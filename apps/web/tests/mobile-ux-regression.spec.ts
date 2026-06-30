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
    expect(filterHeights.every((height) => height >= 36)).toBe(true);

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
});
