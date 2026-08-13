import "server-only";

import {
  ReadingGenerationError,
  ReadingServiceError,
  isReadingGenerationError,
  type ReadingGenerationFailureSubtype,
} from "@/server/reading/errors";
import {
  databaseLlmTokenGate,
  type LlmTokenSource,
  type LlmTokenGate,
} from "@/server/beta/token-budget";
import {
  calculateLlmCostUsd,
  estimateTokenCount,
  recordLlmCall,
} from "@/server/observability/llm-usage";
import {
  getSharedProviderBulkhead,
  type ProviderBulkhead,
} from "@/server/llm/provider-bulkhead";

const MAX_PROVIDER_RESPONSE_BYTES_HARD_LIMIT = 4 * 1024 * 1024;

export interface LlmProviderConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  thinkingMode?: "enabled" | "disabled";
  responseFormat?: "json_object";
  temperature: number;
  timeoutMs: number;
  maxOutputTokens: number;
  maxResponseBytes?: number;
  maxConcurrentRequests?: number;
  maxQueuedRequests?: number;
  queueTimeoutMs?: number;
  bulkheadNamespace?: string;
}

type JsonRecord = Record<string, unknown>;
type FetchImplementation = typeof fetch;

function waitWithSignal<T>(promise: Promise<T>, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

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

function parseBoundedInteger(
  value: string | undefined,
  fallback: number,
  name: string,
  { min, max }: { min: number; max: number },
) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ReadingServiceError(
      "provider_unavailable",
      `${name} 必须是 ${min}-${max} 的整数。`,
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
  const rawThinkingMode = env.AETHERTAROT_LLM_THINKING_MODE?.trim();
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
  const rawResponseFormat = env.AETHERTAROT_LLM_RESPONSE_FORMAT?.trim();
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
    maxResponseBytes: parseBoundedInteger(
      env.AETHERTAROT_LLM_MAX_RESPONSE_BYTES,
      1024 * 1024,
      "AETHERTAROT_LLM_MAX_RESPONSE_BYTES",
      { min: 1024, max: MAX_PROVIDER_RESPONSE_BYTES_HARD_LIMIT },
    ),
    maxConcurrentRequests: parseBoundedInteger(
      env.AETHERTAROT_LLM_MAX_CONCURRENCY,
      4,
      "AETHERTAROT_LLM_MAX_CONCURRENCY",
      { min: 1, max: 64 },
    ),
    maxQueuedRequests: parseBoundedInteger(
      env.AETHERTAROT_LLM_MAX_QUEUE,
      16,
      "AETHERTAROT_LLM_MAX_QUEUE",
      { min: 0, max: 512 },
    ),
    queueTimeoutMs: parseBoundedInteger(
      env.AETHERTAROT_LLM_QUEUE_TIMEOUT_MS,
      15_000,
      "AETHERTAROT_LLM_QUEUE_TIMEOUT_MS",
      { min: 100, max: 120_000 },
    ),
  };
}

async function readWithAbort(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
) {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  return new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    reader.read().then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", abort);
    });
  });
}

async function readBoundedProviderResponse(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
) {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await readWithAbort(reader, signal);
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("provider_response_too_large").catch(() => undefined);
        throw new ReadingGenerationError({
          subtype: "response_too_large",
          message: "llm provider 响应超过允许大小。",
          code: "provider_unavailable",
          status: 503,
          retryable: true,
        });
      }
      chunks.push(value);
    }
  } finally {
    if (signal.aborted) await reader.cancel(signal.reason).catch(() => undefined);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
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
    private readonly bulkhead: ProviderBulkhead = getSharedProviderBulkhead({
      namespace: config.bulkheadNamespace ?? "generation",
      maxConcurrent: config.maxConcurrentRequests ?? 4,
      maxQueued: config.maxQueuedRequests ?? 16,
      queueTimeoutMs: config.queueTimeoutMs ?? 15_000,
    }),
  ) {}

  async request<T>(input: {
    source: LlmTokenSource;
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
      purpose?: "generation" | "safety_input" | "safety_output";
    };
  }): Promise<T> {
    if (input.signal?.aborted) {
      throw new ReadingGenerationError({
        subtype: "cancelled",
        message: "Reading 请求已取消。",
        retryable: false,
      });
    }
    const startedAt = Date.now();
    const abortController = new AbortController();
    let timedOut = false;
    const cancelFromCaller = () => abortController.abort(input.signal?.reason);
    if (input.signal?.aborted) cancelFromCaller();
    else input.signal?.addEventListener("abort", cancelFromCaller, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      abortController.abort(new DOMException("Provider deadline exceeded", "TimeoutError"));
    }, this.config.timeoutMs);
    const cleanupDeadline = () => {
      clearTimeout(timeout);
      input.signal?.removeEventListener("abort", cancelFromCaller);
    };

    let releasePermit: () => void;
    try {
      releasePermit = await this.bulkhead.acquire(abortController.signal);
    } catch (error) {
      cleanupDeadline();
      if (timedOut) {
        throw new ReadingGenerationError({ subtype: "timeout", message: "llm provider 当前不可用，请稍后再试。", retryable: true });
      }
      throw error;
    }
    const promptText = `${input.prompt.system}\n${input.prompt.user}`;
    let reservation;
    const reservationPromise = this.tokenGate.reserve({
      source: input.source,
      promptText,
      maxOutputTokens: input.maxOutputTokens,
    });
    try {
      reservation = await waitWithSignal(reservationPromise, abortController.signal);
    } catch (error) {
      releasePermit();
      cleanupDeadline();
      if (abortController.signal.aborted) {
        void reservationPromise.then((lateReservation) =>
          this.tokenGate.settle({ reservation: lateReservation }).catch(() => undefined)
        ).catch(() => undefined);
        const wasCancelled = input.signal?.aborted && !timedOut;
        throw new ReadingGenerationError({
          subtype: wasCancelled ? "cancelled" : "timeout",
          message: wasCancelled ? "Reading 请求已取消。" : "llm provider 当前不可用，请稍后再试。",
          retryable: !wasCancelled,
        });
      }
      throw error;
    }
    let settled = false;
    const settle = async (actualTokens?: number) => {
      if (settled) return;
      settled = true;
      releasePermit();
      try {
        await waitWithSignal(
          this.tokenGate.settle({ reservation, actualTokens }),
          abortController.signal,
        );
      } catch {
        // Settlement is idempotent server-side; deadline/cancellation must not hold a permit.
      } finally {
        cleanupDeadline();
      }
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
    if (!response.ok) {
      await response.body?.cancel("provider_http_error").catch(() => undefined);
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
      const responseBytes = await readBoundedProviderResponse(
        response,
        Math.min(
          this.config.maxResponseBytes ?? 1024 * 1024,
          MAX_PROVIDER_RESPONSE_BYTES_HARD_LIMIT,
        ),
        abortController.signal,
      );
      payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(responseBytes));
    } catch (error) {
      const wasCancelled = input.signal?.aborted && !timedOut;
      if (
        error instanceof ReadingGenerationError
        && error.subtype === "response_too_large"
      ) {
        record(false, "", error.subtype, response.status, undefined, error.subtype);
        await settle();
        throw error;
      }
      if (wasCancelled || timedOut || (error instanceof Error && error.name === "AbortError")) {
        const subtype = wasCancelled ? "cancelled" : "timeout";
        record(false, "", subtype, response.status, undefined, subtype);
        await settle();
        throw new ReadingGenerationError({
          subtype,
          message: wasCancelled ? "Reading 请求已取消。" : "llm provider 当前不可用，请稍后再试。",
          retryable: !wasCancelled,
        });
      }
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
