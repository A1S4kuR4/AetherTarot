import "server-only";

import type { ReadingPhase } from "@aethertarot/shared-types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getBetaOpsConfig,
  getEncyclopediaQuotaConfig,
  type BetaOpsConfig,
  type EncyclopediaQuotaConfig,
} from "@/server/beta/config";
import {
  isAuthenticatedTester,
  type AuthenticatedTester,
  type PublicFeatureActor,
} from "@/server/beta/access";
import { ReadingServiceError } from "@/server/reading/errors";

interface QuotaRpcResult {
  allowed?: unknown;
  reason?: unknown;
  retry_after_seconds?: unknown;
}

interface ConsumeReadingQuotaInput {
  actor: PublicFeatureActor;
  ipHash: string;
  phase: ReadingPhase;
  config?: BetaOpsConfig;
}

interface ConsumeEncyclopediaQuotaInput {
  actor: PublicFeatureActor;
  ipHash: string;
  config?: EncyclopediaQuotaConfig;
}

function asQuotaResult(value: unknown): QuotaRpcResult {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as QuotaRpcResult;
  }

  return {};
}

function getLimitMessage(reason: string, actor: PublicFeatureActor) {
  switch (reason) {
    case "user_daily":
      if (!isAuthenticatedTester(actor)) {
        return "今日访客完整解读次数已用完。登录内测账号可使用更多次数。";
      }
      return "你今日的完整解读次数已达上限，请明天再试。";
    case "ip_minute":
      return "当前网络请求过于频繁，请稍后再试。";
    default:
      return "当前解读请求已达内测限额，请稍后再试。";
  }
}

function getEncyclopediaLimitMessage(reason: string, actor: PublicFeatureActor) {
  switch (reason) {
    case "user_daily":
      if (!isAuthenticatedTester(actor)) {
        return "今日访客百科问答体验次数已用完。登录内测账号可使用更多次数。";
      }
      return "你今日的百科问答次数已达上限，请明天再试。";
    case "ip_minute":
      return "当前网络百科问答请求过于频繁，请稍后再试。";
    default:
      return "当前百科问答请求已达内测限额，请稍后再试。";
  }
}

export function shouldBypassRequestQuota(tester: AuthenticatedTester) {
  return tester.role === "admin";
}

export async function consumeReadingQuota({
  actor,
  ipHash,
  phase,
  config = getBetaOpsConfig(),
}: ConsumeReadingQuotaInput) {
  if (isAuthenticatedTester(actor) && shouldBypassRequestQuota(actor)) {
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

  const { data, error } = isAuthenticatedTester(actor)
    ? await adminClient.rpc("consume_reading_phase_quota", {
      p_user_id: actor.userId,
      p_ip_hash: ipHash,
      p_user_daily_limit: config.userDailyLimit,
      p_ip_minute_limit: config.ipMinuteLimit,
      p_charge_daily_quota: phase === "initial",
    })
    : await adminClient.rpc("consume_anonymous_reading_phase_quota", {
      p_ip_hash: ipHash,
      p_anonymous_daily_limit: config.anonymousDailyLimit,
      p_ip_minute_limit: config.ipMinuteLimit,
      p_charge_daily_quota: phase === "initial",
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
    getLimitMessage(reason, actor),
    429,
    undefined,
    undefined,
    { reason, retry_after_seconds: retryAfterSeconds },
  );
}

export async function refundReadingQuota({
  actor,
  ipHash,
}: Pick<ConsumeReadingQuotaInput, "actor" | "ipHash">) {
  if (isAuthenticatedTester(actor) && shouldBypassRequestQuota(actor)) {
    return;
  }

  const adminClient = createAdminClient();

  if (!adminClient) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "内测配额退款未配置 Supabase service role key。",
      503,
    );
  }

  const { error } = await adminClient.rpc("refund_reading_daily_quota", {
    p_user_id: actor.userId,
    p_ip_hash: ipHash,
  });

  if (error) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "内测配额退款失败。",
      503,
    );
  }
}

export async function consumeEncyclopediaQuota({
  actor,
  ipHash,
  config = getEncyclopediaQuotaConfig(),
}: ConsumeEncyclopediaQuotaInput) {
  if (isAuthenticatedTester(actor) && shouldBypassRequestQuota(actor)) {
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

  const { data, error } = isAuthenticatedTester(actor)
    ? await adminClient.rpc("consume_encyclopedia_quota", {
      p_user_id: actor.userId,
      p_ip_hash: ipHash,
      p_user_daily_limit: config.userDailyLimit,
      p_ip_minute_limit: config.ipMinuteLimit,
    })
    : await adminClient.rpc("consume_anonymous_encyclopedia_quota", {
      p_ip_hash: ipHash,
      p_anonymous_daily_limit: config.anonymousDailyLimit,
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
    getEncyclopediaLimitMessage(reason, actor),
    429,
    undefined,
    undefined,
    { reason, retry_after_seconds: retryAfterSeconds },
  );
}
