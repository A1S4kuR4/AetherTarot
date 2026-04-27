import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getBetaOpsConfig, type BetaOpsConfig } from "@/server/beta/config";
import type { AuthenticatedTester } from "@/server/beta/access";
import { ReadingServiceError } from "@/server/reading/errors";

interface QuotaRpcResult {
  allowed?: unknown;
  reason?: unknown;
  retry_after_seconds?: unknown;
}

interface ConsumeReadingQuotaInput {
  tester: AuthenticatedTester;
  ipHash: string;
  config?: BetaOpsConfig;
}

function asQuotaResult(value: unknown): QuotaRpcResult {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as QuotaRpcResult;
  }

  return {};
}

function getLimitMessage(reason: string) {
  switch (reason) {
    case "email_daily":
      return "当前邮箱今日 reading 次数已达上限，请明天再试。";
    case "ip_minute":
      return "当前网络请求过于频繁，请稍后再试。";
    case "ip_daily":
      return "当前网络今日 reading 次数已达上限，请明天再试。";
    default:
      return "当前 reading 请求已达内测限额，请稍后再试。";
  }
}

export function shouldBypassReadingQuota(tester: AuthenticatedTester) {
  return tester.role === "admin";
}

export async function consumeReadingQuota({
  tester,
  ipHash,
  config = getBetaOpsConfig(),
}: ConsumeReadingQuotaInput) {
  if (shouldBypassReadingQuota(tester)) {
    return;
  }

  const adminClient = createAdminClient();

  if (!adminClient) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "内测配额控制未配置 Supabase service role key。",
      503,
    );
  }

  const { data, error } = await adminClient.rpc("consume_reading_quota", {
    p_email: tester.email,
    p_user_id: tester.userId,
    p_ip_hash: ipHash,
    p_email_daily_limit: config.emailDailyLimit,
    p_ip_minute_limit: config.ipMinuteLimit,
    p_ip_daily_limit: config.ipDailyLimit,
    p_daily_cost_limit_usd: config.dailyLlmCostLimitUsd,
    p_cost_reservation_usd: config.llmCostReservationUsd,
  });

  if (error) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "内测配额检查失败，请稍后再试。",
      503,
    );
  }

  const result = asQuotaResult(data);

  if (result.allowed === true) {
    return;
  }

  const reason = typeof result.reason === "string" ? result.reason : "unknown";
  const retryAfterSeconds =
    typeof result.retry_after_seconds === "number"
      ? result.retry_after_seconds
      : undefined;

  if (reason === "llm_daily_cost") {
    throw new ReadingServiceError(
      "cost_limit_exceeded",
      "今日 LLM 预算已达上限，内测 reading 暂停到明天恢复。",
      429,
      undefined,
      undefined,
      { reason, retry_after_seconds: retryAfterSeconds },
    );
  }

  throw new ReadingServiceError(
    "rate_limited",
    getLimitMessage(reason),
    429,
    undefined,
    undefined,
    { reason, retry_after_seconds: retryAfterSeconds },
  );
}
