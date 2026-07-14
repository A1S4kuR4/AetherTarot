import { describe, expect, it } from "vitest";
import type { AgentProfile } from "@aethertarot/shared-types";
import { runReadingGraph } from "@/server/reading/graph";
import {
  buildHolyTrianglePayload,
  buildSinglePayload,
  hasAnchoredFollowupQuestion,
} from "@/server/reading/__tests__/fixtures";

/**
 * Mode-differentiation eval (section 8.5 of the reader-mode task).
 *
 * Same input is run through all three reader modes (快速 / 日常 / 专业, internal
 * ids lite / standard / sober) using the deterministic placeholder provider.
 * The assertions verify that the modes differ in *structure and analytical
 * posture* — not merely in length — while sharing the same safety boundary and
 * keeping the core judgment (themes) consistent.
 *
 * Differences are driven by `readerModeStrategies` in @aethertarot/prompting:
 * quick = conclusion-first + ≤2 insights + no clarification; daily = reality
 * mapping in natural language; deep = alternative interpretation +
 * fact/speculation/expectation separation.
 */
const MODES: AgentProfile[] = ["lite", "standard", "sober"];

function guidanceText(reading: { reflective_guidance: string[] }) {
  return reading.reflective_guidance.join("\n");
}

function allVisibleText(reading: {
  synthesis: string;
  reflective_guidance: string[];
  follow_up_questions: string[];
  safety_note: string | null;
}) {
  return [
    reading.synthesis,
    ...reading.reflective_guidance,
    ...reading.follow_up_questions,
    reading.safety_note ?? "",
  ].join("\n");
}

const EMPTY_COMFORT_PHRASES = ["相信自己", "顺其自然", "一切都会好起来", "听从内心"];
const THIRD_PARTY_MIND_READING_PHRASES = [
  "他真实想法",
  "她真实想法",
  "对方真实想法",
];
const PROFESSIONAL_ONLY_PHRASES = ["替代解释"];

function hasNoPhrases(text: string, phrases: string[]) {
  return phrases.every((phrase) => !text.includes(phrase));
}

describe("reader mode differentiation", () => {
  it("contrast 1 — single-card relationship: modes differ in structure, not just length", async () => {
    const base = buildSinglePayload("这段关系里我最需要看清什么？");
    const readings = await Promise.all(
      MODES.map((mode) => runReadingGraph({ ...base, agent_profile: mode })),
    );
    const [quick, daily, deep] = readings;

    // Quick: conclusion-first, at most two insights, no multi-round clarification.
    expect(quick.reflective_guidance.length).toBeLessThanOrEqual(2);
    expect(quick.follow_up_questions).toHaveLength(0);
    expect(guidanceText(quick)).toMatch(/核心提示/);

    // Daily & deep: fuller guidance, anchored follow-ups.
    expect(daily.reflective_guidance.length).toBeGreaterThan(
      quick.reflective_guidance.length,
    );
    expect(daily.follow_up_questions.length).toBeGreaterThanOrEqual(1);
    expect(deep.follow_up_questions.length).toBeGreaterThanOrEqual(1);

    // Deep carries an alternative interpretation; daily maps to reality.
    expect(guidanceText(deep)).toMatch(/替代解释/);
    expect(guidanceText(daily)).toMatch(/现实/);

    // Daily avoids empty comfort phrases and third-party mind-reading.
    expect(hasNoPhrases(allVisibleText(daily), EMPTY_COMFORT_PHRASES)).toBe(true);
    expect(hasNoPhrases(allVisibleText(daily), THIRD_PARTY_MIND_READING_PHRASES)).toBe(
      true,
    );

    // Quick should not borrow deep-only alternative-interpretation framing.
    expect(hasNoPhrases(allVisibleText(quick), PROFESSIONAL_ONLY_PHRASES)).toBe(true);

    // Daily & deep follow-ups are anchored to card/spread/reality cues, not generic fishing.
    expect(daily.follow_up_questions.every(hasAnchoredFollowupQuestion)).toBe(true);
    expect(deep.follow_up_questions.every(hasAnchoredFollowupQuestion)).toBe(true);

    // Core judgment stays consistent: themes derive from cards + question type, not mode.
    expect(quick.themes).toEqual(daily.themes);
    expect(daily.themes).toEqual(deep.themes);
  });

  it("contrast 2 — three-card career: daily maps to reality, deep separates fact/speculation", async () => {
    const base = buildHolyTrianglePayload("我该如何看待当前的职业选择？");
    const readings = await Promise.all(
      MODES.map((mode) => runReadingGraph({ ...base, agent_profile: mode })),
    );
    const [quick, daily, deep] = readings;

    // All modes keep the current question as the axis.
    for (const reading of readings) {
      expect(reading.synthesis).toMatch(/当前的职业选择/);
    }

    // Deep distinguishes fact / speculation / expectation.
    expect(
      deep.reflective_guidance.some((item) => /事实|推测|期待/.test(item)),
    ).toBe(true);

    // Quick stays the most compact; core judgment consistent across modes.
    expect(quick.reflective_guidance.length).toBeLessThanOrEqual(
      daily.reflective_guidance.length,
    );
    expect(daily.themes).toEqual(deep.themes);

    // Daily avoids empty comfort phrases even when guidance is fuller than quick.
    expect(hasNoPhrases(allVisibleText(daily), EMPTY_COMFORT_PHRASES)).toBe(true);
  });

  it("contrast 3 — financial presupposition: all modes share the same safety boundary", async () => {
    const base = buildSinglePayload("我该不该把全部积蓄投进这只股票？");
    const readings = await Promise.all(
      MODES.map((mode) => runReadingGraph({ ...base, agent_profile: mode })),
    );
    const [quick, , deep] = readings;

    // Safety review is question-driven, so every mode gets the financial boundary note.
    for (const reading of readings) {
      expect(reading.safety_note).toMatch(/财务|投资|风险/);
    }

    // Differentiation survives the safety override: deep keeps fact/speculation.
    expect(
      deep.reflective_guidance.some((item) => /事实|推测|期待/.test(item)),
    ).toBe(true);

    // Quick remains the most compact guidance set.
    expect(quick.reflective_guidance.length).toBeLessThanOrEqual(
      deep.reflective_guidance.length,
    );
  });
});
