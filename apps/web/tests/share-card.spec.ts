import { expect, test, type Page } from "@playwright/test";
import type { StructuredReading } from "@aethertarot/shared-types";

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

const CARD_TEMPLATES = [
  { card_id: "fool", name: "愚人", english_name: "The Fool" },
  { card_id: "magician", name: "魔术师", english_name: "The Magician" },
  {
    card_id: "high_priestess",
    name: "女祭司",
    english_name: "The High Priestess",
  },
  { card_id: "empress", name: "皇后", english_name: "The Empress" },
  { card_id: "emperor", name: "皇帝", english_name: "The Emperor" },
  { card_id: "hierophant", name: "教皇", english_name: "The Hierophant" },
  { card_id: "lovers", name: "恋人", english_name: "The Lovers" },
  { card_id: "chariot", name: "战车", english_name: "The Chariot" },
  { card_id: "strength", name: "力量", english_name: "Strength" },
  { card_id: "hermit", name: "隐士", english_name: "The Hermit" },
];

function createMockReading(
  overrides: Partial<StructuredReading> = {},
): StructuredReading {
  const cardCount = overrides.cards?.length ?? 1;
  const cards =
    overrides.cards ??
    CARD_TEMPLATES.slice(0, cardCount).map((template, index) => ({
      card_id: template.card_id,
      name: template.name,
      english_name: template.english_name,
      orientation:
        index % 2 === 0 ? ("upright" as const) : ("reversed" as const),
      position_id: `pos-${index}`,
      position: `位置 ${index + 1}`,
      position_meaning: `位置 ${index + 1} 的含义`,
      interpretation: `位置 ${index + 1} 的解读内容。`,
    }));

  const positions = cards.map((card, index) => ({
    id: `pos-${index}`,
    name: `位置 ${index + 1}`,
    description: `位置 ${index + 1} 描述`,
  }));

  return {
    reading_id: "share-test-reading",
    locale: "zh-CN",
    question: "我现在最该注意什么？",
    question_type: "self_growth",
    agent_profile: "lite",
    reading_phase: "initial",
    requires_followup: false,
    initial_reading_id: null,
    followup_answers: null,
    spread: {
      id: "custom",
      name: `${cards.length} 张测试牌阵`,
      englishName: "Test Spread",
      description: "测试布局用牌阵",
      icon: "style",
      positions,
    },
    cards,
    themes: ["起点", "开放", "信任"],
    synthesis:
      "这张牌显示你正处于一个全新的起点，周围充满未知但也充满可能性。你不必立刻看清整条路，只需要带着信任迈出下一步。",
    reflective_guidance: [
      "留意那些让你感到轻盈但尚未命名的冲动。",
      "不要因为想看清结局而迟迟不开始。",
      "今天可以尝试一件小事，测试自己的直觉。",
    ],
    follow_up_questions: [],
    safety_note: "本解读用于反思与启发，不替代专业建议。",
    confidence_note: "单牌解读聚焦当下状态，请结合自身现实判断。",
    session_capsule: null,
    sober_check: null,
    presentation_mode: "standard",
    ...overrides,
  };
}

async function startQuickReading(page: Page, reading: StructuredReading) {
  await page.route("**/api/reading", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(reading),
    });
  });

  await gotoAppRoute(page, "/new");
  await page
    .getByPlaceholder("今天，你想向内心询问什么？")
    .fill(reading.question);
  await page.getByRole("button", { name: "快速解读" }).click();
  await expect(page).toHaveURL(/\/reading$/, { timeout: 10000 });
}

test.beforeEach(async ({ page }) => {
  await page.route(
    /https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
    (route) => route.abort(),
  );
});

test.describe("share card feature", () => {
  test("serves a self-contained GB2312 share-font embed stylesheet", async ({
    request,
  }) => {
    const response = await request.get(
      "/fonts/aether-serif/aether-serif-share-embed.css",
    );
    expect(response.ok()).toBe(true);

    const css = await response.text();
    expect(css).toContain("data:font/woff2;base64,");
    expect(css).not.toMatch(/url\(["']?\.\//);
    expect(css).toMatch(/U\+554A(?:[,;}\-])/i);
  });

  test("share button appears after a completed lite reading", async ({
    page,
  }) => {
    const reading = createMockReading();
    await startQuickReading(page, reading);

    await expect(page.getByRole("button", { name: "分享" })).toBeVisible({
      timeout: 10000,
    });
  });

  test("share button is hidden when reading requires follow-up", async ({
    page,
  }) => {
    const reading = createMockReading({
      requires_followup: true,
      reading_phase: "initial",
      follow_up_questions: ["你最近是否正在经历某种具体变化？"],
    });
    await startQuickReading(page, reading);

    await expect(page.getByRole("button", { name: "分享" })).toBeHidden({
      timeout: 10000,
    });
  });

  test("sober_check restricts sharing to minimal mode", async ({ page }) => {
    const reading = createMockReading({
      agent_profile: "standard",
      reading_phase: "final",
      sober_check: "这个决定是否涉及重大现实承诺？请用一句话说明。",
    });
    await startQuickReading(page, reading);

    await expect(page.getByText("降温与检视")).toBeVisible();
    await page
      .getByPlaceholder("我的真实顾虑 / 底线计划是...")
      .fill("我需要先确认自己的真实底线。");
    await page.getByRole("button", { name: "确认并解开牌面" }).click();

    await expect(page.getByRole("button", { name: "分享" })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("button", { name: "分享" }).click();

    const dialog = page.getByRole("dialog", { name: "分享这张解读" });
    await expect(dialog).toBeVisible();

    await expect(
      dialog.getByRole("button", { name: "解读摘要卡" }),
    ).toBeDisabled();

    await expect(
      dialog.getByText("本次解读包含现实决策提醒，暂不支持分享完整解读。"),
    ).toBeVisible();
  });

  test("generates a 1200x1800 PNG preview", async ({ page }) => {
    const reading = createMockReading();
    await startQuickReading(page, reading);

    await page.getByRole("button", { name: "分享" }).click();

    const dialog = page.getByRole("dialog", { name: "分享这张解读" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "生成图片" }).click();

    const preview = dialog.locator('img[alt="分享卡预览"]');
    await expect(preview).toBeVisible({ timeout: 15000 });

    const naturalWidth = await preview.evaluate(
      (el) => (el as HTMLImageElement).naturalWidth,
    );
    const naturalHeight = await preview.evaluate(
      (el) => (el as HTMLImageElement).naturalHeight,
    );

    expect(naturalWidth).toBe(1200);
    expect(naturalHeight).toBe(1800);
  });

  test("returns focus to the share button after closing the dialog", async ({
    page,
  }) => {
    const reading = createMockReading();
    await startQuickReading(page, reading);

    const shareButton = page.getByRole("button", { name: "分享" });
    await shareButton.click();

    const dialog = page.getByRole("dialog", { name: "分享这张解读" });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await expect(shareButton).toBeFocused();
  });

  for (const cardCount of [1, 3, 7, 10]) {
    test(`keeps ${cardCount} card items and footer within the share card`, async ({
      page,
    }) => {
      const reading = createMockReading({ cards: undefined });
      reading.cards = CARD_TEMPLATES.slice(0, cardCount).map(
        (template, index) => ({
          card_id: template.card_id,
          name: template.name,
          english_name: template.english_name,
          orientation:
            index % 2 === 0 ? ("upright" as const) : ("reversed" as const),
          position_id: `pos-${index}`,
          position: `位置 ${index + 1}`,
          position_meaning: `位置 ${index + 1} 的含义`,
          interpretation: `位置 ${index + 1} 的解读内容。`,
        }),
      );
      reading.spread.positions = reading.cards.map((card) => ({
        id: card.position_id,
        name: card.position,
        description: `${card.position} 描述`,
      }));

      await startQuickReading(page, reading);
      await page.getByRole("button", { name: "分享" }).click();

      const dialog = page.getByRole("dialog", { name: "分享这张解读" });

      await dialog.getByRole("button", { name: "解读摘要卡" }).click();
      page.once("dialog", (d) => d.accept());
      await dialog.getByRole("button", { name: "生成图片" }).click();

      const preview = dialog.locator('img[alt="分享卡预览"]');
      await expect(preview).toBeVisible({ timeout: 15000 });

      const naturalWidth = await preview.evaluate(
        (el) => (el as HTMLImageElement).naturalWidth,
      );
      const naturalHeight = await preview.evaluate(
        (el) => (el as HTMLImageElement).naturalHeight,
      );

      expect(naturalWidth).toBe(1200);
      expect(naturalHeight).toBe(1800);

      // Verify the off-screen card keeps all key elements inside the 600x900 stage.
      const card = page.locator('[data-testid="reading-share-card"]').first();
      const footer = page
        .locator('[data-testid="reading-share-card"] footer')
        .first();
      const cardItems = card.locator('[data-testid="reading-share-card-item"]');
      const cardBox = await card.boundingBox();
      const footerBox = await footer.boundingBox();

      expect(cardBox).not.toBeNull();
      expect(footerBox).not.toBeNull();
      await expect(cardItems).toHaveCount(cardCount);

      if (cardBox && footerBox) {
        expect(footerBox.x).toBeGreaterThanOrEqual(cardBox.x - 1);
        expect(footerBox.x + footerBox.width).toBeLessThanOrEqual(
          cardBox.x + cardBox.width + 1,
        );
        expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(
          cardBox.y + cardBox.height + 1,
        );

        for (const item of await cardItems.all()) {
          const itemBox = await item.boundingBox();
          expect(itemBox).not.toBeNull();
          if (itemBox) {
            expect(itemBox.x).toBeGreaterThanOrEqual(cardBox.x - 1);
            expect(itemBox.x + itemBox.width).toBeLessThanOrEqual(
              cardBox.x + cardBox.width + 1,
            );
            expect(itemBox.y).toBeGreaterThanOrEqual(cardBox.y - 1);
            expect(itemBox.y + itemBox.height).toBeLessThanOrEqual(
              footerBox.y + 1,
            );
          }
        }
      }
    });
  }

  test("keeps safety note visible with long synthesis", async ({ page }) => {
    const reading = createMockReading({
      synthesis:
        "这是一段非常长的综合解读文本，用于测试内容溢出时的安全边界。".repeat(
          20,
        ),
      safety_note:
        "安全提醒：本解读仅供反思，不能替代医疗、法律或财务专业建议。",
    });
    await startQuickReading(page, reading);

    await page.getByRole("button", { name: "分享" }).click();

    const dialog = page.getByRole("dialog", { name: "分享这张解读" });
    await dialog.getByRole("button", { name: "解读摘要卡" }).click();
    page.once("dialog", (d) => d.accept());
    await dialog.getByRole("button", { name: "生成图片" }).click();

    const preview = dialog.locator('img[alt="分享卡预览"]');
    await expect(preview).toBeVisible({ timeout: 15000 });

    // Verify the safety note element inside the share card is fully visible.
    const card = page.locator('[data-testid="reading-share-card"]').first();
    const summary = card.locator('[data-testid="reading-share-summary"]');
    const safetyNote = page
      .locator(
        '[data-testid="reading-share-card"] [data-testid="reading-share-safety-note"]',
      )
      .first();
    await expect(safetyNote).toBeVisible();
    await expect(
      card.locator('[data-testid="reading-share-guidance"]'),
    ).toHaveCount(0);

    const cardBox = await card.boundingBox();
    const summaryBox = await summary.boundingBox();
    const safetyBox = await safetyNote.boundingBox();

    expect(cardBox).not.toBeNull();
    expect(summaryBox).not.toBeNull();
    expect(safetyBox).not.toBeNull();

    if (cardBox && summaryBox && safetyBox) {
      expect(safetyBox.y).toBeGreaterThanOrEqual(cardBox.y - 1);
      expect(safetyBox.y + safetyBox.height).toBeLessThanOrEqual(
        cardBox.y + cardBox.height + 1,
      );
      expect(safetyBox.y).toBeGreaterThanOrEqual(summaryBox.y - 1);
      expect(safetyBox.y + safetyBox.height).toBeLessThanOrEqual(
        summaryBox.y + summaryBox.height + 1,
      );
    }
  });
});
