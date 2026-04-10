import "server-only";

import type {
  ReadingRequestPayload,
  StructuredReading,
} from "@aethertarot/shared-types";
import { runReadingGraph } from "@/server/reading/graph";

export async function generateStructuredReading(
  payload: ReadingRequestPayload,
): Promise<StructuredReading> {
  return runReadingGraph(payload);
}
