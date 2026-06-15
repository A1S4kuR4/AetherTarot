import type {
  AgentProfile,
  DrawSource,
  DrawnCard,
  ReadingRequestCardInput,
  Spread,
  TarotCard,
} from "@aethertarot/shared-types";

export const READING_DRAFT_STORAGE_KEY = "aether_tarot_active_reading_v1";

export interface ReadingDraftSnapshot {
  version: 1;
  question: string;
  spreadId: string;
  agentProfile: AgentProfile;
  drawSource: DrawSource;
  drawnCards: ReadingRequestCardInput[];
}

export interface RestoredReadingDraft {
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

const AGENT_PROFILES = new Set<AgentProfile>(["lite", "standard", "sober"]);
const DRAW_SOURCES = new Set<DrawSource>(["digital_random", "offline_manual"]);

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
  question,
  selectedSpread,
  agentProfile,
  drawSource,
  drawnCards,
}: {
  question: string;
  selectedSpread: Spread;
  agentProfile: AgentProfile;
  drawSource: DrawSource;
  drawnCards: DrawnCard[];
}): ReadingDraftSnapshot {
  return {
    version: 1,
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
  const spreadId = typeof parsed.spreadId === "string" ? parsed.spreadId : "";
  const agentProfile = parsed.agentProfile;
  const drawSource = parsed.drawSource;

  if (
    parsed.version !== 1 ||
    !question ||
    !spreadId ||
    !AGENT_PROFILES.has(agentProfile as AgentProfile) ||
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

  return {
    question,
    selectedSpread,
    agentProfile: agentProfile as AgentProfile,
    drawSource: drawSource as DrawSource,
    drawnCards,
  };
}
