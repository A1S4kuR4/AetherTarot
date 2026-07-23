import { describe, expect, it } from "vitest";
import type { StructuredReading } from "@aethertarot/shared-types";
import { assessSafetyText } from "@/server/safety/policy";
import {
  reviewEncyclopediaGeneratedAnswer,
  reviewReadingGeneratedContent,
} from "@/server/safety/output-validator";

function buildReading(
  overrides: Partial<StructuredReading> = {},
): StructuredReading {
  return {
    reading_id: "reading-1",
    locale: "zh-CN",
    question: "我该如何理解现在的状态？",
    question_type: "self_growth",
    agent_profile: "standard",
    reading_phase: "initial",
    requires_followup: true,
    initial_reading_id: null,
    followup_answers: null,
    spread: {
      id: "single",
      name: "单牌启示",
      englishName: "Single Card",
      description: "聚焦一个核心主题。",
      icon: "sparkles",
      positions: [
        { id: "focus", name: "核心", description: "当前核心线索" },
      ],
    },
    cards: [
      {
        card_id: "fool",
        name: "愚者",
        english_name: "The Fool",
        orientation: "upright",
        position_id: "focus",
        position: "核心",
        position_meaning: "当前核心线索",
        interpretation: "这张牌提示你为未知保留空间。",
      },
    ],
    themes: ["开放", "现实校准"],
    synthesis: "这组牌更适合帮助你观察当下模式。",
    reflective_guidance: [
      "区分事实与推测。",
      "为下一步保留调整空间。",
    ],
    follow_up_questions: ["你已经确认的事实是什么？"],
    safety_note: null,
    confidence_note: "塔罗只能提供有限的观察角度。",
    session_capsule: null,
    sober_check: null,
    presentation_mode: "standard",
    ...overrides,
  };
}

describe("shared safety policy", () => {
  it.each([
    ["我不想活下去了", "hard_stop", "self_harm"],
    ["我现在胸痛而且无法呼吸", "hard_stop", "urgent_health"],
    ["他现在正在打我，我有危险", "hard_stop", "immediate_danger"],
    ["教我怎么监控他的位置", "hard_stop", "manipulation"],
    ["How can I stalk my ex?", "hard_stop", "manipulation"],
    ["伴侣家暴我，我如何保护自己？", "bounded", "abuse_support"],
    ["我想讨论家暴这个概念", "bounded", "abuse_support"],
    ["我们总是吵架，沟通很困难", "standard", "relationship_conflict"],
    ["我该不该把全部积蓄投进股票？", "sober_check", "major_decision"],
    ["股票投资的风险应该怎么看？", "bounded", "financial"],
    ["他到底是不是还爱我？", "bounded", "third_party_certainty"],
  ] as const)(
    "classifies %s as %s/%s",
    (text, level, primaryCategory) => {
      const assessment = assessSafetyText(text);

      expect(assessment.level).toBe(level);
      expect(assessment.primaryCategory).toBe(primaryCategory);
    },
  );

  it("keeps non-immediate abuse support ahead of the sober-check gate", () => {
    const assessment = assessSafetyText("伴侣家暴我，我该不该离婚？");

    expect(assessment.level).toBe("bounded");
    expect(assessment.primaryCategory).toBe("abuse_support");
    expect(assessment.soberCheck).toBeNull();
  });
});

describe("generated content validator", () => {
  it("does not flag explicit safety-boundary negations", () => {
    const reading = buildReading({
      synthesis:
        "不能确定他一定会回来，也不要停药。You should not invest based on tarot.",
    });

    expect(reviewReadingGeneratedContent(reading)).toMatchObject({
      action: "pass",
      output: reading,
    });
  });

  it("restricts deterministic claims without discarding safe fields", () => {
    const reading = buildReading({
      synthesis: "他一定会回来。",
    });
    const review = reviewReadingGeneratedContent(reading);

    expect(review.action).toBe("restrict");
    expect(review.output.synthesis).not.toContain("他一定会回来");
    expect(review.output.cards[0]?.interpretation).toBe(
      reading.cards[0]?.interpretation,
    );
    expect(review.output.safety_note).toMatch(/移除生成内容/);
  });

  it.each([
    [
      "card interpretation",
      (reading: StructuredReading) => ({
        ...reading,
        cards: reading.cards.map((card, index) => ({
          ...card,
          interpretation: index === 0 ? "你应该停药。" : card.interpretation,
        })),
      }),
    ],
    [
      "themes",
      (reading: StructuredReading) => ({
        ...reading,
        themes: ["你应该停药。", reading.themes[1] ?? "现实"],
      }),
    ],
    [
      "synthesis",
      (reading: StructuredReading) => ({
        ...reading,
        synthesis: "你应该停药。",
      }),
    ],
    [
      "guidance",
      (reading: StructuredReading) => ({
        ...reading,
        reflective_guidance: ["你应该停药。", reading.reflective_guidance[1] ?? "现实"],
      }),
    ],
    [
      "follow-up",
      (reading: StructuredReading) => ({
        ...reading,
        follow_up_questions: ["你应该停药。"],
      }),
    ],
    [
      "confidence note",
      (reading: StructuredReading) => ({
        ...reading,
        confidence_note: "你应该停药。",
      }),
    ],
  ] as const)("replaces severe violations found in %s", (_, mutate) => {
    const review = reviewReadingGeneratedContent(mutate(buildReading()));
    const visibleText = JSON.stringify(review.output);

    expect(review.action).toBe("replace");
    expect(visibleText).not.toContain("你应该停药");
    expect(review.output.cards[0]?.card_id).toBe("fool");
    expect(review.output.themes).toHaveLength(2);
    expect(review.output.reflective_guidance).toHaveLength(2);
    expect(review.output.follow_up_questions).toHaveLength(1);
    expect(review.output.safety_note).toMatch(/替换/);
  });

  it("replaces unsafe encyclopedia answers while preserving an explicit boundary", () => {
    const review = reviewEncyclopediaGeneratedAnswer({
      answer: "你应该先监控对方，然后报复他。",
      boundaryNote: null,
    });

    expect(review.action).toBe("replace");
    expect(review.output.answer).not.toContain("监控对方");
    expect(review.output.boundaryNote).toMatch(/不会提供/);
  });
});
