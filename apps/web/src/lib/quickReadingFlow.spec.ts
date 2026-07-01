import { describe, expect, it } from "vitest";
import type { DrawnCard, Spread, TarotCard } from "@aethertarot/shared-types";
import { isQuickReadingState } from "@/lib/quickReadingFlow";

const singleSpread: Spread = {
  id: "single",
  name: "单牌启示",
  englishName: "Single Card",
  description: "针对当下的能量或简单的问题，提供直接且纯粹的指引。",
  icon: "filter_1",
  positions: [
    {
      id: "focus",
      name: "核心指引",
      description: "问题的核心能量。",
    },
  ],
};

const multiSpread: Spread = {
  ...singleSpread,
  id: "holy-triangle",
  name: "圣三角",
  positions: [
    {
      id: "past",
      name: "过去",
      description: "过去的影响。",
    },
    {
      id: "present",
      name: "现在",
      description: "当下的状态。",
    },
  ],
};

const card: TarotCard = {
  id: "fool",
  name: "愚者",
  englishName: "The Fool",
  arcana: "Major Arcana 0",
  element: "Air",
  description: "愚者代表着原点、空无与未被限定的可能性。",
  uprightKeywords: ["自发"],
  reversedKeywords: ["鲁莽"],
  symbolism: ["白玫瑰：纯真、自由与 0 的原初可能性。"],
  imageUrl: "/cardsV2/major_0_fool.png",
};

const drawnCard: DrawnCard = {
  positionId: "focus",
  card,
  isReversed: false,
};

describe("isQuickReadingState", () => {
  it("accepts only the lite single-card quick reading state", () => {
    expect(isQuickReadingState({
      agentProfile: "lite",
      selectedSpread: singleSpread,
      drawnCards: [drawnCard],
    })).toBe(true);
  });

  it("rejects standard profile drafts so /quick-reading will not consume them", () => {
    expect(isQuickReadingState({
      agentProfile: "standard",
      selectedSpread: singleSpread,
      drawnCards: [drawnCard],
    })).toBe(false);
  });

  it("rejects multi-card or non-single spread drafts", () => {
    expect(isQuickReadingState({
      agentProfile: "lite",
      selectedSpread: multiSpread,
      drawnCards: [
        {
          ...drawnCard,
          positionId: "past",
        },
        {
          ...drawnCard,
          positionId: "present",
          isReversed: true,
        },
      ],
    })).toBe(false);
  });

  it("rejects a single spread when the drawn card does not match its position", () => {
    expect(isQuickReadingState({
      agentProfile: "lite",
      selectedSpread: singleSpread,
      drawnCards: [
        {
          ...drawnCard,
          positionId: "other",
        },
      ],
    })).toBe(false);
  });
});
