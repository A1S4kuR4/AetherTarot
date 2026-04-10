import { expect, test } from "@playwright/test";

type ReadingPayload = {
  question: string;
  spreadId: string;
  drawnCards: Array<{
    positionId: string;
    cardId: string;
    isReversed: boolean;
  }>;
  agent_profile?: "lite" | "standard" | "sober";
  phase?: "initial" | "final";
  initial_reading?: ReadingBody;
  followup_answers?: Array<{ question: string; answer: string }>;
};

type ReadingBody = {
  reading_id: string;
  agent_profile: "lite" | "standard" | "sober";
  reading_phase: "initial" | "final";
  requires_followup: boolean;
  initial_reading_id: string | null;
  followup_answers: Array<{ question: string; answer: string }> | null;
  question_type: string;
  spread: { id: string };
  cards: Array<{ position_id: string; card_id: string; orientation: string }>;
  themes: string[];
  synthesis: string;
  reflective_guidance: string[];
  follow_up_questions: string[];
  safety_note: string | null;
  confidence_note: string | null;
  session_capsule: string | null;
  sober_check?: string | null;
  presentation_mode?: string;
};

type ErrorBody = {
  error: {
    code: string;
    message: string;
    intercept_reason?: string;
    referral_links?: string[];
  };
};

function buildSinglePayload(question = "我现在最该注意什么？"): ReadingPayload {
  return {
    question,
    spreadId: "single",
    drawnCards: [
      {
        positionId: "focus",
        cardId: "star",
        isReversed: false,
      },
    ],
  };
}

function buildHolyTrianglePayload(
  question = "我该如何看待当前的职业选择？",
): ReadingPayload {
  return {
    question,
    spreadId: "holy-triangle",
    drawnCards: [
      {
        positionId: "past",
        cardId: "high-priestess",
        isReversed: false,
      },
      {
        positionId: "present",
        cardId: "hermit",
        isReversed: false,
      },
      {
        positionId: "future",
        cardId: "star",
        isReversed: true,
      },
    ],
  };
}

function buildFollowupAnswers(initial: ReadingBody) {
  return initial.follow_up_questions.map((question) => ({
    question,
    answer: "我会先把事实和感受分开观察。",
  }));
}

async function createInitialReading(
  request: Parameters<typeof test>[0]["request"],
  payload: ReadingPayload = buildHolyTrianglePayload(),
) {
  const response = await request.post("/api/reading", { data: payload });
  expect(response.status()).toBe(200);
  return (await response.json()) as ReadingBody;
}

test.describe("reading API contract", () => {
  test("returns a validation error for invalid JSON", async ({ request }) => {
    const response = await request.fetch("/api/reading", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: Buffer.from("{"),
    });

    expect(response.status()).toBe(400);
    const body = (await response.json()) as ErrorBody;
    expect(body).toEqual({
      error: {
        code: "invalid_request",
        message: "请求体不是有效的 JSON。",
      },
    });
  });

  test("returns a validation error when required fields are missing", async ({
    request,
  }) => {
    const response = await request.post("/api/reading", {
      data: {},
    });

    expect(response.status()).toBe(400);
    const body = (await response.json()) as ErrorBody;
    expect(body.error.code).toBe("invalid_request");
  });

  test("rejects invalid card and spread payloads", async ({ request }) => {
    const cases: Array<{ payload: ReadingPayload; message: string }> = [
      {
        payload: { ...buildSinglePayload(), drawnCards: [] },
        message: "drawnCards 至少需要包含一张牌。",
      },
      {
        payload: { ...buildSinglePayload(), spreadId: "unknown-spread" },
        message: "spreadId 不存在于当前运行时牌阵中。",
      },
      {
        payload: {
          ...buildSinglePayload(),
          drawnCards: [
            {
              positionId: "focus",
              cardId: "unknown-card",
              isReversed: false,
            },
          ],
        },
        message: "drawnCards 包含未知的 cardId。",
      },
      {
        payload: {
          ...buildSinglePayload(),
          drawnCards: [
            {
              positionId: "future",
              cardId: "star",
              isReversed: false,
            },
          ],
        },
        message: "drawnCards 包含不属于当前牌阵的位置。",
      },
    ];

    for (const item of cases) {
      const response = await request.post("/api/reading", { data: item.payload });
      expect(response.status()).toBe(400);
      const body = (await response.json()) as ErrorBody;
      expect(body.error.message).toBe(item.message);
    }
  });

  test("rejects mismatched card count and duplicate runtime ids", async ({
    request,
  }) => {
    const cases: Array<{ payload: ReadingPayload; message: string }> = [
      {
        payload: {
          question: "这个选择会带来什么影响？",
          spreadId: "holy-triangle",
          drawnCards: [
            {
              positionId: "past",
              cardId: "high-priestess",
              isReversed: false,
            },
            {
              positionId: "present",
              cardId: "hermit",
              isReversed: false,
            },
          ],
        },
        message: "drawnCards 数量必须与当前牌阵位置数一致。",
      },
      {
        payload: {
          question: "我该如何看待当前的职业选择？",
          spreadId: "holy-triangle",
          drawnCards: [
            {
              positionId: "past",
              cardId: "high-priestess",
              isReversed: false,
            },
            {
              positionId: "past",
              cardId: "hermit",
              isReversed: false,
            },
            {
              positionId: "future",
              cardId: "star",
              isReversed: false,
            },
          ],
        },
        message: "drawnCards 不能包含重复的 positionId。",
      },
      {
        payload: {
          question: "我该如何看待当前的职业选择？",
          spreadId: "holy-triangle",
          drawnCards: [
            {
              positionId: "past",
              cardId: "star",
              isReversed: false,
            },
            {
              positionId: "present",
              cardId: "star",
              isReversed: false,
            },
            {
              positionId: "future",
              cardId: "hermit",
              isReversed: true,
            },
          ],
        },
        message: "drawnCards 不能包含重复的 cardId。",
      },
    ];

    for (const item of cases) {
      const response = await request.post("/api/reading", { data: item.payload });
      expect(response.status()).toBe(400);
      const body = (await response.json()) as ErrorBody;
      expect(body.error.message).toBe(item.message);
    }
  });

  test("returns standard initial metadata by default", async ({ request }) => {
    const response = await request.post("/api/reading", {
      data: buildHolyTrianglePayload(),
    });

    expect(response.status()).toBe(200);
    const body = (await response.json()) as ReadingBody;

    expect(body.agent_profile).toBe("standard");
    expect(body.reading_phase).toBe("initial");
    expect(body.requires_followup).toBe(true);
    expect(body.initial_reading_id).toBeNull();
    expect(body.followup_answers).toBeNull();
    expect(body.cards.map((card) => card.position_id)).toEqual([
      "past",
      "present",
      "future",
    ]);
    expect(body.themes.length).toBeGreaterThanOrEqual(2);
    expect(body.themes.length).toBeLessThanOrEqual(4);
    expect(body.reflective_guidance.length).toBeGreaterThanOrEqual(2);
    expect(body.follow_up_questions.length).toBeGreaterThanOrEqual(1);
    expect(body.follow_up_questions.length).toBeLessThanOrEqual(2);
    expect(body.session_capsule).toBeNull();
    expect(body.safety_note).toBeNull();
  });

  test("requires follow-up for sober initial readings", async ({ request }) => {
    const response = await request.post("/api/reading", {
      data: {
        ...buildHolyTrianglePayload(),
        agent_profile: "sober",
      },
    });

    expect(response.status()).toBe(200);
    const body = (await response.json()) as ReadingBody;
    expect(body.agent_profile).toBe("sober");
    expect(body.reading_phase).toBe("initial");
    expect(body.requires_followup).toBe(true);
    expect(body.follow_up_questions.length).toBeGreaterThanOrEqual(1);
  });

  test("allows lite initial readings to complete without follow-up", async ({
    request,
  }) => {
    const response = await request.post("/api/reading", {
      data: {
        ...buildSinglePayload(),
        agent_profile: "lite",
      },
    });

    expect(response.status()).toBe(200);
    const body = (await response.json()) as ReadingBody;
    expect(body.agent_profile).toBe("lite");
    expect(body.reading_phase).toBe("initial");
    expect(body.requires_followup).toBe(false);
    expect(body.follow_up_questions).toEqual([]);
  });

  test("rejects final requests without required phase inputs", async ({
    request,
  }) => {
    const withoutInitial = await request.post("/api/reading", {
      data: {
        ...buildSinglePayload(),
        phase: "final",
        followup_answers: [
          {
            question: "这张牌对应哪件现实事情？",
            answer: "我会先观察现实反馈。",
          },
        ],
      },
    });

    expect(withoutInitial.status()).toBe(400);
    const missingInitialBody = (await withoutInitial.json()) as ErrorBody;
    expect(missingInitialBody.error.message).toBe(
      "phase 为 final 时必须提供 initial_reading。",
    );

    const initial = await createInitialReading(request);
    const withoutAnswers = await request.post("/api/reading", {
      data: {
        ...buildHolyTrianglePayload(),
        phase: "final",
        initial_reading: initial,
      },
    });

    expect(withoutAnswers.status()).toBe(400);
    const missingAnswersBody = (await withoutAnswers.json()) as ErrorBody;
    expect(missingAnswersBody.error.message).toBe(
      "phase 为 final 时必须提供 followup_answers。",
    );
  });

  test("rejects final requests that do not match the initial reading", async ({
    request,
  }) => {
    const initial = await createInitialReading(request);
    const answers = buildFollowupAnswers(initial);

    const profileMismatch = await request.post("/api/reading", {
      data: {
        ...buildHolyTrianglePayload(),
        agent_profile: "sober",
        phase: "final",
        initial_reading: initial,
        followup_answers: answers,
      },
    });
    expect(profileMismatch.status()).toBe(400);
    expect(((await profileMismatch.json()) as ErrorBody).error.message).toBe(
      "final 阶段的 agent_profile 必须与 initial_reading 一致。",
    );

    const spreadMismatch = await request.post("/api/reading", {
      data: {
        ...buildSinglePayload(),
        phase: "final",
        initial_reading: initial,
        followup_answers: answers,
      },
    });
    expect(spreadMismatch.status()).toBe(400);
    expect(((await spreadMismatch.json()) as ErrorBody).error.message).toBe(
      "final 阶段的 spreadId 必须与 initial_reading 一致。",
    );

    const cardMismatch = await request.post("/api/reading", {
      data: {
        ...buildHolyTrianglePayload(),
        phase: "final",
        initial_reading: initial,
        followup_answers: answers,
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
      },
    });
    expect(cardMismatch.status()).toBe(400);
    expect(((await cardMismatch.json()) as ErrorBody).error.message).toBe(
      "final 阶段的 drawnCards 必须与 initial_reading 一致。",
    );
  });

  test("returns final reading metadata and preserves initial themes", async ({
    request,
  }) => {
    const initial = await createInitialReading(request);
    const finalResponse = await request.post("/api/reading", {
      data: {
        ...buildHolyTrianglePayload(),
        agent_profile: "standard",
        phase: "final",
        initial_reading: initial,
        followup_answers: buildFollowupAnswers(initial),
      },
    });

    expect(finalResponse.status()).toBe(200);
    const final = (await finalResponse.json()) as ReadingBody;
    expect(final.reading_phase).toBe("final");
    expect(final.requires_followup).toBe(false);
    expect(final.initial_reading_id).toBe(initial.reading_id);
    expect(final.followup_answers).toHaveLength(initial.follow_up_questions.length);
    expect(final.themes).toEqual(initial.themes);
    expect(final.synthesis).toMatch(/第二阶段/);
  });

  test("adds safety-note boundaries for ordinary health questions", async ({
    request,
  }) => {
    const response = await request.post("/api/reading", {
      data: buildSinglePayload("我最近总担心自己的健康状态，该怎么看？"),
    });

    expect(response.status()).toBe(200);
    const body = (await response.json()) as ReadingBody;
    expect(body.safety_note).toMatch(/不能替代医疗判断/);
    expect(body.reflective_guidance[0]).toMatch(/专业人士/);
  });

  test("returns hard-stop intercept payloads for crisis prompts", async ({
    request,
  }) => {
    const response = await request.post("/api/reading", {
      data: buildSinglePayload("我是不是不该活下去了？"),
    });

    expect(response.status()).toBe(403);
    const body = (await response.json()) as ErrorBody;

    expect(body.error.code).toBe("safety_intercept");
    expect(body.error.intercept_reason).toMatch(/医疗或心理急救支持/);
    expect(body.error.referral_links).toEqual(
      expect.arrayContaining([expect.stringMatching(/^https?:\/\//)]),
    );
  });

  test("returns sober-check metadata for major decision prompts", async ({
    request,
  }) => {
    const response = await request.post("/api/reading", {
      data: buildSinglePayload("我应该离婚吗？"),
    });

    expect(response.status()).toBe(200);
    const body = (await response.json()) as ReadingBody;

    expect(body.sober_check).toMatch(/最真实的顾虑或底线计划/);
    expect(body.presentation_mode).toBe("sober_anchor");
  });
});