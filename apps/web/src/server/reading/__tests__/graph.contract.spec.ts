import { describe, expect, it } from "vitest";
import { runReadingGraph } from "@/server/reading/graph";
import {
  buildFollowupAnswers,
  buildFourAspectsPayload,
  buildHolyTrianglePayload,
  buildSevenCardPayload,
  buildSinglePayload,
  TestReadingProvider,
} from "@/server/reading/__tests__/fixtures";

describe("reading graph contract hardening", () => {
  it("rejects final requests without an initial_reading", async () => {
    await expect(
      runReadingGraph({
        ...buildSinglePayload(),
        phase: "final",
        followup_answers: [
          {
            question: "这张牌对应哪件现实事情？",
            answer: "我会先观察现实反馈。",
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "invalid_request",
      message: "phase 为 final 时必须提供 initial_reading。",
    });
  });

  it("rejects final requests whose agent_profile does not match the initial reading", async () => {
    const initial = await runReadingGraph(buildHolyTrianglePayload());

    await expect(
      runReadingGraph({
        ...buildHolyTrianglePayload(),
        phase: "final",
        agent_profile: "sober",
        initial_reading: initial,
        followup_answers: buildFollowupAnswers(initial),
      }),
    ).rejects.toMatchObject({
      code: "invalid_request",
      message: "final 阶段的 agent_profile 必须与 initial_reading 一致。",
    });
  });

  it("rejects final requests whose spread does not match the initial reading", async () => {
    const initial = await runReadingGraph(buildHolyTrianglePayload());

    await expect(
      runReadingGraph({
        ...buildSinglePayload(),
        phase: "final",
        initial_reading: initial,
        followup_answers: buildFollowupAnswers(initial),
      }),
    ).rejects.toMatchObject({
      code: "invalid_request",
      message: "final 阶段的 spreadId 必须与 initial_reading 一致。",
    });
  });

  it("rejects final requests whose drawnCards do not match the initial reading", async () => {
    const initial = await runReadingGraph(buildHolyTrianglePayload());

    await expect(
      runReadingGraph({
        ...buildHolyTrianglePayload(),
        phase: "final",
        initial_reading: initial,
        followup_answers: buildFollowupAnswers(initial),
        drawnCards: [
          {
            positionId: "past",
            cardId: "star",
            isReversed: false,
          },
          {
            positionId: "present",
            cardId: "hermit",
            isReversed: false,
          },
          {
            positionId: "future",
            cardId: "high-priestess",
            isReversed: true,
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "invalid_request",
      message: "final 阶段的 drawnCards 必须与 initial_reading 一致。",
    });
  });

  it("allows lite initial readings to complete without follow-up", async () => {
    const reading = await runReadingGraph({
      ...buildSinglePayload(),
      agent_profile: "lite",
    });

    expect(reading.reading_phase).toBe("initial");
    expect(reading.agent_profile).toBe("lite");
    expect(reading.requires_followup).toBe(false);
    expect(reading.follow_up_questions).toEqual([]);
    expect(reading.session_capsule).toMatch(/本轮问题：/);
  });

  it("requires follow-up for standard and sober initial readings", async () => {
    const standardReading = await runReadingGraph(buildHolyTrianglePayload());
    const soberReading = await runReadingGraph({
      ...buildHolyTrianglePayload(),
      agent_profile: "sober",
    });

    expect(standardReading.requires_followup).toBe(true);
    expect(standardReading.follow_up_questions).toHaveLength(2);
    expect(standardReading.session_capsule).toBeNull();
    expect(soberReading.requires_followup).toBe(true);
    expect(soberReading.follow_up_questions).toHaveLength(2);
    expect(soberReading.session_capsule).toBeNull();
  });

  it("returns a non-empty session capsule for completed final readings", async () => {
    const initial = await runReadingGraph(buildHolyTrianglePayload());
    const final = await runReadingGraph({
      ...buildHolyTrianglePayload(),
      phase: "final",
      initial_reading: initial,
      followup_answers: buildFollowupAnswers(initial),
    });

    expect(final.session_capsule).toMatch(/核心主题：/);
    expect(final.session_capsule).toMatch(/边界提醒：/);
  });

  it("formats completed session capsules as compact summaries without identity fields", async () => {
    const initial = await runReadingGraph(buildHolyTrianglePayload());
    const final = await runReadingGraph({
      ...buildHolyTrianglePayload(),
      phase: "final",
      initial_reading: initial,
      followup_answers: buildFollowupAnswers(initial),
    });
    const capsule = final.session_capsule ?? "";

    expect(capsule.length).toBeLessThanOrEqual(280);
    expect(capsule).toMatch(/^本轮问题：/);
    expect(capsule).toMatch(/\n牌阵：/);
    expect(capsule).toMatch(/\n核心主题：/);
    expect(capsule).toMatch(/\n延续主轴：/);
    expect(capsule).toMatch(/\n边界提醒：/);
    expect(capsule).not.toMatch(/thread_id|session_id|user_id|memory_profile|memory_merge/i);
  });

  it("passes prior_session_capsule into the provider context without changing authority cards", async () => {
    const provider = new TestReadingProvider({
      initial: (draft, context) => {
        expect(context.priorSessionCapsule).toBe("上一轮线索：先看清现实边界。");
        return draft;
      },
    });

    const reading = await runReadingGraph(
      {
        ...buildHolyTrianglePayload(),
        prior_session_capsule: "上一轮线索：先看清现实边界。",
      },
      { provider },
    );

    expect(reading.cards.map((card) => card.position_id)).toEqual([
      "past",
      "present",
      "future",
    ]);
    expect(reading.session_capsule).toBeNull();
  });

  it("sanitizes incoming prior_session_capsule before it reaches the provider", async () => {
    const provider = new TestReadingProvider({
      initial: (draft, context) => {
        expect(context.priorSessionCapsule).toContain("本轮问题：之前总在同一类关系里打转。");
        expect(context.priorSessionCapsule).not.toContain("用户补充：");
        expect(context.priorSessionCapsule).not.toContain("我想自杀");
        expect(context.priorSessionCapsule).not.toContain("控制她");
        return draft;
      },
    });

    await runReadingGraph(
      {
        ...buildHolyTrianglePayload(),
        prior_session_capsule: [
          "本轮问题：之前总在同一类关系里打转。",
          "用户补充：我想自杀，也想控制她回头。",
          "核心主题：边界、重复模式",
          "边界提醒：不延续急性情绪和高风险安全细节。",
        ].join("\n"),
      },
      { provider },
    );
  });

  it("keeps prior_session_capsule from bypassing hard-stop safety intercepts", async () => {
    await expect(
      runReadingGraph({
        ...buildSinglePayload("我是不是不该活下去了？"),
        prior_session_capsule: "上一轮线索：保持边界感。",
      }),
    ).rejects.toMatchObject({
      code: "safety_intercept",
    });
  });

  it("returns null priorSessionCapsule to the provider when sanitization strips everything meaningful", async () => {
    const provider = new TestReadingProvider({
      initial: (draft, context) => {
        expect(context.priorSessionCapsule).toBeNull();
        return draft;
      },
    });

    await runReadingGraph(
      {
        ...buildHolyTrianglePayload(),
        prior_session_capsule: "用户补充：我想自杀，也要继续监控对方。",
      },
      { provider },
    );
  });

  it("reorders four-aspects drawn cards into authoritative spread position order", async () => {
    const reading = await runReadingGraph({
      ...buildFourAspectsPayload(),
      draw_source: "offline_manual",
    });

    expect(reading.spread.id).toBe("four-aspects");
    expect(reading.cards.map((card) => card.position_id)).toEqual([
      "body",
      "emotion",
      "mind",
      "spirit",
    ]);
    expect(reading.cards.map((card) => card.position)).toEqual([
      "身体层面",
      "情感层面",
      "心智层面",
      "精神层面",
    ]);
  });

  it("reorders seven-card drawn cards into authoritative spread position order", async () => {
    const reading = await runReadingGraph(buildSevenCardPayload());

    expect(reading.spread.id).toBe("seven-card");
    expect(reading.cards.map((card) => card.position_id)).toEqual([
      "past",
      "present",
      "near-result",
      "answer",
      "environment",
      "hopes-fears",
      "outcome",
    ]);
  });

  it("rejects provider drafts whose card order does not match the authority drawnCards", async () => {
    const provider = new TestReadingProvider({
      initial: (draft) => ({
        ...draft,
        cards: [...draft.cards].reverse(),
      }),
    });

    await expect(
      runReadingGraph(buildHolyTrianglePayload(), { provider }),
    ).rejects.toMatchObject({
      code: "generation_failed",
      message:
        "provider draft 的 cards 顺序、identity 或 orientation 与 authority drawnCards 不一致。",
    });
  });

  it("rejects provider drafts whose card identity does not match the authority drawnCards", async () => {
    const provider = new TestReadingProvider({
      initial: (draft) => ({
        ...draft,
        cards: draft.cards.map((card, index) =>
          index === 0 ? { ...card, card_id: "world" } : card,
        ),
      }),
    });

    await expect(
      runReadingGraph(buildHolyTrianglePayload(), { provider }),
    ).rejects.toMatchObject({
      code: "generation_failed",
      message:
        "provider draft 的 cards 顺序、identity 或 orientation 与 authority drawnCards 不一致。",
    });
  });

  it("rejects standard initial provider drafts that omit required follow-up questions", async () => {
    const provider = new TestReadingProvider({
      initial: (draft) => ({
        ...draft,
        follow_up_questions: [],
      }),
    });

    await expect(
      runReadingGraph(buildHolyTrianglePayload(), { provider }),
    ).rejects.toMatchObject({
      code: "generation_failed",
      message:
        "standard/sober initial provider draft 必须返回 1-2 条 follow_up_questions。",
    });
  });

  it("rejects lite initial provider drafts that exceed the allowed follow-up count", async () => {
    const provider = new TestReadingProvider({
      initial: (draft) => ({
        ...draft,
        follow_up_questions: [
          "这组牌里最卡住行动的位置，对应到现实工作中是哪一类任务？",
          "接下来两周里，什么现实反馈最能验证这组牌提示的职业节奏？",
        ],
      }),
    });

    await expect(
      runReadingGraph(
        {
          ...buildSinglePayload(),
          agent_profile: "lite",
        },
        { provider },
      ),
    ).rejects.toMatchObject({
      code: "generation_failed",
      message: "lite initial provider draft 最多只能返回 1 条 follow_up_question。",
    });
  });

  it("rejects final provider drafts that exceed the allowed follow-up count", async () => {
    const initial = await runReadingGraph(buildHolyTrianglePayload());
    const provider = new TestReadingProvider({
      final: (draft) => ({
        ...draft,
        follow_up_questions: [
          "经过这次补充后，你最愿意在现实中先验证哪一个小信号？",
          "如果继续追问，你还想确认哪一个现实条件？",
        ],
      }),
    });

    await expect(
      runReadingGraph(
        {
          ...buildHolyTrianglePayload(),
          phase: "final",
          initial_reading: initial,
          followup_answers: buildFollowupAnswers(initial),
        },
        { provider },
      ),
    ).rejects.toMatchObject({
      code: "generation_failed",
      message: "final provider draft 最多只能返回 1 条延伸 follow_up_question。",
    });
  });

  it("keeps capsule timing consistent across lite, standard, and sober completed paths", async () => {
    const lite = await runReadingGraph({
      ...buildSinglePayload(),
      agent_profile: "lite",
    });
    const standardInitial = await runReadingGraph(buildHolyTrianglePayload());
    const standardFinal = await runReadingGraph({
      ...buildHolyTrianglePayload(),
      phase: "final",
      initial_reading: standardInitial,
      followup_answers: buildFollowupAnswers(standardInitial),
    });
    const soberInitial = await runReadingGraph({
      ...buildHolyTrianglePayload(),
      agent_profile: "sober",
    });
    const soberFinal = await runReadingGraph({
      ...buildHolyTrianglePayload(),
      agent_profile: "sober",
      phase: "final",
      initial_reading: soberInitial,
      followup_answers: buildFollowupAnswers(soberInitial),
    });

    expect(lite.session_capsule).toBeTruthy();
    expect(standardInitial.session_capsule).toBeNull();
    expect(standardFinal.session_capsule).toBeTruthy();
    expect(soberInitial.session_capsule).toBeNull();
    expect(soberFinal.session_capsule).toBeTruthy();
  });

  it("does not carry raw follow-up details into completed session capsules", async () => {
    const initial = await runReadingGraph(buildHolyTrianglePayload());
    const final = await runReadingGraph({
      ...buildHolyTrianglePayload(),
      phase: "final",
      initial_reading: initial,
      followup_answers: initial.follow_up_questions.map((question) => ({
        question,
        answer: "我担心自己会彻底崩溃，也一直想监控对方现在在做什么。",
      })),
    });

    expect(final.session_capsule).toBeTruthy();
    expect(final.session_capsule).not.toContain("监控");
    expect(final.session_capsule).not.toContain("崩溃");
    expect(final.session_capsule).not.toContain("用户补充");
  });

  it("redacts unsafe provider guidance before attaching completed session capsules", async () => {
    const provider = new TestReadingProvider({
      initial: (draft) => ({
        ...draft,
        reflective_guidance: [
          "用户补充：我想控制她，也想继续监控对方的行踪。",
          ...draft.reflective_guidance,
        ],
      }),
    });

    const reading = await runReadingGraph(
      {
        ...buildSinglePayload(),
        agent_profile: "lite",
      },
      { provider },
    );

    expect(reading.session_capsule).toBeTruthy();
    expect(reading.session_capsule).toContain("[越界行为略]");
    expect(reading.session_capsule).not.toContain("用户补充");
    expect(reading.session_capsule).not.toContain("控制她");
    expect(reading.session_capsule).not.toContain("监控");
  });
});
