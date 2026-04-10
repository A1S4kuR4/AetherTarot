import "server-only";

import { findCardById, findSpreadById } from "@aethertarot/domain-tarot";
import type {
  DrawnCard,
  PresentationMode,
  QuestionType,
  ReadingRequestPayload,
  Spread,
  StructuredReading,
} from "@aethertarot/shared-types";
import {
  END,
  START,
  StateGraph,
  StateSchema,
  type GraphNode,
} from "@langchain/langgraph";
import { z } from "zod";
import { classifyQuestion } from "@/server/reading/classifier";
import { ReadingServiceError } from "@/server/reading/errors";
import { getReadingProvider } from "@/server/reading/provider";
import { structuredReadingSchema } from "@/server/reading/schemas";
import {
  analyzeIntentFriction,
  applySafetyReview,
  type IntentFrictionResult,
} from "@/server/reading/safety";

type ReadingDraft = Pick<
  StructuredReading,
  | "cards"
  | "themes"
  | "synthesis"
  | "reflective_guidance"
  | "follow_up_questions"
  | "confidence_note"
>;

const ReadingGraphState = new StateSchema({
  payload: z.custom<ReadingRequestPayload>(),
  question: z.string().optional(),
  questionType: z.custom<QuestionType>().optional(),
  spread: z.custom<Spread>().optional(),
  drawnCards: z.custom<DrawnCard[]>().optional(),
  frictionResult: z.custom<IntentFrictionResult>().optional(),
  draft: z.custom<ReadingDraft>().optional(),
  reading: z.custom<StructuredReading>().optional(),
});

type ReadingGraphNode = GraphNode<typeof ReadingGraphState>;

function requireStateValue<T>(
  value: T | undefined,
  fieldName: string,
): T {
  if (value === undefined) {
    throw new ReadingServiceError(
      "generation_failed",
      `Reading graph state 缺少 ${fieldName}。`,
      500,
    );
  }

  return value;
}

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

  const allowedPositionIds = new Set(
    spread.positions.map((position) => position.id),
  );

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

const classifyQuestionNode: ReadingGraphNode = (state) => {
  const question = state.payload.question.trim();

  return {
    question,
    questionType: classifyQuestion(question),
  };
};

const hydrateContextNode: ReadingGraphNode = (state) => {
  return hydrateCanonicalContext(state.payload);
};

const analyzeIntentFrictionNode: ReadingGraphNode = (state) => {
  const question = requireStateValue(state.question, "question");
  const frictionResult = analyzeIntentFriction(question);

  if (frictionResult.type === "hard_stop") {
    throw new ReadingServiceError(
      "safety_intercept",
      "问题触发了高风险安全界限保护。",
      403,
      frictionResult.reason,
      frictionResult.referral_links,
    );
  }

  return { frictionResult };
};

const generateDraftNode: ReadingGraphNode = async (state) => {
  const provider = getReadingProvider();

  return {
    draft: await provider.generate({
      question: requireStateValue(state.question, "question"),
      questionType: requireStateValue(state.questionType, "questionType"),
      spread: requireStateValue(state.spread, "spread"),
      drawnCards: requireStateValue(state.drawnCards, "drawnCards"),
    }),
  };
};

const buildStructuredReadingNode: ReadingGraphNode = (state) => {
  const draft = requireStateValue(state.draft, "draft");
  const frictionResult = requireStateValue(
    state.frictionResult,
    "frictionResult",
  );

  let sober_check: string | null = null;
  let presentation_mode: PresentationMode = "standard";

  if (frictionResult.type === "sober_check") {
    sober_check = frictionResult.sober_check;
    presentation_mode = frictionResult.presentation_mode;
  }

  return {
    reading: structuredReadingSchema.parse({
      reading_id: crypto.randomUUID(),
      locale: "zh-CN",
      question: requireStateValue(state.question, "question"),
      question_type: requireStateValue(state.questionType, "questionType"),
      spread: requireStateValue(state.spread, "spread"),
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
    }),
  };
};

const applySafetyReviewNode: ReadingGraphNode = (state) => {
  return {
    reading: structuredReadingSchema.parse(
      applySafetyReview({
        question: requireStateValue(state.question, "question"),
        reading: requireStateValue(state.reading, "reading"),
      }),
    ),
  };
};

const readingGraph = new StateGraph(ReadingGraphState)
  .addNode("classify_question", classifyQuestionNode)
  .addNode("hydrate_context", hydrateContextNode)
  .addNode("analyze_intent_friction", analyzeIntentFrictionNode)
  .addNode("generate_draft", generateDraftNode)
  .addNode("build_structured_reading", buildStructuredReadingNode)
  .addNode("apply_safety_review", applySafetyReviewNode)
  .addEdge(START, "classify_question")
  .addEdge("classify_question", "hydrate_context")
  .addEdge("hydrate_context", "analyze_intent_friction")
  .addEdge("analyze_intent_friction", "generate_draft")
  .addEdge("generate_draft", "build_structured_reading")
  .addEdge("build_structured_reading", "apply_safety_review")
  .addEdge("apply_safety_review", END)
  .compile();

export async function runReadingGraph(
  payload: ReadingRequestPayload,
): Promise<StructuredReading> {
  try {
    const result = await readingGraph.invoke({ payload });
    return requireStateValue(result.reading, "reading");
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
