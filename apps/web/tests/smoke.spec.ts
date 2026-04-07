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

async function drawCards(
  page: Parameters<typeof test>[0]["page"],
  count: number,
) {
  const deckButton = page
    .locator("button")
    .filter({ has: page.locator('img[alt="Tarot Back"]') })
    .first();

  for (let index = 0; index < count; index += 1) {
    await deckButton.click({ force: true });
  }
}

test.describe("AetherTarot smoke flow", () => {
  test("completes a reading and persists it into history", async ({ page }) => {
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

    await expect(page.getByText("启示之问")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("最终合成")).toBeVisible();

    await page.goto("/history");

    await expect(page.getByText("我该如何看待当前的职业选择？")).toBeVisible();

    await page.reload();

    await expect(page.getByText("我该如何看待当前的职业选择？")).toBeVisible();
  });

  test("reopens a saved reading from history", async ({ page }) => {
    await startReading(page, "接下来一周我应该把重点放在哪里？", /单牌启示/i);
    await expect(page).toHaveURL(/\/ritual$/);
    await drawCards(page, 1);
    await expect(page).toHaveURL(/\/reveal$/, { timeout: 8000 });

    await page.getByRole("button", { name: /开始深入解读/i }).click();
    await expect(page).toHaveURL(/\/reading$/);
    await expect(page.getByText("最终合成")).toBeVisible({ timeout: 10000 });

    await page.goto("/history");
    await page.getByRole("button", { name: /接下来一周我应该把重点放在哪里/i }).click();

    await expect(page).toHaveURL(/\/reading$/);
    await expect(
      page.getByText("“接下来一周我应该把重点放在哪里？”", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText("最终合成")).toBeVisible();
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
    await expect(page.getByText("最终合成")).toBeVisible({ timeout: 10000 });

    await page.goto("/history");
    await expect(
      page.getByText("我需要如何梳理接下来三个月的整体方向？"),
    ).toBeVisible();
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

  test("returns a validation error for an invalid mock reading request", async ({
    request,
  }) => {
    const response = await request.post("/api/reading", {
      data: {},
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: "缺少必要字段：question、spread、drawnCards。",
    });
  });

  test("rejects a reading request with an empty drawnCards list", async ({
    request,
  }) => {
    const response = await request.post("/api/reading", {
      data: {
        question: "我现在最该注意什么？",
        spread: {
          id: "single",
          name: "单牌启示",
          englishName: "Single Card",
          description: "test",
          icon: "filter_1",
          positions: [
            {
              id: "focus",
              name: "核心指引",
              description: "问题的核心能量。",
            },
          ],
        },
        drawnCards: [],
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: "drawnCards 至少需要包含一张牌。",
    });
  });

  test("rejects a reading request when positionId is outside the spread", async ({
    request,
  }) => {
    const response = await request.post("/api/reading", {
      data: {
        question: "这个选择会带来什么影响？",
        spread: {
          id: "single",
          name: "单牌启示",
          englishName: "Single Card",
          description: "test",
          icon: "filter_1",
          positions: [
            {
              id: "focus",
              name: "核心指引",
              description: "问题的核心能量。",
            },
          ],
        },
        drawnCards: [
          {
            positionId: "future",
            isReversed: false,
            card: {
              id: "star",
              name: "星星",
              englishName: "The Star",
              description: "desc",
              uprightKeywords: ["希望", "灵感"],
              reversedKeywords: ["失望", "悲观"],
            },
          },
        ],
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: "drawnCards 包含不属于当前牌阵的位置。",
    });
  });

  test("rejects a reading request when card payload is incomplete", async ({
    request,
  }) => {
    const response = await request.post("/api/reading", {
      data: {
        question: "我应该如何校准节奏？",
        spread: {
          id: "single",
          name: "单牌启示",
          englishName: "Single Card",
          description: "test",
          icon: "filter_1",
          positions: [
            {
              id: "focus",
              name: "核心指引",
              description: "问题的核心能量。",
            },
          ],
        },
        drawnCards: [
          {
            positionId: "focus",
            isReversed: false,
            card: {
              id: "star",
              name: "星星",
            },
          },
        ],
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: "drawnCards 中的 card 结构不完整。",
    });
  });
});
