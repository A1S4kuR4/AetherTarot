import "server-only";

import type {
  AgentProfile,
  ReadingCardResult,
  ReadingPhase,
  StructuredReading,
} from "@aethertarot/shared-types";
import {
  ReadingGenerationError,
  type ReadingGenerationStage,
} from "@/server/reading/errors";
import type {
  HydratedReadingContext,
  ReadingDraft,
} from "@/server/reading/types";

type JsonRecord = Record<string, unknown>;

export interface CardInsightDraft {
  index: number;
  interpretation: string;
  evidence_refs?: string[];
}

export interface SynthesisDraft {
  themes: string[];
  synthesis: string;
  reflective_guidance: string[];
  follow_up_questions: string[];
  confidence_note: string;
  evidence_refs?: string[];
}

export interface FinalSynthesisDraft extends SynthesisDraft {
  card_refinements?: CardInsightDraft[];
}

export interface CompactReadingDraft {
  card_insights: CardInsightDraft[];
  synthesis: SynthesisDraft;
}

export type ReadingStageDraft =
  | CardInsightDraft[]
  | SynthesisDraft
  | FinalSynthesisDraft
  | CompactReadingDraft;

const INTERNAL_PROSE_PATTERNS = [
  /本地知识库(?:片段|检索片段|没有返回)/u,
  /\bsource_?id\b/iu,
  /\bgrounding_claims\b/iu,
  /第一阶段(?:的)?(?:独立)?初读/u,
  /第二阶段(?:不会推翻|仍要|整合深读)/u,
  /\b(?:provider|prompt|generation stage)\b/iu,
];

function contractFailure({
  subtype,
  stage,
  message,
  invalidPayload,
  issues = [message],
}: {
  subtype:
    | "schema_violation"
    | "authority_mismatch"
    | "prose_leakage"
    | "grounding_violation"
    | "semantic_contradiction";
  stage: ReadingGenerationStage;
  message: string;
  invalidPayload?: unknown;
  issues?: string[];
}): never {
  throw new ReadingGenerationError({
    subtype,
    stage,
    message,
    retryable: true,
    invalidPayload,
    issues,
  });
}

function asRecord(
  value: unknown,
  stage: ReadingGenerationStage,
  field: string,
): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    contractFailure({
      subtype: "schema_violation",
      stage,
      message: `${field} 必须是 JSON 对象。`,
      invalidPayload: value,
    });
  }
  return value as JsonRecord;
}

function asNonEmptyString(
  value: unknown,
  stage: ReadingGenerationStage,
  field: string,
) {
  if (typeof value !== "string" || !value.trim()) {
    contractFailure({
      subtype: "schema_violation",
      stage,
      message: `${field} 必须是非空字符串。`,
      invalidPayload: value,
    });
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  if (INTERNAL_PROSE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    contractFailure({
      subtype: "prose_leakage",
      stage,
      message: `${field} 包含内部编排或来源元数据。`,
      invalidPayload: value,
    });
  }
  return normalized;
}

function normalizeStringArray({
  value,
  stage,
  field,
  min,
  max,
  acceptSingleString = false,
}: {
  value: unknown;
  stage: ReadingGenerationStage;
  field: string;
  min: number;
  max: number;
  acceptSingleString?: boolean;
}) {
  const items = acceptSingleString && typeof value === "string"
    ? [value]
    : value;
  if (!Array.isArray(items)) {
    contractFailure({
      subtype: "schema_violation",
      stage,
      message: `${field} 必须是数组。`,
      invalidPayload: value,
    });
  }
  const values = items.map((item, index) =>
    asNonEmptyString(item, stage, `${field}.${index}`)
  );
  const normalized = [...new Set(values)];
  if (normalized.length < min || normalized.length > max) {
    contractFailure({
      subtype: "schema_violation",
      stage,
      message: `${field} 必须包含 ${min}-${max} 个互不重复的项目。`,
      invalidPayload: value,
    });
  }
  return normalized;
}

function allowedRefsForCard(
  context: HydratedReadingContext,
  cardIndex: number,
) {
  const cardId = context.drawnCards[cardIndex]?.card.id;
  return new Set(
    context.knowledgeGrounding.chunks
      .filter((chunk) => chunk.card === cardId)
      .map((chunk) => chunk.ref),
  );
}

function allAllowedRefs(context: HydratedReadingContext) {
  return new Set(context.knowledgeGrounding.chunks.map((chunk) => chunk.ref));
}

function normalizeEvidenceRefs({
  value,
  allowed,
  stage,
  field,
}: {
  value: unknown;
  allowed: Set<string>;
  stage: ReadingGenerationStage;
  field: string;
}) {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    contractFailure({
      subtype: "grounding_violation",
      stage,
      message: `${field} 必须是 ref 数组。`,
      invalidPayload: value,
    });
  }
  const refs = [...new Set(value.filter((item): item is string =>
    typeof item === "string" && item.trim().length > 0
  ).map((item) => item.trim()))];
  if (refs.some((ref) => !allowed.has(ref))) {
    contractFailure({
      subtype: "grounding_violation",
      stage,
      message: `${field} 包含未知或跨牌 ref。`,
      invalidPayload: value,
    });
  }
  return refs;
}

function validateOrientationLanguage({
  interpretation,
  context,
  index,
  stage,
}: {
  interpretation: string;
  context: HydratedReadingContext;
  index: number;
  stage: ReadingGenerationStage;
}) {
  const isReversed = context.drawnCards[index]?.isReversed;
  const contradiction = isReversed
    ? /(?:这张牌|此牌|牌面)(?:处于|是|为)?正位/u.test(interpretation)
    : /(?:这张牌|此牌|牌面)(?:处于|是|为)?逆位/u.test(interpretation);
  if (contradiction) {
    contractFailure({
      subtype: "semantic_contradiction",
      stage,
      message: `card_insights.${index} 与 authority orientation 明显矛盾。`,
      invalidPayload: interpretation,
    });
  }
}

export function normalizeCardInsightsPayload({
  payload,
  context,
  stage = "card_insights",
}: {
  payload: unknown;
  context: HydratedReadingContext;
  stage?: "card_insights" | "compact" | "final_synthesis";
}): CardInsightDraft[] {
  const record = asRecord(payload, stage, "card insight payload");
  const rawInsights = record.card_insights;
  if (!Array.isArray(rawInsights)) {
    contractFailure({
      subtype: "schema_violation",
      stage,
      message: "card_insights 必须是数组。",
      invalidPayload: payload,
    });
  }
  if (rawInsights.length !== context.drawnCards.length) {
    contractFailure({
      subtype: "authority_mismatch",
      stage,
      message: "card_insights 数量必须与 authority cards 一致。",
      invalidPayload: payload,
    });
  }

  const insights = rawInsights.map((item, expectedIndex) => {
    const insight = asRecord(item, stage, `card_insights.${expectedIndex}`);
    if (insight.index !== expectedIndex) {
      contractFailure({
        subtype: "authority_mismatch",
        stage,
        message: "card_insights index 必须唯一、连续并与 authority order 一致。",
        invalidPayload: payload,
      });
    }
    const interpretation = asNonEmptyString(
      insight.interpretation,
      stage,
      `card_insights.${expectedIndex}.interpretation`,
    );
    validateOrientationLanguage({
      interpretation,
      context,
      index: expectedIndex,
      stage,
    });
    return {
      index: expectedIndex,
      interpretation,
      evidence_refs: normalizeEvidenceRefs({
        value: insight.evidence_refs,
        allowed: allowedRefsForCard(context, expectedIndex),
        stage,
        field: `card_insights.${expectedIndex}.evidence_refs`,
      }),
    };
  });

  return insights;
}

function normalizeCardRefinements({
  value,
  context,
}: {
  value: unknown;
  context: HydratedReadingContext;
}): CardInsightDraft[] {
  if (!Array.isArray(value)) {
    contractFailure({
      subtype: "schema_violation",
      stage: "final_synthesis",
      message: "card_refinements 必须是数组。",
      invalidPayload: value,
    });
  }
  const seen = new Set<number>();
  return value.map((item, itemIndex) => {
    const refinement = asRecord(
      item,
      "final_synthesis",
      `card_refinements.${itemIndex}`,
    );
    const index = refinement.index;
    if (
      typeof index !== "number"
      || !Number.isInteger(index)
      || index < 0
      || index >= context.drawnCards.length
      || seen.has(index)
    ) {
      contractFailure({
        subtype: "authority_mismatch",
        stage: "final_synthesis",
        message: "card_refinements index 必须唯一并属于 authority cards。",
        invalidPayload: value,
      });
    }
    seen.add(index);
    const interpretation = asNonEmptyString(
      refinement.interpretation,
      "final_synthesis",
      `card_refinements.${itemIndex}.interpretation`,
    );
    validateOrientationLanguage({
      interpretation,
      context,
      index,
      stage: "final_synthesis",
    });
    return {
      index,
      interpretation,
      evidence_refs: normalizeEvidenceRefs({
        value: refinement.evidence_refs,
        allowed: allowedRefsForCard(context, index),
        stage: "final_synthesis",
        field: `card_refinements.${itemIndex}.evidence_refs`,
      }),
    };
  }).sort((left, right) => left.index - right.index);
}

function guidanceBounds(profile: AgentProfile) {
  return profile === "lite" ? { min: 2, max: 2 } : { min: 3, max: 4 };
}

function followupBounds(phase: ReadingPhase, profile: AgentProfile) {
  if (phase === "final") return { min: 0, max: 1 };
  return profile === "lite" ? { min: 0, max: 1 } : { min: 1, max: 2 };
}

function validateSynthesisShape({
  synthesis,
  context,
  phase,
  stage,
  initialReading,
}: {
  synthesis: SynthesisDraft;
  context: HydratedReadingContext;
  phase: ReadingPhase;
  stage: ReadingGenerationStage;
  initialReading?: StructuredReading;
}) {
  if (context.drawnCards.length > 1) {
    const namedCards = context.drawnCards.filter((drawnCard) =>
      synthesis.synthesis.includes(drawnCard.card.name)
    ).length;
    const enumerativeRetelling =
      /(?:^|\s)(?:1[.)、]|2[.)、]|3[.)、])|首先.{0,40}(?:其次|然后)|第一张.{0,60}第二张/u.test(
      synthesis.synthesis,
    );
    if (
      enumerativeRetelling
      && namedCards >= Math.ceil(context.drawnCards.length * 0.7)
    ) {
      contractFailure({
        subtype: "schema_violation",
        stage,
        message: "synthesis 明显退化为逐牌枚举或逐牌复述。",
        invalidPayload: synthesis,
      });
    }
  }

  if (
    context.spread.id === "single"
    && /一路带到|从\s*核心指引\s*(?:一路)?带到\s*核心指引/u.test(
      synthesis.synthesis,
    )
  ) {
    contractFailure({
      subtype: "semantic_contradiction",
      stage,
      message: "单牌 synthesis 包含虚构的位置路径。",
      invalidPayload: synthesis,
    });
  }

  if (phase === "final" && initialReading) {
    const retainsTheme = initialReading.themes.some((theme) =>
      synthesis.themes.includes(theme) || synthesis.synthesis.includes(theme)
    );
    if (!retainsTheme) {
      contractFailure({
        subtype: "semantic_contradiction",
        stage,
        message: "Final synthesis 完全丢失 Initial 核心主题。",
        invalidPayload: synthesis,
      });
    }
  }
}

export function normalizeSynthesisPayload({
  payload,
  context,
  phase,
  stage = "synthesis",
  initialReading,
}: {
  payload: unknown;
  context: HydratedReadingContext;
  phase: ReadingPhase;
  stage?: "synthesis" | "compact" | "final_synthesis";
  initialReading?: StructuredReading;
}): SynthesisDraft {
  const record = asRecord(payload, stage, "synthesis payload");
  const guidance = guidanceBounds(context.agentProfile);
  const followup = followupBounds(phase, context.agentProfile);
  const draft: SynthesisDraft = {
    themes: normalizeStringArray({
      value: record.themes,
      stage,
      field: "themes",
      min: 2,
      max: 4,
    }),
    synthesis: asNonEmptyString(record.synthesis, stage, "synthesis"),
    reflective_guidance: normalizeStringArray({
      value: record.reflective_guidance,
      stage,
      field: "reflective_guidance",
      min: guidance.min,
      max: guidance.max,
    }),
    follow_up_questions: normalizeStringArray({
      value: record.follow_up_questions ?? [],
      stage,
      field: "follow_up_questions",
      min: followup.min,
      max: followup.max,
      acceptSingleString: true,
    }),
    confidence_note: asNonEmptyString(
      record.confidence_note,
      stage,
      "confidence_note",
    ),
    evidence_refs: normalizeEvidenceRefs({
      value: record.evidence_refs,
      allowed: allAllowedRefs(context),
      stage,
      field: "evidence_refs",
    }),
  };
  validateSynthesisShape({
    synthesis: draft,
    context,
    phase,
    stage,
    initialReading,
  });
  return draft;
}

export function normalizeCompactReadingPayload({
  payload,
  context,
}: {
  payload: unknown;
  context: HydratedReadingContext;
}): CompactReadingDraft {
  const record = asRecord(payload, "compact", "compact payload");
  return {
    card_insights: normalizeCardInsightsPayload({
      payload: { card_insights: record.card_insights },
      context,
      stage: "compact",
    }),
    synthesis: normalizeSynthesisPayload({
      payload: record.synthesis,
      context,
      phase: "initial",
      stage: "compact",
    }),
  };
}

export function normalizeFinalSynthesisPayload({
  payload,
  context,
  initialReading,
}: {
  payload: unknown;
  context: HydratedReadingContext;
  initialReading: StructuredReading;
}): FinalSynthesisDraft {
  const record = asRecord(payload, "final_synthesis", "final synthesis payload");
  const synthesis = normalizeSynthesisPayload({
    payload: record,
    context,
    phase: "final",
    stage: "final_synthesis",
    initialReading,
  });
  const refinements = record.card_refinements === undefined
    ? undefined
    : normalizeCardRefinements({
        value: record.card_refinements,
        context,
      });
  return { ...synthesis, card_refinements: refinements };
}

function buildAuthorityCards(
  context: HydratedReadingContext,
  insights: CardInsightDraft[],
): ReadingCardResult[] {
  return context.drawnCards.map((drawnCard, index) => {
    const position = context.spread.positions.find(
      (item) => item.id === drawnCard.positionId,
    );
    return {
      card_id: drawnCard.card.id,
      name: drawnCard.card.name,
      english_name: drawnCard.card.englishName,
      orientation: drawnCard.isReversed ? "reversed" : "upright",
      position_id: drawnCard.positionId,
      position: position?.name ?? "未知位置",
      position_meaning:
        position?.description ?? "这个位置提醒你留意问题的关键层面。",
      interpretation: insights[index]?.interpretation ?? "",
    };
  });
}

export function hydrateStagedReadingDraft({
  context,
  cardInsights,
  synthesis,
  initialReading,
}: {
  context: HydratedReadingContext;
  cardInsights?: CardInsightDraft[];
  synthesis: SynthesisDraft;
  initialReading?: StructuredReading;
}): ReadingDraft {
  const initialInsights = initialReading?.cards.map((card, index) => ({
      index,
      interpretation: card.interpretation,
      evidence_refs: [...allowedRefsForCard(context, index)],
    } satisfies CardInsightDraft));
  const effectiveInsights: CardInsightDraft[] | undefined = initialInsights
    ? initialInsights.map((insight) =>
        cardInsights?.find((refinement) => refinement.index === insight.index)
        ?? insight
      )
    : cardInsights;
  if (!effectiveInsights) {
    contractFailure({
      subtype: "schema_violation",
      stage: "synthesis",
      message: "缺少可用于 authority hydration 的 card insights。",
    });
  }
  const groundedInsights = effectiveInsights.map((insight) => ({
    ...insight,
    evidence_refs: insight.evidence_refs?.length
      ? insight.evidence_refs
      : [...allowedRefsForCard(context, insight.index)],
  }));
  const synthesisRefs = synthesis.evidence_refs?.length
    ? synthesis.evidence_refs
    : [...new Set(groundedInsights.flatMap(
        (insight) => insight.evidence_refs ?? [],
      ))];

  return {
    cards: buildAuthorityCards(context, groundedInsights),
    themes: synthesis.themes,
    synthesis: synthesis.synthesis,
    reflective_guidance: synthesis.reflective_guidance,
    follow_up_questions: synthesis.follow_up_questions,
    confidence_note: synthesis.confidence_note,
    grounding_claims: [
      ...groundedInsights.flatMap((insight) =>
        insight.evidence_refs?.length
          ? [{
              path: `cards.${insight.index}.interpretation` as const,
              source_refs: insight.evidence_refs,
            }]
          : []
      ),
      ...(synthesisRefs.length
        ? [{
            path: "synthesis" as const,
            source_refs: synthesisRefs,
          }]
        : []),
    ],
  };
}
