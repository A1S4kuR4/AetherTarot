import "server-only";

import { ReadingServiceError } from "@/server/reading/errors";

export interface BetaOpsConfig {
  emailDailyLimit: number;
  ipMinuteLimit: number;
  ipDailyLimit: number;
  dailyLlmCostLimitUsd: number;
  llmCostReservationUsd: number;
}

export interface EncyclopediaQuotaConfig {
  emailDailyLimit: number;
  ipMinuteLimit: number;
  ipDailyLimit: number;
  dailyLlmCostLimitUsd: number;
  llmCostReservationUsd: number;
}

function parsePositiveInteger({
  env,
  name,
  fallback,
}: {
  env: NodeJS.ProcessEnv;
  name: string;
  fallback: number;
}) {
  const value = env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ReadingServiceError(
      "provider_unavailable",
      `${name} 必须是大于 0 的整数。`,
      503,
    );
  }

  return parsed;
}

function parseNonNegativeNumber({
  env,
  name,
  fallback,
}: {
  env: NodeJS.ProcessEnv;
  name: string;
  fallback: number;
}) {
  const value = env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ReadingServiceError(
      "provider_unavailable",
      `${name} 必须是大于等于 0 的数字。`,
      503,
    );
  }

  return parsed;
}

export function getReadingProviderName(env: NodeJS.ProcessEnv = process.env) {
  return env.AETHERTAROT_READING_PROVIDER ?? "placeholder";
}

export function getBetaOpsConfig(
  env: NodeJS.ProcessEnv = process.env,
): BetaOpsConfig {
  const isLlmProvider = getReadingProviderName(env) === "llm";

  return {
    emailDailyLimit: parsePositiveInteger({
      env,
      name: "AETHERTAROT_READING_DAILY_LIMIT_PER_EMAIL",
      fallback: 5,
    }),
    ipMinuteLimit: parsePositiveInteger({
      env,
      name: "AETHERTAROT_READING_IP_LIMIT_PER_MINUTE",
      fallback: 3,
    }),
    ipDailyLimit: parsePositiveInteger({
      env,
      name: "AETHERTAROT_READING_IP_LIMIT_PER_DAY",
      fallback: 20,
    }),
    dailyLlmCostLimitUsd: parseNonNegativeNumber({
      env,
      name: "AETHERTAROT_LLM_DAILY_COST_LIMIT_USD",
      fallback: 1,
    }),
    llmCostReservationUsd: isLlmProvider
      ? parseNonNegativeNumber({
        env,
        name: "AETHERTAROT_LLM_COST_RESERVATION_USD",
        fallback: 0.05,
      })
      : 0,
  };
}

export function getEncyclopediaQuotaConfig(
  env: NodeJS.ProcessEnv = process.env,
): EncyclopediaQuotaConfig {
  return {
    emailDailyLimit: parsePositiveInteger({
      env,
      name: "AETHERTAROT_ENCYCLOPEDIA_DAILY_LIMIT_PER_EMAIL",
      fallback: 20,
    }),
    ipMinuteLimit: parsePositiveInteger({
      env,
      name: "AETHERTAROT_ENCYCLOPEDIA_IP_LIMIT_PER_MINUTE",
      fallback: 6,
    }),
    ipDailyLimit: parsePositiveInteger({
      env,
      name: "AETHERTAROT_ENCYCLOPEDIA_IP_LIMIT_PER_DAY",
      fallback: 60,
    }),
    dailyLlmCostLimitUsd: parseNonNegativeNumber({
      env,
      name: "AETHERTAROT_LLM_DAILY_COST_LIMIT_USD",
      fallback: 1,
    }),
    llmCostReservationUsd: parseNonNegativeNumber({
      env,
      name: "AETHERTAROT_ENCYCLOPEDIA_LLM_COST_RESERVATION_USD",
      fallback: 0.01,
    }),
  };
}
