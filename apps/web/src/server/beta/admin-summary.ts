import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireBetaTesterAccess } from "@/server/beta/access";
import { ReadingServiceError } from "@/server/reading/errors";

interface ReadingEventRow {
  user_id: string | null;
  phase: "initial" | "final" | null;
  status: "success" | "failure";
  error_code: string | null;
  estimated_cost_usd: number | string | null;
  total_tokens: number | null;
  completed_initial: boolean | null;
  completed_final: boolean | null;
}

interface FeedbackRow {
  labels: string[] | null;
}

function todayStartIso() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString();
}

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function increment(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

export async function getAdminSummary() {
  await requireBetaTesterAccess("admin");

  const adminClient = createAdminClient();

  if (!adminClient) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "管理后台未配置 Supabase service role key。",
      503,
    );
  }

  const since = todayStartIso();
  const [
    { data: eventRows, error: eventError },
    { data: feedbackRows, error: feedbackError },
  ] = await Promise.all([
    adminClient
      .from("reading_events")
      .select("user_id, phase, status, error_code, estimated_cost_usd, total_tokens, completed_initial, completed_final")
      .gte("created_at", since)
      .limit(10000),
    adminClient
      .from("reading_feedback")
      .select("labels")
      .gte("created_at", since)
      .limit(10000),
  ]);

  if (eventError || feedbackError) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "管理后台统计查询失败，请稍后再试。",
      503,
    );
  }

  const events = (eventRows ?? []) as ReadingEventRow[];
  const feedback = (feedbackRows ?? []) as FeedbackRow[];
  const activeUsers = new Set(
    events.map((event) => event.user_id).filter((value): value is string => Boolean(value)),
  );
  const failureByCode: Record<string, number> = {};
  const feedbackByLabel: Record<string, number> = {};

  for (const event of events) {
    if (event.status === "failure") {
      increment(failureByCode, event.error_code ?? "unknown");
    }
  }

  for (const item of feedback) {
    for (const label of item.labels ?? []) {
      increment(feedbackByLabel, label);
    }
  }

  const initialSuccess = events.filter(
    (event) => event.phase === "initial" && event.status === "success",
  ).length;
  const finalSuccess = events.filter(
    (event) => event.phase === "final" && event.status === "success",
  ).length;

  return {
    since,
    readingRequests: events.length,
    activeUsers: activeUsers.size,
    estimatedCostUsd: events.reduce(
      (sum, event) => sum + numberValue(event.estimated_cost_usd),
      0,
    ),
    totalTokens: events.reduce(
      (sum, event) => sum + numberValue(event.total_tokens),
      0,
    ),
    successCount: events.filter((event) => event.status === "success").length,
    failureCount: events.filter((event) => event.status === "failure").length,
    failureByCode,
    initialSuccess,
    finalSuccess,
    twoStageCompletionRate:
      initialSuccess > 0 ? Math.min(1, finalSuccess / initialSuccess) : 0,
    feedbackCount: feedback.length,
    feedbackByLabel,
  };
}
