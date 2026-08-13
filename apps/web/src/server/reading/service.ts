import "server-only";

import type {
  ReadingRequestPayload,
  StructuredReading,
} from "@aethertarot/shared-types";
import {
  runReadingGraphWithDiagnostics,
  type ReadingGraphDiagnostics,
  type RunReadingGraphOptions,
} from "@/server/reading/graph";

export type ReadingServiceOptions = Pick<
  RunReadingGraphOptions,
  | "initialReading"
  | "memoryUserId"
  | "sessionMemoryStore"
  | "generationMode"
  | "signal"
  | "safetyReviewer"
  | "inputSafetyReview"
>;

export async function generateStructuredReadingWithDiagnostics(
  payload: ReadingRequestPayload,
  options?: ReadingServiceOptions,
): Promise<ReadingGraphDiagnostics> {
  return runReadingGraphWithDiagnostics(payload, options);
}

export async function generateStructuredReading(
  payload: ReadingRequestPayload,
  options?: ReadingServiceOptions,
): Promise<StructuredReading> {
  const diagnostics = await generateStructuredReadingWithDiagnostics(
    payload,
    options,
  );
  return diagnostics.reading;
}
