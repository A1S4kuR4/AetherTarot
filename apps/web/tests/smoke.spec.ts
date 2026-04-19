import { expect, test } from "@playwright/test";

async function gotoAppRoute(
  page: Parameters<typeof test>[0]["page"],
  url: string,
) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);
}

function historyEntry(page: Parameters<typeof test>[0]["page"], question: string) {
  return page.locator("article").filter({ hasText: question }).first();
}

function journeyTimelineEntry(
  page: Parameters<typeof test>[0]["page"],
  question: string,
) {
  return page.locator("div").filter({ hasText: question }).filter({
    has: page.getByRole("button", { name: /回看解读/i }),
  }).first();
}

async function seedRecentCareerHistory(page: Parameters<typeof test>[0]["page"]) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "aether_tarot_history_v2",
      JSON.stringify([
        {
          id: "history-career-reading",
          createdAt: "2026-04-19T00:00:00.000Z",
          spreadId: "single",
          drawnCards: [],
          reading: {
            reading_id: "history-career-reading",
            locale: "zh-CN",
            question: "我的职业方向接下来该看清什么？",
            question_type: "career",
            agent_profile: "lite",
            reading_phase: "final",
            requires_followup: false,
            initial_reading_id: null,
            followup_answers: null,
            spread: {
              id: "single",
              name: "单牌启示",
              englishName: "Single Card",
              description: "针对当下的能量或简单的问题。",
              positions: [],
              icon: "filter_1",
            },
            cards: [],
            themes: ["职业方向", "现实节奏"],
            synthesis: "先看清职业方向里的现实节奏。",
            reflective_guidance: [],
            follow_up_questions: [],
            safety_note: null,
            confidence_note: null,
            session_capsule: null,
            sober_check: null,
            presentation_mode: "standard",
          },
        },
      ]),
    );
  });
}

async function holdToStart(
  page: Parameters<typeof test>[0]["page"],
  durationMs = 1600,
) {
  const startButton = page.getByRole("button", { name: /长按开始仪式/i });
  await expect(startButton).toBeVisible();
  await expect(startButton).toBeEnabled();
  await startButton.dispatchEvent("mousedown");
  await expect(
    page.getByRole("button", { name: /正在收束意图/i }),
  ).toBeVisible();
  await page.waitForTimeout(durationMs);
}

async function startReading(
  page: Parameters<typeof test>[0]["page"],
  question: string,
  spreadName: RegExp,
  profileName?: RegExp,
) {
  await gotoAppRoute(page, "/new");
  const input = page.getByPlaceholder("今天，你想向内心询问什么？");
  const spreadButton = page.getByRole("button", { name: spreadName });
  const startButton = page.getByRole("button", { name: /长按开始仪式/i });

  await expect(input).toBeEditable();

  if (profileName) {
    await expect(page.getByRole("button", { name: profileName })).toBeVisible();
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (profileName) {
      await page.getByRole("button", { name: profileName }).click();
    }

    await input.fill(question);
    await expect(input).toHaveValue(question);
    await spreadButton.click();

    try {
      await expect(startButton).toBeEnabled({ timeout: 2500 });
      break;
    } catch (error) {
      if (attempt === 4) {
        throw error;
      }

      await page.waitForTimeout(250);
    }
  }

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
  const revealButton = page.getByRole("button", { name: /揭示牌阵/i });
  await expect(revealButton).toBeVisible();

  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await revealButton.click();

    try {
      await expect(page).toHaveURL(/\/reveal$/, { timeout: 3000 });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(250);
    }
  }

  throw lastError;
}

async function enterReading(page: Parameters<typeof test>[0]["page"]) {
  const enterButton = page.getByRole("button", { name: /带着整组气候进入深读/i });
  await expect(enterButton).toBeVisible();

  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await enterButton.click();

    try {
      await expect(page).toHaveURL(/\/reading$/, { timeout: 10000 });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(250);
    }
  }

  throw lastError;
}

async function completeFollowup(
  page: Parameters<typeof test>[0]["page"],
  answer = "我会先对照现实情况观察，再做下一步决定。",
) {
  await expect(page.getByRole("heading", { name: "初步解读" })).toBeVisible({
    timeout: 10000,
  });
  const followupSection = page.locator("section").filter({
    has: page.getByRole("heading", { name: "回答后进入整合深读" }),
  }).first();
  await expect(followupSection).toBeVisible();

  const inputs = followupSection.getByRole("textbox");
  const count = await inputs.count();
  expect(count).toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    const value = `${answer} (${index + 1})`;
    const input = inputs.nth(index);
    await input.fill(value);
    await expect(input).toHaveValue(value);
  }

  const submitButton = followupSection.getByRole("button", { name: /生成整合深读/i });
  await expect(submitButton).toBeEnabled({ timeout: 10000 });
  await submitButton.focus();
  await expect(submitButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "解读结果" })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText(/第二阶段整合深读/)).toBeVisible();
}

test.describe("AetherTarot smoke flow", () => {
  test("completes a structured reading and persists it into history", async ({
    page,
  }) => {
    await gotoAppRoute(page, "/new");

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
    await expect(page.getByRole("heading", { name: "牌面线索" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "位置语义" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "综合推断" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "综合解读" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "反思指引" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "解读说明" })).toBeVisible();
    await completeFollowup(page);
    await gotoAppRoute(page, "/history");

    await expect(historyEntry(page, "我该如何看待当前的职业选择？")).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(historyEntry(page, "我该如何看待当前的职业选择？")).toBeVisible();
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

    await gotoAppRoute(page, "/history");
    await expect(historyEntry(page, "我现在最该注意什么？")).toBeVisible();
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
    await gotoAppRoute(page, "/history");
    await historyEntry(page, "接下来一周我应该把重点放在哪里？")
      .getByRole("button", { name: /回看这次解读/i })
      .click();

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
    await gotoAppRoute(page, "/journey");
    await expect(
      page.getByRole("heading", { name: /意识之流 \(The Journey\)/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /开启新的抽牌/i })).toBeVisible();

    await journeyTimelineEntry(page, "接下来一周我应该把重点放在哪里？")
      .getByRole("button", { name: /回看解读/i })
      .click();
    await expect(page).toHaveURL(/\/reading$/);
    await expect(
      page.getByText('"接下来一周我应该把重点放在哪里？"', {
        exact: true,
      }),
    ).toBeVisible();

    await gotoAppRoute(page, "/journey");
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
    await gotoAppRoute(page, "/history");
    await expect(
      historyEntry(page, "我需要如何梳理接下来三个月的整体方向？"),
    ).toBeVisible();
  });

  test("supports a full four-aspects reading flow", async ({ page }) => {
    await startReading(page, "我该如何理解眼前这次转向？", /四个面向/i);

    await expect(page).toHaveURL(/\/ritual$/);
    await drawCards(page, 4);
    await revealSpread(page);

    const positionMeanings = page.locator("h4").filter({
      hasText: /^位置 \d+:/,
    });

    await expect(positionMeanings).toHaveCount(4);
    await expect(
      page.getByRole("heading", { name: "位置 4: 精神层面" }),
    ).toBeVisible();

    await enterReading(page);
    await expect(page.getByRole("heading", { name: "逐牌展开" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("身体层面", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("精神层面", { exact: true }).first()).toBeVisible();
    await completeFollowup(page);
    await gotoAppRoute(page, "/history");
    await expect(
      historyEntry(page, "我该如何理解眼前这次转向？"),
    ).toBeVisible();
  });

  test("supports a full seven-card reading flow", async ({ page }) => {
    await startReading(page, "这段变化接下来会怎样展开？", /七张牌/i);

    await expect(page).toHaveURL(/\/ritual$/);
    await drawCards(page, 7);
    await revealSpread(page);

    const positionMeanings = page.locator("h4").filter({
      hasText: /^位置 \d+:/,
    });

    await expect(positionMeanings).toHaveCount(7);
    await expect(
      page.getByRole("heading", { name: "位置 4: 答案 / 当事人" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "位置 7: 结果" }),
    ).toBeVisible();

    await enterReading(page);
    await expect(page.getByRole("heading", { name: "逐牌展开" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("答案 / 当事人", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("周遭能量", { exact: true }).first()).toBeVisible();
    await completeFollowup(page);
    await gotoAppRoute(page, "/history");
    await expect(
      historyEntry(page, "这段变化接下来会怎样展开？"),
    ).toBeVisible();
  });

  test("lets the user continue a saved line without auto-filling the next question", async ({
    page,
  }) => {
    await startReading(page, "接下来一周我应该把重点放在哪里？", /单牌启示/i);
    await expect(page).toHaveURL(/\/ritual$/);
    await drawCards(page, 1);
    await revealSpread(page);

    await enterReading(page);
    await completeFollowup(page);
    await gotoAppRoute(page, "/history");

    const entry = historyEntry(page, "接下来一周我应该把重点放在哪里？");
    await entry.getByRole("button", { name: /延续这条线/i }).click();

    await expect(page).toHaveURL(/\/new$/);
    await expect(page.getByText(/延续中的线索/)).toBeVisible();
    await expect(page.getByText(/接下来一周我应该把重点放在哪里？/)).toBeVisible();
    await expect(page.getByPlaceholder("今天，你想向内心询问什么？")).toHaveValue("");

    await page.getByRole("button", { name: /清除这条延续线/i }).click();
    await expect(page.getByText(/延续中的线索/)).toBeHidden();
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
    await expect(page.getByText(/120/)).toBeVisible();
    await expect(page.getByText(/110/)).toBeVisible();
    await expect(page.getByText(/12356/)).toBeVisible();
    await expect(page.getByRole("button", { name: /离开并返回首页/i })).toBeVisible();
  });

  test("requires a nonblank sober-check reflection before revealing a major decision reading", async ({
    page,
  }) => {
    await startReading(page, "我应该离婚吗？", /单牌启示/i);
    await expect(page.getByRole("heading", { name: "重大现实决定前的校准" })).toBeVisible();
    const decisionContinueButton = page.getByRole("button", {
      name: /确认现实边界并继续/i,
    });
    await expect(decisionContinueButton).toBeDisabled();
    await page.getByLabel(/我确认这次阅读只用于整理线索/i).check();
    await expect(decisionContinueButton).toBeEnabled();
    await decisionContinueButton.click();
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
    await seedRecentCareerHistory(page);
    await gotoAppRoute(page, "/new");

    const startButton = page.getByRole("button", { name: /^长按开始仪式$/ });
    const input = page.getByPlaceholder("今天，你想向内心询问什么？");

    await expect(startButton).toBeDisabled();

    await input.fill("我的职业方向还有什么需要看清？");
    await expect(input).toHaveValue("我的职业方向还有什么需要看清？");
    await expect(page.getByText("重复主题提醒")).toBeVisible();
    await expect(
      page.getByText("上一次：我的职业方向接下来该看清什么？"),
    ).toBeVisible();
    await expect(startButton).toBeDisabled();

    await page.getByRole("button", { name: /圣三角/i }).click();
    await expect(startButton).toBeEnabled();

    await input.fill("   ");
    await expect(startButton).toBeDisabled();

    await input.clear();
    await expect(startButton).toBeDisabled();

    await input.fill("只输入问题");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(250);

    await expect(startButton).toBeDisabled();
    await startButton.click({ force: true });
    await expect(page).toHaveURL(/\/new$/);
  });

  test("redirects protected pages back to the start when state is missing", async ({
    page,
  }) => {
    await gotoAppRoute(page, "/reveal");
    await expect(page).toHaveURL(/\/$/);

    await gotoAppRoute(page, "/reading");
    await expect(page).toHaveURL(/\/$/);

    await gotoAppRoute(page, "/ritual");
    await expect(page).toHaveURL(/\/$/);
  });
});
