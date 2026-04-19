import type { StructuredReading } from "@aethertarot/shared-types";
import { z } from "zod";

export const questionTypeSchema = z.enum([
  "relationship",
  "career",
  "self_growth",
  "decision",
  "other",
]);

export const agentProfileSchema = z.enum(["lite", "standard", "sober"]);

export const readingPhaseSchema = z.enum(["initial", "final"]);

export const followupAnswerSchema = z.object({
  question: z.string().trim().min(1, "followup question 不能为空。"),
  answer: z.string().trim().min(1, "followup answer 不能为空。"),
});

export const readingRequestCardInputSchema = z.object({
  positionId: z.string().trim().min(1, "positionId 不能为空。"),
  cardId: z.string().trim().min(1, "cardId 不能为空。"),
  isReversed: z.boolean(),
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

export const structuredReadingSchema: z.ZodType<StructuredReading> = z.object({
  reading_id: z.string().min(1),
  locale: z.string().min(1),
  question: z.string().min(1),
  question_type: questionTypeSchema,
  agent_profile: agentProfileSchema,
  reading_phase: readingPhaseSchema,
  requires_followup: z.boolean(),
  initial_reading_id: z.string().min(1).nullable(),
  followup_answers: z.array(followupAnswerSchema).nullable(),
  spread: spreadSchema,
  cards: z.array(readingCardResultSchema).min(1),
  themes: z.array(z.string().min(1)).min(2).max(4),
  synthesis: z.string().min(1),
  reflective_guidance: z.array(z.string().min(1)).min(2).max(4),
  follow_up_questions: z.array(z.string().min(1)).max(3),
  safety_note: z.string().min(1).nullable(),
  confidence_note: z.string().min(1).nullable(),
  session_capsule: z.string().min(1).nullable(),
  sober_check: z.string().min(1).nullable().optional(),
  presentation_mode: z.enum(["standard", "void_narrative", "sober_anchor"]).optional(),
});

export const readingRequestPayloadSchema = z
  .object({
    question: z.string().trim().min(1, "question 不能为空。"),
    spreadId: z.string().trim().min(1, "spreadId 不能为空。"),
    drawnCards: z
      .array(readingRequestCardInputSchema)
      .min(1, "drawnCards 至少需要包含一张牌。"),
    agent_profile: agentProfileSchema.default("standard"),
    phase: readingPhaseSchema.default("initial"),
    prior_session_capsule: z.string().trim().min(1).nullable().optional(),
    initial_reading: z.lazy(() => structuredReadingSchema).optional(),
    followup_answers: z.array(followupAnswerSchema).optional(),
  })
  .superRefine((payload, context) => {
    if (payload.phase !== "final") {
      return;
    }

    if (!payload.initial_reading) {
      context.addIssue({
        code: "custom",
        message: "phase 为 final 时必须提供 initial_reading。",
        path: ["initial_reading"],
      });
    }

    if (!payload.followup_answers || payload.followup_answers.length === 0) {
      context.addIssue({
        code: "custom",
        message: "phase 为 final 时必须提供 followup_answers。",
        path: ["followup_answers"],
      });
    }
  });
