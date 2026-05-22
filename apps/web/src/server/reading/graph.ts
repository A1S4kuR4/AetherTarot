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
  SessionMemory,
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
import {
  extractLastAdviceSummary,
  GENERIC_LAST_ADVICE_FALLBACK,
} from "@/server/reading/memory-advice";
import type { SessionMemoryStore } from "@/server/reading/memory";
import { getReadingProvider } from "@/server/reading/provider";
import {
  applyGroundingNotice,
  buildAgentStateSnapshot,
  createKnowledgeRetrievalInput,
  defaultReadingAgentDecider,
  type AgentAction,
  type AgentActionTrace,
  type AgentObservation,
  type GroundingStatus,
  type PendingClarification,
  type ReadingAgentDecider,
  type ReadingAgentState,
} from "@/server/reading/reading-agent-core";
import { structuredReadingSchema } from "@/server/reading/schemas";
import {
  analyzeIntentFriction,
  applySafetyReview,
  sanitizeIncomingSessionCapsule,
  type IntentFrictionResult,
} from "@/server/reading/safety";
import { executeReadingTool } from "@/server/reading/tools/executor";
import {
  readingToolRegistry,
  type ReadingToolRegistry,
  type ToolCallAuditEntry,
} from "@/server/reading/tools";
import {
  buildReadingRunTrace,
  type ReadingRunTrace,
  type ReadingTraceState,
} from "@/server/reading/trace";
import {
  isRetrieveTarotKnowledgeOutput,
  type RetrieveTarotKnowledgeOutput,
} from "@/server/reading/tools/retrieve-tarot-knowledge";
import type {
  GetSessionMemoryOutput,
  WriteSessionMemoryOutput,
} from "@/server/reading/tools/session-memory";
import type {
  ReadingDraft,
  ReadingKnowledgeGrounding,
  ReadingProvider,
} from "@/server/reading/types";

const ReadingGraphState = new StateSchema({
  payload: z.custom<ReadingRequestPayload>(),
  runId: z.string().optional(),
  traceStartedAt: z.string().optional(),
  provider: z.custom<ReadingProvider>().optional(),
  agentDecider: z.custom<ReadingAgentDecider>().optional(),
  toolRegistry: z.custom<ReadingToolRegistry>().optional(),
  sessionMemoryStore: z.custom<SessionMemoryStore>().optional(),
  maxAgentSteps: z.number().int().positive().optional(),
  question: z.string().optional(),
  threadId: z.string().optional(),
  questionType: z.custom<QuestionType>().optional(),
  agentProfile: z.custom<AgentProfile>().optional(),
  phase: z.custom<ReadingPhase>().optional(),
  initialReading: z.custom<StructuredReading>().optional(),
  followupAnswers: z.custom<FollowupAnswer[]>().optional(),
  priorSessionCapsule: z.string().nullable().optional(),
  spread: z.custom<Spread>().optional(),
  drawnCards: z.custom<DrawnCard[]>().optional(),
  frictionResult: z.custom<IntentFrictionResult>().optional(),
  agentStepCount: z.number().int().nonnegative().optional(),
  agentAction: z.custom<AgentAction>().optional(),
  agentActions: z.custom<AgentActionTrace[]>().optional(),
  observations: z.custom<AgentObservation[]>().optional(),
  toolCalls: z.custom<ToolCallAuditEntry[]>().optional(),
  pendingClarification: z.custom<PendingClarification>().optional(),
  groundingStatus: z.custom<GroundingStatus>().optional(),
  sessionMemory: z.custom<SessionMemory>().nullable().optional(),
  draft: z.custom<ReadingDraft>().optional(),
  reading: z.custom<StructuredReading>().optional(),
});

type ReadingGraphNode = GraphNode<typeof ReadingGraphState>;
const MAX_SESSION_CAPSULE_LENGTH = 280;
const DEFAULT_MAX_AGENT_STEPS = 3;

interface ReadingGraphAgentFields {
  maxAgentSteps?: number;
  agentStepCount?: number;
  agentActions?: AgentActionTrace[];
  observations?: AgentObservation[];
  toolCalls?: ToolCallAuditEntry[];
  pendingClarification?: PendingClarification;
  groundingStatus?: GroundingStatus;
}

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

function getMaxAgentSteps(state: ReadingGraphAgentFields) {
  return state.maxAgentSteps ?? DEFAULT_MAX_AGENT_STEPS;
}

function getAgentState(state: ReadingGraphAgentFields): ReadingAgentState {
  return buildAgentStateSnapshot({
    agentStepCount: state.agentStepCount,
    maxAgentSteps: getMaxAgentSteps(state),
    agentActions: state.agentActions,
    observations: state.observations,
    toolCalls: state.toolCalls,
    pendingClarification: state.pendingClarification,
    groundingStatus: state.groundingStatus,
  });
}

function getAgentActionInput(action: AgentAction) {
  if (action.type === "retrieve_knowledge") {
    return { query: action.query };
  }

  if (action.type === "get_session_memory") {
    return { source: "current_thread" };
  }

  if (action.type === "request_clarification") {
    return { question: action.question };
  }

  return undefined;
}

function appendAgentAction({
  state,
  step,
  action,
}: {
  state: ReadingGraphAgentFields;
  step: number;
  action: AgentAction;
}) {
  return [
    ...(state.agentActions ?? []),
    {
      step,
      type: action.type,
      reason: action.reason,
      input: getAgentActionInput(action),
      created_at: new Date().toISOString(),
    },
  ];
}

function buildTraceForGraphState(
  state: ReadingTraceState,
  status: ReadingRunTrace["status"],
) {
  return buildReadingRunTrace(state, {
    status,
    endedAt: new Date().toISOString(),
  });
}

function throwWithDiagnosticTrace(
  error: ReadingServiceError,
  state: ReadingTraceState,
  status: ReadingRunTrace["status"],
): never {
  error.diagnosticTrace = buildTraceForGraphState(state, status);
  throw error;
}

function summarizeInternalErrorCause(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = rawMessage.replace(/\s+/g, " ").trim();

  return {
    name: error instanceof Error ? error.name : typeof error,
    message: message.length > 160 ? `${message.slice(0, 159)}…` : message,
  };
}

function buildGenericGenerationError(error: unknown) {
  const wrappedError = new ReadingServiceError(
    "generation_failed",
    "解读生成失败，请稍后再试。",
    500,
  ) as ReadingServiceError & { cause?: unknown };

  wrappedError.cause = summarizeInternalErrorCause(error);

  return wrappedError;
}

function throwGenericFailureWithDiagnosticTrace(
  error: unknown,
  state: ReadingTraceState,
): never {
  if (error instanceof ReadingServiceError) {
    if (!error.diagnosticTrace) {
      error.diagnosticTrace = buildTraceForGraphState(state, "failed");
    }
    throw error;
  }

  const wrappedError = buildGenericGenerationError(error);
  wrappedError.diagnosticTrace = buildTraceForGraphState(state, "failed");
  throw wrappedError;
}

function attachOutputToLastAction(
  agentActions: AgentActionTrace[] | undefined,
  output: unknown,
) {
  const actions = [...(agentActions ?? [])];
  const lastAction = actions.at(-1);

  if (!lastAction) {
    return actions;
  }

  actions[actions.length - 1] = {
    ...lastAction,
    output,
  };

  return actions;
}

function hasKnowledgeObservation(state: ReadingGraphAgentFields) {
  return (state.observations ?? []).some(
    (observation) => observation.source === "retrieve_tarot_knowledge",
  );
}

function buildKnowledgeGrounding(
  state: ReadingGraphAgentFields,
): ReadingKnowledgeGrounding {
  const retrievedOutputs = (state.observations ?? [])
    .map((observation) => observation.content)
    .filter(isRetrieveTarotKnowledgeOutput)
    .filter((output) => output.groundingStatus === "retrieved");
  const chunks = retrievedOutputs.flatMap((output) => output.chunks);

  if (chunks.length === 0) {
    return { status: "none", chunks: [] };
  }

  return {
    status: "retrieved",
    chunks,
  };
}

function getSessionMemoryFromObservations(
  observations: AgentObservation[] | undefined,
) {
  const output = [...(observations ?? [])]
    .reverse()
    .find((observation) => observation.source === "get_session_memory")
    ?.content as GetSessionMemoryOutput | undefined;

  return output?.memory ?? null;
}

function normalizeMemoryText(value: string, maxLength = 120) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function buildLastAdviceSummary(reading: StructuredReading) {
  return extractLastAdviceSummary({
    reading,
    topic: reading.question_type,
    cards: reading.cards.map((card) => ({
      id: card.card_id,
      name: card.name,
      orientation: card.orientation,
    })),
  }) ?? GENERIC_LAST_ADVICE_FALLBACK;
}

function buildSessionMemoryPatch(reading: StructuredReading): Partial<SessionMemory> {
  const lastAdviceSummary = buildLastAdviceSummary(reading);
  const statedConstraints = [
    reading.safety_note ? "safety_note_present" : null,
    reading.sober_check ? "sober_check_present" : null,
    reading.presentation_mode === "sober_anchor" ? "reality_check_required" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    summary: normalizeMemoryText(
      `主题：${reading.themes.join("、")}；建议：${lastAdviceSummary}`,
      180,
    ),
    topics: [reading.question_type, ...reading.themes.slice(0, 3)],
    cards: reading.cards.map((card) => ({
      id: card.card_id,
      name: card.name,
      orientation: card.orientation,
    })),
    stated_constraints: statedConstraints,
    open_questions: reading.follow_up_questions.map((item) =>
      normalizeMemoryText(item, 96),
    ),
    last_advice_summary: lastAdviceSummary || undefined,
  };
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
    .replace(/用户补充[:：]\s*/gi, "")
    .replace(/自杀|自残|不想活|结束生命|kill myself/gi, "[高风险细节略]")
    .replace(/崩溃|绝望|撑不下去|受不了了|活不下去/gi, "[急性情绪略]")
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
    threadId: state.payload.thread_id,
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

  return { frictionResult };
};

const agentDeciderNode: ReadingGraphNode = async (state) => {
  const currentStep = state.agentStepCount ?? 0;
  const maxAgentSteps = getMaxAgentSteps(state);
  const agentState = getAgentState(state);
  const decider = state.agentDecider ?? defaultReadingAgentDecider;
  let nextStep = currentStep;
  let action: AgentAction;

  if (currentStep >= maxAgentSteps) {
    action = {
      type: "final_answer",
      reason: "agent step 已达到上限，停止继续工具循环并进入最终解读生成。",
    };
  } else {
    nextStep = currentStep + 1;
    action = await decider({
      question: requireStateValue(state.question, "question"),
      questionType: requireStateValue(state.questionType, "questionType"),
      threadId: state.threadId,
      phase: requireStateValue(state.phase, "phase"),
      spread: requireStateValue(state.spread, "spread"),
      drawnCards: requireStateValue(state.drawnCards, "drawnCards"),
      frictionResult: requireStateValue(state.frictionResult, "frictionResult"),
      agentState,
    });

    if (nextStep >= maxAgentSteps && action.type === "retrieve_knowledge") {
      action = {
        type: "final_answer",
        reason: "agent step 已到达上限，本轮不再继续检索，优雅降级为最终解读生成。",
      };
    }
  }

  return {
    agentStepCount: nextStep,
    agentAction: action,
    agentActions: appendAgentAction({
      state,
      step: Math.max(nextStep, 1),
      action,
    }),
    pendingClarification:
      action.type === "request_clarification"
        ? {
            question: action.question,
            reason: action.reason,
          }
        : state.pendingClarification,
    groundingStatus: state.groundingStatus ?? "none",
  };
};

function routeAgentAction(state: { agentAction?: AgentAction }) {
  const action = requireStateValue(state.agentAction, "agentAction");

  return action.type;
}

const retrieveKnowledgeNode: ReadingGraphNode = async (state) => {
  const action = requireStateValue(state.agentAction, "agentAction");

  if (action.type !== "retrieve_knowledge") {
    throw new ReadingServiceError(
      "generation_failed",
      "reading agent route 与 retrieve_knowledge action 不一致。",
      500,
    );
  }

  const input = createKnowledgeRetrievalInput({
    action,
    questionType: requireStateValue(state.questionType, "questionType"),
    drawnCards: requireStateValue(state.drawnCards, "drawnCards"),
  });
  const execution = await executeReadingTool<RetrieveTarotKnowledgeOutput>({
    toolName: "retrieve_tarot_knowledge",
    input,
    context: {
      permissions: ["public", "session"],
      stateSnapshot: getAgentState(state),
    },
    registry: state.toolRegistry ?? readingToolRegistry,
    decisionReason: action.reason,
    step: state.agentStepCount ?? 0,
  });
  const output = execution.result.output;
  const observationContent = execution.result.ok
    ? output
    : {
        error: execution.result.error,
      };

  return {
    observations: [
      ...(state.observations ?? []),
      {
        source: "retrieve_tarot_knowledge",
        content: observationContent,
        confidence: output?.groundingStatus ?? "error",
      },
    ],
    agentActions: attachOutputToLastAction(state.agentActions, execution.result),
    toolCalls: [...(state.toolCalls ?? []), execution.auditEntry],
    groundingStatus: output?.groundingStatus ?? state.groundingStatus ?? "none",
  };
};

const getSessionMemoryNode: ReadingGraphNode = async (state) => {
  const action = requireStateValue(state.agentAction, "agentAction");

  if (action.type !== "get_session_memory") {
    throw new ReadingServiceError(
      "generation_failed",
      "reading agent route 与 get_session_memory action 不一致。",
      500,
    );
  }

  const threadId = state.threadId;

  if (!threadId) {
    const skippedOutput = {
      toolName: "get_session_memory",
      skipped: true,
      reason: "no_thread_id",
      output: {
        memory: null,
        skipped: true,
        reason: "no_thread_id",
      },
    };

    return {
      sessionMemory: state.sessionMemory ?? null,
      observations: [
        ...(state.observations ?? []),
        {
          source: "get_session_memory",
          content: skippedOutput.output,
          confidence: "none",
        },
      ],
      agentActions: attachOutputToLastAction(state.agentActions, skippedOutput),
    };
  }

  const execution = await executeReadingTool<GetSessionMemoryOutput>({
    toolName: "get_session_memory",
    input: { threadId },
    context: {
      threadId,
      permissions: ["public", "session"],
      stateSnapshot: getAgentState(state),
      sessionMemoryStore: state.sessionMemoryStore,
    },
    registry: state.toolRegistry ?? readingToolRegistry,
    decisionReason: action.reason,
    step: state.agentStepCount ?? 0,
  });
  const output = execution.result.output;
  const observationContent = execution.result.ok
    ? output
    : {
        error: execution.result.error,
      };

  return {
    sessionMemory: output?.memory ?? state.sessionMemory ?? null,
    observations: [
      ...(state.observations ?? []),
      {
        source: "get_session_memory",
        content: observationContent,
        confidence: output?.memory ? "retrieved" : "none",
      },
    ],
    agentActions: attachOutputToLastAction(state.agentActions, execution.result),
    toolCalls: [...(state.toolCalls ?? []), execution.auditEntry],
  };
};

const requestClarificationNode: ReadingGraphNode = (state) => {
  const pendingClarification = requireStateValue(
    state.pendingClarification,
    "pendingClarification",
  );

  throwWithDiagnosticTrace(
    new ReadingServiceError(
      "invalid_request",
      "这次提问需要先补充一个更明确的解读角度。",
      400,
      undefined,
      undefined,
      {
        agent_action: "request_clarification",
        pending_clarification: pendingClarification,
      },
    ),
    state,
    "clarification",
  );
};

const safetyStopNode: ReadingGraphNode = (state) => {
  const frictionResult = requireStateValue(
    state.frictionResult,
    "frictionResult",
  );

  if (frictionResult.type === "hard_stop") {
    throwWithDiagnosticTrace(
      new ReadingServiceError(
        "safety_intercept",
        "问题触发了高风险安全界限保护。",
        403,
        frictionResult.reason,
        frictionResult.referral_links,
      ),
      state,
      "safety_stop",
    );
  }

  const action = requireStateValue(state.agentAction, "agentAction");

  throwWithDiagnosticTrace(
    new ReadingServiceError(
      "safety_intercept",
      "reading agent 决策进入安全停止。",
      403,
      action.reason,
    ),
    state,
    "safety_stop",
  );
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
    sessionMemory:
      state.sessionMemory ?? getSessionMemoryFromObservations(state.observations),
    knowledgeGrounding: buildKnowledgeGrounding(state),
  };

  if (phase === "final") {
    try {
      return {
        draft: await provider.generateFinalRead({
          ...baseContext,
          initialReading: requireStateValue(state.initialReading, "initialReading"),
          followupAnswers: requireStateValue(state.followupAnswers, "followupAnswers"),
        }),
      };
    } catch (error) {
      throwGenericFailureWithDiagnosticTrace(error, state);
    }
  }

  try {
    return {
      draft: await provider.generateInitialRead(baseContext),
    };
  } catch (error) {
    throwGenericFailureWithDiagnosticTrace(error, state);
  }
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
    confidence_note: applyGroundingNotice(
      draft.confidence_note,
      state.groundingStatus,
      hasKnowledgeObservation(state),
    ),
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

const writeSessionMemoryNode: ReadingGraphNode = async (state) => {
  const threadId = state.threadId;

  if (!threadId) {
    return {};
  }

  const reading = requireStateValue(state.reading, "reading");
  const execution = await executeReadingTool<WriteSessionMemoryOutput>({
    toolName: "write_session_memory",
    input: {
      threadId,
      patch: buildSessionMemoryPatch(reading),
    },
    context: {
      threadId,
      permissions: ["public", "session"],
      stateSnapshot: getAgentState(state),
      sessionMemoryStore: state.sessionMemoryStore,
    },
    registry: state.toolRegistry ?? readingToolRegistry,
    decisionReason: "结构化解读成功后写入当前 thread 的短期记忆摘要。",
    // Post-agent audit step: this write happens after the controlled agent loop,
    // so its tool-call step can be greater than agent_step_count.
    step: (state.agentStepCount ?? 0) + 1,
  });

  return {
    sessionMemory: execution.result.output?.memory ?? state.sessionMemory ?? null,
    toolCalls: [...(state.toolCalls ?? []), execution.auditEntry],
  };
};

const readingGraph = new StateGraph(ReadingGraphState)
  .addNode("classify_question", classifyQuestionNode)
  .addNode("hydrate_context", hydrateContextNode)
  .addNode("validate_final_phase", validateFinalPhaseNode)
  .addNode("analyze_intent_friction", analyzeIntentFrictionNode)
  .addNode("agent_decider", agentDeciderNode)
  .addNode("retrieve_knowledge", retrieveKnowledgeNode)
  .addNode("get_session_memory", getSessionMemoryNode)
  .addNode("request_clarification", requestClarificationNode)
  .addNode("safety_stop", safetyStopNode)
  .addNode("generate_draft", generateDraftNode)
  .addNode("validate_draft_contract", validateDraftContractNode)
  .addNode("build_structured_reading", buildStructuredReadingNode)
  .addNode("apply_safety_review", applySafetyReviewNode)
  .addNode("attach_session_capsule", attachSessionCapsuleNode)
  .addNode("write_session_memory", writeSessionMemoryNode)
  .addEdge(START, "classify_question")
  .addEdge("classify_question", "hydrate_context")
  .addEdge("hydrate_context", "validate_final_phase")
  .addEdge("validate_final_phase", "analyze_intent_friction")
  .addEdge("analyze_intent_friction", "agent_decider")
  .addConditionalEdges("agent_decider", routeAgentAction, {
    final_answer: "generate_draft",
    get_session_memory: "get_session_memory",
    request_clarification: "request_clarification",
    retrieve_knowledge: "retrieve_knowledge",
    safety_stop: "safety_stop",
  })
  .addEdge("retrieve_knowledge", "agent_decider")
  .addEdge("get_session_memory", "agent_decider")
  .addEdge("request_clarification", END)
  .addEdge("safety_stop", END)
  .addEdge("generate_draft", "validate_draft_contract")
  .addEdge("validate_draft_contract", "build_structured_reading")
  .addEdge("build_structured_reading", "apply_safety_review")
  .addEdge("apply_safety_review", "attach_session_capsule")
  .addEdge("attach_session_capsule", "write_session_memory")
  .addEdge("write_session_memory", END)
  .compile();

interface RunReadingGraphOptions {
  provider?: ReadingProvider;
  agentDecider?: ReadingAgentDecider;
  toolRegistry?: ReadingToolRegistry;
  sessionMemoryStore?: SessionMemoryStore;
  maxAgentSteps?: number;
}

export interface ReadingGraphDiagnostics {
  reading: StructuredReading;
  agentState: ReadingAgentState;
  trace: ReadingRunTrace;
}

export async function runReadingGraphWithDiagnostics(
  payload: ReadingRequestPayload,
  options?: RunReadingGraphOptions,
): Promise<ReadingGraphDiagnostics> {
  const runId = crypto.randomUUID();
  const traceStartedAt = new Date().toISOString();

  try {
    const result = await readingGraph.invoke({
      payload,
      runId,
      traceStartedAt,
      provider: options?.provider,
      agentDecider: options?.agentDecider,
      toolRegistry: options?.toolRegistry,
      sessionMemoryStore: options?.sessionMemoryStore,
      maxAgentSteps: options?.maxAgentSteps ?? DEFAULT_MAX_AGENT_STEPS,
    });
    return {
      reading: requireStateValue(result.reading, "reading"),
      agentState: getAgentState(result),
      trace: buildReadingRunTrace(result, {
        status: "success",
        endedAt: new Date().toISOString(),
      }),
    };
  } catch (error) {
    if (error instanceof ReadingServiceError) {
      throw error;
    }

    const wrappedError = buildGenericGenerationError(error);
    wrappedError.diagnosticTrace = buildReadingRunTrace(
      {
        runId,
        traceStartedAt,
      },
      {
        status: "failed",
        endedAt: new Date().toISOString(),
      },
    );

    throw wrappedError;
  }
}

export async function runReadingGraph(
  payload: ReadingRequestPayload,
  options?: RunReadingGraphOptions,
): Promise<StructuredReading> {
  const result = await runReadingGraphWithDiagnostics(payload, options);

  return result.reading;
}
