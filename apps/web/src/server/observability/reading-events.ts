import "server-only";

import type { ReadingPhase } from "@aethertarot/shared-types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type { PersistedReadingTraceV3 } from "@/server/reading/trace";

export interface ReadingEventInput {
  userId: string | null;
  email: string | null;
  ipHash: string;
  provider: string;
  phase: ReadingPhase | null;
  spreadId: string | null;
  readingId: string | null;
  initialReadingId: string | null;
  requestId: string | null;
  status: "success" | "failure";
  errorCode: string | null;
  durationMs: number;
  llmDurationMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  completedInitial: boolean;
  completedFinal: boolean;
  agentTrace?: PersistedReadingTraceV3 | null;
}

export async function recordReadingEvent(input: ReadingEventInput) {
  const adminClient = createAdminClient();

  if (!adminClient) {
    return;
  }

  const { error } = await adminClient.from("reading_events").insert({
    user_id: input.userId,
    email: input.email,
    ip_hash: input.ipHash,
    provider: input.provider,
    phase: input.phase,
    spread_id: input.spreadId,
    reading_id: input.readingId,
    initial_reading_id: input.initialReadingId,
    request_id: input.requestId,
    status: input.status,
    error_code: input.errorCode,
    duration_ms: input.durationMs,
    llm_duration_ms: input.llmDurationMs,
    prompt_tokens: input.promptTokens,
    completion_tokens: input.completionTokens,
    total_tokens: input.totalTokens,
    estimated_cost_usd: input.estimatedCostUsd,
    completed_initial: input.completedInitial,
    completed_final: input.completedFinal,
    agent_trace: (input.agentTrace ?? null) as Json | null,
    agent_trace_schema_version: input.agentTrace?.schema_version ?? null,
  });

  if (error) {
    console.warn("[observability] failed to record reading event", {
      code: error.code,
      message: error.message,
    });
  }
}
