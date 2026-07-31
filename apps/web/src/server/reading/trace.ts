import "server-only";

import type { StructuredReading } from "@aethertarot/shared-types";
import type {
  AgentActionTrace,
  AgentObservation,
  GroundingStatus,
  PendingClarification,
} from "@/server/reading/reading-agent-core";
import type { IntentFrictionResult } from "@/server/reading/safety";
import type {
  ReadingGenerationAttempt,
  ReadingGenerationFailureSubtype,
  ReadingGenerationStage,
} from "@/server/reading/errors";
import type {
  ReadingGenerationMode,
  ReadingGenerationPlan,
} from "@/server/reading/generation-policy";
import type { ToolCallAuditEntry } from "@/server/reading/tools";
import { isRetrieveTarotKnowledgeOutput } from "@/server/reading/tools/retrieve-tarot-knowledge";

export type ReadingRunTraceStatus =
  | "success"
  | "failed"
  | "clarification"
  | "safety_stop";

export interface ReadingRunTrace {
  run_id: string;
  started_at: string;
  ended_at?: string;
  status: ReadingRunTraceStatus;
  agent_steps: AgentStepTrace[];
  tool_calls: ToolCallTrace[];
  retrieval_sources: RetrievalSourceTrace[];
  generation?: ReadingGenerationTrace;
  final_answer_grounding?: FinalAnswerGroundingTrace;
  safety?: {
    policy_version: string;
    rule_ids: string[];
    action_type: string;
  };
}

export interface ReadingGenerationTrace {
  mode: ReadingGenerationMode;
  stages: ReadingGenerationStage[];
  max_requests: number;
  attempts: ReadingGenerationAttempt[];
  failure_stage?: ReadingGenerationStage;
  failure_subtype?: ReadingGenerationFailureSubtype;
}

export const PERSISTED_READING_TRACE_SCHEMA_VERSION = 3;

export interface PersistedReadingTraceV3 {
  schema_version: 3;
  run_id: string;
  started_at: string;
  ended_at?: string;
  status: ReadingRunTraceStatus;
  agent_steps: Array<{
    step: number;
    action_type: string;
    observation_count: number;
    tool_call_count: number;
    grounding_status: string;
    pending_clarification: boolean;
  }>;
  tool_calls: Array<{
    tool_name: string;
    step: number;
    ok: boolean;
    latency_ms: number;
    error_code?: string;
  }>;
  grounding: {
    status: string;
    source_ids: string[];
    chunk_ids: string[];
    retrieved_chunk_count: number;
    grounded_card_count: number;
    degraded_source_count: number;
    citation_count: number;
  };
  safety: {
    policy_version: string;
    rule_ids: string[];
    action_type: string;
  };
  generation?: ReadingGenerationTrace;
}

export function toPersistedReadingTraceV3(
  trace: ReadingRunTrace,
): PersistedReadingTraceV3 {
  return {
    schema_version: PERSISTED_READING_TRACE_SCHEMA_VERSION,
    run_id: trace.run_id,
    started_at: trace.started_at,
    ended_at: trace.ended_at,
    status: trace.status,
    agent_steps: trace.agent_steps.map((step) => ({
      step: step.step,
      action_type: step.action_type ?? step.node,
      observation_count: step.state_summary?.observation_count ?? 0,
      tool_call_count: step.state_summary?.tool_call_count ?? 0,
      grounding_status: step.state_summary?.grounding_status ?? "none",
      pending_clarification:
        step.state_summary?.pending_clarification ?? false,
    })),
    tool_calls: trace.tool_calls.map((toolCall) => ({
      tool_name: toolCall.tool_name,
      step: toolCall.step,
      ok: toolCall.ok,
      latency_ms: toolCall.latency_ms,
      error_code: toolCall.error_code,
    })),
    grounding: {
      status: trace.final_answer_grounding?.grounding_status ?? "none",
      source_ids: [
        ...new Set(trace.retrieval_sources.map((source) => source.source_id)),
      ],
      chunk_ids: [
        ...new Set(trace.retrieval_sources.map((source) => source.chunk_id)),
      ],
      retrieved_chunk_count:
        trace.final_answer_grounding?.retrieved_chunk_count ?? 0,
      grounded_card_count:
        trace.final_answer_grounding?.grounded_card_count ?? 0,
      degraded_source_count:
        trace.final_answer_grounding?.degraded_source_count ?? 0,
      citation_count: trace.final_answer_grounding?.citation_count ?? 0,
    },
    safety: {
      policy_version: trace.safety?.policy_version ?? "safety-rules-v1",
      rule_ids: trace.safety?.rule_ids ?? [],
      action_type: trace.safety?.action_type ?? "pass",
    },
    generation: trace.generation,
  };
}

/** @deprecated Trace persistence now emits the V3 redacted schema. */
export type PersistedReadingTraceV2 = PersistedReadingTraceV3;
/** @deprecated Use toPersistedReadingTraceV3. */
export const toPersistedReadingTraceV2 = toPersistedReadingTraceV3;
/** @deprecated Trace persistence now emits the V3 redacted schema. */
export const toPersistedReadingTraceV1 = toPersistedReadingTraceV3;

export interface AgentStepTrace {
  step: number;
  node: string;
  action_type?: string;
  decision_reason?: string;
  state_summary?: ReadingStepStateSummary;
  prompt_hash?: string;
  output_summary?: unknown;
  created_at: string;
}

export interface ToolCallTrace {
  tool_name: string;
  step: number;
  ok: boolean;
  latency_ms: number;
  error_code?: string;
  decision_reason?: string;
}

export interface RetrievalSourceTrace {
  source_id: string;
  chunk_id: string;
  title: string;
  score?: number;
  confidence?: string;
  used_by_final_answer?: boolean;
}

export interface FinalAnswerGroundingTrace {
  grounding_status: GroundingStatus | "stub";
  used_source_ids: string[];
  retrieved_chunk_count: number;
  unsupported_claim_check?: "not_checked" | "passed" | "failed";
  grounded_card_count: number;
  degraded_source_count: number;
  citation_count: number;
}

export interface ReadingStepStateSummary {
  agent_step_count: number;
  action_type?: string;
  grounding_status: GroundingStatus;
  observation_count: number;
  tool_call_count: number;
  pending_clarification: boolean;
  safety_status?: IntentFrictionResult["type"];
}

export interface ReadingTraceState {
  runId?: string;
  traceStartedAt?: string;
  agentStepCount?: number;
  agentActions?: AgentActionTrace[];
  observations?: AgentObservation[];
  toolCalls?: ToolCallAuditEntry[];
  pendingClarification?: PendingClarification;
  groundingStatus?: GroundingStatus;
  frictionResult?: IntentFrictionResult;
  reading?: StructuredReading;
  generationMode?: ReadingGenerationMode;
  generationPlan?: ReadingGenerationPlan;
  generationStage?: ReadingGenerationStage;
  generationAttempts?: ReadingGenerationAttempt[];
  failureStage?: ReadingGenerationStage;
  failureSubtype?: ReadingGenerationFailureSubtype;
}

interface BuildReadingRunTraceOptions {
  status: ReadingRunTraceStatus;
  endedAt?: string;
}

function getRetrieveOutputs(observations: AgentObservation[]) {
  return observations
    .filter((observation) => observation.source === "retrieve_tarot_knowledge")
    .map((observation) => observation.content)
    .filter(isRetrieveTarotKnowledgeOutput);
}

function buildRetrievalSources(
  observations: AgentObservation[],
  usedSourceIds: Set<string>,
): RetrievalSourceTrace[] {
  return getRetrieveOutputs(observations).flatMap((output) =>
    output.chunks.flatMap((chunk) =>
      (
        chunk.source_ids?.length
          ? chunk.source_ids
          : chunk.source_id
            ? [chunk.source_id]
            : ["unregistered"]
      ).map((sourceId) => ({
        source_id: sourceId,
        chunk_id: chunk.id,
        title: chunk.title,
        score: chunk.score,
        confidence: chunk.confidence,
        used_by_final_answer: usedSourceIds.has(sourceId),
      }))
    ),
  );
}

function buildFinalAnswerGrounding(
  state: ReadingTraceState,
): FinalAnswerGroundingTrace {
  const retrievedChunks = getRetrieveOutputs(state.observations ?? [])
    .filter((output) => output.groundingStatus === "retrieved")
    .flatMap((output) => output.chunks);
  const publicGrounding = state.reading?.grounding;
  const usedSourceIds = Array.from(
    new Set(
      publicGrounding?.sources.flatMap((source) => source.source_ids) ?? [],
    ),
  );
  const publicGroundingStatus: GroundingStatus | undefined =
    publicGrounding?.status === "grounded"
      ? "retrieved"
      : publicGrounding?.status === "degraded"
        ? "degraded"
        : undefined;

  return {
    grounding_status:
      publicGroundingStatus ?? state.groundingStatus ?? "none",
    used_source_ids: usedSourceIds,
    retrieved_chunk_count: retrievedChunks.length,
    unsupported_claim_check: publicGrounding ? "passed" : "not_checked",
    grounded_card_count: publicGrounding?.claims.filter(
      (claim) => claim.path.startsWith("cards."),
    ).length ?? 0,
    degraded_source_count: publicGrounding?.sources.filter(
      (source) => source.kind === "authority_card",
    ).length ?? 0,
    citation_count: publicGrounding?.claims.reduce(
      (count, claim) => count + claim.source_refs.length,
      0,
    ) ?? 0,
  };
}

function summarizeActionOutput({
  action,
  state,
  grounding,
}: {
  action: AgentActionTrace;
  state: ReadingTraceState;
  grounding: FinalAnswerGroundingTrace;
}) {
  if (action.type === "retrieve_knowledge") {
    const result = action.output as {
      ok?: boolean;
      toolName?: string;
      output?: { groundingStatus?: string; chunks?: unknown[] };
      error?: { code?: string };
    } | undefined;

    return {
      tool_name: result?.toolName ?? "retrieve_tarot_knowledge",
      ok: result?.ok ?? false,
      grounding_status: result?.output?.groundingStatus ?? "none",
      chunk_count: result?.output?.chunks?.length ?? 0,
      error_code: result?.error?.code,
    };
  }

  if (action.type === "get_session_memory") {
    const result = action.output as {
      ok?: boolean;
      toolName?: string;
      skipped?: boolean;
      reason?: string;
      output?: {
        memory?: {
          topics?: string[];
          cards?: unknown[];
          last_advice_summary?: string;
        } | null;
        skipped?: boolean;
        reason?: string;
      };
      error?: { code?: string };
    } | undefined;
    const memory = result?.output?.memory;

    return {
      tool_name: result?.toolName ?? "get_session_memory",
      ok: result?.ok ?? false,
      skipped: result?.skipped ?? result?.output?.skipped ?? false,
      skip_reason: result?.reason ?? result?.output?.reason,
      has_memory: Boolean(memory),
      topics: memory?.topics?.slice(0, 3) ?? [],
      card_count: memory?.cards?.length ?? 0,
      has_last_advice: Boolean(memory?.last_advice_summary),
      error_code: result?.error?.code,
    };
  }

  if (action.type === "final_answer") {
    return {
      reading_id: state.reading?.reading_id,
      agent_profile: state.reading?.agent_profile,
      grounding_status: grounding.grounding_status,
      used_source_ids: grounding.used_source_ids,
      requires_followup: state.reading?.requires_followup,
      safety_note_present: Boolean(state.reading?.safety_note),
    };
  }

  if (action.type === "request_clarification") {
    return {
      pending_clarification: true,
    };
  }

  if (action.type === "safety_stop") {
    return {
      safety_status: state.frictionResult?.type ?? "hard_stop",
    };
  }

  return undefined;
}

function getGroundingAtStep({
  state,
  step,
}: {
  state: ReadingTraceState;
  step: number;
}): GroundingStatus {
  const matchingAction = [...(state.agentActions ?? [])]
    .filter((action) => action.step <= step && action.type === "retrieve_knowledge")
    .at(-1);
  const output = matchingAction?.output as {
    output?: { groundingStatus?: GroundingStatus };
  } | undefined;

  return output?.output?.groundingStatus ?? state.groundingStatus ?? "none";
}

function buildStateSummary({
  state,
  action,
}: {
  state: ReadingTraceState;
  action: AgentActionTrace;
}): ReadingStepStateSummary {
  const toolCallCount = (state.toolCalls ?? []).filter(
    (toolCall) => toolCall.step <= action.step,
  ).length;
  const observationCount = (state.observations ?? []).length;

  return {
    agent_step_count: action.step,
    action_type: action.type,
    grounding_status: getGroundingAtStep({ state, step: action.step }),
    observation_count: observationCount,
    tool_call_count: toolCallCount,
    pending_clarification: action.type === "request_clarification"
      || Boolean(state.pendingClarification),
    safety_status: state.frictionResult?.type,
  };
}

function getActionCreatedAt({
  action,
  state,
  fallback,
}: {
  action: AgentActionTrace;
  state: ReadingTraceState;
  fallback: string;
}) {
  return (
    action.created_at
    ?? (state.toolCalls ?? []).find((toolCall) => toolCall.step === action.step)?.created_at
    ?? fallback
  );
}

function buildAgentSteps(
  state: ReadingTraceState,
  grounding: FinalAnswerGroundingTrace,
  fallbackCreatedAt: string,
): AgentStepTrace[] {
  return (state.agentActions ?? []).map((action) => ({
    step: action.step,
    node: action.type,
    action_type: action.type,
    decision_reason: action.reason,
    state_summary: buildStateSummary({ state, action }),
    output_summary: summarizeActionOutput({ action, state, grounding }),
    created_at: getActionCreatedAt({
      action,
      state,
      fallback: fallbackCreatedAt,
    }),
  }));
}

function buildToolCalls(toolCalls: ToolCallAuditEntry[]): ToolCallTrace[] {
  return toolCalls.map((toolCall) => ({
    tool_name: toolCall.tool_name,
    step: toolCall.step,
    ok: toolCall.ok,
    latency_ms: toolCall.latency_ms,
    error_code: toolCall.error?.code,
    decision_reason: toolCall.decision_reason,
  }));
}

export function buildReadingRunTrace(
  state: ReadingTraceState,
  options: BuildReadingRunTraceOptions,
): ReadingRunTrace {
  const startedAt = state.traceStartedAt ?? new Date().toISOString();
  const endedAt = options.endedAt ?? new Date().toISOString();
  const grounding = buildFinalAnswerGrounding(state);
  const usedSourceIds = new Set(grounding.used_source_ids);

  return {
    run_id: state.runId ?? state.reading?.reading_id ?? crypto.randomUUID(),
    started_at: startedAt,
    ended_at: endedAt,
    status: options.status,
    agent_steps: buildAgentSteps(state, grounding, endedAt),
    tool_calls: buildToolCalls(state.toolCalls ?? []),
    retrieval_sources: buildRetrievalSources(state.observations ?? [], usedSourceIds),
    generation: state.generationMode
      ? {
          mode: state.generationMode,
          stages: state.generationPlan?.stages ?? (
            state.generationStage ? [state.generationStage] : []
          ),
          max_requests: state.generationPlan?.max_requests ?? 0,
          attempts: state.generationAttempts ?? [],
          failure_stage: state.failureStage,
          failure_subtype: state.failureSubtype,
        }
      : undefined,
    final_answer_grounding: grounding,
    safety: {
      policy_version: state.frictionResult?.policy_version ?? "safety-rules-v1",
      rule_ids: state.frictionResult?.rule_ids ?? [],
      action_type: state.frictionResult?.type ?? "pass",
    },
  };
}
