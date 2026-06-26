import { ZodError } from "zod";
import { createHash } from "node:crypto";
import type { ReadingErrorPayload, ReadingRequestPayload } from "@aethertarot/shared-types";
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
import { consumeReadingQuota } from "@/server/beta/quota";
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
  generateReading: typeof generateStructuredReading;
  collectUsage: typeof collectLlmUsage;
  recordEvent: (input: ReadingEventInput) => Promise<void>;
}

const DEFAULT_DEPENDENCIES: ReadingRouteDependencies = {
  getIpHash: getClientIpHash,
  getProviderName: getReadingProviderName,
  requireAccess: () => resolvePublicFeatureActor(),
  consumeQuota: consumeReadingQuota,
  generateReading: generateStructuredReading,
  collectUsage: collectLlmUsage,
  recordEvent: recordReadingEvent,
};
type ReadingGenerationResult = Awaited<ReturnType<typeof collectLlmUsage<Awaited<ReturnType<typeof generateStructuredReading>>>>>;

const inFlightReadingGenerations = new Map<string, Promise<ReadingGenerationResult>>();

function buildErrorResponse(
  code: ReadingErrorPayload["error"]["code"],
  message: string,
  status: number,
  intercept_reason?: string,
  referral_links?: string[],
  details?: Record<string, unknown>,
) {
  const payload: ReadingErrorPayload = {
    error: {
      code,
      message,
      details,
      intercept_reason,
      referral_links,
    },
  };

  return Response.json(payload, { status });
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
    durationMs: Date.now() - startedAt,
  };
}

function buildGenerationKey({
  payload,
  actor,
  ipHash,
}: {
  payload: ReadingRequestPayload;
  actor: PublicFeatureActor;
  ipHash: string;
}) {
  const subject = actor.userId ?? actor.email ?? `anonymous:${ipHash}`;
  const hash = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");

  return `${subject}:${hash}`;
}

async function runSingleFlightGeneration(
  key: string,
  generate: () => Promise<ReadingGenerationResult>,
) {
  const existing = inFlightReadingGenerations.get(key);

  if (existing) {
    return existing;
  }

  const promise = generate().finally(() => {
    inFlightReadingGenerations.delete(key);
  });

  inFlightReadingGenerations.set(key, promise);
  return promise;
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
    await deps.consumeQuota({ actor, ipHash });
    const generationKey = buildGenerationKey({
      payload: parsedPayload,
      actor,
      ipHash,
    });
    const { result: reading, calls } = await runSingleFlightGeneration(
      generationKey,
      () => deps.collectUsage(() => deps.generateReading(parsedPayload as ReadingRequestPayload)),
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

    return Response.json(reading);
  } catch (error) {
    const unwrappedError = unwrapLlmUsageError(error);
    const usageSummary = summarizeLlmCalls(unwrappedError.calls);
    const actualError = unwrappedError.cause;

    const recordFailure = async (
      code: ReadingErrorPayload["error"]["code"],
    ) => {
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
    };

    if (actualError instanceof ZodError) {
      const firstIssue = actualError.issues[0]?.message ?? "请求参数无效。";
      await recordFailure("invalid_request");
      return buildErrorResponse("invalid_request", firstIssue, 400);
    }

    if (isReadingServiceError(actualError)) {
      await recordFailure(actualError.code);
      return buildErrorResponse(
        actualError.code,
        actualError.message,
        actualError.status,
        actualError.intercept_reason,
        actualError.referral_links,
        actualError.details,
      );
    }

    await recordFailure("generation_failed");
    return buildErrorResponse(
      "generation_failed",
      "解读生成失败，请稍后再试。",
      500,
    );
  }
}

export async function POST(request: Request) {
  return handleReadingPost(request);
}
