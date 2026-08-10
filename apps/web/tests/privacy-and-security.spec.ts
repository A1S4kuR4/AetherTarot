import { expect, test } from "@playwright/test";

test.describe("privacy and response security", () => {
  test("publishes the privacy notice with global security headers", async ({ page }) => {
    const response = await page.goto("/privacy", { waitUntil: "domcontentloaded" });

    expect(response).not.toBeNull();
    expect(response?.headers()["x-powered-by"]).toBeUndefined();
    expect(response?.headers()["strict-transport-security"]).toBe(
      "max-age=31536000; includeSubDomains",
    );
    expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response?.headers()["x-frame-options"]).toBe("DENY");
    expect(response?.headers()["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(response?.headers()["permissions-policy"]).toContain("camera=()");
    expect(response?.headers()["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );

    await expect(
      page.getByRole("heading", { level: 1, name: "使用与隐私说明" }),
    ).toBeVisible();
    await expect(page.getByText("这是反思工具，不是确定性预言")).toBeVisible();
    await expect(page.getByText("模型与服务提供方")).toBeVisible();
    await expect(page.getByText("你的选择与请求")).toBeVisible();
  });

  test("keeps the privacy notice reachable from desktop and mobile navigation", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "使用与隐私", exact: true }).click();
    await expect(page).toHaveURL(/\/privacy$/);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "打开菜单" }).click();
    await page.getByRole("link", { name: "使用与隐私", exact: true }).click();
    await expect(page).toHaveURL(/\/privacy$/);
  });
});
