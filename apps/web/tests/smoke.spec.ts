import { expect, test } from "@playwright/test";

async function holdToStart(
  page: Parameters<typeof test>[0]["page"],
  durationMs = 1600,
) {
  const startButton = page.getByRole("button", { name: /长按开始仪式/i });
  await expect(startButton).toBeVisible();
  const startButtonHandle = await startButton.elementHandle();

  if (!startButtonHandle) {
    throw new Error("Unable to resolve the start button handle.");
  }

  await startButtonHandle.evaluate((element) => {
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });
  await expect(
    page.getByRole("button", { name: /正在收束意图/i }),
  ).toBeVisible();
  await page.waitForTimeout(durationMs);
  await startButtonHandle.evaluate((element) => {
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
}

async function startReading(
  page: Parameters<typeof test>[0]["page"],
  question: string,
  spreadName: RegExp,
  profileName?: RegExp,
) {
  await page.goto("/new");
  if (profileName) {
    await page.getByRole("button", { name: profileName }).click();
  }
  await page.getByPlaceholder("今天，你想向内心询问什么？").fill(question);
  await page.getByRole("button", { name: spreadName }).click();
  await holdToStart(page);
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

async function revealSpread(page: Parameters<typeof test>[0]["page"]) {
  await page.getByRole("button", { name: /揭示牌阵/i }).click();
  await expect(page).toHaveURL(/\/reveal$/, { timeout: 8000 });
}

async function enterReading(page: Parameters<typeof test>[0]["page"]) {
  await page.getByRole("button", { name: /带着整组气候进入深读/i }).click();
  await expect(page).toHaveURL(/\/reading$/);
}

async function completeFollowup(
  page: Parameters<typeof test>[0]["page"],
  answer = "我会先对照现实情况观察，再做下一步决定。",
) {
  await expect(page.getByRole("heading", { name: "初步解读" })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole("heading", { name: "回答后进入整合深读" })).toBeVisible();

  const inputs = page.getByPlaceholder("写下你的现实补充...");
  const count = await inputs.count();

  for (let index = 0; index < count; index += 1) {
    await inputs.nth(index).fill(`${answer} (${index + 1})`);
  }

  const submitButton = page.getByRole("button", { name: /生成整合深读/i });
  await expect(submitButton).toBeEnabled();
  await submitButton.click({ force: true });
  await expect(page.getByRole("heading", { name: "解读结果" })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText(/第二阶段整合深读/)).toBeVisible();
}

test.describe("AetherTarot smoke flow", () => {
  test("completes a structured reading and persists it into history", async ({
    page,
  }) => {
    await page.goto("/new");

    await expect(
      page.getByRole("heading", { name: /开启你的仪式/i }),
    ).toBeVisible();

    await startReading(page, "我该如何看待当前的职业选择？", /圣三角/i);

    await expect(page).toHaveURL(/\/ritual$/);
    await drawCards(page, 3);
    await revealSpread(page);

    await enterReading(page);

    await expect(page.getByRole("heading", { name: "核心主题聚焦" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("heading", { name: "综合解读" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "反思指引" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "解读说明" })).toBeVisible();
    await completeFollowup(page);
    await page.goto("/history");

    await expect(page.getByRole("button", { name: /我该如何看待当前的职业选择/ })).toBeVisible();

    await page.reload();

    await expect(page.getByRole("button", { name: /我该如何看待当前的职业选择/ })).toBeVisible();
  });

  test("completes a lite reading without a blocking follow-up", async ({ page }) => {
    await startReading(page, "我现在最该注意什么？", /单牌启示/i, /快速塔罗师/i);
    await expect(page).toHaveURL(/\/ritual$/);
    await drawCards(page, 1);
    await revealSpread(page);

    await enterReading(page);
    await expect(page.getByRole("heading", { name: "初步解读" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("heading", { name: "回答后进入整合深读" })).toBeHidden();

    await page.goto("/history");
    await expect(page.getByRole("button", { name: /我现在最该注意什么/ })).toBeVisible();
  });

  test("reopens a saved reading from history", async ({ page }) => {
    await startReading(page, "接下来一周我应该把重点放在哪里？", /单牌启示/i);
    await expect(page).toHaveURL(/\/ritual$/);
    await drawCards(page, 1);
    await revealSpread(page);

    await enterReading(page);
    await expect(page.getByRole("heading", { name: "综合解读" })).toBeVisible({
      timeout: 10000,
    });
    await completeFollowup(page);
    await page.goto("/history");
    await page.getByText(/接下来一周我应该把重点放在哪里/i).first().click();

    await expect(page).toHaveURL(/\/reading$/);
    await expect(
      page.getByText('"接下来一周我应该把重点放在哪里？"', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "综合解读" })).toBeVisible();
  });

  test("routes returning users to JourneyView and exposes the new-reading entry", async ({
    page,
  }) => {
    await startReading(page, "接下来一周我应该把重点放在哪里？", /单牌启示/i);
    await expect(page).toHaveURL(/\/ritual$/);
    await drawCards(page, 1);
    await revealSpread(page);

    await enterReading(page);
    await expect(page.getByRole("heading", { name: "综合解读" })).toBeVisible({
      timeout: 10000,
    });
    await completeFollowup(page);
    await page.goto("/journey");
    await expect(
      page.getByRole("heading", { name: /意识之流 \(The Journey\)/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /开启新的抽牌/i })).toBeVisible();

    await page.getByText(/接下来一周我应该把重点放在哪里/i).first().click();
    await expect(page).toHaveURL(/\/reading$/);
    await expect(
      page.getByText('"接下来一周我应该把重点放在哪里？"', {
        exact: true,
      }),
    ).toBeVisible();

    await page.goto("/journey");
    await page.getByRole("button", { name: /开启新的抽牌/i }).click();
    await expect(page).toHaveURL(/\/new$/);
    await expect(page.getByRole("heading", { name: /开启你的仪式/i })).toBeVisible();
  });

  test("supports a full celtic-cross reading flow", async ({ page }) => {
    await startReading(page, "我需要如何梳理接下来三个月的整体方向？", /赛尔特十字/i);

    await expect(page).toHaveURL(/\/ritual$/);
    await drawCards(page, 10);
    await revealSpread(page);

    const positionMeanings = page.locator("h4").filter({
      hasText: /^位置 \d+:/,
    });

    await expect(positionMeanings).toHaveCount(10);
    await expect(
      page.getByRole("heading", { name: "位置 10: 结果" }),
    ).toBeVisible();

    await enterReading(page);
    await expect(page.getByRole("heading", { name: "逐牌展开" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("heading", { name: "综合解读" })).toBeVisible();
    await completeFollowup(page);
    await page.goto("/history");
    await expect(
      page.getByRole("button", { name: /我需要如何梳理接下来三个月的整体方向/ }),
    ).toBeVisible();
  });

  test("shows a hard-stop intercept for crisis questions", async ({ page }) => {
    await startReading(page, "我是不是不该活下去了？", /单牌启示/i);
    await expect(page).toHaveURL(/\/ritual$/);
    await drawCards(page, 1);
    await revealSpread(page);

    await enterReading(page);
    await expect(page.getByRole("heading", { name: "界限阻断" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/立即寻求专业的医疗或心理急救支持/)).toBeVisible();
    await expect(page.getByRole("button", { name: /离开并返回首页/i })).toBeVisible();
  });

  test("requires a nonblank sober-check reflection before revealing a major decision reading", async ({
    page,
  }) => {
    await startReading(page, "我应该离婚吗？", /单牌启示/i);
    await expect(page.getByRole("heading", { name: "这是一次重大的决定" })).toBeVisible();
    await page.getByRole("button", { name: /我已知晓，仅作为内省的视角/i }).click();
    await expect(page).toHaveURL(/\/ritual$/);
    await drawCards(page, 1);
    await revealSpread(page);

    await enterReading(page);
    await expect(page.getByRole("heading", { name: /降温与检视/i })).toBeVisible({
      timeout: 10000,
    });

    const unlockButton = page.getByRole("button", { name: /确认并解开牌面/i });
    const reflectionInput = page.getByPlaceholder("我的真实顾虑 / 底线计划是...");

    await expect(page.getByRole("heading", { name: "综合解读" })).toBeHidden();
    await expect(unlockButton).toBeDisabled();

    await reflectionInput.fill("     ");
    await expect(unlockButton).toBeDisabled();

    await reflectionInput.fill("顾虑");
    await expect(unlockButton).toBeDisabled();

    await reflectionInput.fill("我需要先确认现实底线");
    await expect(unlockButton).toBeEnabled();
    await unlockButton.click();

    await expect(page.getByRole("heading", { name: "综合解读" })).toBeVisible();
  });

  test("keeps the start button disabled until question and spread are both valid", async ({
    page,
  }) => {
    await page.goto("/new");

    const startButton = page.getByRole("button", { name: /^长按开始仪式$/ });
    const input = page.getByPlaceholder("今天，你想向内心询问什么？");

    await expect(startButton).toBeDisabled();

    await input.fill("   ");
    await page.getByRole("button", { name: /圣三角/i }).click();
    await expect(startButton).toBeDisabled();

    await input.fill("我应该先处理什么？");
    await expect(startButton).toBeEnabled();

    await input.clear();
    await expect(startButton).toBeDisabled();

    await input.fill("只输入问题");
    await page.reload();

    await expect(startButton).toBeDisabled();
    await startButton.click({ force: true });
    await expect(page).toHaveURL(/\/new$/);
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
});
