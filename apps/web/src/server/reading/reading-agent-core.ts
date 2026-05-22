import "server-only";

import type {
  DrawnCard,
  QuestionType,
  ReadingPhase,
  Spread,
} from "@aethertarot/shared-types";
import type { IntentFrictionResult } from "@/server/reading/safety";
import type { RetrieveTarotKnowledgeInput } from "@/server/reading/tools/retrieve-tarot-knowledge";
import type { ToolCallAuditEntry } from "@/server/reading/tools/types";

export type AgentAction =
  | { type: "final_answer"; reason: string }
  | { type: "get_session_memory"; reason: string }
  | { type: "request_clarification"; reason: string; question: string }
  | { type: "retrieve_knowledge"; reason: string; query: string }
  | { type: "safety_stop"; reason: string };

export type GroundingStatus = "none" | "retrieved";

export interface AgentActionTrace {
  step: number;
  type: AgentAction["type"];
  reason: string;
  input?: unknown;
  output?: unknown;
  created_at?: string;
}

export interface AgentObservation {
  source: string;
  content: unknown;
  confidence?: string;
}

export interface PendingClarification {
  question: string;
  reason: string;
}

export interface ReadingAgentState {
  agent_step_count: number;
  max_agent_steps: number;
  agent_actions: AgentActionTrace[];
  observations: AgentObservation[];
  tool_calls: ToolCallAuditEntry[];
  pending_clarification?: PendingClarification;
  grounding_status?: GroundingStatus;
}

export interface ReadingAgentDecisionContext {
  question: string;
  questionType: QuestionType;
  threadId?: string;
  phase: ReadingPhase;
  spread: Spread;
  drawnCards: DrawnCard[];
  frictionResult: IntentFrictionResult;
  agentState: ReadingAgentState;
}

export type ReadingAgentDecider = (
  context: ReadingAgentDecisionContext,
) => Promise<AgentAction> | AgentAction;

const VAGUE_QUESTION_PATTERN =
  /^(我该怎么办|怎么办|该怎么办|怎么选|怎么做|what should i do)[？?。!！\s]*$/i;
const KNOWLEDGE_RETRIEVAL_PATTERN =
  /牌义|正位|逆位|组合|代表什么|什么意思|怎么理解|含义|meaning|reversed|upright/i;
const THREAD_MEMORY_FOLLOWUP_PATTERN =
  /^(那|那么|所以|刚才|上次|上一轮|继续|如果这样|这样的话)|上一轮|上次|刚才|前面|之前|接着|马上|立刻|投简历|要不要|是不是应该|should i/i;

export const AGENT_DECIDER_PROMPT = `
You are AetherTarot's controlled reading agent decider.

Choose exactly one action from this closed set:
- retrieve_knowledge
- get_session_memory
- request_clarification
- final_answer
- safety_stop

Rules:
1. Do not make deterministic fate claims, absolute future predictions, medical/legal/financial certainty claims, or third-party mind-reading claims.
2. If the user's question is too vague to choose a topic lens, choose request_clarification.
3. If the question asks about a specific card meaning, reversed/upright meaning, or card-combination meaning, choose retrieve_knowledge.
4. If the current question is an obvious follow-up to the same reading thread and no session memory has been read yet, choose get_session_memory.
5. If the available question, spread, cards, observations, memory, and safety state are sufficient, choose final_answer.
6. If the input involves high-risk self-harm, urgent danger, coercion, manipulation, or professional-advice substitution, choose safety_stop.
7. Return structured JSON only. Do not write prose outside JSON.

JSON shape:
{
  "type": "retrieve_knowledge" | "get_session_memory" | "request_clarification" | "final_answer" | "safety_stop",
  "reason": "short reason",
  "query": "required only for retrieve_knowledge",
  "question": "required only for request_clarification"
}
`.trim();

function inferPrimaryCard(drawnCards: DrawnCard[]) {
  return drawnCards[0];
}

function buildKnowledgeQuery({
  question,
  questionType,
  drawnCards,
}: {
  question: string;
  questionType: QuestionType;
  drawnCards: DrawnCard[];
}) {
  const primaryCard = inferPrimaryCard(drawnCards);

  if (!primaryCard) {
    return question;
  }

  const orientation = primaryCard.isReversed ? "逆位" : "正位";

  return `${primaryCard.card.name}${orientation} / ${questionType} / ${question}`;
}

export function defaultReadingAgentDecider({
  question,
  questionType,
  threadId,
  drawnCards,
  frictionResult,
  agentState,
}: ReadingAgentDecisionContext): AgentAction {
  if (frictionResult.type === "hard_stop") {
    return {
      type: "safety_stop",
      reason: frictionResult.reason,
    };
  }

  if (VAGUE_QUESTION_PATTERN.test(question.trim())) {
    return {
      type: "request_clarification",
      reason: "用户问题过于宽泛，缺少可稳定选择的主题镜头。",
      question: "你更希望从感情、职业还是自我成长的角度来解读这组牌？",
    };
  }

  const hasObservation = agentState.observations.length > 0;
  const hasMemoryObservation = agentState.observations.some(
    (observation) => observation.source === "get_session_memory",
  );

  if (!hasObservation && KNOWLEDGE_RETRIEVAL_PATTERN.test(question)) {
    return {
      type: "retrieve_knowledge",
      reason: "用户正在询问具体牌义、正逆位或组合含义，先通过知识工具边界收集可替换的依据。",
      query: buildKnowledgeQuery({
        question,
        questionType,
        drawnCards,
      }),
    };
  }

  if (
    threadId
    && !hasMemoryObservation
    && THREAD_MEMORY_FOLLOWUP_PATTERN.test(question.trim())
  ) {
    return {
      type: "get_session_memory",
      reason: "当前问题像同一 thread 内的追问，先读取短期 thread memory 再回答。",
    };
  }

  return {
    type: "final_answer",
    reason: hasObservation
      ? "已有工具观察，进入结构化解读生成。"
      : "当前问题、牌阵与抽牌信息已足够进入结构化解读生成。",
  };
}

export function buildAgentStateSnapshot({
  agentStepCount,
  maxAgentSteps,
  agentActions,
  observations,
  toolCalls,
  pendingClarification,
  groundingStatus,
}: {
  agentStepCount?: number;
  maxAgentSteps?: number;
  agentActions?: AgentActionTrace[];
  observations?: AgentObservation[];
  toolCalls?: ToolCallAuditEntry[];
  pendingClarification?: PendingClarification;
  groundingStatus?: GroundingStatus;
}): ReadingAgentState {
  return {
    agent_step_count: agentStepCount ?? 0,
    max_agent_steps: maxAgentSteps ?? 3,
    agent_actions: agentActions ?? [],
    observations: observations ?? [],
    tool_calls: toolCalls ?? [],
    pending_clarification: pendingClarification,
    grounding_status: groundingStatus ?? "none",
  };
}

export function createKnowledgeRetrievalInput({
  action,
  questionType,
  drawnCards,
}: {
  action: Extract<AgentAction, { type: "retrieve_knowledge" }>;
  questionType: QuestionType;
  drawnCards: DrawnCard[];
}): RetrieveTarotKnowledgeInput {
  const primaryCard = inferPrimaryCard(drawnCards);

  return {
    card: primaryCard?.card.id,
    orientation: primaryCard
      ? primaryCard.isReversed ? "reversed" : "upright"
      : undefined,
    topic: questionType,
    query: action.query,
  };
}

export function applyGroundingNotice(
  confidenceNote: string | null,
  groundingStatus: GroundingStatus | undefined,
  hasKnowledgeObservation = false,
) {
  if (!hasKnowledgeObservation) {
    return confidenceNote;
  }

  const notice = groundingStatus === "retrieved"
    ? "本次牌义依据已接入本地知识库检索片段；未检索到的内容不会被伪装成知识库结论。"
    : "本地知识库没有返回足够可靠的牌义片段；本次解读只能基于当前牌面、牌阵位置与一般反思框架降级生成。";

  if (!confidenceNote) {
    return notice;
  }

  if (confidenceNote.includes(notice)) {
    return confidenceNote;
  }

  return `${confidenceNote} ${notice}`;
}
