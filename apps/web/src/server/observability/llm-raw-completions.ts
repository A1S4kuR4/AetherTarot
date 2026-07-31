import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

export interface LlmRawCompletion {
  run_id?: string;
  stage_id?: string;
  attempt_id?: string;
  stage?: string;
  attempt?: number;
  kind?: "generate" | "retry" | "repair";
  text: string;
}

const rawCompletionStorage = new AsyncLocalStorage<LlmRawCompletion[]>();

export class LlmRawCompletionCollectionError extends Error {
  cause: unknown;
  completions: LlmRawCompletion[];

  constructor(cause: unknown, completions: LlmRawCompletion[]) {
    super(cause instanceof Error ? cause.message : "Raw completion collection failed");
    this.name = "LlmRawCompletionCollectionError";
    this.cause = cause;
    this.completions = completions;
  }
}

export function recordLlmRawCompletion(completion: LlmRawCompletion) {
  rawCompletionStorage.getStore()?.push(completion);
}

export async function collectLlmRawCompletions<T>(
  callback: () => Promise<T>,
) {
  const completions: LlmRawCompletion[] = [];
  try {
    const result = await rawCompletionStorage.run(completions, callback);
    return { result, completions };
  } catch (error) {
    throw new LlmRawCompletionCollectionError(error, completions);
  }
}

export function unwrapLlmRawCompletionError(error: unknown) {
  return error instanceof LlmRawCompletionCollectionError
    ? { cause: error.cause, completions: error.completions }
    : { cause: error, completions: [] };
}
