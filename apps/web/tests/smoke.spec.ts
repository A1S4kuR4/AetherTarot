import { expect, test, type Locator } from "@playwright/test";

async function waitForReadingHydration(
  page: Parameters<typeof test>[0]["page"],
) {
  await page.waitForFunction(
    () =>
      (window as Window & { __AETHERTAROT_READING_HYDRATED__?: boolean })
        .__AETHERTAROT_READING_HYDRATED__ === true,
    undefined,
    { timeout: 15000 },
  );
}

async function gotoAppRoute(
  page: Parameters<typeof test>[0]["page"],
  url: string,
) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto(url, { waitUntil: "domcontentloaded" });

    try {
      await waitForReadingHydration(page);
      await page.waitForTimeout(250);
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(500);
    }
  }

  throw lastError;
}

function historyEntry(page: Parameters<typeof test>[0]["page"], question: string) {
  return page.locator("article").filter({ hasText: question }).first();
}

async function waitForPersistedHistoryEntry(
  page: Parameters<typeof test>[0]["page"],
  question: string,
) {
  await page.waitForFunction(
    (expectedQuestion) => {
      const rawHistory =
        window.localStorage.getItem("aether_tarot_history_v3")
        ?? window.localStorage.getItem("aether_tarot_history_v2");

      if (!rawHistory) {
        return false;
      }

      try {
        const history = JSON.parse(rawHistory) as Array<{
          reading?: { question?: string };
        }>;

        return history.some(
          (entry) => entry.reading?.question === expectedQuestion,
        );
      } catch {
        return false;
      }
    },
    question,
    { timeout: 10000 },
  );
}

function journeyTimelineEntry(
  page: Parameters<typeof test>[0]["page"],
  question: string,
) {
  return page.locator("div").filter({ hasText: question }).filter({
    has: page.getByRole("button", { name: /回看解读/i }),
  }).first();
}

test.beforeEach(async ({ page }) => {
  await page.route(
    /https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
    (route) => route.abort(),
  );
});

async function expectTrustPath(page: Parameters<typeof test>[0]["page"]) {
  await expect(page.getByRole("heading", { name: "这不是神谕，是可检查的解释路径" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "你说了什么" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "牌本身说了什么" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "如何连接二者" })).toBeVisible();
  await expect(page.getByText(/证据路径/).first()).toBeVisible();
  await expect(page.getByText(/逐牌顺序来自权威位置/).first()).toBeVisible();
}

async function fillTextarea(
  input: Locator,
  value: string,
) {
  await input.click();
  await input.fill("");
  await input.pressSequentially(value);
  await expect(input).toHaveValue(value);
}

async function expectDocumentFitsViewport(
  page: Parameters<typeof test>[0]["page"],
  tolerance = 2,
) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const pageHeight = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
          );

          return pageHeight - window.innerHeight;
        }),
      { timeout: 3000 },
    )
    .toBeLessThanOrEqual(tolerance);
}

async function expectRitualInitializerControlsInViewport(
  page: Parameters<typeof test>[0]["page"],
) {
  const controls = [
    page.getByPlaceholder("今天，你想向内心询问什么？"),
    page.getByRole("button", { name: /快速塔罗师/i }),
    page.getByRole("button", { name: /标准塔罗师/i }),
    page.getByRole("button", { name: /清醒塔罗师/i }),
    page.getByRole("button", { name: /单牌启示/i }),
    page.getByRole("button", { name: /圣三角/i }),
    page.getByRole("button", { name: /四个面向/i }),
    page.getByRole("button", { name: /七张牌/i }),
    page.getByRole("button", { name: /赛尔特十字/i }),
    page.getByRole("button", { name: /线上抽牌/i }),
    page.getByRole("button", { name: /线下录入/i }),
    page.getByRole("button", { name: /^长按开始仪式$/ }),
    page.getByRole("button", { name: "快速解读" }),
  ];

  for (const control of controls) {
    await expect(control).toBeVisible();
    await expect(control).toBeInViewport();
  }
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
  durationMs = 2200,
) {
  const startButton = page.getByRole("button", { name: /长按开始仪式/i });
  await expect(startButton).toBeVisible();
  await expect(startButton).toBeEnabled();

  let completed = false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (/\/(ritual|offline-draw)$/i.test(page.url())) {
      return;
    }

    try {
      await startButton.dispatchEvent("mousedown", undefined, { timeout: 3000 });
      await expect(
        page.getByRole("button", { name: /正在收束意图/i }),
      ).toBeVisible({ timeout: 3000 });
    } catch (error) {
      if (/\/(ritual|offline-draw)$/i.test(page.url())) {
        return;
      }

      throw error;
    }

    await page.waitForTimeout(durationMs);

    if (/\/(ritual|offline-draw)$/i.test(page.url())) {
      return;
    }

    completed = await Promise.race([
      page.waitForURL(/\/(ritual|offline-draw)$/i, { timeout: 1000 })
        .then(() => true)
        .catch(() => false),
      page
        .getByRole("heading", { name: "重大现实决定前的校准" })
        .waitFor({ state: "visible", timeout: 1000 })
        .then(() => true)
        .catch(() => false),
    ]);

    if (completed) {
      return;
    }

    if (/\/(ritual|offline-draw)$/i.test(page.url())) {
      return;
    }

    await page.mouse.up();
    await page.waitForTimeout(250);
  }

  throw new Error("Long-press start did not finish the ritual transition.");
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
    await expect(
      page
        .getByText(/问题已经具备开放性|现实决策重量|可以再具体一点/)
        .first(),
    ).toBeVisible({ timeout: 5000 });
    await spreadButton.click();
    await expect(page.getByText(/会用 \d+ 个位置来组织这次随机/)).toBeVisible({
      timeout: 5000,
    });

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
    if (/\/reveal$/i.test(page.url())) {
      return;
    }

    await revealButton.evaluate((button) => {
      (button as HTMLButtonElement).click();
    });

    try {
      await expect(page).toHaveURL(/\/reveal$/, { timeout: 5000 });
      await expect(page.getByRole("heading", { name: "本轮观察重点" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "牌阵如何组织随机" })).toBeVisible();
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
    const input = followupSection.getByRole("textbox", {
      name: new RegExp(`^${index + 1}\\.`),
    });
    await fillTextarea(input, value);
  }

  const submitButton = followupSection.getByRole("button", { name: /生成整合深读/i });
  await expect(submitButton).toBeEnabled({ timeout: 10000 });
  await submitButton.evaluate((button) => {
    (button as HTMLButtonElement).click();
  });
  await expect(page.getByRole("heading", { name: "解读结果" })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText(/第二阶段整合深读/).first()).toBeVisible();
}

test.describe("AetherTarot smoke flow", () => {
  test("completes a structured reading and persists it into history", async ({
    page,
  }) => {
    await startReading(page, "我该如何看待当前的职业选择？", /圣三角/i);

    await expect(page).toHaveURL(/\/ritual$/);
    await drawCards(page, 3);
    await revealSpread(page);
    await expect(page.getByRole("heading", { name: "牌阵如何组织随机" })).toBeVisible();

    await enterReading(page);

    await expect(page.getByText("核心速读")).toBeVisible({
      timeout: 10000,
    });
    await expectTrustPath(page);
    await expect(page.getByRole("heading", { name: "牌面线索" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "位置语义" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "综合推断" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "综合解读" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "反思指引" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "解读说明" })).toBeVisible();
    await completeFollowup(page);
    await waitForPersistedHistoryEntry(page, "我该如何看待当前的职业选择？");
    await gotoAppRoute(page, "/history");

    await expect(historyEntry(page, "我该如何看待当前的职业选择？")).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForReadingHydration(page);
    await page.waitForTimeout(250);

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
    await expectTrustPath(page);
    await expect(page.getByRole("heading", { name: "回答后进入整合深读" })).toBeHidden();

    await waitForPersistedHistoryEntry(page, "我现在最该注意什么？");
    await gotoAppRoute(page, "/history");
    await expect(historyEntry(page, "我现在最该注意什么？")).toBeVisible();
  });

  test("starts a quick reading without a selected spread and defaults to single-card lite", async ({
    page,
  }) => {
    await gotoAppRoute(page, "/new");

    const input = page.getByPlaceholder("今天，你想向内心询问什么？");
    await input.fill("我现在最该注意什么？");
    await page.getByRole("button", { name: "快速解读" }).click();

    await expect(page).toHaveURL(/\/reading$/, { timeout: 10000 });
    await expect(page.getByText("核心速读")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: "单牌启示" })).toBeVisible();
    await expectTrustPath(page);
    await expect(page.getByRole("heading", { name: "回答后进入整合深读" })).toBeHidden();

    await waitForPersistedHistoryEntry(page, "我现在最该注意什么？");
    await gotoAppRoute(page, "/history");
    await expect(historyEntry(page, "我现在最该注意什么？")).toBeVisible();
  });

  test("quick reading respects the selected spread", async ({ page }) => {
    await gotoAppRoute(page, "/new");

    await page
      .getByPlaceholder("今天，你想向内心询问什么？")
      .fill("我该如何看待当前的职业选择？");
    await page.getByRole("button", { name: /圣三角/i }).click();
    await page.getByRole("button", { name: "快速解读" }).click();

    await expect(page).toHaveURL(/\/reading$/, { timeout: 10000 });
    await expect(page.getByText("核心速读")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/圣三角/).first()).toBeVisible();
    await expect(page.getByText(/过去/).first()).toBeVisible();
    await expect(page.getByText(/现在/).first()).toBeVisible();
    await expect(page.getByText(/未来|潜在/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "回答后进入整合深读" })).toBeHidden();
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
    await waitForPersistedHistoryEntry(page, "接下来一周我应该把重点放在哪里？");
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
    await waitForPersistedHistoryEntry(page, "接下来一周我应该把重点放在哪里？");
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
    await expectTrustPath(page);
    await expect(page.getByRole("heading", { name: "综合解读" })).toBeVisible();
    await completeFollowup(page);
    await waitForPersistedHistoryEntry(page, "我需要如何梳理接下来三个月的整体方向？");
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
    await expectTrustPath(page);
    await expect(page.getByText("身体层面", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("精神层面", { exact: true }).first()).toBeVisible();
    await completeFollowup(page);
    await waitForPersistedHistoryEntry(page, "我该如何理解眼前这次转向？");
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
    await expectTrustPath(page);
    await expect(page.getByText("答案 / 当事人", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("周遭能量", { exact: true }).first()).toBeVisible();
    await completeFollowup(page);
    await waitForPersistedHistoryEntry(page, "这段变化接下来会怎样展开？");
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
    await waitForPersistedHistoryEntry(page, "接下来一周我应该把重点放在哪里？");
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

  test("shows runtime and knowledge coverage with all four minor suits in encyclopedia", async ({
    page,
  }) => {
    await page.route("**/api/encyclopedia/query", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          answer: "愚者的逆位常提醒自由感需要先回到现实边界。",
          sources: [
            {
              title: "愚者 (The Fool)",
              path: "knowledge/wiki/major-arcana/the-fool.md",
              type: "card",
              source_ids: ["78W"],
              excerpt: "逆位时，愚者的力量常从自由的跃出转成失衡的失足。",
            },
          ],
          related_cards: ["愚者 (The Fool)"],
          related_concepts: [],
          related_spreads: [],
          boundary_note: null,
        }),
      });
    });

    await gotoAppRoute(page, "/encyclopedia");

    await expect(page.getByRole("heading", { name: "塔罗百科" })).toBeVisible();
    await expect(page.getByText("78 / 78").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /权杖 \(14\)/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /圣杯 \(14\)/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /宝剑 \(14\)/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /星币 \(14\)/ })).toBeVisible();

    const runtimeCardGrid = page.getByTestId("runtime-card-grid");

    await page.getByRole("button", { name: /宝剑 \(14\)/ }).click();
    await expect(runtimeCardGrid.getByRole("button")).toHaveCount(14);
    await expect(
      runtimeCardGrid.getByRole("button", { name: "宝剑王牌" }),
    ).toBeVisible();
    await expect(
      runtimeCardGrid.getByRole("button", { name: "愚者" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: /星币 \(14\)/ }).click();
    await expect(runtimeCardGrid.getByRole("button")).toHaveCount(14);
    await expect(
      runtimeCardGrid.getByRole("button", { name: "星币王牌" }),
    ).toBeVisible();
    await expect(
      runtimeCardGrid.getByRole("button", { name: "宝剑王牌" }),
    ).toHaveCount(0);

    await expect(page.getByTestId("encyclopedia-agent-panel")).toBeVisible();
    await page.getByLabel("向塔罗百科提问").fill("这张牌逆位怎么理解？");
    await page.getByRole("button", { name: "提问" }).click();
    await expect(page.getByTestId("encyclopedia-agent-answer")).toBeVisible();
    await expect(page.getByText(/愚者的逆位/)).toBeVisible();
    await expect(page.getByText(/knowledge\/wiki\/major-arcana\/the-fool\.md/)).toBeVisible();
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

  test("quick reading still requires decision boundary confirmation and sober-check", async ({
    page,
  }) => {
    await gotoAppRoute(page, "/new");

    await page.getByPlaceholder("今天，你想向内心询问什么？").fill("我应该离婚吗？");
    await page.getByRole("button", { name: "快速解读" }).click();

    await expect(page.getByRole("heading", { name: "重大现实决定前的校准" })).toBeVisible();
    const decisionContinueButton = page.getByRole("button", {
      name: /确认现实边界并继续/i,
    });
    await expect(decisionContinueButton).toBeDisabled();
    await page.getByLabel(/我确认这次阅读只用于整理线索/i).check();
    await expect(decisionContinueButton).toBeEnabled();
    await decisionContinueButton.click();

    await expect(page).toHaveURL(/\/reading$/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: /降温与检视/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("heading", { name: "综合解读" })).toBeHidden();
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
    await waitForReadingHydration(page);
    await page.waitForTimeout(250);

    await expect(startButton).toBeDisabled();
    await startButton.click({ force: true });
    await expect(page).toHaveURL(/\/new$/);
  });

  test("keeps the home narrative inside one viewport and jumps section by section", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await gotoAppRoute(page, "/");

    const snapContainer = page.getByTestId("home-snap-container");
    await expectDocumentFitsViewport(page);
    await expect(page.getByRole("heading", { name: "万物皆有回声" })).toBeInViewport();

    await snapContainer.hover();
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(800);
    await expect(page.getByRole("heading", { name: /象征：灵魂的 78 个切面/ })).toBeInViewport();

    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(800);
    await expect(page.getByRole("heading", { name: /如何发问/ })).toBeInViewport();

    await page.getByRole("button", { name: "跳转到第 4 节" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByRole("heading", { name: "通往深处" })).toBeInViewport();
    await expectDocumentFitsViewport(page);
  });

  test("keeps the ritual initializer visible without body scrolling on desktop", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
    ]) {
      await page.setViewportSize(viewport);
      await gotoAppRoute(page, "/new");
      await expectDocumentFitsViewport(page);
      await expectRitualInitializerControlsInViewport(page);
    }

    const input = page.getByPlaceholder("今天，你想向内心询问什么？");
    const startButton = page.getByRole("button", { name: /^长按开始仪式$/ });

    await expect(input).toBeEditable();
    await expect(startButton).toBeDisabled();
    await input.fill("我现在最需要看清什么？");
    await page.getByRole("button", { name: /单牌启示/i }).click();
    await expect(startButton).toBeEnabled();
    await expect(page.getByText(/单牌启示 会用 \d+ 个位置来组织这次随机/)).toBeVisible();
    await expectDocumentFitsViewport(page);
  });

  test("keeps the mobile ritual CTA reachable after choosing a spread", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAppRoute(page, "/new");

    const input = page.getByPlaceholder("今天，你想向内心询问什么？");
    const startButton = page.getByRole("button", { name: /^长按开始仪式$/ });
    const quickButton = page.getByRole("button", { name: "快速解读" });

    await expect(startButton).toBeVisible();
    await expect(startButton).toBeDisabled();
    await expect(startButton).toBeInViewport();
    await expect(quickButton).toBeVisible();
    await expect(quickButton).toBeDisabled();
    await expect(quickButton).toBeInViewport();

    await input.fill("我现在最需要看清什么？");
    await page.getByRole("button", { name: /圣三角/i }).click();

    await expect(startButton).toBeEnabled();
    await expect(startButton).toBeInViewport();
    await expect(quickButton).toBeEnabled();
    await expect(quickButton).toBeInViewport();
  });

  test("keeps the ritual draw stage inside the desktop viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await startReading(page, "我现在最需要看清什么？", /单牌启示/i);

    await expect(page).toHaveURL(/\/ritual$/);
    await expectDocumentFitsViewport(page);
    await expect(page.getByRole("heading", { name: "仪式" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "洗牌" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "抽取一张牌" })).toBeInViewport();
    await expect(page.locator(".deck-card").first()).toBeInViewport();
    await expect(page.getByText(/你已选择 0 \/ 1 张牌/)).toBeInViewport();
  });

  test("keeps encyclopedia browsing in a desktop workspace and resets detail scroll on card change", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await gotoAppRoute(page, "/encyclopedia");

    const runtimeCardGrid = page.getByTestId("runtime-card-grid");
    const detailPanel = page.getByTestId("encyclopedia-card-detail");

    await expectDocumentFitsViewport(page);
    await expect(page.getByLabel("搜索卡牌")).toBeVisible();
    await expect(page.getByRole("button", { name: /宝剑 \(14\)/ })).toBeVisible();
    await expect(runtimeCardGrid).toBeVisible();

    await page.getByRole("button", { name: /宝剑 \(14\)/ }).click();
    await expect(runtimeCardGrid.getByRole("button")).toHaveCount(14);
    await runtimeCardGrid.getByRole("button", { name: "宝剑王牌" }).click();
    await expect(page.getByRole("heading", { name: "宝剑王牌" })).toBeVisible();

    await detailPanel.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });

    await runtimeCardGrid.getByRole("button", { name: "宝剑二" }).click();
    await expect(page.getByRole("heading", { name: "宝剑二" })).toBeVisible();
    await expect
      .poll(() => detailPanel.evaluate((element) => element.scrollTop))
      .toBe(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expectDocumentFitsViewport(page);
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
