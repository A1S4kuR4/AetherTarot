import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

async function waitForReadingHydration(
  page: Page,
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
  page: Page,
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

async function delayAppRouteOnce(
  page: Page,
  pathname: string,
  delayMs = 700,
) {
  let wasDelayed = false;
  const predicate = (url: URL) => url.pathname === pathname;
  const handler = async (route: Route) => {
    if (wasDelayed) {
      await route.fallback();
      return;
    }

    wasDelayed = true;
    await page.waitForTimeout(delayMs);
    await page.unroute(predicate, handler);
    await route.fallback();
  };

  await page.route(predicate, handler);
}

function getNextImageWidth(src: string) {
  try {
    const width = new URL(src).searchParams.get("w");
    return width ? Number(width) : null;
  } catch {
    return null;
  }
}

function getNextImageSourcePath(src: string) {
  try {
    const optimizedUrl = new URL(src);
    const sourcePath = optimizedUrl.searchParams.get("url");
    return sourcePath ? decodeURIComponent(sourcePath) : src;
  } catch {
    return src;
  }
}

function historyEntry(page: Page, question: string) {
  return page.locator("article").filter({ hasText: question }).first();
}

async function waitForPersistedHistoryEntry(
  page: Page,
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

test.beforeEach(async ({ page }) => {
  await page.route(
    /https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
    (route) => route.abort(),
  );
});

async function expectTrustPath(page: Page) {
  const evidenceSection = page.locator("#reading-evidence");

  await expect(
    evidenceSection.getByRole("heading", { name: "这个解读是怎么来的" }),
  ).toBeVisible();
  const evidenceSummary = evidenceSection.getByTestId("reading-evidence-summary");
  await expect(evidenceSummary.locator("p")).toHaveCount(2);
  await expect(evidenceSummary.getByText(/关键牌：/)).toBeVisible();
  await expect(evidenceSection.getByRole("heading", { name: "你的问题" })).not.toBeVisible();

  await evidenceSection
    .getByRole("button", { name: /这个解读是怎么来的/ })
    .click();

  await expect(evidenceSection.getByRole("heading", { name: "你的问题" })).toBeVisible();
  await expect(evidenceSection.getByRole("heading", { name: "牌面线索" })).toBeVisible();
  await expect(evidenceSection.getByRole("heading", { name: "解读逻辑" })).toBeVisible();
}

async function expectElementBefore(
  page: Page,
  firstSelector: string,
  secondSelector: string,
) {
  await expect
    .poll(
      () =>
        page.evaluate(
          ([first, second]) => {
            const firstElement = document.querySelector(first);
            const secondElement = document.querySelector(second);

            if (!firstElement || !secondElement) {
              return false;
            }

            return Boolean(
              firstElement.compareDocumentPosition(secondElement)
                & Node.DOCUMENT_POSITION_FOLLOWING,
            );
          },
          [firstSelector, secondSelector],
        ),
      { timeout: 3000 },
    )
    .toBe(true);
}

async function expectReadingQuickReady(
  page: Page,
  timeout = 60000,
) {
  await expect
    .poll(
      async () => {
        const quickSection = page.locator("#reading-quick").first();
        const quickLabel = page.getByText("当下的关键启示").first();
        return (await quickSection.isVisible().catch(() => false))
          || (await quickLabel.isVisible().catch(() => false));
      },
      { timeout },
    )
    .toBe(true);
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
  page: Page,
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

async function expectNoHorizontalOverflow(
  page: Page,
  tolerance = 2,
) {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Math.max(
            document.body.scrollWidth - document.documentElement.clientWidth,
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
        ),
      { timeout: 3000 },
    )
    .toBeLessThanOrEqual(tolerance);
}

async function expectEncyclopediaImagePaneWidth(
  page: Page,
  matcher: { max?: number; min?: number },
) {
  const imagePane = page.getByTestId("encyclopedia-image-pane");
  const width = () =>
    imagePane.evaluate((element) =>
      Math.round(element.getBoundingClientRect().width),
    );

  if (matcher.max !== undefined) {
    await expect.poll(width, { timeout: 3000 }).toBeLessThanOrEqual(matcher.max);
  }

  if (matcher.min !== undefined) {
    await expect.poll(width, { timeout: 3000 }).toBeGreaterThanOrEqual(matcher.min);
  }
}

async function expectHomeSectionsDoNotClipContent(
  page: Page,
) {
  const clippedSections = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-index]")]
      .map((section) => {
        const rect = section.getBoundingClientRect();
        return {
          index: section.dataset.index,
          height: Math.ceil(rect.height),
          scrollHeight: section.scrollHeight,
        };
      })
      .filter((section) => section.scrollHeight - section.height > 2),
  );

  expect(clippedSections).toEqual([]);
}

async function seedRecentCareerHistory(page: Page) {
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

async function holdToStart(page: Page) {
  let completed = false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (/\/(ritual\/draw|offline-draw)$/i.test(page.url())) {
      return;
    }

    try {
      const startButton = page.locator("button.new-reading-start-button:visible").first();
      await expect(startButton).toBeVisible({ timeout: 3000 });
      await expect(startButton).toBeEnabled({ timeout: 3000 });
      await startButton.focus();
      await page.keyboard.press("Enter");
    } catch (error) {
      if (/\/(ritual\/draw|offline-draw)$/i.test(page.url())) {
        return;
      }

      if (attempt < 2) {
        await page.waitForTimeout(250);
        continue;
      }

      throw error;
    }

    if (/\/(ritual\/draw|offline-draw)$/i.test(page.url())) {
      return;
    }

    completed = await Promise.race([
      page.waitForURL(/\/(ritual\/draw|offline-draw)$/i, { timeout: 1000 })
        .then(() => true)
        .catch(() => false),
      page
        .getByRole("heading", {
          name: /重大现实决定前的校准|重大决策风险提示/,
        })
        .waitFor({ state: "visible", timeout: 1000 })
        .then(() => true)
        .catch(() => false),
    ]);

    if (completed) {
      return;
    }

    if (/\/(ritual\/draw|offline-draw)$/i.test(page.url())) {
      return;
    }

    await page.mouse.up();
    await page.waitForTimeout(250);
  }

  throw new Error("Long-press start did not finish the ritual transition.");
}

async function startReading(
  page: Page,
  question: string,
  spreadName: RegExp,
  profileName?: RegExp,
) {
  await gotoAppRoute(page, "/new");
  const input = page.getByPlaceholder("今天，你想向内心询问什么？");
  const spreadButton = page.getByRole("button", { name: spreadName });
  const startButton = page.locator("button.new-reading-start-button:visible").first();

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
    await spreadButton.scrollIntoViewIfNeeded();
    await spreadButton.click({ force: true });
    await expect(page.getByText(/线上为你执行随机洗牌|会用 \d+ 个位置/)).toBeVisible({
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
  page: Page,
  targetCount: number,
) {
  if (/\/reveal$/.test(page.url())) {
    return targetCount;
  }

  const text = (await page.locator(".ritual-plaque-count").textContent()) ?? "";
  const match = text.match(/(\d+)\s*\/\s*(\d+)/);

  return Number(match?.[1] ?? 0);
}

async function drawCards(
  page: Page,
  count: number,
) {
  let currentCount = await getSelectedCount(page, count);
  const drawButton = page.getByRole("button", { name: /抽取一张牌/i });

  await expect(drawButton).toBeEnabled({ timeout: 5000 });

  while (currentCount < count) {
    await expect(drawButton).toBeEnabled({ timeout: 5000 });
    await drawButton.click();
    const expectedCount = currentCount + 1;
    await expect.poll(
      () => getSelectedCount(page, count),
      { timeout: 5000 },
    ).toBe(expectedCount);
    currentCount = expectedCount;
  }
}

async function revealSpread(page: Page) {
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
      await expect(page.getByTestId("reveal-reading-path")).toBeVisible();
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(250);
    }
  }

  throw lastError;
}

async function enterReading(page: Page) {
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

async function expectHeroImageLoading(
  page: Page,
  expectedCount: number,
) {
  const images = page.getByTestId("hero-spread-display").locator("img");

  await expect(images).toHaveCount(expectedCount);
  await expect(images.first()).toHaveAttribute("loading", "eager");

  for (let index = 1; index < expectedCount; index += 1) {
    await expect(images.nth(index)).toHaveAttribute("loading", "lazy");
  }
}

async function expectCardImageFrame(
  page: Page,
  expectedWidth: number,
) {
  const frame = page.getByTestId("reading-card-image-frame").first();
  await expect(frame).toBeVisible();
  const metrics = await frame.evaluate((element) => {
    const frameRect = element.getBoundingClientRect();
    const imageRect = element.querySelector("img")?.getBoundingClientRect();
    return {
      frameWidth: frameRect.width,
      frameHeight: frameRect.height,
      imageHeight: imageRect?.height ?? 0,
    };
  });

  expect(Math.abs(metrics.frameWidth - expectedWidth)).toBeLessThan(1);
  expect(Math.abs(metrics.frameWidth / metrics.frameHeight - 1 / 1.7)).toBeLessThan(0.01);
  expect(Math.abs(metrics.frameHeight - metrics.imageHeight)).toBeLessThan(3);
}

async function revealQuickDrawAndStartDeepReading(page: Page) {
  const revealButton = page.getByRole("button", { name: "翻开牌面", exact: true });
  await expect(revealButton).toBeEnabled({ timeout: 3000 });
  await revealButton.click();
  await page.getByRole("button", { name: "开启深度解读" }).click();
}

async function expectChapterSequence(page: Page, numerals: string[]) {
  await expect(page.locator(".reading-chapter-number")).toHaveText(
    numerals.map((numeral) => `CHAPTER ${numeral}`),
  );
}

async function completeFollowup(
  page: Page,
  answer = "我会先对照现实情况观察，再做下一步决定。",
) {
  await expect(page.getByTestId("reading-hero-meta")).toContainText("初步解读", {
    timeout: 10000,
  });
  const followupSection = page.locator("#reading-followup");
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
  await expect(page.getByTestId("reading-hero-meta")).toContainText("解读结果", {
    timeout: 60000,
  });
  await expect(page.locator("#reading-synthesis")).toBeInViewport();
}

test.describe("AetherTarot smoke flow", () => {
  test("completes a structured reading and persists it into history", async ({
    page,
  }) => {
    test.setTimeout(120000);

    await startReading(page, "我该如何看待当前的职业选择？", /圣三角/i);

    await expect(page).toHaveURL(/\/ritual\/draw$/);
    await drawCards(page, 3);
    await revealSpread(page);
    await expect(page.getByTestId("reveal-reading-path")).toBeVisible();

    await enterReading(page);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: '"我该如何看待当前的职业选择？"',
      }),
    ).toBeVisible({ timeout: 10000 });
    await expectReadingQuickReady(page);
    await expectHeroImageLoading(page, 3);
    await expectElementBefore(page, "[data-testid='hero-spread-display']", "#reading-quick");
    await expectTrustPath(page);
    await expect(page.locator("#reading-followup").getByRole("heading", { name: "回望与觉察" })).toBeVisible();
    await expect(page.locator("#reading-feedback")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "看到什么" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "它代表着…" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "这意味着什么" })).toHaveCount(0);
    await expect(page.getByText("READING NOTE", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/这些问题来自牌面里的矛盾点/)).toHaveCount(0);
    await expect(page.getByText(/分布只描述这组牌的构成/)).toHaveCount(0);
    await expectChapterSequence(page, ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"]);
    await expect(page.getByText(/^FIG\. 01/)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "串联在一起的故事" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "可以带走的思考" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "温柔的提醒" })).toBeVisible();
    await completeFollowup(page);
    await expectChapterSequence(page, ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]);
    const desktopNav = page.getByTestId("desktop-reading-nav");
    await expect(desktopNav).toBeVisible();
    await expect(desktopNav.locator("a")).toHaveCount(10);
    await expect(page.getByText("使用牌阵：圣三角")).toBeVisible();
    await desktopNav.getByRole("link", { name: "依据" }).click();
    await expect(page.locator("#reading-evidence")).toBeInViewport();
    await desktopNav.getByRole("link", { name: "反馈" }).click();
    await expect(page.locator("#reading-feedback")).toBeInViewport();
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
    await expect(page).toHaveURL(/\/ritual\/draw$/);
    await drawCards(page, 1);
    await revealSpread(page);

    await enterReading(page);
    await expect(
      page.getByRole("heading", { level: 1, name: '"我现在最该注意什么？"' }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("reading-hero-meta")).toContainText("初步解读");
    await expectHeroImageLoading(page, 1);
    await expectTrustPath(page);
    await expectCardImageFrame(page, 152);
    await page.setViewportSize({ width: 390, height: 844 });
    await expectCardImageFrame(page, 84);
    await expect(page.getByRole("button", { name: "生成整合深读" })).toHaveCount(0);

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
    await delayAppRouteOnce(page, "/reading");
    await page.getByTestId("new-reading-actions").getByRole("button", { name: "当下之镜 →" }).click();
    await revealQuickDrawAndStartDeepReading(page);

    await expect(page).toHaveURL(/\/reading$/, { timeout: 10000 });
    await expectReadingQuickReady(page);
    await expect(
      page.getByRole("heading", { level: 1, name: '"我现在最该注意什么？"' }),
    ).toBeVisible();
    await expect(page.getByTestId("reading-hero-meta")).toContainText("单牌启示");
    await expectTrustPath(page);
    await expect(page.getByRole("button", { name: "生成整合深读" })).toHaveCount(0);

    await waitForPersistedHistoryEntry(page, "我现在最该注意什么？");
    await gotoAppRoute(page, "/history");
    await expect(historyEntry(page, "我现在最该注意什么？")).toBeVisible();
  });

  test("restores an active quick reading draft after reload during generation", async ({
    page,
  }) => {
    let readingRequestCount = 0;

    await page.route("**/api/reading", async (route) => {
      readingRequestCount += 1;
      await new Promise((resolve) => {
        setTimeout(resolve, 1500);
      });
      await route.continue();
    });

    await gotoAppRoute(page, "/new");

    const question = "刷新后这次抽牌还应该继续吗？";
    await page.getByPlaceholder("今天，你想向内心询问什么？").fill(question);
    await page.getByTestId("new-reading-actions").getByRole("button", { name: "当下之镜 →" }).click();
    await revealQuickDrawAndStartDeepReading(page);

    await expect(page).toHaveURL(/\/reading$/, { timeout: 10000 });
    await expect(page.getByText("正在确认访问与本次牌阵…")).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForReadingHydration(page);

    await expect(page).toHaveURL(/\/reading$/);
    await expect(page.getByText(`"${question}"`)).toBeVisible();
    await expectReadingQuickReady(page);
    expect(readingRequestCount).toBeGreaterThanOrEqual(2);
  });

  test("quick reading remains a single-card mirror after another spread is selected", async ({ page }) => {
    await gotoAppRoute(page, "/new");

    await page
      .getByPlaceholder("今天，你想向内心询问什么？")
      .fill("我该如何看待当前的职业选择？");
    await page.getByRole("button", { name: /圣三角/i }).click();
    await page.getByTestId("new-reading-actions").getByRole("button", { name: "当下之镜 →" }).click();
    await revealQuickDrawAndStartDeepReading(page);

    await expect(page).toHaveURL(/\/reading$/, { timeout: 10000 });
    await expectReadingQuickReady(page);
    await expect(page.getByTestId("reading-hero-meta")).toContainText("单牌启示");
    await expect(page.getByTestId("reading-hero-meta")).not.toContainText("圣三角");
    await expect(page.getByRole("button", { name: "生成整合深读" })).toHaveCount(0);
  });

  test("reopens a saved reading from history", async ({ page }) => {
    test.setTimeout(120000);

    await startReading(page, "接下来一周我应该把重点放在哪里？", /单牌启示/i);
    await expect(page).toHaveURL(/\/ritual\/draw$/);
    await drawCards(page, 1);
    await revealSpread(page);

    await enterReading(page);
    await expect(page.getByRole("heading", { name: "串联在一起的故事" })).toBeVisible({
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
      page.getByRole("heading", {
        name: '"接下来一周我应该把重点放在哪里？"',
      }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "串联在一起的故事" })).toBeVisible();
  });

  test("validates Phase 1-6 interactive features: feedback, notes saving, and CTA reset", async ({ page }) => {
    test.setTimeout(120000);

    await startReading(page, "今天我的运气怎样？", /单牌启示/i);
    await expect(page).toHaveURL(/\/ritual\/draw$/);
    await drawCards(page, 1);
    await revealSpread(page);
    await enterReading(page);

    await expect(page.getByRole("heading", { name: "串联在一起的故事" })).toBeVisible({
      timeout: 10000,
    });
    await completeFollowup(page);

    const radarSection = page.locator("#reading-radar");
    if (await radarSection.isVisible()) {
      const radarBtn = radarSection.getByRole("button", { name: "牌面呈现了哪些特质" });
      await expect(radarSection.getByText(/展开后查看这组牌里的元素/)).toBeVisible(); // Hint is visible
      await expect(radarSection.locator("polygon").first()).not.toBeVisible();
      await radarBtn.click();
      await expect(radarSection.getByText(/展开后查看这组牌里的元素/)).not.toBeVisible(); // Hint hides
      await expect(radarSection.locator("polygon").first()).toBeVisible();
    }

    // Feedback
    const feedbackSection = page.locator("#reading-feedback");
    await expectElementBefore(page, "#reading-feedback", "#reading-boundary");
    await expectElementBefore(page, "#reading-feedback", "#reading-notes");
    await feedbackSection.getByRole("button", { name: "有帮助" }).click();
    await feedbackSection.getByRole("button", { name: "提交反馈" }).click();
    await expect(feedbackSection.getByText("反馈已记录，谢谢。")).toBeVisible();

    // Notes save handling
    const notesArea = page.getByPlaceholder(/随着时间推移/);
    await fillTextarea(notesArea, "success note");
    await page.getByRole("heading", { name: "你的回望与觉察" }).click();
    await expect(page.getByText("已保存")).toBeVisible();

    // CTA Reset
    await page.getByRole("button", { name: "开启新的解读" }).click();
    await expect(page).toHaveURL(/\/?$/);
    await expect(page.getByRole("button", { name: "抽一张当下之镜" })).toBeVisible();
  });

  test("routes returning users to JourneyView and exposes the new-reading entry", async ({
    page,
  }) => {
    test.setTimeout(120000);

    await startReading(page, "接下来一周我应该把重点放在哪里？", /单牌启示/i);
    await expect(page).toHaveURL(/\/ritual\/draw$/);
    await drawCards(page, 1);
    await revealSpread(page);

    await enterReading(page);
    await expect(page.getByRole("heading", { name: "串联在一起的故事" })).toBeVisible({
      timeout: 10000,
    });
    await completeFollowup(page);
    await waitForPersistedHistoryEntry(page, "接下来一周我应该把重点放在哪里？");
    await gotoAppRoute(page, "/journey");
    await expect(
      page.getByRole("heading", { name: /意识之流 \(The Journey\)/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /开启新的抽牌/i })).toBeVisible();

    const journeyReviewButton = page.getByRole("button", { name: /回看解读/i }).first();
    await expect(journeyReviewButton).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/reading$/, { timeout: 10000 }),
      journeyReviewButton.click(),
    ]);
    await expect(
      page.getByRole("heading", {
        name: '"接下来一周我应该把重点放在哪里？"',
      }),
    ).toBeVisible();

    await gotoAppRoute(page, "/journey");
    await page.getByRole("button", { name: /开启新的抽牌/i }).click();
    await expect(page).toHaveURL(/\/new$/);
    await expect(page.getByRole("heading", { name: "落笔成问" })).toBeVisible();
  });

  test("supports a full celtic-cross reading flow", async ({ page }) => {
    test.setTimeout(120000);

    await startReading(page, "我需要如何梳理接下来三个月的整体方向？", /赛尔特十字/i);

    await expect(page).toHaveURL(/\/ritual\/draw$/);
    await drawCards(page, 10);
    await revealSpread(page);

    const positionMeanings = page.locator(
      "section[aria-labelledby='position-meanings-title'] h4",
    );

    await expect(positionMeanings).toHaveCount(10);
    await expect(
      page.getByRole("heading", { name: "结果", exact: true }),
    ).toBeVisible();

    await enterReading(page);
    await expect(page.getByRole("heading", { name: "逐牌展开" })).toBeVisible({
      timeout: 10000,
    });
    await expectHeroImageLoading(page, 10);
    await expectTrustPath(page);
    await expect(page.locator("#reading-cards article")).toHaveCount(10);
    await expect(page.locator("#reading-cards h4")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "串联在一起的故事" })).toBeVisible();
    await completeFollowup(page);
    await expectChapterSequence(page, ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]);
    await waitForPersistedHistoryEntry(page, "我需要如何梳理接下来三个月的整体方向？");
    await gotoAppRoute(page, "/history");
    await expect(
      historyEntry(page, "我需要如何梳理接下来三个月的整体方向？"),
    ).toBeVisible();
  });

  test("supports a full four-aspects reading flow", async ({ page }) => {
    await startReading(page, "我该如何理解眼前这次转向？", /四个面向/i);

    await expect(page).toHaveURL(/\/ritual\/draw$/);
    await drawCards(page, 4);
    await revealSpread(page);

    const positionMeanings = page.locator(
      "section[aria-labelledby='position-meanings-title'] h4",
    );

    await expect(positionMeanings).toHaveCount(4);
    await expect(
      page.getByRole("heading", { name: "精神层面", exact: true }),
    ).toBeVisible();

    await enterReading(page);
    await expect(page.getByRole("heading", { name: "逐牌展开" })).toBeVisible({
      timeout: 10000,
    });
    await expectHeroImageLoading(page, 4);
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

    await expect(page).toHaveURL(/\/ritual\/draw$/);
    await drawCards(page, 7);
    await revealSpread(page);

    const positionMeanings = page.locator(
      "section[aria-labelledby='position-meanings-title'] h4",
    );

    await expect(positionMeanings).toHaveCount(7);
    await expect(
      page.getByRole("heading", { name: "答案 / 当事人", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "结果", exact: true }),
    ).toBeVisible();

    await enterReading(page);
    await expect(page.getByRole("heading", { name: "逐牌展开" })).toBeVisible({
      timeout: 10000,
    });
    await expectHeroImageLoading(page, 7);
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
    test.setTimeout(120000);

    await startReading(page, "接下来一周我应该把重点放在哪里？", /单牌启示/i);
    await expect(page).toHaveURL(/\/ritual\/draw$/);
    await drawCards(page, 1);
    await revealSpread(page);

    await enterReading(page);
    await completeFollowup(page);
    await waitForPersistedHistoryEntry(page, "接下来一周我应该把重点放在哪里？");
    await gotoAppRoute(page, "/history");

    const entry = historyEntry(page, "接下来一周我应该把重点放在哪里？");
    await entry.getByRole("button", { name: /延续这条线/i }).click();

    await expect(page).toHaveURL(/\/new$/);
    const continuityNotice = page.getByRole("complementary", { name: "延续中的线索" });
    await expect(continuityNotice).toBeVisible();
    await expect(continuityNotice).toContainText("接下来一周我应该把重点放在哪里？");
    await expect(page.getByPlaceholder("今天，你想向内心询问什么？")).toHaveValue("");

    await page.getByRole("button", { name: /停止延续/i }).click();
    await expect(continuityNotice).toBeHidden();
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
    await expect(page.getByText("已收录 78/78 张牌")).toBeVisible();
    await expect(page.getByText("10 个核心概念 · 9 种牌阵")).toBeVisible();
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
    const encyclopediaQuestion = page.getByLabel("向塔罗百科提问");
    await expect(encyclopediaQuestion).toHaveValue("这张牌逆位怎么理解？");
    await encyclopediaQuestion.press("Control+A");
    await encyclopediaQuestion.press("Backspace");
    await expect(encyclopediaQuestion).toHaveValue("");
    await encyclopediaQuestion.type("这张牌逆位怎么理解？");
    await expect(encyclopediaQuestion).toHaveValue("这张牌逆位怎么理解？");
    await page.getByRole("button", { name: "提问" }).click();
    await expect(page.getByTestId("encyclopedia-agent-answer")).toBeVisible();
    await expect(page.getByText(/愚者的逆位/)).toBeVisible();
    await expect(page.getByText(/knowledge\/wiki\/major-arcana\/the-fool\.md/)).toBeVisible();

    await page.getByRole("button", { name: /全部 \(78\)/ }).click();
    await runtimeCardGrid.getByRole("button", { name: "愚者" }).click();
    await page.getByRole("heading", { name: "深度百科" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: "深度百科" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "1. 核心象征与视觉意象" })).toBeVisible();
  });

  test("shows a hard-stop intercept for crisis questions", async ({ page }) => {
    await startReading(page, "我是不是不该活下去了？", /单牌启示/i);
    await expect(page).toHaveURL(/\/ritual\/draw$/);
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
    await expect(page.getByRole("heading", {
      name: /重大现实决定前的校准|重大决策风险提示/,
    })).toBeVisible();
    const decisionContinueButton = page.getByRole("button", {
      name: /我已了解，继续解读/i,
    });
    const boundaryCheckbox = page.getByLabel(/我确认这次阅读只用于整理线索/i);

    if (await boundaryCheckbox.count()) {
      await expect(decisionContinueButton).toBeDisabled();
      await boundaryCheckbox.check();
    }

    await expect(decisionContinueButton).toBeEnabled();
    await decisionContinueButton.click();
    await expect(page).toHaveURL(/\/ritual\/draw$/);
    await drawCards(page, 1);
    await revealSpread(page);

    await enterReading(page);
    await expect(page.getByRole("heading", { name: /降温与检视/i })).toBeVisible({
      timeout: 10000,
    });

    const unlockButton = page.getByRole("button", { name: /确认并解开牌面/i });
    const reflectionInput = page.getByPlaceholder("我的真实顾虑 / 底线计划是…");

    await expect(page.getByRole("heading", { name: "串联在一起的故事" })).toBeHidden();
    await expect(unlockButton).toBeDisabled();

    await reflectionInput.fill("     ");
    await expect(unlockButton).toBeDisabled();

    await reflectionInput.fill("顾虑");
    await expect(unlockButton).toBeDisabled();

    await reflectionInput.fill("我需要先确认现实底线");
    await expect(unlockButton).toBeEnabled();
    await unlockButton.click();

    await expect(page.getByRole("heading", { name: "串联在一起的故事" })).toBeVisible();
  });

  test("quick reading still requires decision boundary confirmation and sober-check", async ({
    page,
  }) => {
    await gotoAppRoute(page, "/new");

    await page.getByPlaceholder("今天，你想向内心询问什么？").fill("我应该离婚吗？");
    await page.getByTestId("new-reading-actions").getByRole("button", { name: "当下之镜 →" }).click();

    await expect(page.getByRole("heading", {
      name: /重大现实决定前的校准|重大决策风险提示/,
    })).toBeVisible();
    const decisionContinueButton = page.getByRole("button", {
      name: /我已了解，继续解读/i,
    });
    const boundaryCheckbox = page.getByLabel(/我确认这次阅读只用于整理线索/i);

    if (await boundaryCheckbox.count()) {
      await expect(decisionContinueButton).toBeDisabled();
      await boundaryCheckbox.check();
    }

    await expect(decisionContinueButton).toBeEnabled();
    await decisionContinueButton.click();

    await revealQuickDrawAndStartDeepReading(page);

    await expect(page).toHaveURL(/\/reading$/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: /降温与检视/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("heading", { name: "串联在一起的故事" })).toBeHidden();
  });

  test("returns to the question with guidance when the decision dialog closes by Escape", async ({
    page,
  }) => {
    await gotoAppRoute(page, "/new");

    const input = page.getByPlaceholder("今天，你想向内心询问什么？");
    await input.fill("我应该离婚吗？");
    const startButton = page.getByTestId("new-reading-actions").getByRole("button", {
      name: /^按住确认，进入抽牌 →$/,
    });
    await startButton.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(input).toBeFocused();
    await expect(page.getByText(/我需要看清哪些条件与代价/)).toBeVisible();
  });

  test("keeps the start button disabled until the question is non-empty, with 单牌启示 preselected", async ({
    page,
  }) => {
    await seedRecentCareerHistory(page);
    await gotoAppRoute(page, "/new");

    const startButton = page.getByTestId("new-reading-actions").getByRole("button", { name: /^按住确认，进入抽牌 →$/ });
    const input = page.getByPlaceholder("今天，你想向内心询问什么？");

    await expect(startButton).toBeDisabled();
    await expect(
      page.getByRole("button", { name: /单牌启示/i }),
    ).toHaveAttribute("aria-pressed", "true");

    await input.fill("我的职业方向还有什么需要看清？");
    await expect(input).toHaveValue("我的职业方向还有什么需要看清？");
    await expect(page.getByText("重复主题提醒")).toBeVisible();
    await expect(
      page.getByText(/最近问过相近的职业议题：我的职业方向接下来该看清什么？/),
    ).toBeVisible();
    await expect(startButton).toBeEnabled();

    const triangleSpread = page.getByRole("button", { name: /圣三角/i });
    await triangleSpread.click();
    await expect(triangleSpread).toHaveAttribute("aria-pressed", "true");
    await expect(startButton).toBeEnabled();

    await input.fill("   ");
    await expect(startButton).toBeDisabled();

    await input.clear();
    await expect(startButton).toBeDisabled();

    const draftQuestion = "只输入问题";
    await input.fill(draftQuestion);
    await expect
      .poll(
        () => page.evaluate(() => window.localStorage.getItem("aether_tarot_new_question_draft_v1")),
        { timeout: 3000 },
      )
      .toBe(draftQuestion);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForReadingHydration(page);
    await expect(input).toHaveValue(draftQuestion);
    await expect(page.getByText("已恢复上次草稿")).toBeVisible();

    await expect(startButton).toBeEnabled();
  });

  test("keeps the home narrative inside one viewport and jumps section by section", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await gotoAppRoute(page, "/");

    const snapContainer = page.getByTestId("home-snap-container");
    await expectDocumentFitsViewport(page);
    await expect(page.getByRole("heading", { name: "万物皆有回声" })).toBeInViewport();

    await snapContainer.dispatchEvent("wheel", { deltaY: 900 });
    await page.waitForTimeout(800);
    await expect(page.getByRole("heading", { name: "灵魂的 78 个切面" })).toBeInViewport();

    await snapContainer.dispatchEvent("wheel", { deltaY: 900 });
    await page.waitForTimeout(800);
    await expect(page.getByRole("heading", { name: "从预言到反思" })).toBeInViewport();

    await page.getByRole("button", { name: "跳转至 CHAPTER IV" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByRole("heading", { name: "通往深处" })).toBeInViewport();
    await expectDocumentFitsViewport(page);
  });

  test("keeps mobile home sections from clipping into each other", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 375, height: 667 },
    ]) {
      await page.setViewportSize(viewport);
      await gotoAppRoute(page, "/");

      await expectNoHorizontalOverflow(page);
      const mobileHomeCta = page
        .getByTestId("home-scroll-cue")
        .getByRole("link", { name: /进入仪式场域/ });
      await expect(mobileHomeCta).toHaveAttribute("href", "/new");

      const knowledgeHeading = page.getByRole("heading", { name: "灵魂的 78 个切面" });
      await knowledgeHeading.scrollIntoViewIfNeeded();
      await expect(knowledgeHeading).toBeInViewport();
      await expectHomeSectionsDoNotClipContent(page);
      await expect(page.getByRole("heading", { name: "从预言到反思" })).toBeVisible();

      await page.getByRole("heading", { name: "通往深处" }).scrollIntoViewIfNeeded();
      await expect(page.getByRole("heading", { name: "通往深处" })).toBeInViewport();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("keeps key routes navigable with reduced route motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAppRoute(page, "/");

    await expect(page.locator("[data-route-motion='reduced']")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page
      .getByTestId("home-scroll-cue")
      .getByRole("link", { name: /进入仪式场域/i })
      .click();
    await expect(page).toHaveURL(/\/new$/);
    await expect(page.locator("[data-route-motion='reduced']")).toBeVisible();
    await expect(page.getByPlaceholder("今天，你想向内心询问什么？")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("uses a natural-scrolling manuscript layout on desktop", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1024, height: 768 },
    ]) {
      await page.setViewportSize(viewport);
      await gotoAppRoute(page, "/new");
      await expectNoHorizontalOverflow(page);
      await expect(page.locator("main main")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "落笔成问" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "I. 选择牌阵" })).toBeVisible();

      const layout = await page.locator(".new-reading-sheet").evaluate((sheet) => ({
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        overflowY: getComputedStyle(sheet).overflowY,
      }));
      expect(layout.documentHeight).toBeGreaterThanOrEqual(layout.viewportHeight);
      expect(["visible", "clip"]).toContain(layout.overflowY);
    }

    const input = page.getByPlaceholder("今天，你想向内心询问什么？");
    const startButton = page.getByTestId("new-reading-actions").getByRole("button", { name: /^按住确认，进入抽牌 →$/ });

    await expect(input).toBeEditable();
    await expect(input).toHaveAttribute("maxlength", "200");
    await expect(startButton).toBeDisabled();
    await input.fill("我现在最需要看清什么？");
    await expect(page.getByRole("button", { name: "清空草稿" })).toBeVisible();
    await page.getByRole("button", { name: /单牌启示/i }).click();
    await expect(startButton).toBeEnabled();
    await expect(page.getByText("线上为你执行随机洗牌与发牌序列。")).toBeVisible();
    await page.getByTestId("new-reading-actions").scrollIntoViewIfNeeded();
    await expect(startButton).toBeInViewport();

    await input.fill("这段感情中，我需要看清什么？");
    await expect(page.getByText(/这个问题和关系有关|检测到议题可能聚焦关系/)).toBeVisible();
  });

  test("keeps mobile CTAs reachable without scrolling and reserves their space", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAppRoute(page, "/new");

    const input = page.getByPlaceholder("今天，你想向内心询问什么？");
    const actions = page.getByTestId("new-reading-mobile-actions");
    const startButton = actions.getByRole("button", { name: /^按住确认，进入抽牌 →$/ });
    const quickButton = actions.getByRole("button", { name: "当下之镜 →" });

    await expect(actions).toBeInViewport();
    await expect(startButton).toBeDisabled();
    await expect(quickButton).toBeVisible();
    await expect(quickButton).toBeEnabled();

    await input.fill("我现在最需要看清什么？");
    await expect(startButton).toBeEnabled();
    await expect(quickButton).toBeEnabled();
    await expectNoHorizontalOverflow(page);

    const actionPosition = await actions.evaluate((element) => getComputedStyle(element).position);
    expect(actionPosition).toBe("fixed");
  });

  test("opens and closes the mobile drawer and keeps the home entry usable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAppRoute(page, "/");

    const menuButton = page.getByRole("button", { name: "打开菜单" });
    const backdrop = page.locator("#mobile-sidebar-backdrop");

    await expectNoHorizontalOverflow(page);
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await expect(backdrop).toHaveClass(/opacity-100/);
    await expect(page.getByRole("link", { name: "旅程", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "关闭菜单" }).click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(backdrop).toHaveClass(/opacity-0/);

    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await expect(backdrop).toHaveClass(/opacity-100/);

    await backdrop.click({ position: { x: 24, y: 96 } });
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(backdrop).toHaveClass(/opacity-0/);

    await page
      .getByTestId("home-scroll-cue")
      .getByRole("link", { name: /进入仪式场域/i })
      .click();
    await expect(page).toHaveURL(/\/new$/);
    await expect(page.getByPlaceholder("今天，你想向内心询问什么？")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("keeps a seven-card mobile reveal and reading navigable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startReading(page, "这段变化接下来会怎样展开？", /七张牌/i);
    await expect(page).toHaveURL(/\/ritual\/draw$/);
    await expect(page.getByTestId("ritual-position-track")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await drawCards(page, 7);
    await delayAppRouteOnce(page, "/reveal");
    await page.getByRole("button", { name: /揭示牌阵/i }).click();
    await expect(page.getByRole("button", { name: /正在揭示/i })).toBeDisabled();
    await expect(page).toHaveURL(/\/reveal$/, { timeout: 10000 });
    await expect(page.getByTestId("reveal-reading-path")).toBeVisible();
    await expect(page.getByRole("heading", { name: "阅读路径" })).toBeVisible();

    const revealTrack = page.getByTestId("reveal-card-track");
    await expect(revealTrack).toBeVisible();
    await expect(revealTrack.locator(".reveal-card-container")).toHaveCount(7);
    await expect(page.getByRole("button", { name: /带着整组气候进入深读/i })).toBeVisible();
    await expect
      .poll(
        async () => {
          const widths = (
            await revealTrack.locator("img").evaluateAll((images) =>
              images.map((image) => (image as HTMLImageElement).currentSrc),
            )
          )
            .map(getNextImageWidth)
            .filter((width): width is number => width !== null);

          return widths.length === 7 ? Math.max(...widths) : Number.POSITIVE_INFINITY;
        },
        { timeout: 10000 },
      )
      .toBeLessThanOrEqual(640);

    const revealImageWidths = (
      await revealTrack.locator("img").evaluateAll((images) =>
        images.map((image) => (image as HTMLImageElement).currentSrc),
      )
    )
      .map(getNextImageWidth)
      .filter((width): width is number => width !== null);
    const revealSourcePaths = (
      await revealTrack.locator("img").evaluateAll((images) =>
        images.map((image) =>
          (image as HTMLImageElement).currentSrc || (image as HTMLImageElement).src,
        ),
      )
    ).map(getNextImageSourcePath);
    expect(revealImageWidths.length).toBeGreaterThan(0);
    expect(Math.max(...revealImageWidths)).toBeLessThanOrEqual(640);
    expect(revealSourcePaths.every((sourcePath) => sourcePath.includes("/cardsV2/reveal/"))).toBe(true);
    await expectNoHorizontalOverflow(page);

    await delayAppRouteOnce(page, "/reading");
    await page.getByRole("button", { name: /带着整组气候进入深读/i }).click();
    await expect(
      page.getByRole("button", { name: /正在进入深读/i }),
    ).toBeDisabled();
    await expect(page).toHaveURL(/\/reading$/, { timeout: 10000 });
    await expect(page.getByTestId("mobile-reading-nav")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("hero-spread-display")).toBeVisible();
    await expect(page.getByTestId("hero-spread-display").locator("img")).toHaveCount(7);
    await expectReadingQuickReady(page);
    await page.getByRole("link", { name: "逐牌" }).click();
    await expect(page.locator("#reading-cards")).toBeInViewport();
    await page.getByRole("link", { name: "思考" }).click();
    await expect(page.locator("#reading-guidance")).toBeInViewport();
    await expectNoHorizontalOverflow(page);

    const firstCardLink = page.locator('#reading-cards a[href^="/encyclopedia?card="]').first();
    const targetHref = await firstCardLink.getAttribute("href");
    await firstCardLink.click();
    await expect(page).toHaveURL(/\/encyclopedia\?card=/);
    if (targetHref) {
      expect(page.url()).toContain(targetHref);
    }
  });

  test("keeps short mobile ritual controls clear of the deck", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await startReading(page, "这件事接下来会如何发展？", /赛尔特十字/i);
    await expect(page).toHaveURL(/\/ritual\/draw$/);
    await expect(page.getByRole("button", { name: "从牌堆抽牌" })).toHaveCount(1);

    for (const viewport of [
      { width: 320, height: 568 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await expectNoHorizontalOverflow(page);

      const layout = await page.evaluate(() => {
        const deckField = document.querySelector<HTMLElement>(".ritual-deck-field");
        const actions = document.querySelector<HTMLElement>(".ritual-actions");

        if (!deckField || !actions) {
          throw new Error("Ritual deck field or actions are missing");
        }

        const actionsRect = actions.getBoundingClientRect();
        const cardRects = Array.from(
          document.querySelectorAll<HTMLElement>("[data-testid='deck-card']"),
        ).map((card) => card.getBoundingClientRect());
        const overlappingCards = cardRects.filter(
          (cardRect) =>
            cardRect.bottom > actionsRect.top && cardRect.top < actionsRect.bottom,
        ).length;

        return {
          maxCardBottom: Math.max(...cardRects.map((cardRect) => cardRect.bottom)),
          actionsTop: actionsRect.top,
          overlappingCards,
        };
      });

      expect(layout.maxCardBottom).toBeLessThanOrEqual(layout.actionsTop);
      expect(layout.overlappingCards).toBe(0);
    }
  });

  test("keeps the ritual draw stage inside the desktop viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await startReading(page, "我现在最需要看清什么？", /单牌启示/i);

    await expect(page).toHaveURL(/\/ritual\/draw$/);
    await expectDocumentFitsViewport(page);
    await expect(
      page.getByRole("heading", { name: "仪式 · 单牌启示", exact: true }),
    ).toBeInViewport();
    await expect(page.getByRole("button", { name: "洗牌" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "抽取一张牌" })).toBeInViewport();
    await expect(page.locator(".deck-card").first()).toBeInViewport();
    await expect(page.getByText("00 / 01", { exact: true })).toBeInViewport();
  });

  test("draws a card by clicking the desktop deck", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await startReading(page, "我现在最需要看清什么？", /单牌启示/i);

    const deckCard = page.getByRole("button", { name: "从牌堆抽牌" }).last();

    await expect(deckCard).toBeEnabled({ timeout: 5000 });
    await deckCard.click();
    await expect(page.getByText("01 / 01", { exact: true })).toBeVisible({
      timeout: 5000,
    });
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
    await expect(page.getByRole("heading", { name: "宝剑王牌", exact: true })).toBeVisible();

    await detailPanel.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });

    await runtimeCardGrid.getByRole("button", { name: "宝剑二" }).click();
    await expect(page.getByRole("heading", { name: "宝剑二", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/card=two-of-swords/);
    await expect
      .poll(() => detailPanel.evaluate((element) => element.scrollTop))
      .toBe(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.getByRole("heading", { name: "深度百科" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: "深度百科" })).toBeVisible();
    await expectDocumentFitsViewport(page);
  });

  test("keeps encyclopedia browsing usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAppRoute(page, "/encyclopedia");

    const runtimeCardGrid = page.getByTestId("runtime-card-grid");

    await expect(page.getByRole("heading", { name: "塔罗百科" })).toBeVisible();
    await expect(page.getByLabel("搜索卡牌")).toBeVisible();
    await page.getByRole("button", { name: /宝剑 \(14\)/ }).click();
    const swordsTwoButton = runtimeCardGrid.getByRole("button", { name: "宝剑二" });
    await expect(swordsTwoButton).toBeVisible();
    await swordsTwoButton.click();
    await expectEncyclopediaImagePaneWidth(page, { max: 120 });
    await expect(page.getByRole("heading", { name: "深度百科" })).toBeInViewport();

    await page.getByRole("button", { name: "展开牌图" }).click();
    await expectEncyclopediaImagePaneWidth(page, { min: 160 });
    await expect(page.getByRole("button", { name: "收起牌图" })).toBeVisible();

    await page.getByRole("heading", { name: "塔罗百科" }).scrollIntoViewIfNeeded();
    await runtimeCardGrid.getByRole("button", { name: "宝剑三" }).click();
    await expectEncyclopediaImagePaneWidth(page, { max: 120 });
    await expect(page.getByRole("button", { name: "展开牌图" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("opens encyclopedia directly to a card and renders wiki markdown cleanly", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await gotoAppRoute(page, "/encyclopedia?card=two-of-swords");

    await expect(page.getByRole("heading", { name: "宝剑二", exact: true })).toBeVisible();
    await page.getByRole("heading", { name: "深度百科" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: "深度百科" })).toBeVisible();

    await gotoAppRoute(page, "/encyclopedia?card=not-real");
    await expect(page.getByRole("heading", { name: "愚者", exact: true })).toBeVisible();
    await page.getByRole("heading", { name: "深度百科" }).scrollIntoViewIfNeeded();
    await expect(page.getByText("来源: 《78度的智慧》").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/\[[^\]]+\]\([^)]+\.md\)|\*\*/);

    await page.getByRole("heading", { name: "6. 关联与交叉引用" }).scrollIntoViewIfNeeded();
    await page.getByRole("link", { name: "魔术师" }).click();
    await expect(page).toHaveURL(/card=the-magician/);
    await expect(page.getByRole("heading", { name: "魔术师", exact: true })).toBeVisible();
  });

  test("redirects protected pages back to the start when state is missing", async ({
    page,
  }) => {
    await gotoAppRoute(page, "/reveal");
    await expect(page).toHaveURL(/\/$/);

    await gotoAppRoute(page, "/reading");
    await expect(page).toHaveURL(/\/$/);

    await gotoAppRoute(page, "/ritual/draw");
    await expect(page).toHaveURL(/\/$/);
  });

  test("shows a mobile reading nav with shared reading anchors", async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 375, height: 667 });

    await startReading(page, "我该如何看待当前的变化？", /圣三角/i);
    await drawCards(page, 3);
    await revealSpread(page);
    await enterReading(page);
    await expectReadingQuickReady(page);

    const mobileNav = page.getByTestId("mobile-reading-nav");
    await expect(mobileNav).toBeVisible();

    const anchors = mobileNav.locator("a");
    await expect(anchors).toHaveCount(8);
    await expect(mobileNav.getByText("牌阵")).toBeVisible();
    await expect(mobileNav.getByText("核心")).toBeVisible();
    await expect(mobileNav.getByText("依据")).toBeVisible();
    await expect(mobileNav.getByText("逐牌")).toBeVisible();
    await expect(mobileNav.getByText("综合")).toBeVisible();
    await expect(mobileNav.getByText("思考")).toBeVisible();
    await expect(mobileNav.getByText("追问")).toBeVisible();
    await expect(mobileNav.getByText("能量")).toBeVisible();
    await expect(mobileNav.getByText("反馈")).toHaveCount(0);

    await mobileNav.getByText("依据").click();
    await expect(page.locator("#reading-evidence")).toBeInViewport();

    await mobileNav.getByText("逐牌").click();
    await expect(page.locator("#reading-cards")).toBeInViewport();

    await mobileNav.getByText("思考").click();
    await expect(page.locator("#reading-guidance")).toBeInViewport();

    await expect(page.locator("#reading-feedback")).toHaveCount(0);
    await completeFollowup(page);
    await expect(mobileNav.getByText("反馈")).toBeVisible();
    await expect(mobileNav.getByText("手记")).toBeVisible();
    await mobileNav.getByText("反馈").click();
    await expect(page.locator("#reading-feedback")).toBeInViewport();
  });
});
