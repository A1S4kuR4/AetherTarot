import { test, chromium } from "@playwright/test";
import { playAudit } from "playwright-lighthouse";

test("Lighthouse performance audit for main pages", async () => {
  // Use a separate browser instance with remote-debugging-port for lighthouse
  const browser = await chromium.launch({
    args: ["--remote-debugging-port=9222"],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Audit Home Page
  await page.goto("https://aethertarot.cn/");
  await playAudit({
    page: page,
    thresholds: {
      performance: 50,
      accessibility: 50,
      "best-practices": 50,
      seo: 50,
    },
    port: 9222,
    reports: {
      formats: {
        html: true,
      },
      name: "lighthouse-home",
      directory: "test-results",
    },
  });

  // Audit Login Page
  await page.goto("https://aethertarot.cn/login");
  await playAudit({
    page: page,
    thresholds: {
      performance: 50,
      accessibility: 50,
      "best-practices": 50,
      seo: 50,
    },
    port: 9222,
    reports: {
      formats: {
        html: true,
      },
      name: "lighthouse-login",
      directory: "test-results",
    },
  });

  await browser.close();
});
