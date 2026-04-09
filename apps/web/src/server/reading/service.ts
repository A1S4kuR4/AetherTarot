import "server-only";

import { findCardById, findSpreadById } from "@aethertarot/domain-tarot";
import type {
  DrawnCard,
  ReadingRequestPayload,
  StructuredReading,
} from "@aethertarot/shared-types";
import { classifyQuestion } from "@/server/reading/classifier";
import { ReadingServiceError } from "@/server/reading/errors";
import { getReadingProvider } from "@/server/reading/provider";
import { structuredReadingSchema } from "@/server/reading/schemas";
import { analyzeIntentFriction, applySafetyReview } from "@/server/reading/safety";

function hydrateCanonicalContext(payload: ReadingRequestPayload) {
  const spread = findSpreadById(payload.spreadId);

  if (!spread) {
    throw new ReadingServiceError(
      "invalid_request",
      "spreadId 不存在于当前运行时牌阵中。",
      400,
    );
  }

  if (payload.drawnCards.length !== spread.positions.length) {
    throw new ReadingServiceError(
      "invalid_request",
      "drawnCards 数量必须与当前牌阵位置数一致。",
      400,
    );
  }

  const seenPositionIds = new Set<string>();
  const seenCardIds = new Set<string>();
  const drawnCardInputByPosition = new Map(
    payload.drawnCards.map((drawnCard) => [drawnCard.positionId, drawnCard]),
  );

  for (const drawnCard of payload.drawnCards) {
    if (seenPositionIds.has(drawnCard.positionId)) {
      throw new ReadingServiceError(
        "invalid_request",
        "drawnCards 不能包含重复的 positionId。",
        400,
      );
    }

    if (seenCardIds.has(drawnCard.cardId)) {
      throw new ReadingServiceError(
        "invalid_request",
        "drawnCards 不能包含重复的 cardId。",
        400,
      );
    }

    seenPositionIds.add(drawnCard.positionId);
    seenCardIds.add(drawnCard.cardId);
  }

  const allowedPositionIds = new Set(spread.positions.map((position) => position.id));

  for (const positionId of seenPositionIds) {
    if (!allowedPositionIds.has(positionId)) {
      throw new ReadingServiceError(
        "invalid_request",
        "drawnCards 包含不属于当前牌阵的位置。",
        400,
      );
    }
  }

  if (seenPositionIds.size !== spread.positions.length) {
    throw new ReadingServiceError(
      "invalid_request",
      "drawnCards 必须覆盖当前牌阵的全部位置。",
      400,
    );
  }

  const drawnCards: DrawnCard[] = spread.positions.map((position) => {
    const drawnCardInput = drawnCardInputByPosition.get(position.id);

    if (!drawnCardInput) {
      throw new ReadingServiceError(
        "invalid_request",
        "drawnCards 必须覆盖当前牌阵的全部位置。",
        400,
      );
    }

    const card = findCardById(drawnCardInput.cardId);

    if (!card) {
      throw new ReadingServiceError(
        "invalid_request",
        "drawnCards 包含未知的 cardId。",
        400,
      );
    }

    return {
      positionId: position.id,
      card,
      isReversed: drawnCardInput.isReversed,
    };
  });

  return { spread, drawnCards };
}

export async function generateStructuredReading(
  payload: ReadingRequestPayload,
): Promise<StructuredReading> {
  const question = payload.question.trim();
  const questionType = classifyQuestion(question);
  const { spread, drawnCards } = hydrateCanonicalContext(payload);

  const frictionResult = analyzeIntentFriction(question);
  if (frictionResult.type === "hard_stop") {
    throw new ReadingServiceError(
      "safety_intercept",
      "问题触发了高风险安全界限保护。",
      403,
      frictionResult.reason,
      frictionResult.referral_links
    );
  }

  const provider = getReadingProvider();

  try {
    const draft = await provider.generate({
      question,
      questionType,
      spread,
      drawnCards,
    });

    let sober_check: string | null = null;
    let presentation_mode: "standard" | "void_narrative" | "sober_anchor" = "standard";

    if (frictionResult.type === "sober_check") {
      sober_check = frictionResult.sober_check;
      presentation_mode = frictionResult.presentation_mode;
    }

    const reading = structuredReadingSchema.parse({
      reading_id: crypto.randomUUID(),
      locale: "zh-CN",
      question,
      question_type: questionType,
      spread,
      cards: draft.cards,
      themes: draft.themes,
      synthesis: draft.synthesis,
      reflective_guidance: draft.reflective_guidance,
      follow_up_questions: draft.follow_up_questions,
      safety_note: null,
      confidence_note: draft.confidence_note,
      session_capsule: null,
      sober_check,
      presentation_mode,
    });

    return structuredReadingSchema.parse(
      applySafetyReview({
        question,
        reading,
      }),
    );
  } catch (error) {
    if (error instanceof ReadingServiceError) {
      throw error;
    }

    throw new ReadingServiceError(
      "generation_failed",
      "解读生成失败，请稍后再试。",
      500,
    );
  }
}
