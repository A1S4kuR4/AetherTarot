import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getLlmTokenBudgetConfig } from "@/server/beta/config";
import { ReadingServiceError } from "@/server/reading/errors";

export type LlmTokenSource = "reading" | "encyclopedia";

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

export const databaseLlmTokenGate: LlmTokenGate = {
  async reserve({ source, promptText, maxOutputTokens }) {
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
      p_daily_limit: getLlmTokenBudgetConfig().dailyTokenLimit,
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
