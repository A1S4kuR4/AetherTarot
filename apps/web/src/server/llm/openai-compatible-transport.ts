import "server-only";

import { ReadingServiceError } from "@/server/reading/errors";
import {
  databaseLlmTokenGate,
  type LlmTokenGate,
} from "@/server/beta/token-budget";
import {
  calculateLlmCostUsd,
  estimateTokenCount,
  recordLlmCall,
} from "@/server/observability/llm-usage";

export interface LlmProviderConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  thinkingMode?: "enabled" | "disabled";
  responseFormat?: "json_object";
  temperature: number;
  timeoutMs: number;
  maxOutputTokens: number;
}

type JsonRecord = Record<string, unknown>;
type FetchImplementation = typeof fetch;

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveEnvReference(
  value: string | null,
  env: Partial<NodeJS.ProcessEnv>,
) {
  if (!value) return null;
  const reference = value.match(/^\$([A-Z0-9_]+)$|^\$\{([A-Z0-9_]+)\}$/);
  return reference
    ? asNonEmptyString(env[reference[1] ?? reference[2]])
    : value;
}

function parseNumber(
  value: string | undefined,
  fallback: number,
  name: string,
  integer = false,
) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (
    !Number.isFinite(parsed)
    || (integer && !Number.isInteger(parsed))
    || parsed <= 0
  ) {
    throw new ReadingServiceError(
      "provider_unavailable",
      `${name} 必须是大于 0 的${integer ? "整数" : "合法数字"}。`,
      503,
    );
  }
  return parsed;
}

export function resolveLlmProviderConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env,
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
  const rawThinkingMode = env.AETHERTAROT_LLM_THINKING_MODE;
  if (
    rawThinkingMode
    && rawThinkingMode !== "enabled"
    && rawThinkingMode !== "disabled"
  ) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "AETHERTAROT_LLM_THINKING_MODE 必须是 enabled 或 disabled。",
      503,
    );
  }
  const rawResponseFormat = env.AETHERTAROT_LLM_RESPONSE_FORMAT;
  if (rawResponseFormat && rawResponseFormat !== "json_object") {
    throw new ReadingServiceError(
      "provider_unavailable",
      "AETHERTAROT_LLM_RESPONSE_FORMAT 必须是 json_object。",
      503,
    );
  }
  const thinkingMode: LlmProviderConfig["thinkingMode"] =
    rawThinkingMode === "enabled" || rawThinkingMode === "disabled"
      ? rawThinkingMode
      : undefined;
  const responseFormat: LlmProviderConfig["responseFormat"] =
    rawResponseFormat === "json_object" ? rawResponseFormat : undefined;
  const temperature = env.AETHERTAROT_LLM_TEMPERATURE
    ? Number(env.AETHERTAROT_LLM_TEMPERATURE)
    : 0.3;
  if (!Number.isFinite(temperature)) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "AETHERTAROT_LLM_TEMPERATURE 必须是合法数字。",
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
    thinkingMode,
    responseFormat,
    temperature,
    timeoutMs: parseNumber(
      env.AETHERTAROT_LLM_TIMEOUT_MS,
      120_000,
      "AETHERTAROT_LLM_TIMEOUT_MS",
    ),
    maxOutputTokens: parseNumber(
      env.AETHERTAROT_LLM_MAX_OUTPUT_TOKENS,
      3_200,
      "AETHERTAROT_LLM_MAX_OUTPUT_TOKENS",
      true,
    ),
  };
}

export function parseOpenAiJsonObject(rawText: string): JsonRecord {
  const trimmed = rawText.trim();
  const candidate =
    trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]?.trim()
    ?? trimmed;
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
    "llm provider 返回的内容不是合法 JSON 对象。",
    500,
  );
}

function extractMessageText(payload: unknown) {
  const choices = (payload as { choices?: unknown } | null)?.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new ReadingServiceError(
      "generation_failed",
      "llm provider 响应缺少 choices。",
      500,
    );
  }
  const content = (choices[0] as { message?: { content?: unknown } }).message
    ?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const joined = content.map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        return typeof part.text === "string" ? part.text : "";
      }
      return "";
    }).join("");
    if (joined.trim()) return joined;
  }
  throw new ReadingServiceError(
    "generation_failed",
    "llm provider 响应缺少可解析的 message.content。",
    500,
  );
}

function extractUsage(payload: unknown) {
  const usage = (payload as { usage?: unknown } | null)?.usage;
  if (!usage || typeof usage !== "object") return null;
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

export class OpenAiCompatibleTransport {
  constructor(
    private readonly config: LlmProviderConfig,
    private readonly fetchImplementation: FetchImplementation = fetch,
    private readonly tokenGate: LlmTokenGate = databaseLlmTokenGate,
  ) {}

  async request<T>(input: {
    source: "reading" | "encyclopedia";
    prompt: { system: string; user: string };
    maxOutputTokens: number;
    parse: (payload: JsonRecord) => T;
    truncatedMessage: string;
  }): Promise<T> {
    const promptText = `${input.prompt.system}\n${input.prompt.user}`;
    const reservation = await this.tokenGate.reserve({
      source: input.source,
      promptText,
      maxOutputTokens: input.maxOutputTokens,
    });
    const startedAt = Date.now();
    let settled = false;
    const settle = async (actualTokens?: number) => {
      if (settled) return;
      settled = true;
      await this.tokenGate.settle({ reservation, actualTokens });
    };
    const record = (
      success: boolean,
      outputText = "",
      errorCode?: string,
      httpStatus?: number,
      usage?: ReturnType<typeof extractUsage>,
    ) => {
      const promptTokens = usage?.promptTokens ?? estimateTokenCount(promptText);
      const completionTokens =
        usage?.completionTokens ?? estimateTokenCount(outputText);
      const totalTokens =
        usage?.totalTokens ?? promptTokens + completionTokens;
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

    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      this.config.timeoutMs,
    );
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
            ...(this.config.responseFormat
              ? { response_format: { type: this.config.responseFormat } }
              : {}),
            temperature: this.config.temperature,
            max_tokens: input.maxOutputTokens,
            stream: false,
            messages: [
              { role: "system", content: input.prompt.system },
              { role: "user", content: input.prompt.user },
            ],
          }),
          signal: abortController.signal,
        },
      );
    } catch (error) {
      clearTimeout(timeout);
      const code =
        error instanceof Error && error.name === "AbortError"
          ? "timeout"
          : "fetch_failed";
      record(false, "", code);
      await settle();
      throw new ReadingServiceError(
        "provider_unavailable",
        "llm provider 当前不可用，请稍后再试。",
        503,
      );
    }
    clearTimeout(timeout);

    if (!response.ok) {
      record(false, "", `http_${response.status}`, response.status);
      await settle();
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
      record(false, "", "invalid_json", response.status);
      await settle();
      throw new ReadingServiceError(
        "generation_failed",
        "llm provider 返回的响应不是合法 JSON。",
        500,
      );
    }

    const usage = extractUsage(payload);
    let messageText = "";
    const finishReason = Array.isArray(
      (payload as { choices?: unknown }).choices,
    )
      ? (
        (payload as { choices: Array<{ finish_reason?: unknown }> }).choices[0]
          ?.finish_reason
      )
      : null;
    if (finishReason === "length") {
      try {
        messageText = extractMessageText(payload);
      } catch {
        // finish_reason remains authoritative.
      }
      const total = record(
        false,
        messageText,
        "output_truncated",
        response.status,
        usage,
      );
      await settle(usage || messageText ? total : undefined);
      throw new ReadingServiceError(
        "generation_failed",
        input.truncatedMessage,
        500,
      );
    }

    try {
      messageText = extractMessageText(payload);
      const result = input.parse(parseOpenAiJsonObject(messageText));
      const total = record(true, messageText, undefined, response.status, usage);
      await settle(total);
      return result;
    } catch (error) {
      const total = record(
        false,
        messageText,
        "invalid_provider_payload",
        response.status,
        usage,
      );
      await settle(usage || messageText ? total : undefined);
      throw error;
    }
  }
}
