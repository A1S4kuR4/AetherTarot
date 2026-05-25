import "server-only";

import type { EncyclopediaQueryResponse } from "@aethertarot/shared-types";
import { isEncyclopediaQueryEnabled } from "@/server/beta/config";
import { ReadingServiceError } from "@/server/reading/errors";
import { resolveLlmProviderConfig } from "@/server/reading/llm-provider";
import {
  databaseLlmTokenGate,
  type LlmTokenGate,
} from "@/server/beta/token-budget";
import {
  calculateLlmCostUsd,
  estimateTokenCount,
  recordLlmCall,
} from "@/server/observability/llm-usage";
import type { EncyclopediaRetrievedSource } from "@/server/encyclopedia/retrieval";

type FetchImplementation = typeof fetch;
type JsonRecord = Record<string, unknown>;

export type EncyclopediaDraft = Pick<
  EncyclopediaQueryResponse,
  "answer" | "related_cards" | "related_concepts" | "related_spreads"
>;

export interface EncyclopediaProvider {
  generateAnswer(input: {
    query: string;
    sources: EncyclopediaRetrievedSource[];
    boundaryNote: string | null;
  }): Promise<EncyclopediaDraft>;
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function extractJsonCandidate(rawText: string) {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  return fenced?.[1]?.trim() ?? trimmed;
}

function parseJsonRecord(rawText: string): JsonRecord {
  const candidate = extractJsonCandidate(rawText);

  try {
    const parsed = JSON.parse(candidate);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JsonRecord;
    }
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");

    if (start >= 0 && end > start) {
      const parsed = JSON.parse(candidate.slice(start, end + 1));

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as JsonRecord;
      }
    }
  }

  throw new ReadingServiceError(
    "generation_failed",
    "百科 provider 返回的内容不是合法 JSON 对象。",
    500,
  );
}

function extractMessageText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new ReadingServiceError(
      "generation_failed",
      "百科 provider 返回了不可解析的响应。",
      500,
    );
  }

  const choices = (payload as { choices?: unknown }).choices;

  if (!Array.isArray(choices) || choices.length === 0) {
    throw new ReadingServiceError(
      "generation_failed",
      "百科 provider 响应缺少 choices。",
      500,
    );
  }

  const content = (choices[0] as { message?: { content?: unknown } })?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  throw new ReadingServiceError(
    "generation_failed",
    "百科 provider 响应缺少可解析的 message.content。",
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

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asNonEmptyString(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 5);
}

function normalizeDraft(payload: unknown): EncyclopediaDraft {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ReadingServiceError(
      "generation_failed",
      "百科 provider 返回的 draft 不是合法对象。",
      500,
    );
  }

  const record = payload as JsonRecord;
  const answer = asNonEmptyString(record.answer);

  if (!answer) {
    throw new ReadingServiceError(
      "generation_failed",
      "百科 provider 返回的 answer 不能为空。",
      500,
    );
  }

  return {
    answer,
    related_cards: normalizeStringArray(record.related_cards),
    related_concepts: normalizeStringArray(record.related_concepts),
    related_spreads: normalizeStringArray(record.related_spreads),
  };
}

function buildPrompt({
  query,
  sources,
  boundaryNote,
}: {
  query: string;
  sources: EncyclopediaRetrievedSource[];
  boundaryNote: string | null;
}) {
  return {
    system: [
      "You are AetherTarot's encyclopedia answer provider.",
      "Answer only as a tarot encyclopedia explainer, not as a reading agent.",
      "Use only the provided wiki sources. Do not draw cards, predict outcomes, infer hidden third-party intent, diagnose, or give medical/legal/financial instructions.",
      "Return JSON only with keys: answer, related_cards, related_concepts, related_spreads.",
      "All user-visible prose must be natural Simplified Chinese.",
    ].join("\n"),
    user: [
      `用户问题：${query}`,
      boundaryNote ? `边界提示：${boundaryNote}` : null,
      "可用百科来源：",
      ...sources.map((source, index) =>
        [
          `Source ${index + 1}: ${source.title}`,
          `path: ${source.path}`,
          `type: ${source.type}`,
          `source_ids: ${source.source_ids.join(", ") || "unknown"}`,
          source.content,
        ].join("\n"),
      ),
      "回答要求：",
      "- 用 2-4 个自然段解释，必须贴合来源内容。",
      "- 不要声称这是一次塔罗解读，不要替用户做现实决定。",
      "- 若用户问题带有预测、依赖、治疗、法律或财务倾向，先解释百科含义，再温和提醒这不能替代现实判断或专业支持。",
      "- related_* 只返回和来源直接相关的标题数组。",
    ].filter(Boolean).join("\n\n"),
  };
}

export class LlmEncyclopediaProvider implements EncyclopediaProvider {
  constructor(
    private readonly config = resolveLlmProviderConfig(),
    private readonly fetchImplementation: FetchImplementation = fetch,
    private readonly tokenGate: LlmTokenGate = databaseLlmTokenGate,
  ) {}

  async generateAnswer(input: {
    query: string;
    sources: EncyclopediaRetrievedSource[];
    boundaryNote: string | null;
  }) {
    const prompt = buildPrompt(input);
    const promptText = `${prompt.system}\n${prompt.user}`;
    const maxOutputTokens = Math.min(this.config.maxOutputTokens, 900);
    const reservation = await this.tokenGate.reserve({
      source: "encyclopedia",
      promptText,
      maxOutputTokens,
    });
    const startedAt = Date.now();
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(
      () => abortController.abort(),
      this.config.timeoutMs,
    );
    let reservationSettled = false;

    const settleReservation = async (actualTokens?: number) => {
      if (reservationSettled) {
        return;
      }

      reservationSettled = true;
      await this.tokenGate.settle({ reservation, actualTokens });
    };

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

      return totalTokens;
    };

    let response: Response;

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
            ...(this.config.thinkingMode
              ? { thinking: { type: this.config.thinkingMode } }
              : {}),
            temperature: this.config.temperature,
            max_tokens: maxOutputTokens,
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
      recordCall({
        success: false,
        errorCode:
          error instanceof Error && error.name === "AbortError"
            ? "timeout"
            : "fetch_failed",
      });
      await settleReservation();
      throw new ReadingServiceError(
        "provider_unavailable",
        "百科 provider 当前不可用，请稍后再试。",
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
      await settleReservation();
      throw new ReadingServiceError(
        "provider_unavailable",
        `百科 provider 请求失败（HTTP ${response.status}）。`,
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
      await settleReservation();
      throw new ReadingServiceError(
        "generation_failed",
        "百科 provider 返回的响应不是合法 JSON。",
        500,
      );
    }

    const usage = extractUsage(payload);
    let messageText = "";

    try {
      messageText = extractMessageText(payload);
      const draft = normalizeDraft(parseJsonRecord(messageText));
      const totalTokens = recordCall({
        success: true,
        httpStatus: response.status,
        outputText: messageText,
        usage,
      });
      await settleReservation(totalTokens);
      return draft;
    } catch (error) {
      const totalTokens = recordCall({
        success: false,
        httpStatus: response.status,
        outputText: messageText,
        errorCode: "invalid_provider_payload",
        usage,
      });
      await settleReservation(usage || messageText ? totalTokens : undefined);
      throw error;
    }
  }
}

export function getEncyclopediaProvider() {
  if (!isEncyclopediaQueryEnabled()) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "百科问答暂未开放。",
      503,
    );
  }

  return new LlmEncyclopediaProvider();
}
