import { ZodError } from "zod";
import type { ReadingErrorPayload, ReadingRequestPayload } from "@aethertarot/shared-types";
import { getClientIpHash } from "@/server/beta/ip";
import {
  getReadingProviderName,
  type BetaOpsConfig,
} from "@/server/beta/config";
import {
  E2E_ACCESS_BYPASS_HEADER,
  isE2eAccessBypassEnabled,
  requireBetaTesterAccess,
  type AuthenticatedTester,
} from "@/server/beta/access";
import { consumeReadingQuota } from "@/server/beta/quota";
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

interface ReadingRouteDependencies {
  getIpHash: (request: Request) => string;
  getProviderName: () => string;
  requireAccess: () => Promise<AuthenticatedTester>;
  consumeQuota: (input: {
    tester: AuthenticatedTester;
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
  requireAccess: () => requireBetaTesterAccess(),
  consumeQuota: consumeReadingQuota,
  generateReading: generateStructuredReading,
  collectUsage: collectLlmUsage,
  recordEvent: recordReadingEvent,
};

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
  tester,
  ipHash,
  provider,
  startedAt,
}: {
  parsedPayload: ReadingRequestPayload | null;
  tester: AuthenticatedTester | null;
  ipHash: string;
  provider: string;
  startedAt: number;
}) {
  return {
    userId: tester?.userId ?? null,
    email: tester?.email ?? null,
    ipHash,
    provider,
    phase: parsedPayload?.phase ?? "initial",
    spreadId: parsedPayload?.spreadId ?? null,
    initialReadingId: parsedPayload?.initial_reading?.reading_id ?? null,
    durationMs: Date.now() - startedAt,
  };
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
  let tester: AuthenticatedTester | null = null;

  const recordEvent = async (input: ReadingEventInput) => {
    if (shouldSkipBetaOps) {
      return;
    }

    await deps.recordEvent(input);
  };

  try {
    payload = await request.json();
  } catch {
    await recordEvent({
      ...getEventBase({
        parsedPayload,
        tester,
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
    return buildErrorResponse(
      "invalid_request",
      "请求体不是有效的 JSON。",
      400,
    );
  }

  try {
    parsedPayload = readingRequestPayloadSchema.parse(payload);
    tester = await deps.requireAccess();
    await deps.consumeQuota({ tester, ipHash });
    const { result: reading, calls } = await deps.collectUsage(() =>
      deps.generateReading(parsedPayload as ReadingRequestPayload)
    );
    const usageSummary = summarizeLlmCalls(calls as LlmCallMetric[]);

    await recordEvent({
      ...getEventBase({
        parsedPayload,
        tester,
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
          tester,
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
