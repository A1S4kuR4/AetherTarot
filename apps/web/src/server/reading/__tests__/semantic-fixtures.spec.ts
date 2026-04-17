import { describe, expect, it } from "vitest";
import { runReadingGraph } from "@/server/reading/graph";
import {
  buildFollowupAnswers,
  buildHolyTrianglePayload,
  buildSinglePayload,
  hasAnchoredFollowupQuestion,
  hasSafeSessionCapsule,
  hasSafetyNarrowedFollowup,
  hasSafetyNarrowedGuidance,
  preservesPrimaryTheme,
} from "@/server/reading/__tests__/fixtures";

describe("reading semantic fixtures", () => {
  it("keeps the primary initial theme in the final reading", async () => {
    const initial = await runReadingGraph(buildHolyTrianglePayload());
    const final = await runReadingGraph({
      ...buildHolyTrianglePayload(),
      phase: "final",
      initial_reading: initial,
      followup_answers: buildFollowupAnswers(initial),
    });

    expect(preservesPrimaryTheme(initial, final)).toBe(true);
    expect(final.synthesis).toMatch(/第二阶段/);
  });

  it("keeps standard follow-up questions anchored to card or spread cues", async () => {
    const reading = await runReadingGraph(buildHolyTrianglePayload());

    expect(reading.follow_up_questions.length).toBeGreaterThanOrEqual(1);
    expect(reading.follow_up_questions.every(hasAnchoredFollowupQuestion)).toBe(true);
  });

  it("narrows guidance and follow-up questions when a safety_note is added", async () => {
    const reading = await runReadingGraph(
      buildSinglePayload("我最近总担心自己的健康状态，该怎么看？"),
    );

    expect(reading.safety_note).toMatch(/不能替代医疗判断/);
    expect(hasSafetyNarrowedGuidance(reading)).toBe(true);
    expect(hasSafetyNarrowedFollowup(reading)).toBe(true);
  });

  it("treats prior capsules as supplemental context instead of overriding the current question", async () => {
    const reading = await runReadingGraph({
      ...buildHolyTrianglePayload("我该如何看待当前的职业选择？"),
      prior_session_capsule:
        "本轮问题：上一段关系会不会回头。核心主题：关系节奏、边界。边界提醒：不延续未验证的第三方意图。",
    });

    expect(reading.synthesis).toMatch(/当前的职业选择/);
    expect(reading.synthesis).not.toMatch(/上一段关系会不会回头/);
  });

  it("keeps completed session capsules compact and free of unsafe detail spillover", async () => {
    const reading = await runReadingGraph({
      ...buildSinglePayload(),
      agent_profile: "lite",
    });

    expect(reading.session_capsule).toBeTruthy();
    expect(reading.session_capsule).toMatch(/边界提醒：/);
    expect(hasSafeSessionCapsule(reading)).toBe(true);
  });
});
