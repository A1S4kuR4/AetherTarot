import { describe, expect, it } from "vitest";
import type { DrawnCard, StructuredReading } from "@aethertarot/shared-types";
import { buildShareCardModel } from "./share-model";

function createMockReading(
  overrides: Partial<StructuredReading> = {},
): StructuredReading {
  return {
    reading_id: "test-reading-id",
    locale: "zh-CN",
    question: "我应该接受这份工作吗？",
    question_type: "career",
    agent_profile: "standard",
    reading_phase: "final",
    requires_followup: false,
    initial_reading_id: null,
    followup_answers: null,
    spread: {
      id: "three-card",
      name: "圣三角牌阵",
      englishName: "Three Card Spread",
      description: "过去、现在、未来",
      icon: "style",
      positions: [
        { id: "past", name: "过去", description: "过去的影响" },
        { id: "present", name: "现在", description: "当前状态" },
        { id: "future", name: "未来", description: "未来走向" },
      ],
    },
    cards: [
      {
        card_id: "fool",
        name: "愚人",
        english_name: "The Fool",
        orientation: "upright",
        position_id: "past",
        position: "过去",
        position_meaning: "过去的起点",
        interpretation: "你正站在新的起点上。",
      },
      {
        card_id: "death",
        name: "死神",
        english_name: "Death",
        orientation: "reversed",
        position_id: "present",
        position: "现在",
        position_meaning: "转变中",
        interpretation: "旧模式正在松动。",
      },
      {
        card_id: "sun",
        name: "太阳",
        english_name: "The Sun",
        orientation: "upright",
        position_id: "future",
        position: "未来",
        position_meaning: "光明前景",
        interpretation: "结果会趋向明朗。",
      },
    ],
    themes: ["转变", "行动", "新生"],
    synthesis: "综合解读内容",
    reflective_guidance: ["思考一", "思考二", "思考三"],
    follow_up_questions: [],
    safety_note: "安全说明",
    confidence_note: "置信说明",
    session_capsule: "session-capsule-value",
    sober_check: null,
    presentation_mode: "standard",
    ...overrides,
  };
}

function createMockDrawnCards(): DrawnCard[] {
  return [
    {
      positionId: "past",
      card: {
        id: "fool",
        name: "愚人",
        englishName: "The Fool",
        arcana: "Major Arcana 0",
        element: "Air",
        description: "",
        uprightKeywords: ["自发", "开放"],
        reversedKeywords: ["鲁莽", "逃避责任"],
        symbolism: [],
        imageUrl: "/cardsV2/major_0_fool.png",
        thumbnailUrl: "/cardsV2/thumbs/major_0_fool.webp",
      },
      isReversed: false,
    },
    {
      positionId: "present",
      card: {
        id: "death",
        name: "死神",
        englishName: "Death",
        arcana: "Major Arcana XIII",
        element: "Water",
        description: "",
        uprightKeywords: ["转变", "结束"],
        reversedKeywords: ["抗拒", "停滞"],
        symbolism: [],
        imageUrl: "/cardsV2/major_13_death.png",
        thumbnailUrl: "/cardsV2/thumbs/major_13_death.webp",
      },
      isReversed: true,
    },
    {
      positionId: "future",
      card: {
        id: "sun",
        name: "太阳",
        englishName: "The Sun",
        arcana: "Major Arcana XIX",
        element: "Fire",
        description: "",
        uprightKeywords: ["成功", "喜悦"],
        reversedKeywords: ["延迟", "沮丧"],
        symbolism: [],
        imageUrl: "/cardsV2/major_19_sun.png",
        thumbnailUrl: "/cardsV2/thumbs/major_19_sun.webp",
      },
      isReversed: false,
    },
  ];
}

describe("buildShareCardModel", () => {
  it("maps reading fields to share model", () => {
    const model = buildShareCardModel({
      reading: createMockReading(),
      drawnCards: createMockDrawnCards(),
      mode: "minimal",
    });

    expect(model.mode).toBe("minimal");
    expect(model.question).toBe("我应该接受这份工作吗？");
    expect(model.spreadName).toBe("圣三角牌阵");
    expect(model.cards).toHaveLength(3);
    expect(model.cards[0].name).toBe("愚人");
    expect(model.cards[1].orientation).toBe("reversed");
    expect(model.themes).toEqual(["转变", "行动", "新生"]);
    expect(model.synthesis).toBe("综合解读内容");
  });

  it("uses reveal image urls for card images", () => {
    const model = buildShareCardModel({
      reading: createMockReading(),
      drawnCards: createMockDrawnCards(),
      mode: "minimal",
    });

    expect(model.cards[0].imageUrl).toBe("/cardsV2/thumbs/major_0_fool.webp");
  });

  it("excludes sensitive fields from the projection", () => {
    const model = buildShareCardModel({
      reading: createMockReading({
        session_capsule: "secret-session-capsule",
        followup_answers: [{ question: "q", answer: "a" }],
      }),
      drawnCards: createMockDrawnCards(),
      mode: "summary",
    });

    expect(model).not.toHaveProperty("sessionCapsule");
    expect(model).not.toHaveProperty("followupAnswers");
    expect(model).not.toHaveProperty("readingId");
  });
});
