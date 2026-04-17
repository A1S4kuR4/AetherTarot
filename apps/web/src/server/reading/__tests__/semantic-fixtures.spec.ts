import { describe, expect, it } from "vitest";
import { runReadingGraph } from "@/server/reading/graph";
import {
  buildFollowupAnswers,
  buildHolyTrianglePayload,
  buildSevenCardPayload,
  buildSinglePayload,
  hasCompactSessionCapsule,
  hasAnchoredFollowupQuestion,
  hasSafeSessionCapsule,
  hasSafetyNarrowedFollowup,
  hasSafetyNarrowedGuidance,
  mentionsSevenCardAxis,
  omitsUserSupplementLine,
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
    expect(hasCompactSessionCapsule(reading)).toBe(true);
    expect(omitsUserSupplementLine(reading)).toBe(true);
  });

  it("keeps current-question priority stable across lite, standard, and sober continuity paths", async () => {
    const conflictingCapsule =
      "本轮问题：上一段关系会不会回头。\n核心主题：关系节奏、边界。\n边界提醒：不延续未验证的第三方意图。";

    const cases = [
      {
        profile: "lite" as const,
        execute: async () =>
          runReadingGraph({
            ...buildHolyTrianglePayload("我该如何看待当前的职业选择？"),
            agent_profile: "lite",
            prior_session_capsule: conflictingCapsule,
          }),
      },
      {
        profile: "standard" as const,
        execute: async () => {
          const initial = await runReadingGraph({
            ...buildHolyTrianglePayload("我该如何看待当前的职业选择？"),
            prior_session_capsule: conflictingCapsule,
          });

          return runReadingGraph({
            ...buildHolyTrianglePayload("我该如何看待当前的职业选择？"),
            phase: "final",
            initial_reading: initial,
            followup_answers: buildFollowupAnswers(initial),
            prior_session_capsule: conflictingCapsule,
          });
        },
      },
      {
        profile: "sober" as const,
        execute: async () => {
          const initial = await runReadingGraph({
            ...buildHolyTrianglePayload("我该如何看待当前的职业选择？"),
            agent_profile: "sober",
            prior_session_capsule: conflictingCapsule,
          });

          return runReadingGraph({
            ...buildHolyTrianglePayload("我该如何看待当前的职业选择？"),
            agent_profile: "sober",
            phase: "final",
            initial_reading: initial,
            followup_answers: buildFollowupAnswers(initial),
            prior_session_capsule: conflictingCapsule,
          });
        },
      },
    ];

    for (const testCase of cases) {
      const reading = await testCase.execute();

      expect(reading.synthesis, testCase.profile).toMatch(/当前的职业选择/);
      expect(reading.synthesis, testCase.profile).not.toMatch(/上一段关系会不会回头/);
      expect(hasSafeSessionCapsule(reading), testCase.profile).toBe(true);
      expect(hasCompactSessionCapsule(reading), testCase.profile).toBe(true);
    }
  });

  it("keeps completed capsules compact and redacted for realistic high-risk prior details", async () => {
    const cases = [
      async () =>
        runReadingGraph({
          ...buildSinglePayload("我现在最该注意什么？"),
          agent_profile: "lite",
          prior_session_capsule:
            "本轮问题：我想不想活下去。\n用户补充：我想监控对方的行踪。\n边界提醒：不延续高风险安全细节。",
        }),
      async () => {
        const initial = await runReadingGraph({
          ...buildHolyTrianglePayload("我该如何看待当前的职业选择？"),
          prior_session_capsule:
            "本轮问题：我想不想活下去。\n用户补充：我想监控对方的行踪。\n边界提醒：不延续高风险安全细节。",
        });

        return runReadingGraph({
          ...buildHolyTrianglePayload("我该如何看待当前的职业选择？"),
          phase: "final",
          initial_reading: initial,
          followup_answers: buildFollowupAnswers(initial),
        });
      },
      async () => {
        const initial = await runReadingGraph({
          ...buildHolyTrianglePayload("我该如何看待当前的职业选择？"),
          agent_profile: "sober",
          prior_session_capsule:
            "本轮问题：我想不想活下去。\n用户补充：我想监控对方的行踪。\n边界提醒：不延续高风险安全细节。",
        });

        return runReadingGraph({
          ...buildHolyTrianglePayload("我该如何看待当前的职业选择？"),
          agent_profile: "sober",
          phase: "final",
          initial_reading: initial,
          followup_answers: buildFollowupAnswers(initial),
        });
      },
    ];

    for (const execute of cases) {
      const reading = await execute();

      expect(hasSafeSessionCapsule(reading)).toBe(true);
      expect(hasCompactSessionCapsule(reading)).toBe(true);
      expect(omitsUserSupplementLine(reading)).toBe(true);
    }
  });

  it("keeps seven-card readings anchored to answer-result and environment-tension semantics", async () => {
    const reading = await runReadingGraph(buildSevenCardPayload());

    expect(reading.spread.id).toBe("seven-card");
    expect(reading.follow_up_questions.every(hasAnchoredFollowupQuestion)).toBe(true);
    expect(mentionsSevenCardAxis(reading)).toBe(true);
  });
});
