import "server-only";

import {
  buildFinalReadingPrompt,
  buildInitialReadingPrompt,
} from "@aethertarot/prompting";
import type {
  AgentProfile,
  ReadingCardResult,
  ReadingPhase,
} from "@aethertarot/shared-types";
import { ReadingServiceError } from "@/server/reading/errors";
import {
  calculateLlmCostUsd,
  estimateTokenCount,
  recordLlmCall,
} from "@/server/observability/llm-usage";
import type {
  FinalReadingContext,
  HydratedReadingContext,
  ReadingDraft,
  ReadingProvider,
} from "@/server/reading/types";

interface LlmProviderConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  temperature: number;
  timeoutMs: number;
  maxOutputTokens: number;
}

type FetchImplementation = typeof fetch;

type JsonRecord = Record<string, unknown>;

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function resolveEnvReference(value: string | null, env: NodeJS.ProcessEnv) {
  if (!value) {
    return null;
  }

  const reference = value.match(/^\$([A-Z0-9_]+)$|^\$\{([A-Z0-9_]+)\}$/);

  if (!reference) {
    return value;
  }

  return asNonEmptyString(env[reference[1] ?? reference[2]]);
}

function collectInterpretationText(value: unknown): string[] {
  if (typeof value === "string") {
    const normalized = asNonEmptyString(value);
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectInterpretationText(item));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.values(value as JsonRecord).flatMap((item) =>
    collectInterpretationText(item),
  );
}

function normalizeCardInterpretation(record: JsonRecord) {
  const direct = asNonEmptyString(record.interpretation);

  if (direct) {
    return direct;
  }

  const aliases = [
    record.interpretation,
    record.card_interpretation,
    record.cardInterpretation,
    record.meaning,
    record.reading,
    record.analysis,
    record.explanation,
  ];

  for (const value of aliases) {
    const joined = collectInterpretationText(value).join(" ").trim();

    if (joined) {
      return joined;
    }
  }

  return null;
}

function parseTemperature(value: string | undefined) {
  if (!value) {
    return 0.3;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "AETHERTAROT_LLM_TEMPERATURE 必须是合法数字。",
      503,
    );
  }

  return parsed;
}

function parseTimeoutMs(value: string | undefined) {
  if (!value) {
    return 120_000;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "AETHERTAROT_LLM_TIMEOUT_MS 必须是大于 0 的合法数字。",
      503,
    );
  }

  return parsed;
}

function parseMaxOutputTokens(value: string | undefined) {
  if (!value) {
    return 1800;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "AETHERTAROT_LLM_MAX_OUTPUT_TOKENS 必须是大于 0 的整数。",
      503,
    );
  }

  return parsed;
}

export function resolveLlmProviderConfig(
  env: NodeJS.ProcessEnv = process.env,
): LlmProviderConfig {
  const baseUrl = asNonEmptyString(env.AETHERTAROT_LLM_BASE_URL);
  const model = asNonEmptyString(env.AETHERTAROT_LLM_MODEL);

  if (!baseUrl || !model) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "llm provider 需要配置 AETHERTAROT_LLM_BASE_URL 和 AETHERTAROT_LLM_MODEL。",
      503,
    );
  }

  return {
    apiKey:
      resolveEnvReference(
        asNonEmptyString(env.AETHERTAROT_LLM_API_KEY),
        env,
      ) ?? undefined,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    model,
    temperature: parseTemperature(env.AETHERTAROT_LLM_TEMPERATURE),
    timeoutMs: parseTimeoutMs(env.AETHERTAROT_LLM_TIMEOUT_MS),
    maxOutputTokens: parseMaxOutputTokens(env.AETHERTAROT_LLM_MAX_OUTPUT_TOKENS),
  };
}

function buildAuthorityCards(context: HydratedReadingContext): ReadingCardResult[] {
  return context.drawnCards.map((drawnCard) => {
    const position = context.spread.positions.find(
      (item) => item.id === drawnCard.positionId,
    );

    return {
      card_id: drawnCard.card.id,
      name: drawnCard.card.name,
      english_name: drawnCard.card.englishName,
      orientation: drawnCard.isReversed ? "reversed" : "upright",
      position_id: drawnCard.positionId,
      position: position?.name ?? "未知位置",
      position_meaning:
        position?.description ?? "这个位置提醒你留意问题的关键层面。",
      interpretation: "",
    };
  });
}

function extractJsonCandidate(rawText: string) {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  return trimmed;
}

function parseJsonRecord(rawText: string): JsonRecord {
  const candidate = extractJsonCandidate(rawText);

  try {
    const parsed = JSON.parse(candidate);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not-object");
    }

    return parsed as JsonRecord;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");

    if (start >= 0 && end > start) {
      const sliced = candidate.slice(start, end + 1);
      const parsed = JSON.parse(sliced);

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as JsonRecord;
      }
    }

    throw new ReadingServiceError(
      "generation_failed",
      "llm provider 返回的内容不是合法 JSON 对象。",
      500,
    );
  }
}

function extractMessageText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new ReadingServiceError(
      "generation_failed",
      "llm provider 返回了不可解析的响应。",
      500,
    );
  }

  const choices = (payload as { choices?: unknown }).choices;

  if (!Array.isArray(choices) || choices.length === 0) {
    throw new ReadingServiceError(
      "generation_failed",
      "llm provider 响应缺少 choices。",
      500,
    );
  }

  const content = (choices[0] as { message?: { content?: unknown } })?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const joined = content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object" && "text" in item) {
          return typeof item.text === "string" ? item.text : "";
        }

        return "";
      })
      .join("");

    if (joined.trim()) {
      return joined;
    }
  }

  throw new ReadingServiceError(
    "generation_failed",
    "llm provider 响应缺少可解析的 message.content。",
    500,
  );
}

function extractUsage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const usage = (payload as { usage?: unknown }).usage;

  if (!usage || typeof usage !== "object") {
    return null;
  }

  const record = usage as Record<string, unknown>;
  const promptTokens = Number(record.prompt_tokens);
  const completionTokens = Number(record.completion_tokens);
  const totalTokens = Number(record.total_tokens);

  if (!Number.isFinite(promptTokens) || !Number.isFinite(completionTokens)) {
    return null;
  }

  return {
    promptTokens: Math.max(0, Math.round(promptTokens)),
    completionTokens: Math.max(0, Math.round(completionTokens)),
    totalTokens: Number.isFinite(totalTokens)
      ? Math.max(0, Math.round(totalTokens))
      : Math.max(0, Math.round(promptTokens + completionTokens)),
  };
}

function normalizeStringArray({
  value,
  field,
  min,
  max,
}: {
  value: unknown;
  field: string;
  min: number;
  max: number;
}) {
  if (!Array.isArray(value)) {
    throw new ReadingServiceError(
      "generation_failed",
      `llm provider 返回的 ${field} 必须是数组。`,
      500,
    );
  }

  const seen = new Set<string>();
  const normalized = value
    .map((item) => asNonEmptyString(item))
    .filter((item): item is string => Boolean(item))
    .filter((item) => {
      if (seen.has(item)) {
        return false;
      }

      seen.add(item);
      return true;
    })
    .slice(0, max);

  if (normalized.length < min) {
    throw new ReadingServiceError(
      "generation_failed",
      `llm provider 返回的 ${field} 数量不足。`,
      500,
    );
  }

  return normalized;
}

function normalizeCards({
  value,
  authorityCards,
}: {
  value: unknown;
  authorityCards: ReadingCardResult[];
}) {
  if (!Array.isArray(value)) {
    throw new ReadingServiceError(
      "generation_failed",
      "llm provider 返回的 cards 必须是数组。",
      500,
    );
  }

  if (value.length !== authorityCards.length) {
    throw new ReadingServiceError(
      "generation_failed",
      "llm provider 返回的 cards 数量必须与 authority cards 一致。",
      500,
    );
  }

  return authorityCards.map((authorityCard, index) => {
    const rawCard = value[index];

    if (!rawCard || typeof rawCard !== "object" || Array.isArray(rawCard)) {
      throw new ReadingServiceError(
        "generation_failed",
        "llm provider 返回的某张 card 不是合法对象。",
        500,
      );
    }

    const record = rawCard as JsonRecord;
    const interpretation = normalizeCardInterpretation(record);
    const rawCardId = asNonEmptyString(record.card_id);
    const rawPositionId = asNonEmptyString(record.position_id);
    const rawOrientation = asNonEmptyString(record.orientation);

    if (!interpretation) {
      throw new ReadingServiceError(
        "generation_failed",
        "llm provider 返回的 card interpretation 不能为空。",
        500,
      );
    }

    if (rawCardId && rawCardId !== authorityCard.card_id) {
      throw new ReadingServiceError(
        "generation_failed",
        "llm provider 返回的 card_id 与 authority cards 不一致。",
        500,
      );
    }

    if (rawPositionId && rawPositionId !== authorityCard.position_id) {
      throw new ReadingServiceError(
        "generation_failed",
        "llm provider 返回的 position_id 与 authority cards 不一致。",
        500,
      );
    }

    if (
      rawOrientation
      && rawOrientation !== "upright"
      && rawOrientation !== "reversed"
    ) {
      throw new ReadingServiceError(
        "generation_failed",
        "llm provider 返回的 orientation 不是合法值。",
        500,
      );
    }

    if (rawOrientation && rawOrientation !== authorityCard.orientation) {
      throw new ReadingServiceError(
        "generation_failed",
        "llm provider 返回的 orientation 与 authority cards 不一致。",
        500,
      );
    }

    return {
      card_id: authorityCard.card_id,
      name: authorityCard.name,
      english_name: authorityCard.english_name,
      orientation: authorityCard.orientation,
      position_id: authorityCard.position_id,
      position: authorityCard.position,
      position_meaning: authorityCard.position_meaning,
      interpretation,
    } satisfies ReadingCardResult;
  });
}

function getFollowupBounds(
  phase: ReadingPhase,
  agentProfile: AgentProfile,
) {
  if (phase === "final") {
    return { min: 0, max: 1 };
  }

  if (agentProfile === "lite") {
    return { min: 0, max: 1 };
  }

  return { min: 1, max: 2 };
}

export function normalizeReadingDraft({
  payload,
  context,
  phase,
}: {
  payload: unknown;
  context: HydratedReadingContext;
  phase: ReadingPhase;
}): ReadingDraft {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ReadingServiceError(
      "generation_failed",
      "llm provider 返回的 draft 不是合法对象。",
      500,
    );
  }

  const record = payload as JsonRecord;
  const followupBounds = getFollowupBounds(phase, context.agentProfile);
  const authorityCards = buildAuthorityCards(context);
  const confidenceNote = asNonEmptyString(record.confidence_note);

  if (!confidenceNote) {
    throw new ReadingServiceError(
      "generation_failed",
      "llm provider 返回的 confidence_note 不能为空。",
      500,
    );
  }

  return {
    cards: normalizeCards({ value: record.cards, authorityCards }),
    themes: normalizeStringArray({
      value: record.themes,
      field: "themes",
      min: 2,
      max: 4,
    }),
    synthesis: asNonEmptyString(record.synthesis)
      ?? (() => {
        throw new ReadingServiceError(
          "generation_failed",
          "llm provider 返回的 synthesis 不能为空。",
          500,
        );
      })(),
    reflective_guidance: normalizeStringArray({
      value: record.reflective_guidance,
      field: "reflective_guidance",
      min: 2,
      max: 4,
    }),
    follow_up_questions: normalizeStringArray({
      value: record.follow_up_questions ?? [],
      field: "follow_up_questions",
      min: followupBounds.min,
      max: followupBounds.max,
    }),
    confidence_note: confidenceNote,
  };
}

export class LlmReadingProvider implements ReadingProvider {
  constructor(
    private readonly config: LlmProviderConfig,
    private readonly fetchImplementation: FetchImplementation = fetch,
  ) {}

  private async requestDraft(prompt: { system: string; user: string }) {
    let response: Response;
    const startedAt = Date.now();
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(
      () => abortController.abort(),
      this.config.timeoutMs,
    );
    const promptText = `${prompt.system}\n${prompt.user}`;

    const recordCall = ({
      success,
      httpStatus,
      outputText = "",
      errorCode,
      usage,
    }: {
      success: boolean;
      httpStatus?: number;
      outputText?: string;
      errorCode?: string;
      usage?: ReturnType<typeof extractUsage> | null;
    }) => {
      const promptTokens = usage?.promptTokens ?? estimateTokenCount(promptText);
      const completionTokens = usage?.completionTokens ?? estimateTokenCount(outputText);
      const totalTokens = usage?.totalTokens ?? promptTokens + completionTokens;

      recordLlmCall({
        provider: "llm",
        model: this.config.model,
        success,
        durationMs: Date.now() - startedAt,
        httpStatus,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd: calculateLlmCostUsd({
          promptTokens,
          completionTokens,
        }),
        errorCode,
      });
    };

    try {
      response = await this.fetchImplementation(
        `${this.config.baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.config.apiKey
              ? { Authorization: `Bearer ${this.config.apiKey}` }
              : {}),
          },
          body: JSON.stringify({
            model: this.config.model,
            temperature: this.config.temperature,
            max_tokens: this.config.maxOutputTokens,
            stream: false,
            messages: [
              { role: "system", content: prompt.system },
              { role: "user", content: prompt.user },
            ],
          }),
          signal: abortController.signal,
        },
      );
    } catch (error) {
      clearTimeout(timeoutHandle);

      if (error instanceof Error && error.name === "AbortError") {
        recordCall({ success: false, errorCode: "timeout" });
        throw new ReadingServiceError(
          "provider_unavailable",
          "llm provider 请求超时，请稍后再试。",
          503,
        );
      }

      recordCall({ success: false, errorCode: "fetch_failed" });
      throw new ReadingServiceError(
        "provider_unavailable",
        "llm provider 当前不可用，请检查本地 API 是否已启动。",
        503,
      );
    }

    clearTimeout(timeoutHandle);

    if (!response.ok) {
      recordCall({
        success: false,
        httpStatus: response.status,
        errorCode: `http_${response.status}`,
      });
      throw new ReadingServiceError(
        "provider_unavailable",
        `llm provider 请求失败（HTTP ${response.status}）。`,
        503,
      );
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      recordCall({
        success: false,
        httpStatus: response.status,
        errorCode: "invalid_json",
      });
      throw new ReadingServiceError(
        "generation_failed",
        "llm provider 返回的响应不是合法 JSON。",
        500,
      );
    }

    const usage = extractUsage(payload);
    let messageText = "";

    try {
      messageText = extractMessageText(payload);
      const parsed = parseJsonRecord(messageText);
      recordCall({
        success: true,
        httpStatus: response.status,
        outputText: messageText,
        usage,
      });
      return parsed;
    } catch (error) {
      recordCall({
        success: false,
        httpStatus: response.status,
        outputText: messageText,
        errorCode: "invalid_provider_payload",
        usage,
      });
      throw error;
    }
  }

  async generateInitialRead(context: HydratedReadingContext) {
    const payload = await this.requestDraft(buildInitialReadingPrompt(context));

    return normalizeReadingDraft({
      payload,
      context,
      phase: "initial",
    });
  }

  async generateFinalRead(context: FinalReadingContext) {
    const payload = await this.requestDraft(buildFinalReadingPrompt(context));

    return normalizeReadingDraft({
      payload,
      context,
      phase: "final",
    });
  }
}

export function createLlmReadingProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  fetchImplementation: FetchImplementation = fetch,
) {
  return new LlmReadingProvider(
    resolveLlmProviderConfig(env),
    fetchImplementation,
  );
}
