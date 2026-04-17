import "server-only";

import { findCardById, findSpreadById } from "@aethertarot/domain-tarot";
import type {
  AgentProfile,
  DrawnCard,
  FollowupAnswer,
  PresentationMode,
  QuestionType,
  ReadingPhase,
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
  sanitizeIncomingSessionCapsule,
  type IntentFrictionResult,
} from "@/server/reading/safety";
import type { ReadingDraft, ReadingProvider } from "@/server/reading/types";

const ReadingGraphState = new StateSchema({
  payload: z.custom<ReadingRequestPayload>(),
  provider: z.custom<ReadingProvider>().optional(),
  question: z.string().optional(),
  questionType: z.custom<QuestionType>().optional(),
  agentProfile: z.custom<AgentProfile>().optional(),
  phase: z.custom<ReadingPhase>().optional(),
  initialReading: z.custom<StructuredReading>().optional(),
  followupAnswers: z.custom<FollowupAnswer[]>().optional(),
  priorSessionCapsule: z.string().nullable().optional(),
  spread: z.custom<Spread>().optional(),
  drawnCards: z.custom<DrawnCard[]>().optional(),
  frictionResult: z.custom<IntentFrictionResult>().optional(),
  draft: z.custom<ReadingDraft>().optional(),
  reading: z.custom<StructuredReading>().optional(),
});

type ReadingGraphNode = GraphNode<typeof ReadingGraphState>;
const MAX_SESSION_CAPSULE_LENGTH = 280;

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

function readingCardsSignature(reading: StructuredReading) {
  return reading.cards
    .map((card) => `${card.position_id}:${card.card_id}:${card.orientation}`)
    .join("|");
}

function drawnCardsSignature(drawnCards: DrawnCard[]) {
  return drawnCards
    .map((drawnCard) =>
      `${drawnCard.positionId}:${drawnCard.card.id}:${drawnCard.isReversed ? "reversed" : "upright"}`,
    )
    .join("|");
}

function validateFinalPhaseState({
  agentProfile,
  initialReading,
  followupAnswers,
  spread,
  drawnCards,
}: {
  agentProfile: AgentProfile;
  initialReading: StructuredReading | undefined;
  followupAnswers: FollowupAnswer[] | undefined;
  spread: Spread;
  drawnCards: DrawnCard[];
}) {
  if (!initialReading) {
    throw new ReadingServiceError(
      "invalid_request",
      "phase 为 final 时必须提供 initial_reading。",
      400,
    );
  }

  if (!followupAnswers || followupAnswers.length === 0) {
    throw new ReadingServiceError(
      "invalid_request",
      "phase 为 final 时必须提供 followup_answers。",
      400,
    );
  }

  if (initialReading.reading_phase !== "initial") {
    throw new ReadingServiceError(
      "invalid_request",
      "initial_reading 必须来自 initial 阶段。",
      400,
    );
  }

  if (initialReading.agent_profile !== agentProfile) {
    throw new ReadingServiceError(
      "invalid_request",
      "final 阶段的 agent_profile 必须与 initial_reading 一致。",
      400,
    );
  }

  if (initialReading.spread.id !== spread.id) {
    throw new ReadingServiceError(
      "invalid_request",
      "final 阶段的 spreadId 必须与 initial_reading 一致。",
      400,
    );
  }

  if (readingCardsSignature(initialReading) !== drawnCardsSignature(drawnCards)) {
    throw new ReadingServiceError(
      "invalid_request",
      "final 阶段的 drawnCards 必须与 initial_reading 一致。",
      400,
    );
  }
}

function shouldRequireFollowup(reading: StructuredReading) {
  return (
    reading.reading_phase === "initial" &&
    reading.agent_profile !== "lite" &&
    reading.follow_up_questions.length > 0
  );
}

function getExpectedDraftCardSignature(drawnCards: DrawnCard[]) {
  return drawnCards
    .map((drawnCard) =>
      [
        drawnCard.positionId,
        drawnCard.card.id,
        drawnCard.isReversed ? "reversed" : "upright",
      ].join(":"),
    )
    .join("|");
}

function getDraftCardSignature(draft: ReadingDraft) {
  return draft.cards
    .map((card) => [card.position_id, card.card_id, card.orientation].join(":"))
    .join("|");
}

function validateDraftCardsContract({
  draft,
  drawnCards,
}: {
  draft: ReadingDraft;
  drawnCards: DrawnCard[];
}) {
  if (draft.cards.length !== drawnCards.length) {
    throw new ReadingServiceError(
      "generation_failed",
      "provider draft 的 cards 数量必须与 authority drawnCards 一致。",
      500,
    );
  }

  if (getDraftCardSignature(draft) !== getExpectedDraftCardSignature(drawnCards)) {
    throw new ReadingServiceError(
      "generation_failed",
      "provider draft 的 cards 顺序、identity 或 orientation 与 authority drawnCards 不一致。",
      500,
    );
  }
}

function validateDraftFollowupContract({
  draft,
  phase,
  agentProfile,
}: {
  draft: ReadingDraft;
  phase: ReadingPhase;
  agentProfile: AgentProfile;
}) {
  const count = draft.follow_up_questions.length;

  if (phase === "final") {
    if (count > 1) {
      throw new ReadingServiceError(
        "generation_failed",
        "final provider draft 最多只能返回 1 条延伸 follow_up_question。",
        500,
      );
    }

    return;
  }

  if (agentProfile === "lite") {
    if (count > 1) {
      throw new ReadingServiceError(
        "generation_failed",
        "lite initial provider draft 最多只能返回 1 条 follow_up_question。",
        500,
      );
    }

    return;
  }

  if (count < 1 || count > 2) {
    throw new ReadingServiceError(
      "generation_failed",
      "standard/sober initial provider draft 必须返回 1-2 条 follow_up_questions。",
      500,
    );
  }
}

function normalizeCapsuleLine(value: string, maxLength = 140) {
  const normalized = value.replace(/\s+/g, " ").trim();
  const sanitized = normalized
    .replace(/自杀|自残|不想活|结束生命|kill myself/gi, "[高风险细节略]")
    .replace(/急救|急诊|胸痛|无法呼吸|呼吸困难|大量出血|昏迷|服药过量|overdose|emergency|can't breathe/gi, "[紧急健康细节略]")
    .replace(/跟踪|监控|报复|操控|控制他|控制她|pua|勒索|偷窥|家暴|胁迫/gi, "[越界行为略]")
    .replace(/(他|她|对方)(到底|会不会|是不是|真实).{0,8}(爱|想|打算|回|喜欢|讨厌)/gi, "[第三方意图推测略]");

  if (sanitized.length <= maxLength) {
    return sanitized;
  }

  return `${sanitized.slice(0, maxLength - 1)}…`;
}

function truncateCapsule(value: string, maxLength = MAX_SESSION_CAPSULE_LENGTH) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function shouldAttachSessionCapsule(reading: StructuredReading) {
  return (
    reading.reading_phase === "final"
    || (reading.reading_phase === "initial" && reading.agent_profile === "lite")
  );
}

function buildSessionCapsule({
  question,
  spread,
  themes,
  reflectiveGuidance,
}: {
  question: string;
  spread: Spread;
  themes: string[];
  reflectiveGuidance: string[];
}) {
  const carryForwardLines = reflectiveGuidance
    .slice(0, 2)
    .map((item, index) => `${index + 1}. ${normalizeCapsuleLine(item, 56)}`);
  const lines = [
    `本轮问题：${normalizeCapsuleLine(question, 64)}`,
    `牌阵：${spread.name}`,
    `核心主题：${themes.map((theme) => normalizeCapsuleLine(theme, 14)).join("、")}`,
    "延续主轴：",
    ...carryForwardLines,
    "边界提醒：不延续急性情绪、未验证的第三方意图和高风险安全细节。",
  ];

  return truncateCapsule(lines.join("\n"));
}

const classifyQuestionNode: ReadingGraphNode = (state) => {
  const question = state.payload.question.trim();

  return {
    question,
    questionType: classifyQuestion(question),
    agentProfile: state.payload.agent_profile ?? "standard",
    phase: state.payload.phase ?? "initial",
    initialReading: state.payload.initial_reading,
    followupAnswers: state.payload.followup_answers,
    priorSessionCapsule: sanitizeIncomingSessionCapsule(
      state.payload.prior_session_capsule ?? null,
    ),
  };
};

const hydrateContextNode: ReadingGraphNode = (state) => {
  return hydrateCanonicalContext(state.payload);
};

const validateFinalPhaseNode: ReadingGraphNode = (state) => {
  const phase = requireStateValue(state.phase, "phase");

  if (phase !== "final") {
    return {};
  }

  validateFinalPhaseState({
    agentProfile: requireStateValue(state.agentProfile, "agentProfile"),
    initialReading: state.initialReading,
    followupAnswers: state.followupAnswers,
    spread: requireStateValue(state.spread, "spread"),
    drawnCards: requireStateValue(state.drawnCards, "drawnCards"),
  });

  return {};
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
  const provider = state.provider ?? getReadingProvider();
  const phase = requireStateValue(state.phase, "phase");
  const baseContext = {
    question: requireStateValue(state.question, "question"),
    questionType: requireStateValue(state.questionType, "questionType"),
    agentProfile: requireStateValue(state.agentProfile, "agentProfile"),
    spread: requireStateValue(state.spread, "spread"),
    drawnCards: requireStateValue(state.drawnCards, "drawnCards"),
    priorSessionCapsule: state.priorSessionCapsule ?? null,
  };

  if (phase === "final") {
    return {
      draft: await provider.generateFinalRead({
        ...baseContext,
        initialReading: requireStateValue(state.initialReading, "initialReading"),
        followupAnswers: requireStateValue(state.followupAnswers, "followupAnswers"),
      }),
    };
  }

  return {
    draft: await provider.generateInitialRead(baseContext),
  };
};

const validateDraftContractNode: ReadingGraphNode = (state) => {
  const draft = requireStateValue(state.draft, "draft");

  validateDraftCardsContract({
    draft,
    drawnCards: requireStateValue(state.drawnCards, "drawnCards"),
  });
  validateDraftFollowupContract({
    draft,
    phase: requireStateValue(state.phase, "phase"),
    agentProfile: requireStateValue(state.agentProfile, "agentProfile"),
  });

  return {};
};

const buildStructuredReadingNode: ReadingGraphNode = (state) => {
  const draft = requireStateValue(state.draft, "draft");
  const frictionResult = requireStateValue(
    state.frictionResult,
    "frictionResult",
  );
  const phase = requireStateValue(state.phase, "phase");
  const agentProfile = requireStateValue(state.agentProfile, "agentProfile");
  const initialReading = state.initialReading;
  const followupAnswers = state.followupAnswers ?? null;

  let sober_check: string | null = null;
  let presentation_mode: PresentationMode = "standard";

  if (frictionResult.type === "sober_check") {
    sober_check = frictionResult.sober_check;
    presentation_mode = frictionResult.presentation_mode;
  }

  const reading = structuredReadingSchema.parse({
    reading_id: crypto.randomUUID(),
    locale: "zh-CN",
    question: requireStateValue(state.question, "question"),
    question_type: requireStateValue(state.questionType, "questionType"),
    agent_profile: agentProfile,
    reading_phase: phase,
    requires_followup:
      phase === "initial" && agentProfile !== "lite" && draft.follow_up_questions.length > 0,
    initial_reading_id: phase === "final" ? initialReading?.reading_id ?? null : null,
    followup_answers: phase === "final" ? followupAnswers : null,
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
  }) as StructuredReading;

  return { reading };
};

const applySafetyReviewNode: ReadingGraphNode = (state) => {
  const reviewedReading = structuredReadingSchema.parse(
    applySafetyReview({
      question: requireStateValue(state.question, "question"),
      reading: requireStateValue(state.reading, "reading"),
    }),
  ) as StructuredReading;

  return {
    reading: structuredReadingSchema.parse({
      ...reviewedReading,
      requires_followup: shouldRequireFollowup(reviewedReading),
    }) as StructuredReading,
  };
};

const attachSessionCapsuleNode: ReadingGraphNode = (state) => {
  const reading = requireStateValue(state.reading, "reading");

  if (!shouldAttachSessionCapsule(reading)) {
    return {
      reading: structuredReadingSchema.parse({
        ...reading,
        session_capsule: null,
      }) as StructuredReading,
    };
  }

  return {
    reading: structuredReadingSchema.parse({
      ...reading,
      session_capsule: buildSessionCapsule({
        question: reading.question,
        spread: reading.spread,
        themes: reading.themes,
        reflectiveGuidance: reading.reflective_guidance,
      }),
    }) as StructuredReading,
  };
};

const readingGraph = new StateGraph(ReadingGraphState)
  .addNode("classify_question", classifyQuestionNode)
  .addNode("hydrate_context", hydrateContextNode)
  .addNode("validate_final_phase", validateFinalPhaseNode)
  .addNode("analyze_intent_friction", analyzeIntentFrictionNode)
  .addNode("generate_draft", generateDraftNode)
  .addNode("validate_draft_contract", validateDraftContractNode)
  .addNode("build_structured_reading", buildStructuredReadingNode)
  .addNode("apply_safety_review", applySafetyReviewNode)
  .addNode("attach_session_capsule", attachSessionCapsuleNode)
  .addEdge(START, "classify_question")
  .addEdge("classify_question", "hydrate_context")
  .addEdge("hydrate_context", "validate_final_phase")
  .addEdge("validate_final_phase", "analyze_intent_friction")
  .addEdge("analyze_intent_friction", "generate_draft")
  .addEdge("generate_draft", "validate_draft_contract")
  .addEdge("validate_draft_contract", "build_structured_reading")
  .addEdge("build_structured_reading", "apply_safety_review")
  .addEdge("apply_safety_review", "attach_session_capsule")
  .addEdge("attach_session_capsule", END)
  .compile();

interface RunReadingGraphOptions {
  provider?: ReadingProvider;
}

export async function runReadingGraph(
  payload: ReadingRequestPayload,
  options?: RunReadingGraphOptions,
): Promise<StructuredReading> {
  try {
    const result = await readingGraph.invoke({
      payload,
      provider: options?.provider,
    });
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
