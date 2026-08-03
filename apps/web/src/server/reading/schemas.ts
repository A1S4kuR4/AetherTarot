import {
  normalizeAgentProfile,
  restoreAgentProfile,
  type AgentProfile,
  type ReadingGroundingClaimPath,
  type StructuredReading,
} from "@aethertarot/shared-types";
import { z } from "zod";

export const questionTypeSchema = z.enum([
  "relationship",
  "career",
  "self_growth",
  "decision",
  "other",
]);

export const canonicalAgentProfileSchema = z.enum([
  "lite",
  "standard",
  "sober",
]);

/**
 * Strict schema for external API requests.
 *
 * Canonical IDs and known legacy aliases are accepted. Unknown values cause a
 * validation error instead of silently falling back to "standard".
 * Omitted values default to "standard".
 */
export const apiAgentProfileSchema = z.preprocess(
  (val) => (val === undefined ? "standard" : val),
  z
    .string()
    .refine((val) => normalizeAgentProfile(val) !== null, {
      message: "agent_profile 必须是 lite、standard、sober 或已知的旧别名。",
    })
    .transform((val) => normalizeAgentProfile(val) as AgentProfile)
    .pipe(canonicalAgentProfileSchema),
);

/**
 * Lenient schema for stored readings and history.
 *
 * Unknown values are safely restored to "standard" so historical records and
 * drafts remain openable.
 */
export const restoredAgentProfileSchema = z.preprocess(
  (val) => restoreAgentProfile(val, (original, fallback) => {
    const valueType = original === null
      ? "null"
      : Array.isArray(original)
        ? "array"
        : typeof original;

    console.warn(
      "[reading-history] invalid agent_profile; falling back to standard",
      { fallback, valueType },
    );
  }),
  canonicalAgentProfileSchema,
);

export const readingPhaseSchema = z.enum(["initial", "final"]);

export const drawSourceSchema = z.enum(["digital_random", "offline_manual"]);

export const followupAnswerSchema = z.object({
  question: z.string().trim().min(1, "followup question 不能为空。"),
  answer: z
    .string()
    .trim()
    .min(1, "followup answer 不能为空。")
    .max(600, "followup answer 不能超过 600 个字符。"),
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

const groundingSourceSchema = z.object({
  ref: z.string().min(1),
  kind: z.enum(["wiki", "authority_card"]),
  title: z.string().min(1),
  card_id: z.string().min(1),
  orientation: z.enum(["upright", "reversed", "unknown"]),
  chunk_id: z.string().min(1),
  source_ids: z.array(z.string().min(1)),
});

const groundingClaimSchema = z.object({
  path: z.custom<ReadingGroundingClaimPath>(
    (value) => typeof value === "string"
      && /^(?:cards\.\d+\.interpretation|synthesis)$/.test(value),
  ),
  source_refs: z.array(z.string().min(1)).min(1),
});

const structuredReadingShape = {
  reading_id: z.string().min(1),
  locale: z.string().min(1),
  question: z.string(),
  question_type: questionTypeSchema,
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
  grounding: z.object({
    version: z.literal(1),
    status: z.enum(["grounded", "degraded"]),
    sources: z.array(groundingSourceSchema).min(1),
    claims: z.array(groundingClaimSchema).min(1),
  }).optional(),
};

/** Strict schema for current provider output and API request snapshots. */
export const structuredReadingSchema: z.ZodType<StructuredReading> = z.object({
  ...structuredReadingShape,
  agent_profile: canonicalAgentProfileSchema,
});

/** Lenient recovery schema used only for stored readings, drafts, and history. */
export const restoredStructuredReadingSchema: z.ZodType<StructuredReading> = z.object({
  ...structuredReadingShape,
  agent_profile: restoredAgentProfileSchema,
});

export const readingRequestPayloadSchema = z
  .object({
    request_id: z.string().uuid("request_id 必须是有效的 UUID。").optional(),
    question: z
      .string()
      .trim()
      .max(1000, "question 不能超过 1000 个字符。"),
    spreadId: z.string().trim().min(1, "spreadId 不能为空。"),
    drawnCards: z
      .array(readingRequestCardInputSchema)
      .min(1, "drawnCards 至少需要包含一张牌。"),
    thread_id: z
      .string()
      .trim()
      .min(1, "thread_id 不能为空。")
      .max(128, "thread_id 不能超过 128 个字符。")
      .optional(),
    agent_profile: apiAgentProfileSchema.default("standard"),
    phase: readingPhaseSchema.default("initial"),
    draw_source: drawSourceSchema.default("digital_random"),
    prior_session_capsule: z.string().trim().min(1).max(280).nullable().optional(),
    initial_reading_id: z.string().trim().min(1).max(128).optional(),
    initial_reading: z
      .object({ reading_id: z.string().trim().min(1).max(128) })
      .optional(),
    followup_answers: z.array(followupAnswerSchema).optional(),
  })
  .superRefine((payload, context) => {
    const isQuestionlessQuickMirror =
      !payload.question
      && payload.phase === "initial"
      && payload.agent_profile === "lite"
      && payload.spreadId === "single"
      && payload.drawnCards.length === 1;

    if (!payload.question && !isQuestionlessQuickMirror) {
      context.addIssue({
        code: "custom",
        message: "question 不能为空，除非是单牌 lite 当下之镜。",
        path: ["question"],
      });
    }

    if (payload.phase !== "final") {
      return;
    }

    if (!payload.initial_reading_id && !payload.initial_reading) {
      context.addIssue({
        code: "custom",
        message: "phase 为 final 时必须提供 initial_reading_id。",
        path: ["initial_reading_id"],
      });
    }

    if (
      payload.initial_reading_id
      && payload.initial_reading
      && payload.initial_reading_id !== payload.initial_reading.reading_id
    ) {
      context.addIssue({
        code: "custom",
        message: "initial_reading_id 与 legacy initial_reading.reading_id 不一致。",
        path: ["initial_reading_id"],
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
