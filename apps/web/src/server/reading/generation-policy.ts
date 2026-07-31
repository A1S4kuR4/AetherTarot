import "server-only";

import type { AgentProfile, ReadingPhase } from "@aethertarot/shared-types";
import {
  ReadingGenerationError,
  ReadingServiceError,
  isReadingGenerationError,
  type ReadingGenerationAttempt,
  type ReadingGenerationFailureSubtype,
  type ReadingGenerationStage,
} from "@/server/reading/errors";
import {
  hydrateStagedReadingDraft,
  type CardInsightDraft,
  type CompactReadingDraft,
  type FinalSynthesisDraft,
  type ReadingStageDraft,
  type SynthesisDraft,
} from "@/server/reading/generation-contracts";
import type {
  FinalReadingContext,
  HydratedReadingContext,
  ReadingDraft,
  ReadingGenerationCallOptions,
  ReadingProvider,
  RepairStageRequest,
} from "@/server/reading/types";
import { getCurrentLlmCalls } from "@/server/observability/llm-usage";

export type ReadingGenerationMode = "monolithic" | "adaptive_staged";

export interface ReadingGenerationPlan {
  mode: ReadingGenerationMode;
  stages: ReadingGenerationStage[];
  max_requests: number;
}

export interface ReadingGenerationResult {
  draft: ReadingDraft;
  plan: ReadingGenerationPlan;
  attempts: ReadingGenerationAttempt[];
}

export function resolveReadingGenerationMode(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): ReadingGenerationMode {
  const value = env.AETHERTAROT_READING_GENERATION_MODE ?? "monolithic";
  if (value === "monolithic" || value === "adaptive_staged") {
    return value;
  }
  throw new ReadingServiceError(
    "provider_unavailable",
    "AETHERTAROT_READING_GENERATION_MODE 必须是 monolithic 或 adaptive_staged。",
    503,
  );
}

export function buildReadingGenerationPlan({
  mode,
  phase,
  agentProfile,
  cardCount,
}: {
  mode: ReadingGenerationMode;
  phase: ReadingPhase;
  agentProfile: AgentProfile;
  cardCount: number;
}): ReadingGenerationPlan {
  if (mode === "monolithic") {
    return { mode, stages: ["monolithic"], max_requests: 1 };
  }
  if (phase === "final") {
    return { mode, stages: ["final_synthesis"], max_requests: 2 };
  }
  if (agentProfile === "lite" && cardCount <= 4) {
    return { mode, stages: ["compact"], max_requests: 2 };
  }
  return {
    mode,
    stages: ["card_insights", "synthesis"],
    max_requests: 4,
  };
}

function shouldRepair(subtype: ReadingGenerationFailureSubtype) {
  return (
    subtype === "malformed_json"
    || subtype === "schema_violation"
    || subtype === "authority_mismatch"
    || subtype === "prose_leakage"
    || subtype === "grounding_violation"
    || subtype === "semantic_contradiction"
  );
}

function normalizeStageError(
  error: unknown,
  stage: ReadingGenerationStage,
) {
  if (isReadingGenerationError(error)) {
    error.stage ??= stage;
    return error;
  }
  if (error instanceof ReadingServiceError) {
    if (error.code === "generation_failed") {
      return new ReadingGenerationError({
        subtype: "schema_violation",
        stage,
        message: error.message,
        code: error.code,
        status: error.status,
        retryable: false,
        issues: [error.message],
      });
    }
    return error;
  }
  return new ReadingGenerationError({
    subtype: "schema_violation",
    stage,
    message: "生成阶段返回了无法验证的结果。",
    retryable: true,
    invalidPayload: error,
  });
}

function buildCallOptions({
  runId,
  stage,
  attempt,
  kind,
  signal,
}: {
  runId: string;
  stage: ReadingGenerationStage;
  attempt: number;
  kind: ReadingGenerationCallOptions["kind"];
  signal?: AbortSignal;
}): ReadingGenerationCallOptions {
  return {
    runId,
    stageId: `${runId}:${stage}`,
    attemptId: `${runId}:${stage}:${attempt}`,
    stage,
    attempt,
    kind,
    signal,
  };
}

function buildAttempt(
  options: ReadingGenerationCallOptions,
  success: boolean,
  subtype?: ReadingGenerationFailureSubtype,
): ReadingGenerationAttempt {
  const metric = [...getCurrentLlmCalls()]
    .reverse()
    .find((call) => call.attemptId === options.attemptId);
  return {
    stage_id: options.stageId,
    attempt_id: options.attemptId,
    stage: options.stage,
    attempt: options.attempt,
    kind: options.kind,
    success,
    subtype,
    duration_ms: metric?.durationMs,
    http_status: metric?.httpStatus,
    prompt_tokens: metric?.promptTokens,
    completion_tokens: metric?.completionTokens,
    total_tokens: metric?.totalTokens,
    estimated_cost_usd: metric?.estimatedCostUsd,
  };
}

function throwIfCancelled(
  signal: AbortSignal | undefined,
  stage: ReadingGenerationStage,
  attempts: ReadingGenerationAttempt[],
) {
  if (signal?.aborted) {
    throw new ReadingGenerationError({
      subtype: "cancelled",
      stage,
      message: "Reading 请求已取消。",
      retryable: false,
      attempts: [...attempts],
    });
  }
}

async function executeStage<T extends ReadingStageDraft>({
  runId,
  stage,
  signal,
  generate,
  repair,
  attempts,
}: {
  runId: string;
  stage: ReadingGenerationStage;
  signal?: AbortSignal;
  generate: (options: ReadingGenerationCallOptions) => Promise<T>;
  repair: (
    error: ReadingGenerationError,
    options: ReadingGenerationCallOptions,
  ) => Promise<T>;
  attempts: ReadingGenerationAttempt[];
}): Promise<T> {
  throwIfCancelled(signal, stage, attempts);
  const firstOptions = buildCallOptions({
    runId,
    stage,
    attempt: 1,
    kind: "generate",
    signal,
  });
  try {
    const result = await generate(firstOptions);
    attempts.push(buildAttempt(firstOptions, true));
    return result;
  } catch (error) {
    const firstError = normalizeStageError(error, stage);
    if (!(firstError instanceof ReadingGenerationError)) {
      throw firstError;
    }
    attempts.push(buildAttempt(firstOptions, false, firstError.subtype));
    if (!firstError.retryable || firstError.subtype === "cancelled") {
      firstError.attempts = [...attempts];
      throw firstError;
    }

    const kind = shouldRepair(firstError.subtype) ? "repair" : "retry";
    throwIfCancelled(signal, stage, attempts);
    const secondOptions = buildCallOptions({
      runId,
      stage,
      attempt: 2,
      kind,
      signal,
    });
    try {
      const result = kind === "repair"
        ? await repair(firstError, secondOptions)
        : await generate(secondOptions);
      attempts.push(buildAttempt(secondOptions, true));
      return result;
    } catch (secondError) {
      const lastError = normalizeStageError(secondError, stage);
      if (!(lastError instanceof ReadingGenerationError)) {
        throw lastError;
      }
      attempts.push(buildAttempt(secondOptions, false, lastError.subtype));
      throw new ReadingGenerationError({
        subtype: "retry_exhausted",
        retryCauseSubtype: lastError.subtype,
        stage,
        message: lastError.message,
        code: lastError.code,
        status: lastError.status,
        retryable: false,
        issues: lastError.issues,
        attempts: [...attempts],
        httpStatus: lastError.httpStatus,
      });
    }
  }
}

function repairRequest(
  stage: ReadingGenerationStage,
  context: HydratedReadingContext | FinalReadingContext,
  error: ReadingGenerationError,
): RepairStageRequest {
  return {
    stage,
    context,
    invalidPayload: error.invalidPayload,
    issues: error.issues.length > 0 ? error.issues : [error.message],
  };
}

export async function generateReadingDraftWithPolicy({
  provider,
  context,
  phase,
  mode,
  runId,
  signal,
}: {
  provider: ReadingProvider;
  context: HydratedReadingContext | FinalReadingContext;
  phase: ReadingPhase;
  mode: ReadingGenerationMode;
  runId: string;
  signal?: AbortSignal;
}): Promise<ReadingGenerationResult> {
  const plan = buildReadingGenerationPlan({
    mode,
    phase,
    agentProfile: context.agentProfile,
    cardCount: context.drawnCards.length,
  });
  const attempts: ReadingGenerationAttempt[] = [];

  if (mode === "monolithic") {
    throwIfCancelled(signal, "monolithic", attempts);
    const options = buildCallOptions({
      runId,
      stage: "monolithic",
      attempt: 1,
      kind: "generate",
      signal,
    });
    try {
      const draft = phase === "final"
        ? await provider.generateFinalRead(context as FinalReadingContext, options)
        : await provider.generateInitialRead(context, options);
      attempts.push(buildAttempt(options, true));
      return { draft, plan, attempts };
    } catch (error) {
      const normalized = normalizeStageError(error, "monolithic");
      if (normalized instanceof ReadingGenerationError) {
        attempts.push(buildAttempt(options, false, normalized.subtype));
        normalized.attempts = [...attempts];
      }
      throw normalized;
    }
  }

  if (phase === "final") {
    const finalContext = context as FinalReadingContext;
    const finalDraft = await executeStage<FinalSynthesisDraft>({
      runId,
      stage: "final_synthesis",
      signal,
      attempts,
      generate: (options) => provider.refineFinalSynthesis(finalContext, options),
      repair: (error, options) =>
        provider.repairStage(
          repairRequest("final_synthesis", finalContext, error),
          options,
        ) as Promise<FinalSynthesisDraft>,
    });
    return {
      draft: hydrateStagedReadingDraft({
        context,
        cardInsights: finalDraft.card_refinements,
        synthesis: finalDraft,
        initialReading: finalContext.initialReading,
      }),
      plan,
      attempts,
    };
  }

  if (plan.stages[0] === "compact") {
    const compact = await executeStage<CompactReadingDraft>({
      runId,
      stage: "compact",
      signal,
      attempts,
      generate: (options) => provider.generateCompactRead(context, options),
      repair: (error, options) =>
        provider.repairStage(
          repairRequest("compact", context, error),
          options,
        ) as Promise<CompactReadingDraft>,
    });
    return {
      draft: hydrateStagedReadingDraft({
        context,
        cardInsights: compact.card_insights,
        synthesis: compact.synthesis,
      }),
      plan,
      attempts,
    };
  }

  const cardInsights = await executeStage<CardInsightDraft[]>({
    runId,
    stage: "card_insights",
    signal,
    attempts,
    generate: (options) => provider.generateCardInsights(context, options),
    repair: (error, options) =>
      provider.repairStage(
        repairRequest("card_insights", context, error),
        options,
      ) as Promise<CardInsightDraft[]>,
  });
  const synthesis = await executeStage<SynthesisDraft>({
    runId,
    stage: "synthesis",
    signal,
    attempts,
    generate: (options) =>
      provider.generateSynthesis(context, cardInsights, options),
    repair: (error, options) =>
      provider.repairStage(
        {
          ...repairRequest("synthesis", context, error),
          cardInsights,
        },
        options,
      ) as Promise<SynthesisDraft>,
  });
  return {
    draft: hydrateStagedReadingDraft({
      context,
      cardInsights,
      synthesis,
    }),
    plan,
    attempts,
  };
}
