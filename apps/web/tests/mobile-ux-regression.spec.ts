import { expect, test, type Page } from "@playwright/test";

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
  await page.waitForTimeout(250);
}

async function expectNoHorizontalOverflow(page: Page, tolerance = 2) {
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

test.describe("mobile UX regressions", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(
      /https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
      (route) => route.abort(),
    );
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("keeps suggested question chips readable and tap-friendly on the new ritual page", async ({
    page,
  }) => {
    await gotoAppRoute(page, "/new");

    const metrics = await page
      .getByTestId("suggested-prompt-list")
      .evaluate((list) => {
        const listRect = list.getBoundingClientRect();
        const buttons = Array.from(list.querySelectorAll("button")).map((button) => {
          const rect = button.getBoundingClientRect();
          return {
            bottom: rect.bottom,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
          };
        });

        return {
          buttons,
          clientWidth: list.clientWidth,
          listLeft: listRect.left,
          listRight: listRect.right,
          scrollWidth: list.scrollWidth,
        };
      });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2);
    expect(metrics.buttons.length).toBeGreaterThan(0);
    expect(metrics.buttons.every((button) => button.height >= 40)).toBe(true);
    expect(
      metrics.buttons.every(
        (button) =>
          button.left >= metrics.listLeft - 1
          && button.right <= metrics.listRight + 1,
      ),
    ).toBe(true);
    await expectNoHorizontalOverflow(page);
  });

  test("keeps encyclopedia filters tap-friendly and avoids nested vertical scroll on mobile", async ({
    page,
  }) => {
    await gotoAppRoute(page, "/encyclopedia");

    const filterHeights = await page
      .getByTestId("encyclopedia-filter-list")
      .locator("button")
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getBoundingClientRect().height),
      );

    expect(filterHeights.length).toBeGreaterThan(0);
    expect(filterHeights.every((height) => height >= 44)).toBe(true);

    const quickQuestionHeights = await page
      .getByTestId("encyclopedia-agent-panel")
      .getByRole("button")
      .evaluateAll((buttons) =>
        buttons.slice(0, 3).map((button) => button.getBoundingClientRect().height),
      );

    expect(quickQuestionHeights).toHaveLength(3);
    expect(quickQuestionHeights.every((height) => height >= 44)).toBe(true);

    const scrollContainers = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          "[data-testid='encyclopedia-content-pane'], [data-testid='runtime-card-grid']",
        ),
      ).map((element) => ({
        testId: element.dataset.testid,
        hasNestedVerticalScroll: element.scrollHeight > element.clientHeight + 4,
        overflowY: getComputedStyle(element).overflowY,
      })),
    );

    expect(scrollContainers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          hasNestedVerticalScroll: false,
          testId: "encyclopedia-content-pane",
        }),
        expect.objectContaining({
          hasNestedVerticalScroll: false,
          testId: "runtime-card-grid",
        }),
      ]),
    );
    await expectNoHorizontalOverflow(page);
  });

  test("uses one main landmark and renders mapped mobile icons", async ({ page }) => {
    await gotoAppRoute(page, "/");

    await expect(page.locator("main")).toHaveCount(1);
    await page.getByRole("button", { name: "打开菜单" }).click();
    await expect(page.locator(".lucide-circle-help:visible")).toHaveCount(0);

    await gotoAppRoute(page, "/login");
    await expect(page.locator("main")).toHaveCount(1);

    await gotoAppRoute(page, "/admin");
    await expect(page.locator("main")).toHaveCount(1);

    const adminFilterHeights = await page
      .getByRole("link", { name: /^(今日|近 7 日|近 30 日)$/ })
      .evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));
    expect(adminFilterHeights).toHaveLength(3);
    expect(adminFilterHeights.every((height) => height >= 44)).toBe(true);

    await gotoAppRoute(page, "/encyclopedia");
    await expect(page.locator(".lucide-circle-help:visible")).toHaveCount(0);
  });

  test("keeps the quick draw stop entry at a 44px touch target", async ({ page }) => {
    await gotoAppRoute(page, "/new");

    await page
      .getByTestId("new-reading-mobile-actions")
      .getByRole("button", { name: "当下之镜 →" })
      .click();
    const dialog = page.getByRole("dialog", { name: "当下之镜" });
    const flipButton = dialog.getByRole("button", { name: "点击卡牌，翻开牌面", exact: true });
    await expect(flipButton).toBeVisible();
    await flipButton.click();
    await expect(dialog.locator("#quick-draw-card-title")).toBeVisible();

    const stopButton = dialog.getByRole("button", { name: "先停在这里" });
    await expect(stopButton).toBeVisible();
    const stopRect = await stopButton.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { height: Math.round(rect.height), width: Math.round(rect.width) };
    });
    expect(stopRect.height).toBeGreaterThanOrEqual(44);
    expect(stopRect.width).toBeGreaterThanOrEqual(44);
  });

  test("keeps the mobile reading action bar compact with one primary CTA", async ({
    page,
  }) => {
    await gotoAppRoute(page, "/new");

    const actions = page.getByTestId("new-reading-mobile-actions");
    const startButton = actions.getByRole("button", { name: /^按住确认，进入抽牌 →$/ });
    const quickButton = actions.getByRole("button", { name: "当下之镜 →" });

    await expect(startButton).toBeVisible();
    await expect(quickButton).toBeVisible();

    const barMetrics = await actions.evaluate((element) => {
      const start = element.querySelector<HTMLButtonElement>(".new-reading-start-button");
      const quick = element.querySelector<HTMLButtonElement>(".new-reading-quick-button");
      if (!start || !quick) {
        throw new Error("Mobile action buttons are missing");
      }
      const pageEl = document.querySelector(".new-reading-page");
      if (!pageEl) {
        throw new Error("New reading page container is missing");
      }
      return {
        barHeight: element.getBoundingClientRect().height,
        paddingBottom: Number.parseFloat(getComputedStyle(pageEl).paddingBottom),
        quickBorderTopWidth: getComputedStyle(quick).borderTopWidth,
        startBorderTopWidth: getComputedStyle(start).borderTopWidth,
        startHeight: start.getBoundingClientRect().height,
      };
    });

    // Compact bar target (~96-112px, excluding the safe area), with enough
    // page reserve that no content hides behind the fixed bar.
    expect(barMetrics.barHeight).toBeLessThanOrEqual(125);
    expect(barMetrics.barHeight).toBeGreaterThanOrEqual(85);
    expect(barMetrics.paddingBottom).toBeGreaterThanOrEqual(barMetrics.barHeight + 20);
    expect(barMetrics.quickBorderTopWidth).toBe("0px");
    expect(barMetrics.startBorderTopWidth).not.toBe("0px");
    expect(barMetrics.startHeight).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalOverflow(page);
  });

  test("keeps the mobile action bar usable at 320x568 and under 200% zoom", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await gotoAppRoute(page, "/new");

    const actions = page.getByTestId("new-reading-mobile-actions");
    await expect(actions).toBeInViewport();

    const measure = () =>
      actions.evaluate((element) => {
        const start = element.querySelector<HTMLButtonElement>(".new-reading-start-button");
        const quick = element.querySelector<HTMLButtonElement>(".new-reading-quick-button");
        if (!start || !quick) {
          throw new Error("Mobile action buttons are missing");
        }
        const startRect = start.getBoundingClientRect();
        const quickRect = quick.getBoundingClientRect();
        return {
          barHeight: element.getBoundingClientRect().height,
          startHeight: startRect.height,
          startWidth: startRect.width,
          quickHeight: quickRect.height,
        };
      });

    // Native 320x568: one compact row; the primary CTA keeps usable width.
    const unzoomed = await measure();
    expect(unzoomed.barHeight).toBeLessThanOrEqual(98);
    expect(unzoomed.startWidth).toBeGreaterThanOrEqual(150);
    expect(unzoomed.startHeight).toBeLessThanOrEqual(60);
    await expectNoHorizontalOverflow(page);

    // 200% CSS zoom on the smallest supported phone: the secondary entry
    // must wrap below instead of squeezing the primary CTA into a tall
    // multi-line sliver (regression: the bar once covered ~69% of the
    // viewport with an 85px-wide primary button).
    await page.evaluate(() => {
      document.documentElement.style.zoom = "200%";
    });
    await expect
      .poll(async () => (await measure()).barHeight, { timeout: 5000 })
      .toBeLessThanOrEqual(568 * 0.45);

    const zoomed = await measure();
    expect(zoomed.barHeight).toBeLessThanOrEqual(568 * 0.45);
    expect(zoomed.startWidth).toBeGreaterThanOrEqual(200);
    expect(zoomed.startHeight).toBeLessThanOrEqual(160);
    expect(zoomed.quickHeight).toBeGreaterThanOrEqual(80);
    await expectNoHorizontalOverflow(page);
  });

  test("keeps search and selection intact when returning from an encyclopedia detail", async ({
    page,
  }) => {
    await gotoAppRoute(page, "/encyclopedia");

    const searchInput = page.getByLabel("搜索卡牌");
    await searchInput.fill("宝剑二");
    const grid = page.getByTestId("runtime-card-grid");
    const selectedCardButton = grid.getByRole("button", { name: "宝剑二" });
    await expect(selectedCardButton).toBeVisible();
    await selectedCardButton.click();

    const backEntry = page.getByTestId("encyclopedia-back-to-grid");
    await expect(backEntry).toBeInViewport();
    await expect(backEntry).toContainText("宝剑二");

    await backEntry.getByRole("button", { name: "返回选牌" }).click();
    await expect(selectedCardButton).toBeFocused();
    await expect(selectedCardButton).toBeInViewport();
    await expect(searchInput).toHaveValue("宝剑二");
    await expect(page).toHaveURL(/card=two-of-swords/);
    await expectNoHorizontalOverflow(page);
  });
});
