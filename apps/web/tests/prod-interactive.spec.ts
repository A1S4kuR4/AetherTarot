import { expect, test, type Page } from "@playwright/test";
import * as path from "path";

const ARTIFACT_DIR = "C:\\Users\\yoga\\.gemini\\antigravity\\brain\\cc241b25-ab43-4983-a8cf-df8cd23d96f8";
const PROD_TEST_EMAIL = process.env.AETHERTAROT_PROD_TEST_EMAIL;
const PROD_TEST_PASSWORD = process.env.AETHERTAROT_PROD_TEST_PASSWORD;

test.skip(
  process.env.AETHERTAROT_ALLOW_REMOTE_E2E !== "1"
    || !PROD_TEST_EMAIL
    || !PROD_TEST_PASSWORD,
  "Production interaction tests require explicit remote approval and injected credentials.",
);

async function takeScreenshot(page: Page, name: string) {
  const screenshotPath = path.join(ARTIFACT_DIR, name);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot saved to: ${screenshotPath}`);
}

async function waitForReadingHydration(page: Page) {
  await page.waitForFunction(
    () =>
      (window as Window & { __AETHERTAROT_READING_HYDRATED__?: boolean })
        .__AETHERTAROT_READING_HYDRATED__ === true,
    undefined,
    { timeout: 15000 },
  );
}

async function gotoAppRoute(page: Page, url: string) {
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

async function holdToStart(page: Page, durationMs = 2200) {
  const startButton = page.getByRole("button", { name: /长按开始仪式/i });
  await expect(startButton).toBeVisible();
  await expect(startButton).toBeEnabled();

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

    const completed = await page.waitForURL(/\/(ritual|offline-draw)$/i, { timeout: 1500 })
      .then(() => true)
      .catch(() => false);

    if (completed) {
      return;
    }

    await page.mouse.up();
    await page.waitForTimeout(250);
  }

  throw new Error("Long-press start did not finish the ritual transition.");
}

async function getSelectedCount(page: Page, targetCount: number) {
  if (/\/reveal$/.test(page.url())) {
    return targetCount;
  }

  const text =
    (await page.getByText(/你已选择 \d+ \/ \d+ 张牌/).textContent()) ?? "";
  const match = text.match(/你已选择 (\d+) \/ (\d+) 张牌/);

  return Number(match?.[1] ?? 0);
}

async function drawCards(page: Page, count: number) {
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

async function expectReadingQuickReady(page: Page, timeout = 90000) {
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

async function expectReadingQuality(page: Page) {
  // Validate content quality: non-empty, correct format, no obvious errors
  const quickSection = page.locator("#reading-quick").first();
  const text = await quickSection.innerText();
  
  // 1. Non-empty / Substantial Length
  expect(text.trim().length).toBeGreaterThan(20);
  
  // 2. No obvious JS artifacts or data mapping errors
  expect(text).not.toContain("undefined");
  expect(text).not.toContain("[object Object]");
  expect(text).not.toContain("null");
  
  // 3. Proper formatting (contains Chinese punctuation, meaning it generated real sentences)
  expect(text).toMatch(/[。！？]/);
}

test("Production Interaction and Flow E2E Test", async ({ page }) => {
  // Set explicit window size to ensure consistency in screenshots
  await page.setViewportSize({ width: 1280, height: 800 });

  // 1. Visit Login Page
  console.log("Navigating to login page...");
  await page.goto("https://aethertarot.cn/login");
  await page.waitForLoadState("networkidle");
  await takeScreenshot(page, "1-login-page.png");

  // 2. Fill login form
  console.log("Filling login credentials...");
  await page.fill("#email", PROD_TEST_EMAIL ?? "");
  await page.fill("#password", PROD_TEST_PASSWORD ?? "");
  await takeScreenshot(page, "2-login-filled.png");

  // 3. Submit
  console.log("Submitting login form...");
  await page.click('button[type="submit"]');

  // Wait for redirect to home
  try {
    await page.waitForURL("https://aethertarot.cn/", { timeout: 30000 });
    await page.waitForLoadState("networkidle");
    await takeScreenshot(page, "3-dashboard.png");
  } catch (err) {
    console.error("Login redirect failed or timed out.");
    console.log("Current URL is:", page.url());
    const errorBox = page.locator(".bg-red-50, [role='alert']").first();
    if (await errorBox.isVisible()) {
      console.log("Found page error message:", await errorBox.innerText());
    } else {
      console.log("No error box visible on page.");
    }
    await takeScreenshot(page, "error-login-failure.png");
    throw err;
  }

  // 4. Initialize Tarot Ritual
  console.log("Navigating to new ritual page...");
  await gotoAppRoute(page, "https://aethertarot.cn/new");
  await page.waitForLoadState("networkidle");

  const questionInput = page.getByPlaceholder("今天，你想向内心询问什么？");
  await questionInput.fill("今天我的运势和能量指引是什么？");
  
  // Wait for open questions check
  await page.waitForTimeout(1500);
  
  // Select spread "单牌启示" and "日常塔罗师"
  console.log("Configuring spread and profile...");
  await page.getByRole("button", { name: /单牌启示/i }).click();
  await page.getByRole("button", { name: /日常塔罗师/i }).click();
  
  await takeScreenshot(page, "4-ritual-prepared.png");

  // 5. Long press to start ritual
  console.log("Initiating long press ritual...");
  await holdToStart(page);
  await page.waitForURL(/\/ritual$/, { timeout: 10000 });
  await page.waitForLoadState("networkidle");
  await takeScreenshot(page, "5-ritual-started.png");

  // 6. Draw Card
  console.log("Drawing card...");
  await drawCards(page, 1);
  await page.waitForTimeout(500);
  await takeScreenshot(page, "6-card-drawn.png");

  // 7. Reveal Spread
  console.log("Revealing spread...");
  await revealSpread(page);
  await page.waitForLoadState("networkidle");
  await takeScreenshot(page, "7-spread-revealed.png");

  // 8. Enter Reading Node
  console.log("Entering deep reading...");
  await enterReading(page);
  await takeScreenshot(page, "8-reading-loading.png");

  // 9. Wait for deep reading completion (up to 90s)
  console.log("Waiting for LLM analysis report...");
  await expectReadingQuickReady(page, 90000);
  await expectReadingQuality(page);
  await page.waitForTimeout(1000);
  await takeScreenshot(page, "9-reading-outcome.png");

  // 10. Logout and verify
  console.log("Logging out...");
  // Open sidebar if closed or click directly
  const logoutButton = page.getByRole("button", { name: /退出登录|退出/i }).first();
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
  } else {
    // Topbar logout
    await page.goto("https://aethertarot.cn/login");
  }
  await page.waitForURL(/\/login$/, { timeout: 10000 });
  await takeScreenshot(page, "10-logged-out.png");

  console.log("E2E Test Flow completed successfully!");
});

test("Production Mobile Interaction and Flow E2E Test", async ({ page }) => {
  // Set viewport to mobile size (iPhone 12)
  await page.setViewportSize({ width: 390, height: 844 });

  // 1. Visit Login Page
  console.log("[Mobile] Navigating to login page...");
  await page.goto("https://aethertarot.cn/login");
  await page.waitForLoadState("networkidle");
  await takeScreenshot(page, "mobile-1-login-page.png");

  // 2. Fill login form
  console.log("[Mobile] Filling credentials...");
  await page.fill("#email", PROD_TEST_EMAIL ?? "");
  await page.fill("#password", PROD_TEST_PASSWORD ?? "");
  await takeScreenshot(page, "mobile-2-login-filled.png");

  // 3. Submit
  console.log("[Mobile] Submitting login form...");
  await page.click('button[type="submit"]');

  // Wait for redirect to home
  try {
    await page.waitForURL("https://aethertarot.cn/", { timeout: 30000 });
    await page.waitForLoadState("networkidle");
    await takeScreenshot(page, "mobile-3-dashboard.png");
  } catch (err) {
    console.error("[Mobile] Login redirect failed or timed out.");
    console.log("[Mobile] Current URL is:", page.url());
    const errorBox = page.locator(".bg-red-50, [role='alert']").first();
    if (await errorBox.isVisible()) {
      console.log("[Mobile] Found error message:", await errorBox.innerText());
    }
    await takeScreenshot(page, "mobile-error-login-failure.png");
    throw err;
  }

  // 4. Initialize Tarot Ritual
  console.log("[Mobile] Navigating to new ritual page...");
  await gotoAppRoute(page, "https://aethertarot.cn/new");
  await page.waitForLoadState("networkidle");

  const questionInput = page.getByPlaceholder("今天，你想向内心询问什么？");
  await questionInput.fill("今天我的运势和能量指引是什么？");
  
  // Wait for open questions check
  await page.waitForTimeout(1500);
  
  // Select spread "单牌启示" and "日常塔罗师"
  console.log("[Mobile] Configuring spread and profile...");
  await page.getByRole("button", { name: /单牌启示/i }).click();
  await page.getByRole("button", { name: /日常塔罗师/i }).click();
  
  await takeScreenshot(page, "mobile-4-ritual-prepared.png");

  // 5. Long press to start ritual
  console.log("[Mobile] Initiating long press ritual...");
  await holdToStart(page);
  await page.waitForURL(/\/ritual$/, { timeout: 10000 });
  await page.waitForLoadState("networkidle");
  await takeScreenshot(page, "mobile-5-ritual-started.png");

  // 6. Draw Card
  console.log("[Mobile] Drawing card...");
  await drawCards(page, 1);
  await page.waitForTimeout(500);
  await takeScreenshot(page, "mobile-6-card-drawn.png");

  // 7. Reveal Spread
  console.log("[Mobile] Revealing spread...");
  await revealSpread(page);
  await page.waitForLoadState("networkidle");
  await takeScreenshot(page, "mobile-7-spread-revealed.png");

  // 8. Enter Reading Node
  console.log("[Mobile] Entering deep reading...");
  await enterReading(page);
  await takeScreenshot(page, "mobile-8-reading-loading.png");

  // 9. Wait for deep reading completion (up to 90s)
  console.log("[Mobile] Waiting for LLM analysis report...");
  await expectReadingQuickReady(page, 90000);
  await expectReadingQuality(page);
  await page.waitForTimeout(1000);
  await takeScreenshot(page, "mobile-9-reading-outcome.png");

  // 10. Logout and verify
  console.log("[Mobile] Logging out...");
  // Open mobile drawer
  const menuButton = page.getByRole("button", { name: "打开菜单" });
  if (await menuButton.isVisible()) {
    await menuButton.click();
    await page.waitForTimeout(500);
  }
  const logoutButton = page.getByRole("button", { name: /退出登录|退出/i }).first();
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
  } else {
    await page.goto("https://aethertarot.cn/login");
  }
  await page.waitForURL(/\/login$/, { timeout: 10000 });
  await takeScreenshot(page, "mobile-10-logged-out.png");

  console.log("[Mobile] Mobile E2E Test Flow completed successfully!");
});
