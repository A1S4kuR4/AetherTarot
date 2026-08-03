import type {
  AgentProfile,
  DrawSource,
  DrawnCard,
  Spread,
  TarotCard,
  ReadingRequestCardInput,
} from "@aethertarot/shared-types";
import { restoreAgentProfile } from "@aethertarot/shared-types";

export const READING_DRAFT_STORAGE_KEY = "aether_tarot_active_reading_v1";

export interface ReadingDraftSnapshot {
  version: 2;
  requestId: string;
  threadId: string;
  question: string;
  spreadId: string;
  agentProfile: AgentProfile;
  drawSource: DrawSource;
  drawnCards: ReadingRequestCardInput[];
}

export interface RestoredReadingDraft {
  requestId: string | null;
  threadId: string | null;
  question: string;
  selectedSpread: Spread;
  agentProfile: AgentProfile;
  drawSource: DrawSource;
  drawnCards: DrawnCard[];
}

interface ParseReadingDraftOptions {
  findSpreadById: (id: string) => Spread | undefined;
  findCardById: (id: string) => TarotCard | undefined;
}

const DRAW_SOURCES = new Set<DrawSource>(["digital_random", "offline_manual"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseDrawnCard(value: unknown): ReadingRequestCardInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const { positionId, cardId, isReversed } = value;

  if (
    typeof positionId !== "string" ||
    !positionId.trim() ||
    typeof cardId !== "string" ||
    !cardId.trim() ||
    typeof isReversed !== "boolean"
  ) {
    return null;
  }

  return {
    positionId,
    cardId,
    isReversed,
  };
}

export function buildReadingDraftSnapshot({
  requestId,
  threadId,
  question,
  selectedSpread,
  agentProfile,
  drawSource,
  drawnCards,
}: {
  requestId: string;
  threadId?: string;
  question: string;
  selectedSpread: Spread;
  agentProfile: AgentProfile;
  drawSource: DrawSource;
  drawnCards: DrawnCard[];
}): ReadingDraftSnapshot {
  return {
    version: 2,
    requestId,
    threadId: threadId ?? requestId,
    question: question.trim(),
    spreadId: selectedSpread.id,
    agentProfile,
    drawSource,
    drawnCards: drawnCards.map((drawnCard) => ({
      positionId: drawnCard.positionId,
      cardId: drawnCard.card.id,
      isReversed: drawnCard.isReversed,
    })),
  };
}

export function parseReadingDraftSnapshot(
  value: string | null,
  options: ParseReadingDraftOptions,
): RestoredReadingDraft | null {
  if (!value) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const question = typeof parsed.question === "string" ? parsed.question.trim() : "";
  const requestId = typeof parsed.requestId === "string" && UUID_PATTERN.test(parsed.requestId)
    ? parsed.requestId
    : null;
  const threadId = typeof parsed.threadId === "string" && UUID_PATTERN.test(parsed.threadId)
    ? parsed.threadId
    : null;
  const spreadId = typeof parsed.spreadId === "string" ? parsed.spreadId : "";
  const agentProfile = parsed.agentProfile;
  const drawSource = parsed.drawSource;

  if (
    (parsed.version !== 1 && parsed.version !== 2) ||
    !spreadId ||
    !DRAW_SOURCES.has(drawSource as DrawSource) ||
    !Array.isArray(parsed.drawnCards) ||
    parsed.drawnCards.length === 0
  ) {
    return null;
  }

  const selectedSpread = options.findSpreadById(spreadId);

  if (!selectedSpread) {
    return null;
  }

  const requestCards = parsed.drawnCards.map(parseDrawnCard);

  if (requestCards.some((card) => card === null)) {
    return null;
  }

  const drawnCards: DrawnCard[] = [];

  for (const requestCard of requestCards) {
    if (!requestCard) {
      return null;
    }

    const card = options.findCardById(requestCard.cardId);

    if (!card) {
      return null;
    }

    drawnCards.push({
      positionId: requestCard.positionId,
      card,
      isReversed: requestCard.isReversed,
    });
  }

  const normalizedAgentProfile = restoreAgentProfile(agentProfile);
  const isQuestionlessQuickDraft =
    !question
    && normalizedAgentProfile === "lite"
    && selectedSpread.id === "single"
    && selectedSpread.positions.length === 1
    && drawnCards.length === 1
    && drawnCards[0]?.positionId === selectedSpread.positions[0]?.id;

  if (!question && !isQuestionlessQuickDraft) {
    return null;
  }

  return {
    requestId,
    threadId,
    question,
    selectedSpread,
    agentProfile: restoreAgentProfile(agentProfile, (original, fallback) => {
      const valueType = original === null
        ? "null"
        : Array.isArray(original)
          ? "array"
          : typeof original;

      console.warn(
        "[reading-draft-storage] unknown agent_profile in draft; falling back to",
        fallback,
        { valueType },
      );
    }),
    drawSource: drawSource as DrawSource,
    drawnCards,
  };
}
