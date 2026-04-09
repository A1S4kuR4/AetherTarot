import { z } from "zod";

export const questionTypeSchema = z.enum([
  "relationship",
  "career",
  "self_growth",
  "decision",
  "other",
]);

export const readingRequestCardInputSchema = z.object({
  positionId: z.string().trim().min(1, "positionId 不能为空。"),
  cardId: z.string().trim().min(1, "cardId 不能为空。"),
  isReversed: z.boolean(),
});

export const readingRequestPayloadSchema = z.object({
  question: z.string().trim().min(1, "question 不能为空。"),
  spreadId: z.string().trim().min(1, "spreadId 不能为空。"),
  drawnCards: z
    .array(readingRequestCardInputSchema)
    .min(1, "drawnCards 至少需要包含一张牌。"),
});

const spreadPositionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
});

const spreadSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  englishName: z.string().min(1),
  description: z.string().min(1),
  icon: z.string().min(1),
  positions: z.array(spreadPositionSchema).min(1),
});

const readingCardResultSchema = z.object({
  card_id: z.string().min(1),
  name: z.string().min(1),
  english_name: z.string().min(1),
  orientation: z.enum(["upright", "reversed"]),
  position_id: z.string().min(1),
  position: z.string().min(1),
  position_meaning: z.string().min(1),
  interpretation: z.string().min(1),
});

export const structuredReadingSchema = z.object({
  reading_id: z.string().min(1),
  locale: z.string().min(1),
  question: z.string().min(1),
  question_type: questionTypeSchema,
  spread: spreadSchema,
  cards: z.array(readingCardResultSchema).min(1),
  themes: z.array(z.string().min(1)).min(2).max(4),
  synthesis: z.string().min(1),
  reflective_guidance: z.array(z.string().min(1)).min(2).max(4),
  follow_up_questions: z.array(z.string().min(1)).min(1).max(2),
  safety_note: z.string().min(1).nullable(),
  confidence_note: z.string().min(1).nullable(),
  session_capsule: z.string().min(1).nullable(),
  sober_check: z.string().min(1).nullable().optional(),
  presentation_mode: z.enum(["standard", "void_narrative", "sober_anchor"]).optional(),
});
