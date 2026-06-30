import "server-only";

import { ReadingServiceError } from "@/server/reading/errors";

export interface BetaOpsConfig {
  userDailyLimit: number;
  anonymousDailyLimit: number;
  ipMinuteLimit: number;
}

export interface EncyclopediaQuotaConfig {
  userDailyLimit: number;
  anonymousDailyLimit: number;
  ipMinuteLimit: number;
}

export interface LlmTokenBudgetConfig {
  dailyTokenLimit: number;
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

export function getReadingProviderName(env: NodeJS.ProcessEnv = process.env) {
  return env.AETHERTAROT_READING_PROVIDER ?? "placeholder";
}

export function isEncyclopediaQueryEnabled(
  env: NodeJS.ProcessEnv = process.env,
) {
  return (env.AETHERTAROT_ENCYCLOPEDIA_PROVIDER ?? "disabled") === "llm";
}

export function getBetaOpsConfig(
  env: NodeJS.ProcessEnv = process.env,
): BetaOpsConfig {
  return {
    userDailyLimit: parsePositiveInteger({
      env,
      name: "AETHERTAROT_READING_DAILY_LIMIT_PER_USER",
      fallback: 10,
    }),
    anonymousDailyLimit: parsePositiveInteger({
      env,
      name: "AETHERTAROT_READING_DAILY_LIMIT_PER_ANONYMOUS_IP",
      fallback: 1,
    }),
    ipMinuteLimit: parsePositiveInteger({
      env,
      name: "AETHERTAROT_LLM_IP_LIMIT_PER_MINUTE",
      fallback: 6,
    }),
  };
}

export function getEncyclopediaQuotaConfig(
  env: NodeJS.ProcessEnv = process.env,
): EncyclopediaQuotaConfig {
  return {
    userDailyLimit: parsePositiveInteger({
      env,
      name: "AETHERTAROT_ENCYCLOPEDIA_DAILY_LIMIT_PER_USER",
      fallback: 20,
    }),
    anonymousDailyLimit: parsePositiveInteger({
      env,
      name: "AETHERTAROT_ENCYCLOPEDIA_DAILY_LIMIT_PER_ANONYMOUS_IP",
      fallback: 1,
    }),
    ipMinuteLimit: parsePositiveInteger({
      env,
      name: "AETHERTAROT_LLM_IP_LIMIT_PER_MINUTE",
      fallback: 6,
    }),
  };
}

export function getLlmTokenBudgetConfig(
  env: NodeJS.ProcessEnv = process.env,
): LlmTokenBudgetConfig {
  return {
    dailyTokenLimit: parsePositiveInteger({
      env,
      name: "AETHERTAROT_LLM_DAILY_TOKEN_LIMIT",
      fallback: 200_000,
    }),
  };
}
