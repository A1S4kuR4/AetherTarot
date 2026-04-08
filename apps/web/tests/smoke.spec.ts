import { expect, test } from "@playwright/test";

async function startReading(
  page: Parameters<typeof test>[0]["page"],
  question: string,
  spreadName: RegExp,
) {
  await page.goto("/");
  await page.getByPlaceholder("今天，你想向宇宙询问什么？").fill(question);
  await page.getByRole("button", { name: spreadName }).click();
  await page.getByRole("button", { name: /^启示$/ }).click();
}

async function getSelectedCount(
  page: Parameters<typeof test>[0]["page"],
  targetCount: number,
) {
  if (/\/reveal$/.test(page.url())) {
    return targetCount;
  }

  const text =
    (await page.getByText(/你已选择 \d+ \/ \d+ 张牌/).textContent()) ?? "";
  const match = text.match(/你已选择 (\d+) \/ (\d+) 张牌/);

  return Number(match?.[1] ?? 0);
}

async function drawCards(
  page: Parameters<typeof test>[0]["page"],
  count: number,
) {
  let attempts = 0;
  let currentCount = await getSelectedCount(page, count);
  const drawButton = page.getByRole("button", { name: /抽取一张牌/i });

  while (currentCount < count) {
    if (attempts > count * 6) {
      throw new Error(
        `Failed to finish drawing ${count} cards within the retry budget.`,
      );
    }

    if (await drawButton.isDisabled()) {
      await page.waitForTimeout(250);
      currentCount = await getSelectedCount(page, count);
      attempts += 1;
      continue;
    }

    await drawButton.click();
    await page.waitForTimeout(200);

    const nextCount = await getSelectedCount(page, count);
    attempts += 1;

    if (nextCount > currentCount) {
      currentCount = nextCount;
      continue;
    }

    await page.waitForTimeout(200);
    currentCount = await getSelectedCount(page, count);
  }
}

function buildSinglePayload(question = "我现在最该注意什么？") {
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

function buildHolyTrianglePayload(question = "我该如何看待当前的职业选择？") {
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

test.describe("AetherTarot smoke flow", () => {
  test("completes a structured reading and persists it into history", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /灵语塔罗/i }),
    ).toBeVisible();

    await startReading(page, "我该如何看待当前的职业选择？", /圣三角形/i);

    await expect(page).toHaveURL(/\/ritual$/);
    await drawCards(page, 3);

    await expect(page).toHaveURL(/\/reveal$/, { timeout: 8000 });

    await page.getByRole("button", { name: /开始深入解读/i }).click();
    await expect(page).toHaveURL(/\/reading$/);

    await expect(page.getByRole("heading", { name: "主题聚焦" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("heading", { name: "综合解读" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "反思指引" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "解读说明" })).toBeVisible();

    await page.goto("/history");

    await expect(page.getByRole("button", { name: /我该如何看待当前的职业选择/ })).toBeVisible();

    await page.reload();

    await expect(page.getByRole("button", { name: /我该如何看待当前的职业选择/ })).toBeVisible();
  });

  test("reopens a saved reading from history", async ({ page }) => {
    await startReading(page, "接下来一周我应该把重点放在哪里？", /单牌启示/i);
    await expect(page).toHaveURL(/\/ritual$/);
    await drawCards(page, 1);
    await expect(page).toHaveURL(/\/reveal$/, { timeout: 8000 });

    await page.getByRole("button", { name: /开始深入解读/i }).click();
    await expect(page).toHaveURL(/\/reading$/);
    await expect(page.getByRole("heading", { name: "综合解读" })).toBeVisible({
      timeout: 10000,
    });

    await page.goto("/history");
    await page.getByRole("button", { name: /接下来一周我应该把重点放在哪里/i }).click();

    await expect(page).toHaveURL(/\/reading$/);
    await expect(
      page.getByText("“接下来一周我应该把重点放在哪里？”", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "综合解读" })).toBeVisible();
  });

  test("supports a full celtic-cross reading flow", async ({ page }) => {
    await startReading(page, "我需要如何梳理接下来三个月的整体方向？", /赛尔特十字/i);

    await expect(page).toHaveURL(/\/ritual$/);
    await drawCards(page, 10);
    await expect(page).toHaveURL(/\/reveal$/, { timeout: 10000 });

    const positionMeanings = page.locator("h4").filter({
      hasText: /^Position \d+:/,
    });

    await expect(positionMeanings).toHaveCount(10);
    await expect(
      page.getByRole("heading", { name: "Position 10: 结果" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /开始深入解读/i }).click();
    await expect(page).toHaveURL(/\/reading$/);
    await expect(page.getByRole("heading", { name: "逐牌展开" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("heading", { name: "综合解读" })).toBeVisible();

    await page.goto("/history");
    await expect(
      page.getByRole("button", { name: /我需要如何梳理接下来三个月的整体方向/ }),
    ).toBeVisible();
  });

  test("shows a safety note for high-risk questions", async ({ page }) => {
    await startReading(page, "我是不是不该活下去了？", /单牌启示/i);
    await expect(page).toHaveURL(/\/ritual$/);
    await drawCards(page, 1);
    await expect(page).toHaveURL(/\/reveal$/, { timeout: 8000 });

    await page.getByRole("button", { name: /开始深入解读/i }).click();
    await expect(page).toHaveURL(/\/reading$/);
    await expect(page.getByRole("heading", { name: "边界提醒" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/先把安全放在第一位/)).toBeVisible();
  });

  test("keeps the start button disabled until question and spread are both valid", async ({
    page,
  }) => {
    await page.goto("/");

    const startButton = page.getByRole("button", { name: /^启示$/ });
    const input = page.getByPlaceholder("今天，你想向宇宙询问什么？");

    await expect(startButton).toBeDisabled();

    await input.fill("   ");
    await page.getByRole("button", { name: /圣三角形/i }).click();
    await expect(startButton).toBeDisabled();

    await input.fill("我应该先处理什么？");
    await expect(startButton).toBeEnabled();

    await input.clear();
    await expect(startButton).toBeDisabled();

    await input.fill("只输入问题");
    await page.reload();

    await expect(startButton).toBeDisabled();
    await startButton.click({ force: true });
    await expect(page).toHaveURL(/\/$/);
  });

  test("redirects protected pages back to the start when state is missing", async ({
    page,
  }) => {
    await page.goto("/reveal");
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/reading");
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/ritual");
    await expect(page).toHaveURL(/\/$/);
  });

  test("returns a validation error for invalid JSON", async ({ request }) => {
    const response = await request.fetch("/api/reading", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: Buffer.from("{"),
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
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
    const body = await response.json();
    expect(body.error.code).toBe("invalid_request");
  });

  test("rejects a reading request with an empty drawnCards list", async ({
    request,
  }) => {
    const response = await request.post("/api/reading", {
      data: {
        question: "我现在最该注意什么？",
        spreadId: "single",
        drawnCards: [],
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "invalid_request",
        message: "drawnCards 至少需要包含一张牌。",
      },
    });
  });

  test("rejects a reading request with an unknown spread id", async ({
    request,
  }) => {
    const response = await request.post("/api/reading", {
      data: {
        ...buildSinglePayload(),
        spreadId: "unknown-spread",
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "invalid_request",
        message: "spreadId 不存在于当前运行时牌阵中。",
      },
    });
  });

  test("rejects a reading request with an unknown card id", async ({ request }) => {
    const response = await request.post("/api/reading", {
      data: {
        ...buildSinglePayload(),
        drawnCards: [
          {
            positionId: "focus",
            cardId: "unknown-card",
            isReversed: false,
          },
        ],
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "invalid_request",
        message: "drawnCards 包含未知的 cardId。",
      },
    });
  });

  test("rejects a reading request with a mismatched card count", async ({
    request,
  }) => {
    const response = await request.post("/api/reading", {
      data: {
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
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "invalid_request",
        message: "drawnCards 数量必须与当前牌阵位置数一致。",
      },
    });
  });

  test("rejects a reading request when positionId is outside the spread", async ({
    request,
  }) => {
    const response = await request.post("/api/reading", {
      data: {
        ...buildSinglePayload(),
        drawnCards: [
          {
            positionId: "future",
            cardId: "star",
            isReversed: false,
          },
        ],
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "invalid_request",
        message: "drawnCards 包含不属于当前牌阵的位置。",
      },
    });
  });

  test("rejects a reading request with duplicate position ids", async ({
    request,
  }) => {
    const response = await request.post("/api/reading", {
      data: {
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
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "invalid_request",
        message: "drawnCards 不能包含重复的 positionId。",
      },
    });
  });

  test("rejects a reading request with duplicate card ids", async ({ request }) => {
    const response = await request.post("/api/reading", {
      data: {
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
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "invalid_request",
        message: "drawnCards 不能包含重复的 cardId。",
      },
    });
  });

  test("returns a structured reading payload for a valid request", async ({
    request,
  }) => {
    const response = await request.post("/api/reading", {
      data: buildHolyTrianglePayload(),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.question_type).toBeTruthy();
    expect(body.cards).toHaveLength(3);
    expect(body.themes.length).toBeGreaterThanOrEqual(2);
    expect(body.themes.length).toBeLessThanOrEqual(4);
    expect(body.synthesis).toBeTruthy();
    expect(body.reflective_guidance.length).toBeGreaterThanOrEqual(2);
    expect(body.confidence_note).toBeTruthy();
    expect(body.safety_note).toBeNull();
  });

  test("adds a safety note for high-risk prompts", async ({ request }) => {
    const response = await request.post("/api/reading", {
      data: buildSinglePayload("我是不是不该活下去了？"),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.safety_note).toMatch(/现实支持|第一位/);
    expect(body.follow_up_questions).toHaveLength(1);
  });
});

