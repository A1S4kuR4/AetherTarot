import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getLlmTokenBudgetConfig,
  getSafetyReviewerTokenBudgetConfig,
} from "@/server/beta/config";
import { ReadingServiceError } from "@/server/reading/errors";

export type LlmTokenSource =
  | "reading"
  | "encyclopedia"
  | "safety_input"
  | "safety_output";

export interface LlmTokenReservation {
  id: string;
  reservedTokens: number;
}

export interface LlmTokenGate {
  reserve(input: {
    source: LlmTokenSource;
    promptText: string;
    maxOutputTokens: number;
  }): Promise<LlmTokenReservation>;
  settle(input: {
    reservation: LlmTokenReservation;
    actualTokens?: number;
  }): Promise<void>;
}

interface ReservationRpcResult {
  allowed?: unknown;
  reservation_id?: unknown;
  reserved_tokens?: unknown;
  reason?: unknown;
  retry_after_seconds?: unknown;
}

export function getReservationTokenCount(
  promptText: string,
  maxOutputTokens: number,
) {
  return new TextEncoder().encode(promptText).byteLength + maxOutputTokens;
}

function asReservationRpcResult(value: unknown): ReservationRpcResult {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as ReservationRpcResult;
  }

  return {};
}

function createDatabaseLlmTokenGate(getDailyLimit: () => number): LlmTokenGate {
  return {
  async reserve({ source, promptText, maxOutputTokens }) {
    if (source !== "reading" && source !== "encyclopedia") {
      throw new ReadingServiceError(
        "provider_unavailable",
        "正文生成 token gate 收到不支持的 source。",
        503,
      );
    }
    const adminClient = createAdminClient();

    if (!adminClient) {
      throw new ReadingServiceError(
        "provider_unavailable",
        "LLM token 额度控制未配置 Supabase service role key。",
        503,
      );
    }

    const requestedTokens = getReservationTokenCount(promptText, maxOutputTokens);
    const { data, error } = await adminClient.rpc("reserve_daily_llm_tokens", {
      p_source: source,
      p_requested_tokens: requestedTokens,
      p_daily_limit: getDailyLimit(),
    });

    if (error) {
      throw new ReadingServiceError(
        "provider_unavailable",
        "LLM token 额度检查失败，请稍后再试。",
        503,
      );
    }

    const result = asReservationRpcResult(data);

    if (result.allowed !== true) {
      const retryAfterSeconds =
        typeof result.retry_after_seconds === "number"
          ? result.retry_after_seconds
          : undefined;

      throw new ReadingServiceError(
        "token_limit_exceeded",
        "今日体验额度已用完，请于明日再试。",
        429,
        undefined,
        undefined,
        { reason: "llm_daily_tokens", retry_after_seconds: retryAfterSeconds },
      );
    }

    if (
      typeof result.reservation_id !== "string"
      || typeof result.reserved_tokens !== "number"
    ) {
      throw new ReadingServiceError(
        "provider_unavailable",
        "LLM token 额度预占返回无效结果。",
        503,
      );
    }

    return {
      id: result.reservation_id,
      reservedTokens: result.reserved_tokens,
    };
  },

  async settle({ reservation, actualTokens }) {
    const adminClient = createAdminClient();

    if (!adminClient) {
      console.warn("[quota] unable to settle LLM token reservation: missing admin client");
      return;
    }

    const settledTokens = actualTokens ?? reservation.reservedTokens;
    const { error } = await adminClient.rpc("settle_daily_llm_tokens", {
      p_reservation_id: reservation.id,
      p_actual_tokens: settledTokens,
    });

    if (error) {
      console.warn("[quota] failed to settle LLM token reservation", {
        code: error.code,
        message: error.message,
      });
    }
  },
  };
}

export const databaseLlmTokenGate = createDatabaseLlmTokenGate(
  () => getLlmTokenBudgetConfig().dailyTokenLimit,
);

export const databaseSafetyReviewerTokenGate: LlmTokenGate = {
  async reserve({ source, promptText, maxOutputTokens }) {
    if (source !== "safety_input" && source !== "safety_output") {
      throw new ReadingServiceError(
        "provider_unavailable",
        "安全审校 token gate 收到不支持的 source。",
        503,
      );
    }
    const adminClient = createAdminClient();
    if (!adminClient) {
      throw new ReadingServiceError(
        "provider_unavailable",
        "Safety Reviewer token 额度控制未配置 Supabase service role key。",
        503,
      );
    }
    const requestedTokens = getReservationTokenCount(promptText, maxOutputTokens);
    const { data, error } = await adminClient.rpc(
      "reserve_daily_safety_reviewer_tokens",
      {
        p_source: source,
        p_requested_tokens: requestedTokens,
        p_daily_limit: getSafetyReviewerTokenBudgetConfig().dailyTokenLimit,
      },
    );
    if (error) {
      throw new ReadingServiceError(
        "provider_unavailable",
        "Safety Reviewer token 额度检查失败，请稍后再试。",
        503,
      );
    }
    const result = asReservationRpcResult(data);
    if (result.allowed !== true) {
      throw new ReadingServiceError(
        "provider_unavailable",
        "安全审校服务暂时不可用，请稍后重试。",
        503,
        undefined,
        undefined,
        { reason: "safety_reviewer_daily_tokens" },
      );
    }
    if (
      typeof result.reservation_id !== "string"
      || typeof result.reserved_tokens !== "number"
    ) {
      throw new ReadingServiceError(
        "provider_unavailable",
        "Safety Reviewer token 额度预占返回无效结果。",
        503,
      );
    }
    return { id: result.reservation_id, reservedTokens: result.reserved_tokens };
  },

  async settle({ reservation, actualTokens }) {
    const adminClient = createAdminClient();
    if (!adminClient) return;
    const { error } = await adminClient.rpc(
      "settle_daily_safety_reviewer_tokens",
      {
        p_reservation_id: reservation.id,
        p_actual_tokens: actualTokens ?? reservation.reservedTokens,
      },
    );
    if (error) {
      console.warn("[safety-reviewer] token settlement failed", {
        code: error.code,
        message: error.message,
      });
    }
  },
};
