import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const baseUrlHost = new URL(baseURL).hostname;
const isLoopbackBaseUrl = ["127.0.0.1", "localhost", "::1"].includes(baseUrlHost);
const isRemoteE2eApproved = process.env.AETHERTAROT_ALLOW_REMOTE_E2E === "1";

if (!isLoopbackBaseUrl && !isRemoteE2eApproved) {
  throw new Error(
    "Refusing to run E2E against a non-loopback URL. Set AETHERTAROT_ALLOW_REMOTE_E2E=1 only for an explicitly approved remote target.",
  );
}

export default defineConfig({
  testDir: "./tests",
  testIgnore: isRemoteE2eApproved ? [] : ["**/prod-*.spec.ts"],
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
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    command:
      process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ??
      "npm run dev -- --hostname 127.0.0.1 --port 3000",
    env: {
      ...process.env,
      AETHERTAROT_LOCAL_ONLY: "1",
      AETHERTAROT_LOCAL_ONLY_ENCYCLOPEDIA_UI: "1",
      AETHERTAROT_E2E_BYPASS_BETA_ACCESS: "1",
      AETHERTAROT_READING_PROVIDER: "placeholder",
      AETHERTAROT_ENCYCLOPEDIA_PROVIDER: "llm",
      AETHERTAROT_LLM_BASE_URL: "http://127.0.0.1:9/v1",
      AETHERTAROT_LLM_API_KEY: "",
      AUTH_SECRET: "aethertarot-local-e2e-auth-secret",
    },
    url: baseURL,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "1",
    timeout: 120 * 1000,
  },
});
