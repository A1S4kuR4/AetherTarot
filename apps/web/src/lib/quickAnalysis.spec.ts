import { describe, expect, it } from "vitest";
import type { DrawnCard, TarotCard } from "@aethertarot/shared-types";
import { buildLocalQuickAnalysis } from "@/lib/quickAnalysis";

const card: TarotCard = {
  id: "fool",
  name: "愚者",
  englishName: "The Fool",
  arcana: "Major Arcana 0",
  element: "Air",
  description:
    "愚者代表着原点、空无与未被限定的可能性。他带着信任感进入新经验。",
  uprightKeywords: ["自发", "开放", "冒险"],
  reversedKeywords: ["鲁莽", "逃避责任", "忽略现实"],
  symbolism: [
    "白玫瑰：纯真、自由与 0 的原初可能性。",
    "悬崖边的狗：对过去经验对当下行动拉扯的警示。",
  ],
  imageUrl: "/cardsV2/major_0_fool.png",
};

function drawCard(isReversed: boolean, overrides?: Partial<TarotCard>): DrawnCard {
  return {
    positionId: "focus",
    card: {
      ...card,
      ...overrides,
    },
    isReversed,
  };
}

describe("buildLocalQuickAnalysis", () => {
  it("anchors upright quick analysis to card keywords and symbolism", () => {
    const analysis = buildLocalQuickAnalysis(drawCard(false));

    expect(analysis.keywords).toEqual(["自发", "开放", "冒险"]);
    expect(analysis.core).toContain("愚者（正位）");
    expect(analysis.core).toContain("自发、开放、冒险");
    expect(analysis.action).toContain("白玫瑰");
    expect(analysis.boundary).toContain("不是对未来的确定承诺");
  });

  it("uses a slower reality-check action for reversed cards", () => {
    const analysis = buildLocalQuickAnalysis(drawCard(true));

    expect(analysis.keywords).toEqual(["鲁莽", "逃避责任", "忽略现实"]);
    expect(analysis.core).toContain("卡点");
    expect(analysis.action).toContain("紧绷或失衡");
    expect(analysis.action).toContain("放慢一步");
  });

  it("falls back to keywords when description and symbolism are unavailable", () => {
    const analysis = buildLocalQuickAnalysis(
      drawCard(false, {
        description: " ",
        symbolism: [],
      }),
    );

    expect(analysis.core).toContain("自发、开放、冒险");
    expect(analysis.action).toContain("现实中可观察、可收回的小行动");
  });
});
