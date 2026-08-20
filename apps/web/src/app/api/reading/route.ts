import { ZodError } from "zod";
import { createHash } from "node:crypto";
import type {
  ReadingErrorPayload,
  ReadingPhase,
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
import {
  INVALID_JSON_BODY_MESSAGE,
  readBoundedJsonBody,
} from "@/server/http/json-body";
import { isReadingServiceError } from "@/server/reading/errors";
import { readingRequestPayloadSchema } from "@/server/reading/schemas";
import {
  generateStructuredReadingWithDiagnostics,
  type ReadingServiceOptions,
} from "@/server/reading/service";
import {
  analyzeIntentFriction,
  buildSafetySubjects,
  sanitizeIncomingSessionCapsule,
} from "@/server/reading/safety";
import type { ReadingGraphDiagnostics } from "@/server/reading/graph";
import {
  getDefaultReadingRuntimeStores,
  getReadingSubjectKey,
  type InitialReadingSnapshot,
  type InitialReadingSnapshotStore,
  type ReadingRequestExecutionStore,
} from "@/server/reading/runtime-persistence";
import { ReadingServiceError } from "@/server/reading/errors";
import {
  toPersistedReadingTraceV3,
  type ReadingRunTrace,
} from "@/server/reading/trace";
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
import {
  assertSafetyAllowsGeneration,
  assessSafetyFields,
} from "@/server/safety/policy";
import {
  defaultLLMSafetyReviewer,
  mergeInputSafetyAssessment,
  type SafetyReviewExecution,
  type SafetyInputReviewVerdict,
  type SafetyReviewer,
} from "@/server/safety/llm-reviewer";

export const runtime = "nodejs";
const MAX_READING_REQUEST_BYTES = 64 * 1024;

interface ReadingRouteDependencies {
  getIpHash: (request: Request) => string;
  getProviderName: () => string;
  requireAccess: () => Promise<PublicFeatureActor>;
  consumeQuota: (input: {
    actor: PublicFeatureActor;
    ipHash: string;
    phase: ReadingPhase;
    config?: BetaOpsConfig;
  }) => Promise<void>;
  refundQuota: (input: {
    actor: PublicFeatureActor;
    ipHash: string;
  }) => Promise<void>;
  generateReading: (
    payload: ReadingRequestPayload,
    options?: ReadingServiceOptions,
  ) => Promise<StructuredReading | ReadingGraphDiagnostics>;
  collectUsage: typeof collectLlmUsage;
  recordEvent: (input: ReadingEventInput) => Promise<void>;
  executionStore?: ReadingRequestExecutionStore;
  snapshotStore?: InitialReadingSnapshotStore;
  safetyReviewer: SafetyReviewer;
}

const DEFAULT_DEPENDENCIES: ReadingRouteDependencies = {
  getIpHash: getClientIpHash,
  getProviderName: getReadingProviderName,
  requireAccess: () => resolvePublicFeatureActor(),
  consumeQuota: consumeReadingQuota,
  refundQuota: refundReadingQuota,
  generateReading: generateStructuredReadingWithDiagnostics,
  collectUsage: collectLlmUsage,
  recordEvent: recordReadingEvent,
  safetyReviewer: defaultLLMSafetyReviewer,
};
type ReadingResponseSnapshot = {
  payload: StructuredReading | ReadingErrorPayload;
  status: number;
};

function buildErrorResponse(
  code: ReadingErrorPayload["error"]["code"],
  message: string,
  status: number,
  intercept_reason?: string,
  referral_links?: string[],
  details?: Record<string, unknown>,
) {
  const retryAfter = details?.retry_after_seconds;
  return Response.json(
    buildErrorPayload(code, message, intercept_reason, referral_links, details),
    {
      status,
      headers: typeof retryAfter === "number"
        ? { "Retry-After": String(Math.max(1, Math.ceil(retryAfter))) }
        : undefined,
    },
  );
}

function responseFromSnapshot(snapshot: { payload: object | StructuredReading; status: number }) {
  const details = (snapshot.payload as Partial<ReadingErrorPayload>).error?.details;
  const retryAfter = details?.retry_after_seconds;
  return Response.json(snapshot.payload, {
    status: snapshot.status,
    headers: typeof retryAfter === "number"
      ? { "Retry-After": String(Math.max(1, Math.ceil(retryAfter))) }
      : undefined,
  });
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
    initialReadingId:
      parsedPayload?.initial_reading_id
      ?? parsedPayload?.initial_reading?.reading_id
      ?? null,
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
  const subjectKey = getReadingSubjectKey({
    userId: actor.userId,
    email: actor.email,
    ipHash,
  });
  const effectivePayload = {
    ...payload,
    initial_reading: undefined,
    initial_reading_id:
      payload.initial_reading_id ?? payload.initial_reading?.reading_id,
    prior_session_capsule:
      payload.phase === "final" ? undefined : payload.prior_session_capsule,
  };
  const payloadHash = createHash("sha256")
    .update(JSON.stringify(effectivePayload))
    .digest("hex");

  return {
    subjectKey,
    payloadHash,
  };
}

function getInitialReadingId(payload: ReadingRequestPayload) {
  return payload.initial_reading_id ?? payload.initial_reading?.reading_id;
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateFinalSnapshot(
  payload: ReadingRequestPayload,
  snapshot: InitialReadingSnapshot,
) {
  const expectedQuestions = snapshot.followUpQuestions;
  const receivedAnswers = payload.followup_answers ?? [];
  const matches = (
    payload.question === snapshot.question
    && payload.spreadId === snapshot.spreadId
    && sameJson(payload.drawnCards, snapshot.drawnCards)
    && (payload.agent_profile ?? "standard") === snapshot.agentProfile
    && (payload.draw_source ?? "digital_random") === snapshot.drawSource
    && (payload.thread_id ?? null) === snapshot.threadId
    && receivedAnswers.length === expectedQuestions.length
    && receivedAnswers.every(
      (answer, index) => answer.question === expectedQuestions[index],
    )
  );

  if (!matches) {
    throw new ReadingServiceError(
      "invalid_request",
      "Final 请求与服务端保存的 initial reading 不一致。",
      400,
    );
  }
}

function normalizeGenerationResult(
  value: StructuredReading | ReadingGraphDiagnostics,
): { reading: StructuredReading; trace?: ReadingRunTrace } {
  if ("reading" in value && "trace" in value) {
    return { reading: value.reading, trace: value.trace };
  }
  return { reading: value };
}

async function executeReadingRequest({
  deps,
  parsedPayload,
  actor,
  ipHash,
  provider,
  startedAt,
  recordEvent,
  subjectKey,
  snapshotStore,
  initialSnapshot,
  inputSafetyReview,
  signal,
}: {
  deps: ReadingRouteDependencies;
  parsedPayload: ReadingRequestPayload;
  actor: PublicFeatureActor;
  ipHash: string;
  provider: string;
  startedAt: number;
  recordEvent: (input: ReadingEventInput) => Promise<void>;
  subjectKey: string;
  snapshotStore: InitialReadingSnapshotStore;
  initialSnapshot?: InitialReadingSnapshot;
  inputSafetyReview?: SafetyReviewExecution<SafetyInputReviewVerdict>;
  signal?: AbortSignal;
}): Promise<ReadingResponseSnapshot> {
  let dailyQuotaConsumed = false;
  let trace: ReadingRunTrace | undefined;

  try {
    const phase = parsedPayload.phase ?? "initial";
    await deps.consumeQuota({ actor, ipHash, phase });
    dailyQuotaConsumed = phase === "initial";
    const { result, calls } = await deps.collectUsage(() =>
      deps.generateReading(parsedPayload, {
        initialReading: initialSnapshot?.initialReading,
        memoryUserId: actor.userId ?? undefined,
        signal,
        safetyReviewer: deps.safetyReviewer,
        reviewerSubjectKey: subjectKey,
        inputSafetyReview,
      })
    );
    const generated = normalizeGenerationResult(result);
    const reading = generated.reading;
    trace = generated.trace;
    const usageSummary = summarizeLlmCalls(calls as LlmCallMetric[]);

    if (
      reading.reading_phase === "initial"
      && reading.requires_followup
    ) {
      try {
        await snapshotStore.save({
          subjectKey,
          initialReadingId: reading.reading_id,
          requestId: parsedPayload.request_id ?? crypto.randomUUID(),
          question: parsedPayload.question,
          spreadId: parsedPayload.spreadId,
          drawnCards: parsedPayload.drawnCards,
          agentProfile: parsedPayload.agent_profile ?? "standard",
          drawSource: parsedPayload.draw_source ?? "digital_random",
          threadId: parsedPayload.thread_id ?? null,
          continuityContext: sanitizeIncomingSessionCapsule(
            parsedPayload.prior_session_capsule ?? null,
          ),
          initialReading: reading,
          followUpQuestions: reading.follow_up_questions,
        });
      } catch {
        throw new ReadingServiceError(
          "provider_unavailable",
          "初始解读暂时无法安全保存，请稍后重试。",
          503,
        );
      }
    }

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
      agentTrace: trace ? toPersistedReadingTraceV3(trace) : null,
    });

    return { payload: reading, status: 200 };
  } catch (error) {
    const unwrappedError = unwrapLlmUsageError(error);
    const usageSummary = summarizeLlmCalls(unwrappedError.calls);
    const actualError = unwrappedError.cause;
    if (isReadingServiceError(actualError)) {
      trace = actualError.diagnosticTrace;
    }

    if (dailyQuotaConsumed) {
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
      agentTrace: trace ? toPersistedReadingTraceV3(trace) : null,
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

    try {
      await deps.recordEvent(input);
    } catch (error) {
      console.warn("[observability] reading event persistence failed", {
        code: "reading_event_write_failed",
        message: error instanceof Error ? error.message : "unknown",
      });
    }
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

    return buildErrorResponse("invalid_request", INVALID_JSON_BODY_MESSAGE, 400);
  }

  try {
    parsedPayload = readingRequestPayloadSchema.parse(payload);
    actor = await deps.requireAccess();
    const safetyPreflight = analyzeIntentFriction(buildSafetySubjects(
      parsedPayload.question,
      parsedPayload.followup_answers,
    ));
    if (safetyPreflight.type === "hard_stop") {
      throw new ReadingServiceError(
        "safety_intercept",
        "问题触发了高风险安全界限保护。",
        403,
        safetyPreflight.reason,
        safetyPreflight.referral_links,
      );
    }
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

  let runtimeStores: ReturnType<typeof getDefaultReadingRuntimeStores>;
  try {
    const defaults = getDefaultReadingRuntimeStores({
      forceInMemory: shouldSkipBetaOps,
    });
    runtimeStores = {
      executionStore: dependencies.executionStore ?? defaults.executionStore,
      snapshotStore: dependencies.snapshotStore ?? defaults.snapshotStore,
    };
  } catch {
    return buildErrorResponse(
      "provider_unavailable",
      "Reading 持久化服务暂时不可用，请稍后重试。",
      503,
    );
  }

  const identity = buildRequestIdentity({
    payload: parsedPayload,
    actor,
    ipHash,
  });
  const operationRequestId = parsedPayload.request_id ?? crypto.randomUUID();
  let leaseOwner: string | undefined;

  if (parsedPayload.request_id) {
    let claim = await runtimeStores.executionStore.claim({
      ...identity,
      requestId: parsedPayload.request_id,
    });
    if (claim.status === "wait") {
      claim = await runtimeStores.executionStore.waitForResult({
        ...identity,
        requestId: parsedPayload.request_id,
      });
    }
    if (claim.status === "conflict") {
      return buildErrorResponse(
        "invalid_request",
        "request_id 已用于不同的 reading 请求。",
        409,
      );
    }
    if (claim.status === "replay") {
      return responseFromSnapshot(claim.response);
    }
    if (claim.status === "wait") {
      return buildErrorResponse(
        "provider_unavailable",
        "同一 Reading 请求仍在处理中，请稍后使用相同 request_id 重试。",
        503,
      );
    }
    leaseOwner = claim.leaseOwner;
  }

  let initialSnapshot: InitialReadingSnapshot | undefined;
  const initialReadingId = getInitialReadingId(parsedPayload);
  if (parsedPayload.phase === "final") {
    if (!initialReadingId) {
      return buildErrorResponse(
        "invalid_request",
        "phase 为 final 时必须提供 initial_reading_id。",
        400,
      );
    }
    try {
      const claim = await runtimeStores.snapshotStore.claim({
        subjectKey: identity.subjectKey,
        initialReadingId,
        requestId: operationRequestId,
      });
      if (claim.status !== "claimed") {
        if (leaseOwner && parsedPayload.request_id) {
          await runtimeStores.executionStore.release({
            subjectKey: identity.subjectKey,
            requestId: parsedPayload.request_id,
            leaseOwner,
          });
        }
        return buildErrorResponse(
          "invalid_request",
          claim.status === "busy"
            ? "这份 initial reading 正由另一个 Final 请求处理。"
            : "initial reading 不存在、已过期或已完成。",
          claim.status === "busy" ? 409 : 400,
        );
      }
      initialSnapshot = claim.snapshot;
      validateFinalSnapshot(parsedPayload, initialSnapshot);
      parsedPayload = {
        ...parsedPayload,
        initial_reading: { reading_id: initialSnapshot.initialReadingId },
        initial_reading_id: initialSnapshot.initialReadingId,
        prior_session_capsule: sanitizeIncomingSessionCapsule(
          initialSnapshot.continuityContext,
        ),
      };
    } catch (error) {
      await runtimeStores.snapshotStore.release({
        subjectKey: identity.subjectKey,
        initialReadingId,
        requestId: operationRequestId,
      }).catch(() => undefined);
      if (leaseOwner && parsedPayload.request_id) {
        await runtimeStores.executionStore.release({
          subjectKey: identity.subjectKey,
          requestId: parsedPayload.request_id,
          leaseOwner,
        }).catch(() => undefined);
      }
      if (isReadingServiceError(error)) {
        return buildErrorResponse(error.code, error.message, error.status);
      }
      return buildErrorResponse(
        "provider_unavailable",
        "initial reading 暂时无法读取，请稍后重试。",
        503,
      );
    }
  }

  let inputSafetyReview: SafetyReviewExecution<SafetyInputReviewVerdict>;
  try {
    const subjects = buildSafetySubjects(
      parsedPayload.question,
      parsedPayload.followup_answers,
    );
    const deterministicSafety = assessSafetyFields(subjects);
    inputSafetyReview = await deps.safetyReviewer.reviewInput({
      requestId: parsedPayload.request_id,
      question: parsedPayload.question,
      followupAnswers: parsedPayload.followup_answers ?? [],
      deterministic: deterministicSafety,
      subjectKey: identity.subjectKey,
      signal: request.signal,
    });
    if (inputSafetyReview.applied) {
      assertSafetyAllowsGeneration(
        mergeInputSafetyAssessment(deterministicSafety, inputSafetyReview.verdict),
      );
    }
  } catch (error) {
    if (initialSnapshot) {
      await runtimeStores.snapshotStore.release({
        subjectKey: identity.subjectKey,
        initialReadingId: initialSnapshot.initialReadingId,
        requestId: operationRequestId,
      }).catch(() => undefined);
    }
    if (leaseOwner && parsedPayload.request_id) {
      await runtimeStores.executionStore.release({
        subjectKey: identity.subjectKey,
        requestId: parsedPayload.request_id,
        leaseOwner,
      }).catch(() => undefined);
    }
    const actualError = isReadingServiceError(error)
      ? error
      : new ReadingServiceError(
        "provider_unavailable",
        "安全审校服务暂时不可用，请稍后重试。",
        503,
      );
    await recordEvent({
      ...getEventBase({ parsedPayload, actor, ipHash, provider, startedAt }),
      readingId: null,
      status: "failure",
      errorCode: actualError.code,
      llmDurationMs: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      completedInitial: false,
      completedFinal: false,
    });
    return buildErrorResponse(
      actualError.code,
      actualError.message,
      actualError.status,
      actualError.intercept_reason,
      actualError.referral_links,
      actualError.details,
    );
  }

  const snapshot = await executeReadingRequest({
    deps,
    parsedPayload,
    actor,
    ipHash,
    provider,
    startedAt,
    recordEvent,
    subjectKey: identity.subjectKey,
    snapshotStore: runtimeStores.snapshotStore,
    initialSnapshot,
    signal: request.signal,
    inputSafetyReview,
  });

  if (snapshot.status === 200 && leaseOwner && parsedPayload.request_id) {
    try {
      await runtimeStores.executionStore.complete({
        subjectKey: identity.subjectKey,
        requestId: parsedPayload.request_id,
        leaseOwner,
        response: snapshot,
      });
    } catch {
      return buildErrorResponse(
        "provider_unavailable",
        "Reading 结果暂时无法安全保存，请使用相同 request_id 重试。",
        503,
      );
    }
  } else if (snapshot.status !== 200 && leaseOwner && parsedPayload.request_id) {
    await runtimeStores.executionStore.release({
      subjectKey: identity.subjectKey,
      requestId: parsedPayload.request_id,
      leaseOwner,
    }).catch(() => undefined);
  }

  if (initialSnapshot) {
    const input = {
      subjectKey: identity.subjectKey,
      initialReadingId: initialSnapshot.initialReadingId,
      requestId: operationRequestId,
    };
    if (snapshot.status === 200) {
      await runtimeStores.snapshotStore.consume(input).catch(() => undefined);
    } else {
      await runtimeStores.snapshotStore.release(input).catch(() => undefined);
    }
  }

  return responseFromSnapshot(snapshot);
}

export async function POST(request: Request) {
  return handleReadingPost(request);
}
