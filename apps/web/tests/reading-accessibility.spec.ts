import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Page,
  type TestInfo,
} from "@playwright/test";

const WCAG_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
] as const;

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
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitForReadingHydration(page);
}

async function startReading(
  page: Page,
  question: string,
  spreadName: RegExp,
  cardCount: number,
) {
  await gotoAppRoute(page, "/new");
  await page.getByPlaceholder("今天，你想向内心询问什么？").fill(question);
  await page.getByRole("button", { name: spreadName }).click();

  const startButton = page.getByTestId("new-reading-actions").getByRole("button", { name: /确认问询，进入抽牌/i });
  await expect(startButton).toBeEnabled();
  await startButton.click();

  const decisionHeading = page.getByRole("heading", {
    name: /重大现实决定前的校准|重大决策风险提示/,
  });

  if (await decisionHeading.isVisible().catch(() => false)) {
    const boundaryCheckbox = page.getByLabel(/我确认这次阅读只用于整理线索/i);
    if (await boundaryCheckbox.count()) {
      await boundaryCheckbox.check();
    }
    await page
      .getByRole("button", { name: /确认现实边界并继续|我已了解，继续仪式/i })
      .click();
  }

  await expect(page).toHaveURL(/\/ritual\/draw$/, { timeout: 15000 });
  const drawButton = page.getByRole("button", { name: /抽取一张牌/i });

  for (let index = 0; index < cardCount; index += 1) {
    await expect(drawButton).toBeEnabled();
    await drawButton.click();
    await page.waitForTimeout(200);
  }

  await page.getByRole("button", { name: /揭示牌阵/i }).click();
  await expect(page).toHaveURL(/\/reveal$/, { timeout: 15000 });
  await expect(page.getByTestId("reveal-reading-path")).toBeVisible();
}

async function enterReading(page: Page) {
  await page
    .getByRole("button", { name: /带着整组气候进入深读/i })
    .click();
  await expect(page).toHaveURL(/\/reading$/, { timeout: 15000 });
}

async function completeFollowup(page: Page) {
  const section = page.locator("section").filter({
    has: page.getByRole("heading", { name: "回答后进入整合深读" }),
  });
  const inputs = section.getByRole("textbox");
  const count = await inputs.count();

  for (let index = 0; index < count; index += 1) {
    await inputs
      .nth(index)
      .fill(`我会先核对现实条件，再决定下一步如何行动。（${index + 1}）`);
  }

  await section.getByRole("button", { name: /生成整合深读/i }).click();
  await expect(page.getByTestId("reading-hero-meta")).toContainText("解读结果", {
    timeout: 60000,
  });
}

function formatViolations(
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
) {
  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .map((node) => `  - ${node.target.join(" ")}: ${node.failureSummary ?? ""}`)
        .join("\n");
      return `${violation.id} (${violation.impact ?? "unknown"}): ${violation.help}\n${nodes}`;
    })
    .join("\n\n");
}

async function auditWcag(page: Page, testInfo: TestInfo, label: string) {
  // Axe must inspect the settled UI, not transient route/card opacity frames.
  await page.waitForFunction(
    () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          "[data-testid='hero-spread-display'] li",
        ),
      ).every((element) => Number.parseFloat(getComputedStyle(element).opacity) >= 0.999),
    undefined,
    { timeout: 5000 },
  );
  await page.waitForTimeout(500);
  const results = await new AxeBuilder({
    page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"],
  }).withTags([...WCAG_TAGS]).analyze();

  await testInfo.attach(`${label}-axe.json`, {
    body: Buffer.from(JSON.stringify(results, null, 2)),
    contentType: "application/json",
  });
  await testInfo.attach(`${label}.png`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });

  expect(results.violations, formatViolations(results.violations)).toEqual([]);
}

async function expectResponsiveBasics(page: Page, testInfo: TestInfo) {
  const metrics = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const overflow = Math.max(
      document.body.scrollWidth - viewportWidth,
      document.documentElement.scrollWidth - viewportWidth,
    );
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(
        "#reading-main button, #reading-main input, #reading-main textarea, #reading-main nav a",
      ),
    )
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          height: Math.round(rect.height),
          label:
            element.getAttribute("aria-label")
            ?? element.textContent?.trim().slice(0, 40)
            ?? element.tagName,
          width: Math.round(rect.width),
        };
      });
    const overflowers = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label: element.id || element.getAttribute("data-testid") || element.tagName,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        };
      })
      .filter((element) => element.left < -2 || element.right > viewportWidth + 2)
      .slice(0, 12);

    return {
      overflow,
      overflowers,
      sub24: targets.filter((target) => target.width < 24 || target.height < 24),
      sub44: targets.filter((target) => target.width < 44 || target.height < 44),
    };
  });

  await testInfo.attach("mobile-target-metrics.json", {
    body: Buffer.from(JSON.stringify(metrics, null, 2)),
    contentType: "application/json",
  });

  expect(metrics.overflow, JSON.stringify(metrics.overflowers)).toBeLessThanOrEqual(2);
  expect(metrics.sub24).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.route(
    /https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
    (route) => route.abort(),
  );
});

test.describe("/reading WCAG 2.2 AA audit", () => {
  test.describe.configure({ timeout: 180000 });

  test("audits initial, final, skip navigation, and the share dialog", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const lcpWarnings: string[] = [];
    page.on("console", (message) => {
      if (/Largest Contentful Paint|\bLCP\b/i.test(message.text())) {
        lcpWarnings.push(message.text());
      }
    });

    await startReading(
      page,
      "面对接下来三个月的职业变化，我应该先确认哪些现实条件与内在边界？",
      /圣三角/i,
      3,
    );
    await enterReading(page);
    await expect(page.getByTestId("reading-hero-meta")).toContainText("初步解读", {
      timeout: 60000,
    });

    const skipLink = page.getByRole("link", { name: "跳到解读正文" });
    await expect(
      skipLink.evaluate((link) => {
        const topbarLogo = document.querySelector("nav a");
        return Boolean(
          topbarLogo
          && (link.compareDocumentPosition(topbarLogo) & Node.DOCUMENT_POSITION_FOLLOWING),
        );
      }),
    ).resolves.toBe(true);
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
    await skipLink.press("Enter");
    await expect(page.locator("#reading-main")).toBeFocused();
    await expect(page.locator("main")).toHaveCount(1);
    await auditWcag(page, testInfo, "desktop-initial");
    await testInfo.attach("reading-desktop-1440x900", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    await completeFollowup(page);
    await auditWcag(page, testInfo, "desktop-final");

    const shareButton = page.getByRole("button", { name: "分享这次解读" });
    await shareButton.focus();
    await shareButton.click();
    await expect(page.getByRole("dialog", { name: "分享这张解读" })).toBeVisible();
    await auditWcag(page, testInfo, "share-dialog");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "分享这张解读" })).toBeHidden();
    await expect(shareButton).toBeFocused();

    await page.waitForTimeout(1500);
    expect(lcpWarnings).toEqual([]);
  });

  test("audits mobile layout, touch targets, and 200% reflow", async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await startReading(page, "这段变化接下来会怎样展开？", /七张牌/i, 7);
    await enterReading(page);
    await expect(page.getByTestId("hero-spread-display")).toBeVisible({
      timeout: 60000,
    });

    await expectResponsiveBasics(page, testInfo);
    await auditWcag(page, testInfo, "mobile-initial");
    await testInfo.attach("reading-mobile-390x844", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    await page.evaluate(() => {
      document.documentElement.style.zoom = "200%";
    });
    await expectResponsiveBasics(page, testInfo);
    await auditWcag(page, testInfo, "mobile-zoom-200");
    await testInfo.attach("reading-mobile-zoom-200", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  });

  test("audits loading and recoverable error states", async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await startReading(page, "我现在最需要留意什么？", /单牌启示/i, 1);

    let releaseRequest: () => void = () => undefined;
    const heldRequest = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    await page.route("**/api/reading", async (route) => {
      await heldRequest;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "audit_simulated_failure",
            message: "审计模拟连接失败，请稍后重新尝试。",
          },
        }),
      });
    });

    await enterReading(page);
    await expect(page.getByRole("status")).toBeVisible();
    await expect(
      page.getByRole("status").locator("[aria-hidden='true']"),
    ).toHaveCSS("animation-name", "none");
    await auditWcag(page, testInfo, "loading");

    releaseRequest?.();
    await expect(
      page.getByRole("alert").filter({ hasText: "审计模拟连接失败" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "重新尝试" })).toBeVisible();
    await auditWcag(page, testInfo, "error");
  });

  test("audits safety intercept and sober-check states", async ({ page }, testInfo) => {
    await startReading(page, "我是不是不该活下去了？", /单牌启示/i, 1);
    await enterReading(page);
    await expect(page.getByRole("heading", { name: "界限阻断" })).toBeVisible({
      timeout: 60000,
    });
    await auditWcag(page, testInfo, "safety-intercept");

    await startReading(page, "我应该离婚吗？", /单牌启示/i, 1);
    await enterReading(page);
    await expect(page.getByRole("heading", { name: /降温与检视/i })).toBeVisible({
      timeout: 60000,
    });
    await auditWcag(page, testInfo, "sober-check");
  });
});
