import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 60 * 1000,
  retries: process.env.CI ? 2 : 0,
  reporter:
    process.env.PLAYWRIGHT_HTML_REPORT === "0"
      ? "list"
      : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    extraHTTPHeaders: {
      "x-aethertarot-e2e-access": "1",
    },
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ??
      "npm run dev -- --hostname 127.0.0.1 --port 3000",
    env: {
      ...process.env,
      AETHERTAROT_E2E_BYPASS_BETA_ACCESS: "1",
      AETHERTAROT_READING_PROVIDER: "placeholder",
    },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
