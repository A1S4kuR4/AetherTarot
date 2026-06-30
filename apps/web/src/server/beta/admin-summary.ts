import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireBetaTesterAccess } from "@/server/beta/access";
import { getLlmTokenBudgetConfig } from "@/server/beta/config";
import { ReadingServiceError } from "@/server/reading/errors";

interface ReadingEventRow {
  user_id: string | null;
  ip_hash: string | null;
  phase: "initial" | "final" | null;
  status: "success" | "failure";
  error_code: string | null;
  estimated_cost_usd: number | string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  completed_initial: boolean | null;
  completed_final: boolean | null;
}

interface FeedbackRow {
  labels: string[] | null;
}

interface EncyclopediaEventRow {
  user_id: string | null;
  ip_hash: string | null;
  status: "success" | "failure";
  error_code: string | null;
  estimated_cost_usd: number | string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
}

interface DailyTokenRow {
  consumed_tokens: number | null;
  outstanding_reserved_tokens: number | null;
}

export function getBeijingDayWindow(now = new Date(), days = 1) {
  const windowDays = Math.max(1, Math.floor(days));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const usageDay = `${part("year")}-${part("month")}-${part("day")}`;

  const sinceDate = new Date(now);
  if (windowDays > 1) {
    sinceDate.setDate(sinceDate.getDate() - (windowDays - 1));
  }
  const sinceParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(sinceDate);
  const sincePart = (type: string) =>
    sinceParts.find((item) => item.type === type)?.value ?? "";
  const sinceDay = `${sincePart("year")}-${sincePart("month")}-${sincePart("day")}`;

  return {
    usageDay,
    sinceDay,
    since: new Date(`${sinceDay}T00:00:00+08:00`).toISOString(),
  };
}

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function increment(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

export async function getAdminSummary(days: number = 1) {
  await requireBetaTesterAccess("admin");

  const windowDays = Math.max(1, Math.floor(days));
  const tokenBudget = getLlmTokenBudgetConfig();

  if (process.env.AETHERTAROT_MOCK_ADMIN_SUMMARY === "1") {
    return {
      since: getBeijingDayWindow(new Date(), windowDays).since,
      readingRequests: 124,
      registeredReadingRequests: 100,
      guestReadingRequests: 24,
      encyclopediaRequests: 86,
      registeredEncyclopediaRequests: 50,
      guestEncyclopediaRequests: 36,
      activeUsers: 42,
      registeredUsers: 30,
      guestUsers: 12,
      estimatedCostCny: 15.65,
      totalTokens: 480000,
      outstandingReservedTokens: 120000,
      tokenLimit: tokenBudget.dailyTokenLimit * windowDays,
      successCount: 195,
      failureCount: 15,
      failureByCode: { "rate_limited": 8, "provider_timeout": 5, "unknown": 2 },
      initialSuccess: 110,
      finalSuccess: 105,
      twoStageCompletionRate: 0.954,
      feedbackCount: 36,
      feedbackByLabel: { "insightful": 20, "accurate": 12, "confusing": 4 },
    };
  }

  const adminClient = createAdminClient();

  if (!adminClient) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "管理后台未配置 Supabase service role key。",
      503,
    );
  }

  const { usageDay, sinceDay, since } = getBeijingDayWindow(new Date(), windowDays);
  const [
    { data: eventRows, error: eventError },
    { data: encyclopediaEventRows, error: encyclopediaEventError },
    { data: feedbackRows, error: feedbackError },
    { data: tokenRows, error: tokenError },
  ] = await Promise.all([
    adminClient
      .from("reading_events")
      .select("user_id, ip_hash, phase, status, error_code, estimated_cost_usd, prompt_tokens, completion_tokens, total_tokens, completed_initial, completed_final")
      .gte("created_at", since)
      .limit(10000),
    adminClient
      .from("encyclopedia_events")
      .select("user_id, ip_hash, status, error_code, estimated_cost_usd, prompt_tokens, completion_tokens")
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
      .gte("usage_day", sinceDay)
      .lte("usage_day", usageDay)
      .limit(windowDays),
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
  const tokens = (tokenRows ?? []) as DailyTokenRow[];

  const registeredUsers = new Set<string>();
  const guestUsers = new Set<string>();
  let registeredReadingRequests = 0;
  let guestReadingRequests = 0;
  let registeredEncyclopediaRequests = 0;
  let guestEncyclopediaRequests = 0;

  const failureByCode: Record<string, number> = {};
  const feedbackByLabel: Record<string, number> = {};

  for (const event of events) {
    if (event.user_id) {
      registeredUsers.add(event.user_id);
      registeredReadingRequests++;
    } else if (event.ip_hash) {
      guestUsers.add(event.ip_hash);
      guestReadingRequests++;
    }
    if (event.status === "failure") {
      increment(failureByCode, event.error_code ?? "unknown");
    }
  }

  for (const event of encyclopediaEvents) {
    if (event.user_id) {
      registeredUsers.add(event.user_id);
      registeredEncyclopediaRequests++;
    } else if (event.ip_hash) {
      guestUsers.add(event.ip_hash);
      guestEncyclopediaRequests++;
    }
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

  const totalPromptTokens =
    events.reduce((sum, event) => sum + numberValue(event.prompt_tokens), 0) +
    encyclopediaEvents.reduce((sum, event) => sum + numberValue(event.prompt_tokens), 0);

  const totalCompletionTokens =
    events.reduce((sum, event) => sum + numberValue(event.completion_tokens), 0) +
    encyclopediaEvents.reduce((sum, event) => sum + numberValue(event.completion_tokens), 0);

  const estimatedCostCny = (totalPromptTokens / 1_000_000) * 1.00 + (totalCompletionTokens / 1_000_000) * 2.00;

  return {
    since,
    readingRequests: events.length,
    registeredReadingRequests,
    guestReadingRequests,
    encyclopediaRequests: encyclopediaEvents.length,
    registeredEncyclopediaRequests,
    guestEncyclopediaRequests,
    activeUsers: registeredUsers.size + guestUsers.size,
    registeredUsers: registeredUsers.size,
    guestUsers: guestUsers.size,
    estimatedCostCny,
    totalTokens: tokens.reduce(
      (sum, row) => sum + numberValue(row.consumed_tokens),
      0,
    ),
    outstandingReservedTokens: tokens.reduce(
      (sum, row) => sum + numberValue(row.outstanding_reserved_tokens),
      0,
    ),
    tokenLimit: tokenBudget.dailyTokenLimit * windowDays,
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
