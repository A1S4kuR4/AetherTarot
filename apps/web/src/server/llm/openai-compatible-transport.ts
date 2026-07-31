import "server-only";

import {
  ReadingGenerationError,
  ReadingServiceError,
  isReadingGenerationError,
  type ReadingGenerationFailureSubtype,
} from "@/server/reading/errors";
import { recordLlmRawCompletion } from "@/server/observability/llm-raw-completions";
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

  if (!candidate) {
    throw new ReadingGenerationError({
      subtype: "empty_completion",
      message: "llm provider 返回了空 completion。",
      retryable: true,
      invalidPayload: rawText,
    });
  }

  const asObject = (value: unknown) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as JsonRecord;
    }
    return null;
  };

  try {
    const parsed = asObject(JSON.parse(candidate));
    if (parsed) {
      return parsed;
    }
  } catch {
    // A balanced object embedded in explanatory text is handled below.
  }

  if (candidate.startsWith("[") && candidate.endsWith("]")) {
    throw new ReadingGenerationError({
      subtype: "malformed_json",
      message: "llm provider 返回的内容必须是 JSON 对象，不能是数组。",
      retryable: true,
      invalidPayload: rawText,
    });
  }

  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < candidate.length; index += 1) {
    const character = candidate[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "\"") {
        inString = false;
      }
      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (character === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(candidate.slice(start, index + 1));
        start = -1;
      }
    }
  }

  if (objects.length === 1) {
    try {
      const parsed = asObject(JSON.parse(objects[0]));
      if (parsed) {
        return parsed;
      }
    } catch {
      // Fall through to the classified error below.
    }
  }

  throw new ReadingGenerationError({
    subtype: "malformed_json",
    message: "llm provider 返回的内容不是合法 JSON 对象。",
    retryable: true,
    invalidPayload: rawText,
  });
}

function extractMessageText(payload: unknown) {
  const choices = (payload as { choices?: unknown } | null)?.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new ReadingGenerationError({
      subtype: "empty_completion",
      message: "llm provider 响应缺少 choices。",
      retryable: true,
    });
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
  throw new ReadingGenerationError({
    subtype: "empty_completion",
    message: "llm provider 响应缺少可解析的 message.content。",
    retryable: true,
  });
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
    signal?: AbortSignal;
    metric?: {
      runId?: string;
      stageId?: string;
      attemptId?: string;
      stage?: string;
      attempt?: number;
      kind?: "generate" | "retry" | "repair";
    };
  }): Promise<T> {
    if (input.signal?.aborted) {
      throw new ReadingGenerationError({
        subtype: "cancelled",
        message: "Reading 请求已取消。",
        retryable: false,
      });
    }
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
      subtype?: ReadingGenerationFailureSubtype,
      httpStatus?: number,
      usage?: ReturnType<typeof extractUsage>,
      errorCode?: string,
    ) => {
      const promptTokens = usage?.promptTokens ?? estimateTokenCount(promptText);
      const completionTokens =
        usage?.completionTokens ?? estimateTokenCount(outputText);
      const totalTokens =
        usage?.totalTokens ?? promptTokens + completionTokens;
      recordLlmCall({
        provider: "llm",
        model: this.config.model,
        ...input.metric,
        subtype,
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
    let timedOut = false;
    const cancelFromCaller = () => abortController.abort(input.signal?.reason);
    if (input.signal?.aborted) {
      cancelFromCaller();
    } else {
      input.signal?.addEventListener("abort", cancelFromCaller, { once: true });
    }
    const timeout = setTimeout(
      () => {
        timedOut = true;
        abortController.abort();
      },
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
      input.signal?.removeEventListener("abort", cancelFromCaller);
      const wasCancelled = input.signal?.aborted && !timedOut;
      const code = wasCancelled
        ? "cancelled"
        : timedOut || (error instanceof Error && error.name === "AbortError")
          ? "timeout"
          : "transport_error";
      record(false, "", code);
      await settle();
      throw new ReadingGenerationError({
        subtype: code,
        message: wasCancelled
          ? "Reading 请求已取消。"
          : "llm provider 当前不可用，请稍后再试。",
        retryable: !wasCancelled,
      });
    }
    clearTimeout(timeout);
    input.signal?.removeEventListener("abort", cancelFromCaller);

    if (!response.ok) {
      record(
        false,
        "",
        "provider_http_error",
        response.status,
        undefined,
        `http_${response.status}`,
      );
      await settle();
      throw new ReadingGenerationError({
        subtype: "provider_http_error",
        message: `llm provider 请求失败（HTTP ${response.status}）。`,
        retryable: response.status === 429 || response.status >= 500,
        httpStatus: response.status,
      });
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      record(
        false,
        "",
        "malformed_json",
        response.status,
        undefined,
        "invalid_json",
      );
      await settle();
      throw new ReadingGenerationError({
        subtype: "malformed_json",
        message: "llm provider 返回的响应不是合法 JSON。",
        retryable: true,
      });
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
      if (messageText) {
        recordLlmRawCompletion({
          run_id: input.metric?.runId,
          stage_id: input.metric?.stageId,
          attempt_id: input.metric?.attemptId,
          stage: input.metric?.stage,
          attempt: input.metric?.attempt,
          kind: input.metric?.kind,
          text: messageText,
        });
      }
      const total = record(
        false,
        messageText,
        "truncated_output",
        response.status,
        usage,
        "output_truncated",
      );
      await settle(usage || messageText ? total : undefined);
      throw new ReadingGenerationError({
        subtype: "truncated_output",
        message: input.truncatedMessage,
        retryable: true,
        invalidPayload: messageText,
      });
    }

    let result: T;
    let parsedMessage: JsonRecord | undefined;
    try {
      messageText = extractMessageText(payload);
      recordLlmRawCompletion({
        run_id: input.metric?.runId,
        stage_id: input.metric?.stageId,
        attempt_id: input.metric?.attemptId,
        stage: input.metric?.stage,
        attempt: input.metric?.attempt,
        kind: input.metric?.kind,
        text: messageText,
      });
      parsedMessage = parseOpenAiJsonObject(messageText);
      result = input.parse(parsedMessage);
    } catch (error) {
      if (parsedMessage && isReadingGenerationError(error)) {
        error.invalidPayload = parsedMessage;
      }
      const subtype = isReadingGenerationError(error)
        ? error.subtype
        : "schema_violation";
      const total = record(
        false,
        messageText,
        subtype,
        response.status,
        usage,
        subtype,
      );
      await settle(usage || messageText ? total : undefined);
      throw error;
    }
    const total = record(true, messageText, undefined, response.status, usage);
    await settle(total);
    return result;
  }
}
