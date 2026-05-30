import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getBetaOpsConfig,
  getAuthEmailQuotaConfig,
  getEncyclopediaQuotaConfig,
  type AuthEmailQuotaConfig,
  type BetaOpsConfig,
  type EncyclopediaQuotaConfig,
} from "@/server/beta/config";
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

interface ConsumeEncyclopediaQuotaInput {
  tester: AuthenticatedTester;
  ipHash: string;
  config?: EncyclopediaQuotaConfig;
}

interface ConsumeAuthEmailQuotaInput {
  email: string;
  ipHash: string;
  config?: AuthEmailQuotaConfig;
}

function asQuotaResult(value: unknown): QuotaRpcResult {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as QuotaRpcResult;
  }

  return {};
}

function getLimitMessage(reason: string) {
  switch (reason) {
    case "user_daily":
      return "你今日的 reading 次数已达上限，请明天再试。";
    case "ip_minute":
      return "当前网络请求过于频繁，请稍后再试。";
    default:
      return "当前 reading 请求已达内测限额，请稍后再试。";
  }
}

function getEncyclopediaLimitMessage(reason: string) {
  switch (reason) {
    case "user_daily":
      return "你今日的百科问答次数已达上限，请明天再试。";
    case "ip_minute":
      return "当前网络百科问答请求过于频繁，请稍后再试。";
    default:
      return "当前百科问答请求已达内测限额，请稍后再试。";
  }
}

function getAuthEmailLimitMessage(reason: string) {
  switch (reason) {
    case "email_hourly":
    case "email_daily":
      return "这个邮箱的登录链接请求过于频繁，请稍后再试。";
    case "ip_hourly":
      return "当前网络登录请求过于频繁，请稍后再试。";
    case "global_hourly":
      return "当前登录邮件请求量较高，请稍后再试。";
    default:
      return "登录链接请求过于频繁，请稍后再试。";
  }
}

export function shouldBypassRequestQuota(tester: AuthenticatedTester) {
  return tester.role === "admin";
}

export async function consumeReadingQuota({
  tester,
  ipHash,
  config = getBetaOpsConfig(),
}: ConsumeReadingQuotaInput) {
  if (shouldBypassRequestQuota(tester)) {
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
    p_user_id: tester.userId,
    p_ip_hash: ipHash,
    p_user_daily_limit: config.userDailyLimit,
    p_ip_minute_limit: config.ipMinuteLimit,
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

  throw new ReadingServiceError(
    "rate_limited",
    getLimitMessage(reason),
    429,
    undefined,
    undefined,
    { reason, retry_after_seconds: retryAfterSeconds },
  );
}

export async function consumeEncyclopediaQuota({
  tester,
  ipHash,
  config = getEncyclopediaQuotaConfig(),
}: ConsumeEncyclopediaQuotaInput) {
  if (shouldBypassRequestQuota(tester)) {
    return;
  }

  const adminClient = createAdminClient();

  if (!adminClient) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "百科问答配额控制未配置 Supabase service role key。",
      503,
    );
  }

  const { data, error } = await adminClient.rpc("consume_encyclopedia_quota", {
    p_user_id: tester.userId,
    p_ip_hash: ipHash,
    p_user_daily_limit: config.userDailyLimit,
    p_ip_minute_limit: config.ipMinuteLimit,
  });

  if (error) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "百科问答配额检查失败，请稍后再试。",
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

  throw new ReadingServiceError(
    "rate_limited",
    getEncyclopediaLimitMessage(reason),
    429,
    undefined,
    undefined,
    { reason, retry_after_seconds: retryAfterSeconds },
  );
}

export async function consumeAuthEmailQuota({
  email,
  ipHash,
  config = getAuthEmailQuotaConfig(),
}: ConsumeAuthEmailQuotaInput) {
  const adminClient = createAdminClient();

  if (!adminClient) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "登录发信限流未配置 Supabase service role key。",
      503,
    );
  }

  const { data, error } = await adminClient.rpc("consume_auth_email_quota", {
    p_email: email,
    p_ip_hash: ipHash,
    p_email_hourly_limit: config.emailHourlyLimit,
    p_email_daily_limit: config.emailDailyLimit,
    p_ip_hourly_limit: config.ipHourlyLimit,
    p_global_hourly_limit: config.globalHourlyLimit,
  });

  if (error) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "登录发信限流检查失败，请稍后再试。",
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

  throw new ReadingServiceError(
    "rate_limited",
    getAuthEmailLimitMessage(reason),
    429,
    undefined,
    undefined,
    { reason, retry_after_seconds: retryAfterSeconds },
  );
}
