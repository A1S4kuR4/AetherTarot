import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

export interface LlmCallMetric {
  provider: "llm";
  model: string;
  success: boolean;
  durationMs: number;
  httpStatus?: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  errorCode?: string;
}

interface TokenUsageInput {
  promptTokens: number;
  completionTokens: number;
}

const llmUsageStorage = new AsyncLocalStorage<LlmCallMetric[]>();

export class LlmUsageCollectionError extends Error {
  calls: LlmCallMetric[];
  cause: unknown;

  constructor(error: unknown, calls: LlmCallMetric[]) {
    super(error instanceof Error ? error.message : "LLM usage collection failed");
    this.name = "LlmUsageCollectionError";
    this.cause = error;
    this.calls = calls;
  }
}

function parseNonNegativeNumber(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
) {
  const value = env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function estimateTokenCount(text: string) {
  if (!text.trim()) {
    return 0;
  }

  return Math.max(1, Math.ceil(text.length / 2));
}

export function calculateLlmCostUsd(
  usage: TokenUsageInput,
  env: NodeJS.ProcessEnv = process.env,
) {
  const inputCostPer1K = parseNonNegativeNumber(
    env,
    "AETHERTAROT_LLM_INPUT_COST_PER_1K_USD",
    0.001,
  );
  const outputCostPer1K = parseNonNegativeNumber(
    env,
    "AETHERTAROT_LLM_OUTPUT_COST_PER_1K_USD",
    0.002,
  );

  return (
    (usage.promptTokens / 1000) * inputCostPer1K
    + (usage.completionTokens / 1000) * outputCostPer1K
  );
}

export function recordLlmCall(metric: LlmCallMetric) {
  llmUsageStorage.getStore()?.push(metric);
}

export async function collectLlmUsage<T>(callback: () => Promise<T>) {
  const calls: LlmCallMetric[] = [];
  let result: T;

  try {
    result = await llmUsageStorage.run(calls, callback);
  } catch (error) {
    throw new LlmUsageCollectionError(error, calls);
  }

  return { result, calls };
}

export function unwrapLlmUsageError(error: unknown) {
  if (error instanceof LlmUsageCollectionError) {
    return {
      cause: error.cause,
      calls: error.calls,
    };
  }

  return {
    cause: error,
    calls: [],
  };
}

export function summarizeLlmCalls(calls: LlmCallMetric[]) {
  return calls.reduce(
    (summary, call) => ({
      llmDurationMs: summary.llmDurationMs + call.durationMs,
      promptTokens: summary.promptTokens + call.promptTokens,
      completionTokens: summary.completionTokens + call.completionTokens,
      totalTokens: summary.totalTokens + call.totalTokens,
      estimatedCostUsd: summary.estimatedCostUsd + call.estimatedCostUsd,
    }),
    {
      llmDurationMs: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
    },
  );
}
