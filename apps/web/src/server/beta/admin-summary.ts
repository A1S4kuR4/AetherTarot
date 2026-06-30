import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireBetaTesterAccess } from "@/server/beta/access";
import { getLlmTokenBudgetConfig } from "@/server/beta/config";
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

interface EncyclopediaEventRow {
  user_id: string | null;
  status: "success" | "failure";
  error_code: string | null;
  estimated_cost_usd: number | string | null;
}

interface DailyTokenRow {
  consumed_tokens: number | null;
  outstanding_reserved_tokens: number | null;
}

export function getBeijingDayWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const usageDay = `${part("year")}-${part("month")}-${part("day")}`;

  return {
    usageDay,
    since: new Date(`${usageDay}T00:00:00+08:00`).toISOString(),
  };
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

  const { usageDay, since } = getBeijingDayWindow();
  const [
    { data: eventRows, error: eventError },
    { data: encyclopediaEventRows, error: encyclopediaEventError },
    { data: feedbackRows, error: feedbackError },
    { data: tokenRow, error: tokenError },
  ] = await Promise.all([
    adminClient
      .from("reading_events")
      .select("user_id, phase, status, error_code, estimated_cost_usd, total_tokens, completed_initial, completed_final")
      .gte("created_at", since)
      .limit(10000),
    adminClient
      .from("encyclopedia_events")
      .select("user_id, status, error_code, estimated_cost_usd")
      .gte("created_at", since)
      .limit(10000),
    adminClient
      .from("reading_feedback")
      .select("labels")
      .gte("created_at", since)
      .limit(10000),
    adminClient
      .from("llm_daily_token_usage")
      .select("consumed_tokens, outstanding_reserved_tokens")
      .eq("usage_day", usageDay)
      .maybeSingle(),
  ]);

  if (eventError || encyclopediaEventError || feedbackError || tokenError) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "管理后台统计查询失败，请稍后再试。",
      503,
    );
  }

  const events = (eventRows ?? []) as ReadingEventRow[];
  const encyclopediaEvents = (encyclopediaEventRows ?? []) as EncyclopediaEventRow[];
  const feedback = (feedbackRows ?? []) as FeedbackRow[];
  const activeUsers = new Set(
    [...events, ...encyclopediaEvents]
      .map((event) => event.user_id)
      .filter((value): value is string => Boolean(value)),
  );
  const failureByCode: Record<string, number> = {};
  const feedbackByLabel: Record<string, number> = {};

  for (const event of events) {
    if (event.status === "failure") {
      increment(failureByCode, event.error_code ?? "unknown");
    }
  }

  for (const event of encyclopediaEvents) {
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
    encyclopediaRequests: encyclopediaEvents.length,
    activeUsers: activeUsers.size,
    estimatedCostUsd:
      events.reduce((sum, event) => sum + numberValue(event.estimated_cost_usd), 0)
      + encyclopediaEvents.reduce(
        (sum, event) => sum + numberValue(event.estimated_cost_usd),
        0,
      ),
    totalTokens: numberValue((tokenRow as DailyTokenRow | null)?.consumed_tokens),
    outstandingReservedTokens: numberValue(
      (tokenRow as DailyTokenRow | null)?.outstanding_reserved_tokens,
    ),
    tokenLimit: getLlmTokenBudgetConfig().dailyTokenLimit,
    successCount:
      events.filter((event) => event.status === "success").length
      + encyclopediaEvents.filter((event) => event.status === "success").length,
    failureCount:
      events.filter((event) => event.status === "failure").length
      + encyclopediaEvents.filter((event) => event.status === "failure").length,
    failureByCode,
    initialSuccess,
    finalSuccess,
    twoStageCompletionRate:
      initialSuccess > 0 ? Math.min(1, finalSuccess / initialSuccess) : 0,
    feedbackCount: feedback.length,
    feedbackByLabel,
  };
}
