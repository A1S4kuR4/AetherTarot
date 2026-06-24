import { expect, test } from "@playwright/test";

test("handles invalid credentials gracefully", async ({ page }) => {
  await page.goto("https://aethertarot.cn/login");
  await page.fill("#email", "wrong@example.com");
  await page.fill("#password", "WrongPass123!");
  await page.locator("button[type='submit']").click();

  const errorMessage = page.getByText("邮箱或密码错误，请重试。");
  await expect(errorMessage).toBeVisible({ timeout: 10000 });
});


