import { describe, expect, it } from "vitest";
import { runReadingGraph } from "@/server/reading/graph";
import {
  buildFollowupAnswers,
  buildHolyTrianglePayload,
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
  });

  it("requires follow-up for standard and sober initial readings", async () => {
    const standardReading = await runReadingGraph(buildHolyTrianglePayload());
    const soberReading = await runReadingGraph({
      ...buildHolyTrianglePayload(),
      agent_profile: "sober",
    });

    expect(standardReading.requires_followup).toBe(true);
    expect(standardReading.follow_up_questions).toHaveLength(2);
    expect(soberReading.requires_followup).toBe(true);
    expect(soberReading.follow_up_questions).toHaveLength(2);
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
});
