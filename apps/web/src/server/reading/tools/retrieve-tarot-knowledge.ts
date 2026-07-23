import { z } from "zod";
import { loadTarotKnowledgeChunks } from "@/server/reading/knowledge/loader";
import {
  retrieveMinimumGroundingChunks,
  retrieveTarotKnowledgeChunks,
} from "@/server/reading/knowledge/retrieval";
import type { ReadingToolDefinition } from "@/server/reading/tools/types";

export const retrieveTarotKnowledgeInputSchema = z.object({
  query: z.string().trim().min(1),
  card: z.string().trim().min(1).optional(),
  orientation: z.enum(["upright", "reversed", "unknown"]).optional(),
  topic: z.string().trim().min(1).optional(),
  spreadId: z.string().trim().min(1).optional(),
  cards: z.array(z.object({
    cardId: z.string().trim().min(1),
    orientation: z.enum(["upright", "reversed", "unknown"]),
    positionId: z.string().trim().min(1),
  })).min(1).max(10).optional(),
});

export const retrieveTarotKnowledgeOutputSchema = z.object({
  chunks: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      content: z.string().min(1),
      source: z.string().min(1),
      source_ids: z.array(z.string().min(1)),
      source_id: z.string().min(1),
      card: z.string().min(1).optional(),
      spread: z.string().min(1).optional(),
      orientation: z.enum(["upright", "reversed", "unknown"]).optional(),
      score: z.number().nonnegative(),
      confidence: z.enum(["low", "medium", "high"]),
    }),
  ),
  groundingStatus: z.enum(["retrieved", "none"]),
});

export type RetrieveTarotKnowledgeInput = z.infer<
  typeof retrieveTarotKnowledgeInputSchema
>;

export type RetrieveTarotKnowledgeOutput = z.infer<
  typeof retrieveTarotKnowledgeOutputSchema
>;

export function isRetrieveTarotKnowledgeOutput(
  value: unknown,
): value is RetrieveTarotKnowledgeOutput {
  return (
    Boolean(value)
    && typeof value === "object"
    && Array.isArray((value as { chunks?: unknown }).chunks)
    && (
      (value as { groundingStatus?: unknown }).groundingStatus === "retrieved"
      || (value as { groundingStatus?: unknown }).groundingStatus === "none"
    )
  );
}

export const retrieveTarotKnowledgeTool: ReadingToolDefinition<
  RetrieveTarotKnowledgeInput,
  RetrieveTarotKnowledgeOutput
> = {
  name: "retrieve_tarot_knowledge",
  description:
    "Retrieves source-attributed tarot knowledge chunks from the local AetherTarot knowledge wiki using metadata and keyword scoring.",
  permission: "public",
  riskLevel: "low",
  inputSchema: retrieveTarotKnowledgeInputSchema,
  outputSchema: retrieveTarotKnowledgeOutputSchema,
  timeoutMs: 2_000,
  traceable: true,
  async run(input) {
    const chunks = await loadTarotKnowledgeChunks();
    const rankedChunks = input.cards
      ? retrieveMinimumGroundingChunks({
          chunks,
          query: input.query,
          cards: input.cards,
          spreadId: input.spreadId,
          topic: input.topic,
          limit: 12,
        })
      : retrieveTarotKnowledgeChunks({
          chunks,
          query: input.query,
          card: input.card,
          orientation: input.orientation,
          topic: input.topic,
          topK: 5,
        });
    const retrievedChunks = rankedChunks.map((chunk) => ({
      id: chunk.id,
      title: chunk.title,
      content: chunk.content,
      source: chunk.source,
      source_ids: chunk.source_ids ?? (chunk.source_id ? [chunk.source_id] : []),
      source_id: chunk.source_id
        ?? (chunk.source_ids?.length ? chunk.source_ids.join(",") : "unregistered"),
      card: chunk.card,
      spread: chunk.spread,
      orientation: chunk.orientation,
      score: chunk.score,
      confidence: chunk.confidence,
    }));

    return {
      chunks: retrievedChunks,
      groundingStatus: retrievedChunks.length > 0 ? "retrieved" : "none",
    };
  },
};
