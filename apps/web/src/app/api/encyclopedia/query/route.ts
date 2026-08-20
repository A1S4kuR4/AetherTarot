import { ZodError } from "zod";
import type {
  EncyclopediaQueryRequest,
  ReadingErrorPayload,
} from "@aethertarot/shared-types";
import {
  E2E_ACCESS_BYPASS_HEADER,
  isE2eAccessBypassEnabled,
  resolvePublicFeatureActor,
  type PublicFeatureActor,
} from "@/server/beta/access";
import { isEncyclopediaQueryEnabled } from "@/server/beta/config";
import { getClientIpHash } from "@/server/beta/ip";
import { consumeEncyclopediaQuota } from "@/server/beta/quota";
import {
  INVALID_JSON_BODY_MESSAGE,
  readBoundedJsonBody,
} from "@/server/http/json-body";
import { generateEncyclopediaAnswer } from "@/server/encyclopedia/service";
import { encyclopediaQueryRequestSchema } from "@/server/encyclopedia/schemas";
import {
  isReadingServiceError,
  ReadingServiceError,
} from "@/server/reading/errors";
import {
  collectLlmUsage,
  summarizeLlmCalls,
  unwrapLlmUsageError,
  type LlmCallMetric,
} from "@/server/observability/llm-usage";
import {
  recordEncyclopediaEvent,
  type EncyclopediaEventInput,
} from "@/server/observability/encyclopedia-events";
import {
  assertSafetyAllowsGeneration,
  assessSafetyText,
} from "@/server/safety/policy";
import {
  defaultLLMSafetyReviewer,
  mergeInputSafetyAssessment,
  type SafetyReviewer,
} from "@/server/safety/llm-reviewer";

export const runtime = "nodejs";
const MAX_ENCYCLOPEDIA_REQUEST_BYTES = 8 * 1024;

interface EncyclopediaRouteDependencies {
  isQueryEnabled: () => boolean;
  getIpHash: (request: Request) => string;
  requireAccess: () => Promise<PublicFeatureActor>;
  consumeQuota: (input: {
    actor: PublicFeatureActor;
    ipHash: string;
  }) => Promise<void>;
  generateAnswer: typeof generateEncyclopediaAnswer;
  collectUsage: typeof collectLlmUsage;
  recordEvent: (input: EncyclopediaEventInput) => Promise<void>;
  safetyReviewer: SafetyReviewer;
}

const DEFAULT_DEPENDENCIES: EncyclopediaRouteDependencies = {
  isQueryEnabled: isEncyclopediaQueryEnabled,
  getIpHash: getClientIpHash,
  requireAccess: () => resolvePublicFeatureActor(),
  consumeQuota: consumeEncyclopediaQuota,
  generateAnswer: generateEncyclopediaAnswer,
  collectUsage: collectLlmUsage,
  recordEvent: recordEncyclopediaEvent,
  safetyReviewer: defaultLLMSafetyReviewer,
};

function buildErrorResponse(
  code: ReadingErrorPayload["error"]["code"],
  message: string,
  status: number,
  details?: Record<string, unknown>,
  interceptReason?: string,
  referralLinks?: string[],
) {
  const payload: ReadingErrorPayload = {
    error: {
      code,
      message,
      details,
      intercept_reason: interceptReason,
      referral_links: referralLinks,
    },
  };

  const retryAfter = details?.retry_after_seconds;
  return Response.json(payload, {
    status,
    headers: typeof retryAfter === "number" && Number.isFinite(retryAfter)
      ? { "Retry-After": String(Math.max(1, Math.ceil(retryAfter))) }
      : undefined,
  });
}

function getEventBase({
  parsedPayload,
  actor,
  ipHash,
  startedAt,
}: {
  parsedPayload: EncyclopediaQueryRequest | null;
  actor: PublicFeatureActor | null;
  ipHash: string;
  startedAt: number;
}) {
  return {
    userId: actor?.userId ?? null,
    email: actor?.email ?? null,
    ipHash,
    provider: "encyclopedia-llm",
    cardId: parsedPayload?.cardId ?? null,
    durationMs: Date.now() - startedAt,
  };
}

export async function handleEncyclopediaQueryPost(
  request: Request,
  dependencies: Partial<EncyclopediaRouteDependencies> = {},
) {
  const deps = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  const startedAt = Date.now();
  const ipHash = deps.getIpHash(request);
  const shouldSkipBetaOps = isE2eAccessBypassEnabled(
    request.headers.get(E2E_ACCESS_BYPASS_HEADER),
  );
  let payload: unknown;
  let parsedPayload: EncyclopediaQueryRequest | null = null;
  let actor: PublicFeatureActor | null = null;

  const recordEvent = async (input: EncyclopediaEventInput) => {
    if (shouldSkipBetaOps) {
      return;
    }

    await deps.recordEvent(input);
  };

  try {
    payload = await readBoundedJsonBody(
      request,
      MAX_ENCYCLOPEDIA_REQUEST_BYTES,
      "百科问答",
    );
  } catch (error) {
    await recordEvent({
      ...getEventBase({ parsedPayload, actor, ipHash, startedAt }),
      sourceCount: 0,
      status: "failure",
      errorCode: "invalid_request",
      llmDurationMs: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
    });
    if (isReadingServiceError(error)) {
      return buildErrorResponse(error.code, error.message, error.status);
    }

    return buildErrorResponse("invalid_request", INVALID_JSON_BODY_MESSAGE, 400);
  }

  try {
    parsedPayload = encyclopediaQueryRequestSchema.parse(payload);
    if (!deps.isQueryEnabled()) {
      throw new ReadingServiceError(
        "provider_unavailable",
        "百科问答暂未开放。",
        503,
      );
    }
    actor = await deps.requireAccess();
    const deterministicSafety = assessSafetyText(parsedPayload.query);
    assertSafetyAllowsGeneration(deterministicSafety);
    const inputSafetyReview = await deps.safetyReviewer.reviewInput({
      question: parsedPayload.query,
      followupAnswers: [],
      subjectKey: ipHash,
      deterministic: deterministicSafety,
      signal: request.signal,
    });
    if (inputSafetyReview.applied) {
      assertSafetyAllowsGeneration(
        mergeInputSafetyAssessment(deterministicSafety, inputSafetyReview.verdict),
      );
    }
    await deps.consumeQuota({ actor, ipHash });
    const { result, calls } = await deps.collectUsage(() =>
      deps.generateAnswer(parsedPayload as EncyclopediaQueryRequest, {
        safetyReviewer: deps.safetyReviewer,
        inputSafetyReview,
        reviewerSubjectKey: ipHash,
        signal: request.signal,
      })
    );
    const usageSummary = summarizeLlmCalls(calls as LlmCallMetric[]);

    await recordEvent({
      ...getEventBase({ parsedPayload, actor, ipHash, startedAt }),
      sourceCount: result.sources.length,
      status: "success",
      errorCode: null,
      llmDurationMs: usageSummary.llmDurationMs,
      promptTokens: usageSummary.promptTokens,
      completionTokens: usageSummary.completionTokens,
      totalTokens: usageSummary.totalTokens,
      estimatedCostUsd: usageSummary.estimatedCostUsd,
    });

    return Response.json(result);
  } catch (error) {
    const unwrappedError = unwrapLlmUsageError(error);
    const usageSummary = summarizeLlmCalls(unwrappedError.calls);
    const actualError = unwrappedError.cause;

    const recordFailure = async (
      code: ReadingErrorPayload["error"]["code"],
    ) => {
      await recordEvent({
        ...getEventBase({ parsedPayload, actor, ipHash, startedAt }),
        sourceCount: 0,
        status: "failure",
        errorCode: code,
        llmDurationMs: usageSummary.llmDurationMs,
        promptTokens: usageSummary.promptTokens,
        completionTokens: usageSummary.completionTokens,
        totalTokens: usageSummary.totalTokens,
        estimatedCostUsd: usageSummary.estimatedCostUsd,
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
        actualError.details,
        actualError.intercept_reason,
        actualError.referral_links,
      );
    }

    await recordFailure("generation_failed");
    return buildErrorResponse(
      "generation_failed",
      "百科问答生成失败，请稍后再试。",
      500,
    );
  }
}

export async function POST(request: Request) {
  return handleEncyclopediaQueryPost(request);
}
