import { expect, test } from "@playwright/test";

test("encyclopedia renders safety intercepts as a dedicated reality-safety panel", async ({
  page,
}) => {
  await page.route("**/api/encyclopedia/query", async (route) => {
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "safety_intercept",
          message: "问题触发了高风险安全界限保护。",
          intercept_reason: "请先回到现实安全与支持。",
          referral_links: ["https://example.test/safety-resource"],
        },
      }),
    });
  });

  await page.goto("/encyclopedia?card=fool", {
    waitUntil: "domcontentloaded",
  });
  const panel = page.getByTestId("encyclopedia-agent-panel");
  await expect(panel).toBeVisible();
  await panel.getByRole("textbox", { name: "向塔罗百科提问" }).fill(
    "高风险测试问题",
  );
  await panel.getByRole("button", { name: "提问" }).click();

  const intercept = page.getByTestId("encyclopedia-safety-intercept");
  await expect(intercept).toBeVisible();
  await expect(intercept).toContainText("现实安全优先");
  await expect(intercept).toContainText("请先回到现实安全与支持");
  await expect(intercept.getByRole("link")).toHaveAttribute(
    "href",
    "https://example.test/safety-resource",
  );
  await expect(page.getByTestId("encyclopedia-agent-answer")).toHaveCount(0);
});
