import { expect, test } from "@playwright/test";

test.skip(
  process.env.AETHERTAROT_ALLOW_REMOTE_E2E !== "1",
  "Production negative-auth tests require explicit remote approval.",
);

test("handles invalid credentials gracefully", async ({ page }) => {
  await page.goto("https://aethertarot.cn/login");
  await page.fill("#email", "wrong@example.com");
  await page.fill("#password", "WrongPass123!");
  await page.locator("button[type='submit']").click();

  const errorMessage = page.getByText("邮箱或密码错误，请重试。");
  await expect(errorMessage).toBeVisible({ timeout: 10000 });
});


