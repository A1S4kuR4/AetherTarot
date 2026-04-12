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

test.describe("reading API contract smoke", () => {
  test("returns a validation error for invalid JSON", async ({ request }) => {
    const response = await request.fetch("/api/reading", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: Buffer.from("{"),
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "invalid_request",
        message: "请求体不是有效的 JSON。",
      },
    });
  });

  test("maps schema validation failures to invalid_request", async ({ request }) => {
    const response = await request.post("/api/reading", {
      data: {
        question: "",
        spreadId: "single",
        drawnCards: [],
      },
    });

    expect(response.status()).toBe(400);
    const body = (await response.json()) as ErrorBody;
    expect(body.error.code).toBe("invalid_request");
    expect(body.error.message).toBeTruthy();
  });

  test("returns a happy-path standard initial reading over HTTP", async ({
    request,
  }) => {
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
  });

  test("returns a happy-path final reading over HTTP", async ({ request }) => {
    const initial = await createInitialReading(request);
    const response = await request.post("/api/reading", {
      data: {
        ...buildHolyTrianglePayload(),
        phase: "final",
        initial_reading: initial,
        followup_answers: buildFollowupAnswers(initial),
      },
    });

    expect(response.status()).toBe(200);
    const final = (await response.json()) as ReadingBody;

    expect(final.reading_phase).toBe("final");
    expect(final.requires_followup).toBe(false);
    expect(final.initial_reading_id).toBe(initial.reading_id);
    expect(final.followup_answers).toHaveLength(initial.follow_up_questions.length);
  });

  test("returns a hard-stop payload for crisis prompts", async ({ request }) => {
    const response = await request.post("/api/reading", {
      data: buildSinglePayload("我是不是不该活下去了？"),
    });

    expect(response.status()).toBe(403);
    const body = (await response.json()) as ErrorBody;
    expect(body.error.code).toBe("safety_intercept");
    expect(body.error.intercept_reason).toMatch(/医疗或心理急救支持/);
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

  test("returns a safety_note for ordinary health prompts", async ({
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
});
