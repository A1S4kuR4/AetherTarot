import { ZodError } from "zod";
import { createHash } from "node:crypto";
import type {
  ReadingErrorPayload,
  ReadingRequestPayload,
  StructuredReading,
} from "@aethertarot/shared-types";
import { getClientIpHash } from "@/server/beta/ip";
import {
  getReadingProviderName,
  type BetaOpsConfig,
} from "@/server/beta/config";
import {
  E2E_ACCESS_BYPASS_HEADER,
  isE2eAccessBypassEnabled,
  resolvePublicFeatureActor,
  type PublicFeatureActor,
} from "@/server/beta/access";
import { consumeReadingQuota, refundReadingQuota } from "@/server/beta/quota";
import { readBoundedJsonBody } from "@/server/http/json-body";
import { isReadingServiceError } from "@/server/reading/errors";
import { readingRequestPayloadSchema } from "@/server/reading/schemas";
import { generateStructuredReading } from "@/server/reading/service";
import {
  collectLlmUsage,
  summarizeLlmCalls,
  unwrapLlmUsageError,
  type LlmCallMetric,
} from "@/server/observability/llm-usage";
import {
  recordReadingEvent,
  type ReadingEventInput,
} from "@/server/observability/reading-events";

export const runtime = "nodejs";
const MAX_READING_REQUEST_BYTES = 64 * 1024;

interface ReadingRouteDependencies {
  getIpHash: (request: Request) => string;
  getProviderName: () => string;
  requireAccess: () => Promise<PublicFeatureActor>;
  consumeQuota: (input: {
    actor: PublicFeatureActor;
    ipHash: string;
    config?: BetaOpsConfig;
  }) => Promise<void>;
  refundQuota: (input: {
    actor: PublicFeatureActor;
    ipHash: string;
  }) => Promise<void>;
  generateReading: typeof generateStructuredReading;
  collectUsage: typeof collectLlmUsage;
  recordEvent: (input: ReadingEventInput) => Promise<void>;
}

const DEFAULT_DEPENDENCIES: ReadingRouteDependencies = {
  getIpHash: getClientIpHash,
  getProviderName: getReadingProviderName,
  requireAccess: () => resolvePublicFeatureActor(),
  consumeQuota: consumeReadingQuota,
  refundQuota: refundReadingQuota,
  generateReading: generateStructuredReading,
  collectUsage: collectLlmUsage,
  recordEvent: recordReadingEvent,
};
type ReadingResponseSnapshot = {
  payload: StructuredReading | ReadingErrorPayload;
  status: number;
};
type ReadingRequestExecution = {
  payloadHash: string;
  expiresAt: number;
  promise: Promise<ReadingResponseSnapshot>;
};

const readingRequestExecutions = new Map<string, ReadingRequestExecution>();

function buildErrorResponse(
  code: ReadingErrorPayload["error"]["code"],
  message: string,
  status: number,
  intercept_reason?: string,
  referral_links?: string[],
  details?: Record<string, unknown>,
) {
  return Response.json(
    buildErrorPayload(code, message, intercept_reason, referral_links, details),
    { status },
  );
}

function buildErrorPayload(
  code: ReadingErrorPayload["error"]["code"],
  message: string,
  intercept_reason?: string,
  referral_links?: string[],
  details?: Record<string, unknown>,
): ReadingErrorPayload {
  return {
    error: {
      code,
      message,
      details,
      intercept_reason,
      referral_links,
    },
  };
}

function getEventBase({
  parsedPayload,
  actor,
  ipHash,
  provider,
  startedAt,
}: {
  parsedPayload: ReadingRequestPayload | null;
  actor: PublicFeatureActor | null;
  ipHash: string;
  provider: string;
  startedAt: number;
}) {
  return {
    userId: actor?.userId ?? null,
    email: actor?.email ?? null,
    ipHash,
    provider,
    phase: parsedPayload?.phase ?? "initial",
    spreadId: parsedPayload?.spreadId ?? null,
    initialReadingId: parsedPayload?.initial_reading?.reading_id ?? null,
    requestId: parsedPayload?.request_id ?? null,
    durationMs: Date.now() - startedAt,
  };
}

function buildRequestIdentity({
  payload,
  actor,
  ipHash,
}: {
  payload: ReadingRequestPayload;
  actor: PublicFeatureActor;
  ipHash: string;
}) {
  const subject = actor.userId ?? actor.email ?? `anonymous:${ipHash}`;
  const payloadHash = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");

  return {
    key: `${subject}:${payload.request_id}`,
    payloadHash,
  };
}

function getBeijingDayEnd(now = Date.now()) {
  const local = new Date(now + 8 * 60 * 60 * 1000);
  return Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + 1,
  ) - 8 * 60 * 60 * 1000;
}

function removeExpiredReadingRequests(now = Date.now()) {
  for (const [key, execution] of readingRequestExecutions) {
    if (execution.expiresAt <= now) {
      readingRequestExecutions.delete(key);
    }
  }
}

async function runIdempotentReadingRequest({
  key,
  payloadHash,
  execute,
}: {
  key: string;
  payloadHash: string;
  execute: () => Promise<ReadingResponseSnapshot>;
}) {
  removeExpiredReadingRequests();
  const existing = readingRequestExecutions.get(key);

  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      return {
        status: 409,
        payload: buildErrorPayload(
          "invalid_request",
          "request_id 已用于不同的 reading 请求。",
        ),
      } satisfies ReadingResponseSnapshot;
    }

    return existing.promise;
  }

  const execution: ReadingRequestExecution = {
    payloadHash,
    expiresAt: Number.POSITIVE_INFINITY,
    promise: Promise.resolve().then(execute),
  };
  readingRequestExecutions.set(key, execution);
  void execution.promise.then((snapshot) => {
    if (snapshot.status === 200) {
      execution.expiresAt = getBeijingDayEnd();
      return;
    }

    if (readingRequestExecutions.get(key) === execution) {
      readingRequestExecutions.delete(key);
    }
  }, () => {
    if (readingRequestExecutions.get(key) === execution) {
      readingRequestExecutions.delete(key);
    }
  });
  return execution.promise;
}

async function executeReadingRequest({
  deps,
  parsedPayload,
  actor,
  ipHash,
  provider,
  startedAt,
  recordEvent,
}: {
  deps: ReadingRouteDependencies;
  parsedPayload: ReadingRequestPayload;
  actor: PublicFeatureActor;
  ipHash: string;
  provider: string;
  startedAt: number;
  recordEvent: (input: ReadingEventInput) => Promise<void>;
}): Promise<ReadingResponseSnapshot> {
  let quotaConsumed = false;

  try {
    await deps.consumeQuota({ actor, ipHash });
    quotaConsumed = true;
    const { result: reading, calls } = await deps.collectUsage(() =>
      deps.generateReading(parsedPayload)
    );
    const usageSummary = summarizeLlmCalls(calls as LlmCallMetric[]);

    await recordEvent({
      ...getEventBase({
        parsedPayload,
        actor,
        ipHash,
        provider,
        startedAt,
      }),
      readingId: reading.reading_id,
      status: "success",
      errorCode: null,
      llmDurationMs: usageSummary.llmDurationMs,
      promptTokens: usageSummary.promptTokens,
      completionTokens: usageSummary.completionTokens,
      totalTokens: usageSummary.totalTokens,
      estimatedCostUsd: usageSummary.estimatedCostUsd,
      completedInitial: reading.reading_phase === "initial" && !reading.requires_followup,
      completedFinal: reading.reading_phase === "final",
    });

    return { payload: reading, status: 200 };
  } catch (error) {
    const unwrappedError = unwrapLlmUsageError(error);
    const usageSummary = summarizeLlmCalls(unwrappedError.calls);
    const actualError = unwrappedError.cause;

    if (quotaConsumed) {
      try {
        await deps.refundQuota({ actor, ipHash });
      } catch (refundError) {
        console.warn("[quota] failed to refund reading quota", {
          message: refundError instanceof Error ? refundError.message : "unknown error",
        });
      }
    }

    let code: ReadingErrorPayload["error"]["code"] = "generation_failed";
    let message = "解读生成失败，请稍后再试。";
    let status = 500;
    let interceptReason: string | undefined;
    let referralLinks: string[] | undefined;
    let details: Record<string, unknown> | undefined;

    if (actualError instanceof ZodError) {
      code = "invalid_request";
      message = actualError.issues[0]?.message ?? "请求参数无效。";
      status = 400;
    } else if (isReadingServiceError(actualError)) {
      code = actualError.code;
      message = actualError.message;
      status = actualError.status;
      interceptReason = actualError.intercept_reason;
      referralLinks = actualError.referral_links;
      details = actualError.details;
    }

    await recordEvent({
      ...getEventBase({
        parsedPayload,
        actor,
        ipHash,
        provider,
        startedAt,
      }),
      readingId: null,
      status: "failure",
      errorCode: code,
      llmDurationMs: usageSummary.llmDurationMs,
      promptTokens: usageSummary.promptTokens,
      completionTokens: usageSummary.completionTokens,
      totalTokens: usageSummary.totalTokens,
      estimatedCostUsd: usageSummary.estimatedCostUsd,
      completedInitial: false,
      completedFinal: false,
    });

    return {
      payload: buildErrorPayload(
        code,
        message,
        interceptReason,
        referralLinks,
        details,
      ),
      status,
    };
  }
}

export async function handleReadingPost(
  request: Request,
  dependencies: Partial<ReadingRouteDependencies> = {},
) {
  const deps = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  const startedAt = Date.now();
  const ipHash = deps.getIpHash(request);
  const provider = deps.getProviderName();
  const shouldSkipBetaOps = isE2eAccessBypassEnabled(
    request.headers.get(E2E_ACCESS_BYPASS_HEADER),
  );
  let payload: unknown;
  let parsedPayload: ReadingRequestPayload | null = null;
  let actor: PublicFeatureActor | null = null;

  const recordEvent = async (input: ReadingEventInput) => {
    if (shouldSkipBetaOps) {
      return;
    }

    await deps.recordEvent(input);
  };

  try {
    payload = await readBoundedJsonBody(
      request,
      MAX_READING_REQUEST_BYTES,
      "Reading",
    );
  } catch (error) {
    await recordEvent({
      ...getEventBase({
        parsedPayload,
        actor,
        ipHash,
        provider,
        startedAt,
      }),
      readingId: null,
      status: "failure",
      errorCode: "invalid_request",
      llmDurationMs: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      completedInitial: false,
      completedFinal: false,
    });
    if (isReadingServiceError(error)) {
      return buildErrorResponse(error.code, error.message, error.status);
    }

    return buildErrorResponse("invalid_request", "请求体不是有效的 JSON。", 400);
  }

  try {
    parsedPayload = readingRequestPayloadSchema.parse(payload);
    actor = await deps.requireAccess();
  } catch (error) {
    const code = error instanceof ZodError
      ? "invalid_request"
      : isReadingServiceError(error)
        ? error.code
        : "generation_failed";
    const message = error instanceof ZodError
      ? error.issues[0]?.message ?? "请求参数无效。"
      : isReadingServiceError(error)
        ? error.message
        : "解读生成失败，请稍后再试。";
    const status = error instanceof ZodError
      ? 400
      : isReadingServiceError(error)
        ? error.status
        : 500;

    await recordEvent({
      ...getEventBase({ parsedPayload, actor, ipHash, provider, startedAt }),
      readingId: null,
      status: "failure",
      errorCode: code,
      llmDurationMs: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      completedInitial: false,
      completedFinal: false,
    });

    return buildErrorResponse(
      code,
      message,
      status,
      isReadingServiceError(error) ? error.intercept_reason : undefined,
      isReadingServiceError(error) ? error.referral_links : undefined,
      isReadingServiceError(error) ? error.details : undefined,
    );
  }

  const execute = () => executeReadingRequest({
    deps,
    parsedPayload,
    actor,
    ipHash,
    provider,
    startedAt,
    recordEvent,
  });
  const snapshot = parsedPayload.request_id
    ? await runIdempotentReadingRequest({
      ...buildRequestIdentity({ payload: parsedPayload, actor, ipHash }),
      execute,
    })
    : await execute();

  return Response.json(snapshot.payload, { status: snapshot.status });
}

export async function POST(request: Request) {
  return handleReadingPost(request);
}
