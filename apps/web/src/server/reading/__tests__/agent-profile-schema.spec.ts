import { describe, expect, it } from "vitest";
import {
  apiAgentProfileSchema,
  readingRequestPayloadSchema,
  restoredAgentProfileSchema,
  restoredStructuredReadingSchema,
  structuredReadingSchema,
} from "@/server/reading/schemas";

function buildStructuredReading(agentProfile: unknown) {
  return {
    reading_id: "reading-1",
    locale: "zh-CN",
    question: "我现在需要看清什么？",
    question_type: "self_growth",
    agent_profile: agentProfile,
    reading_phase: "initial",
    requires_followup: true,
    initial_reading_id: null,
    followup_answers: null,
    spread: {
      id: "single",
      name: "单牌启示",
      englishName: "Single Card",
      description: "观察当前重点。",
      icon: "sparkles",
      positions: [{ id: "focus", name: "重点", description: "当前重点。" }],
    },
    cards: [{
      card_id: "star",
      name: "星星",
      english_name: "The Star",
      orientation: "upright",
      position_id: "focus",
      position: "重点",
      position_meaning: "当前重点。",
      interpretation: "先恢复自己的节奏。",
    }],
    themes: ["恢复节奏", "现实验证"],
    synthesis: "先回到可确认的现实信息。",
    reflective_guidance: ["记录事实。", "区分推测。"],
    follow_up_questions: ["你最想先确认什么？"],
    safety_note: null,
    confidence_note: "这是一种反思角度。",
    session_capsule: null,
  };
}

describe("agent profile schemas", () => {
  describe("apiAgentProfileSchema (strict)", () => {
    it.each([
      ["lite", "lite"],
      ["standard", "standard"],
      ["sober", "sober"],
      ["quick", "lite"],
      ["daily", "standard"],
      ["professional", "sober"],
      ["  QUICK  ", "lite"],
      [undefined, "standard"],
    ] as const)("accepts %j as %j", (input, expected) => {
      expect(apiAgentProfileSchema.parse(input)).toBe(expected);
    });

    it.each([
      "expert-v2",
      "unknown-reader",
      "",
      "   ",
    ])("rejects unknown string value %j with a clear field message", (input) => {
      expect(() => apiAgentProfileSchema.parse(input)).toThrow(/agent_profile/);
    });

    it.each([null, 123, {}, []])("rejects non-string value %j", (input) => {
      expect(() => apiAgentProfileSchema.parse(input)).toThrow();
    });
  });

  describe("restoredAgentProfileSchema (lenient)", () => {
    it.each([
      ["lite", "lite"],
      ["standard", "standard"],
      ["sober", "sober"],
      ["quick", "lite"],
      ["daily", "standard"],
      ["professional", "sober"],
      ["expert-v2", "standard"],
      ["", "standard"],
      [null, "standard"],
      [undefined, "standard"],
      [123, "standard"],
    ] as const)("restores %j to %j", (input, expected) => {
      expect(restoredAgentProfileSchema.parse(input)).toBe(expected);
    });
  });

  it("keeps current structured readings canonical while restoring stored aliases", () => {
    expect(structuredReadingSchema.safeParse(buildStructuredReading("professional")).success)
      .toBe(false);
    expect(
      restoredStructuredReadingSchema.parse(buildStructuredReading("professional")).agent_profile,
    ).toBe("sober");
    expect(
      restoredStructuredReadingSchema.parse(buildStructuredReading("expert-v2")).agent_profile,
    ).toBe("standard");
  });

  it.each(["professional", "expert-v2", undefined])(
    "rejects non-canonical nested final profile %j",
    (nestedProfile) => {
      const initialReading = buildStructuredReading(nestedProfile);

      expect(readingRequestPayloadSchema.safeParse({
        question: "我现在需要看清什么？",
        spreadId: "single",
        drawnCards: [{ positionId: "focus", cardId: "star", isReversed: false }],
        agent_profile: "standard",
        phase: "final",
        initial_reading: initialReading,
        followup_answers: [{ question: "你最想先确认什么？", answer: "现实反馈。" }],
      }).success).toBe(false);
    },
  );

  it("accepts a final snapshot after historical recovery canonicalizes it", () => {
    const restored = restoredStructuredReadingSchema.parse(
      buildStructuredReading("professional"),
    );

    expect(readingRequestPayloadSchema.safeParse({
      question: "我现在需要看清什么？",
      spreadId: "single",
      drawnCards: [{ positionId: "focus", cardId: "star", isReversed: false }],
      agent_profile: "sober",
      phase: "final",
      initial_reading: restored,
      followup_answers: [{ question: "你最想先确认什么？", answer: "现实反馈。" }],
    }).success).toBe(true);
  });
});
