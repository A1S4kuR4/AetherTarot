import { describe, expect, it } from "vitest";
import type { DrawnCard, Spread, TarotCard } from "@aethertarot/shared-types";
import {
  buildReadingDraftSnapshot,
  parseReadingDraftSnapshot,
  READING_DRAFT_STORAGE_KEY,
} from "@/lib/reading-draft-storage";

const spread: Spread = {
  id: "single",
  name: "单牌启示",
  englishName: "Single Card",
  description: "A focused single-card spread.",
  icon: "sparkles",
  positions: [
    {
      id: "core",
      name: "核心指引",
      description: "问题的核心能量。",
    },
  ],
};

const card: TarotCard = {
  id: "king-of-cups",
  name: "圣杯国王",
  englishName: "King of Cups",
  arcana: "minor",
  element: "water",
  description: "Mature emotional steadiness.",
  uprightKeywords: ["成熟情感", "包容"],
  reversedKeywords: ["情绪压抑"],
  symbolism: ["cup", "throne"],
  imageUrl: "/cardsV2/minor_cups_king.png",
};

const drawnCards: DrawnCard[] = [
  {
    positionId: "core",
    card,
    isReversed: false,
  },
];

describe("reading draft storage", () => {
  it("uses a stable session storage key", () => {
    expect(READING_DRAFT_STORAGE_KEY).toBe("aether_tarot_active_reading_v1");
  });

  it("serializes only the active reading draft fields needed after reload", () => {
    const snapshot = buildReadingDraftSnapshot({
      question: "我最近在工作上需要看清什么？",
      selectedSpread: spread,
      agentProfile: "lite",
      drawSource: "digital_random",
      drawnCards,
    });

    expect(snapshot).toEqual({
      version: 1,
      question: "我最近在工作上需要看清什么？",
      spreadId: "single",
      agentProfile: "lite",
      drawSource: "digital_random",
      drawnCards: [
        {
          positionId: "core",
          cardId: "king-of-cups",
          isReversed: false,
        },
      ],
    });
  });

  it("restores spread and card objects from a saved active draft", () => {
    const snapshot = buildReadingDraftSnapshot({
      question: "我最近在工作上需要看清什么？",
      selectedSpread: spread,
      agentProfile: "lite",
      drawSource: "digital_random",
      drawnCards,
    });

    const restored = parseReadingDraftSnapshot(JSON.stringify(snapshot), {
      findSpreadById: (id) => (id === spread.id ? spread : undefined),
      findCardById: (id) => (id === card.id ? card : undefined),
    });

    expect(restored).toEqual({
      question: "我最近在工作上需要看清什么？",
      selectedSpread: spread,
      agentProfile: "lite",
      drawSource: "digital_random",
      drawnCards,
    });
  });

  it("rejects incomplete or stale active draft data", () => {
    const baseSnapshot = buildReadingDraftSnapshot({
      question: "我最近在工作上需要看清什么？",
      selectedSpread: spread,
      agentProfile: "lite",
      drawSource: "digital_random",
      drawnCards,
    });

    expect(parseReadingDraftSnapshot(null, {
      findSpreadById: () => spread,
      findCardById: () => card,
    })).toBeNull();

    expect(parseReadingDraftSnapshot(JSON.stringify({
      ...baseSnapshot,
      question: "   ",
    }), {
      findSpreadById: () => spread,
      findCardById: () => card,
    })).toBeNull();

    expect(parseReadingDraftSnapshot(JSON.stringify({
      ...baseSnapshot,
      drawnCards: [],
    }), {
      findSpreadById: () => spread,
      findCardById: () => card,
    })).toBeNull();

    expect(parseReadingDraftSnapshot(JSON.stringify(baseSnapshot), {
      findSpreadById: () => spread,
      findCardById: () => undefined,
    })).toBeNull();
  });
});
