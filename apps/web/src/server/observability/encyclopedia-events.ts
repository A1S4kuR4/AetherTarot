import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface EncyclopediaEventInput {
  userId: string | null;
  email: string | null;
  ipHash: string;
  provider: string;
  query: string | null;
  cardId: string | null;
  sourceCount: number;
  status: "success" | "failure";
  errorCode: string | null;
  durationMs: number;
  llmDurationMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export async function recordEncyclopediaEvent(input: EncyclopediaEventInput) {
  const adminClient = createAdminClient();

  if (!adminClient) {
    return;
  }

  const { error } = await adminClient.from("encyclopedia_events").insert({
    user_id: input.userId,
    email: input.email,
    ip_hash: input.ipHash,
    provider: input.provider,
    query_text: input.query,
    card_id: input.cardId,
    source_count: input.sourceCount,
    status: input.status,
    error_code: input.errorCode,
    duration_ms: input.durationMs,
    llm_duration_ms: input.llmDurationMs,
    prompt_tokens: input.promptTokens,
    completion_tokens: input.completionTokens,
    total_tokens: input.totalTokens,
    estimated_cost_usd: input.estimatedCostUsd,
  });

  if (error) {
    console.warn("[observability] failed to record encyclopedia event", {
      code: error.code,
      message: error.message,
    });
  }
}
