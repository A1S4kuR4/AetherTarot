import type {
  EncyclopediaQueryRequest,
  EncyclopediaQueryResponse,
} from "@aethertarot/shared-types";
import { z } from "zod";

export const encyclopediaQueryRequestSchema: z.ZodType<EncyclopediaQueryRequest> = z.object({
  query: z.string().trim().min(1, "query 不能为空。").max(500, "query 不能超过 500 个字符。"),
  cardId: z.string().trim().min(1).max(80).optional(),
});

const encyclopediaSourceSchema = z.object({
  title: z.string().min(1),
  path: z.string().min(1),
  type: z.enum(["card", "concept", "spread"]),
  source_ids: z.array(z.string().min(1)),
  excerpt: z.string().min(1),
});

export const encyclopediaQueryResponseSchema: z.ZodType<EncyclopediaQueryResponse> = z.object({
  answer: z.string().min(1),
  sources: z.array(encyclopediaSourceSchema),
  related_cards: z.array(z.string().min(1)),
  related_concepts: z.array(z.string().min(1)),
  related_spreads: z.array(z.string().min(1)),
  boundary_note: z.string().min(1).nullable(),
});
