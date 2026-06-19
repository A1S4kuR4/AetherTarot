import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  collectProductionReadinessChecks,
  formatReadinessReport,
} from "./production-readiness-check.mjs";

const fullEnv = {
  NODE_ENV: "production",
  NEXT_PUBLIC_SITE_URL: "https://aethertarot.example",
  AUTH_SECRET: "fake-auth-secret-value",
  AUTH_URL: "https://aethertarot.example",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "fake-service-role-secret",
  AETHERTAROT_READING_PROVIDER: "placeholder",
  AETHERTAROT_ENCYCLOPEDIA_PROVIDER: "disabled",
  AETHERTAROT_IP_HASH_SALT: "fake-ip-hash-salt",
  AETHERTAROT_READING_DAILY_LIMIT_PER_USER: "10",
  AETHERTAROT_ENCYCLOPEDIA_DAILY_LIMIT_PER_USER: "20",
  AETHERTAROT_LLM_IP_LIMIT_PER_MINUTE: "6",
  AETHERTAROT_LLM_DAILY_TOKEN_LIMIT: "200000",
  AETHERTAROT_AUTH_EMAIL_HOURLY_LIMIT_PER_EMAIL: "3",
  AETHERTAROT_AUTH_EMAIL_DAILY_LIMIT_PER_EMAIL: "10",
  AETHERTAROT_AUTH_EMAIL_HOURLY_LIMIT_PER_IP: "10",
  AETHERTAROT_AUTH_EMAIL_HOURLY_LIMIT_GLOBAL: "50",
};

test("missing required env reports variable names without values", async () => {
  const repoRoot = makeRepoFixture();

  const result = await collectProductionReadinessChecks({
    repoRoot,
    env: {},
    nodeVersion: "v22.11.0",
    origin: "https://aethertarot.example",
  });
  const report = formatReadinessReport(result);

  assert.equal(result.ok, false);
  assert.match(report, /NODE_ENV/);
  assert.match(report, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(report, /AETHERTAROT_IP_HASH_SALT/);
  assert.doesNotMatch(report, /fake-service-role-secret/);
});

test("Next build artifact checks fail when required build outputs are missing", async () => {
  const repoRoot = makeRepoFixture({ includeBuild: false });

  const result = await collectProductionReadinessChecks({
    repoRoot,
    env: fullEnv,
    nodeVersion: "v22.11.0",
    origin: "https://aethertarot.example",
  });
  const report = formatReadinessReport(result);

  assert.equal(result.ok, false);
  assert.match(report, /apps\/web\/\.next\/BUILD_ID/);
  assert.match(report, /apps\/web\/\.next\/server/);
  assert.match(report, /apps\/web\/\.next\/diagnostics\/route-bundle-stats\.json/);
});

test("cardsV2, reveal, and thumbs checks catch missing derived assets", async () => {
  const repoRoot = makeRepoFixture({
    missingFiles: [
      "apps/web/public/cardsV2/major_0_fool.png",
      "apps/web/public/cardsV2/reveal/major_0_fool.webp",
      "apps/web/public/cardsV2/thumbs/major_0_fool.webp",
    ],
  });

  const result = await collectProductionReadinessChecks({
    repoRoot,
    env: fullEnv,
    nodeVersion: "v22.11.0",
    origin: "https://aethertarot.example",
  });
  const report = formatReadinessReport(result);

  assert.equal(result.ok, false);
  assert.match(report, /cardsV2\/major_0_fool\.png/);
  assert.match(report, /cardsV2\/reveal\/major_0_fool\.webp/);
  assert.match(report, /cardsV2\/thumbs\/major_0_fool\.webp/);
});

test("prewarm URL check reuses production prewarm URL construction", async () => {
  const repoRoot = makeRepoFixture();

  const result = await collectProductionReadinessChecks({
    repoRoot,
    env: fullEnv,
    nodeVersion: "v22.11.0",
    origin: "https://mainland-beta.example",
  });

  assert.equal(result.ok, true);
  assert.ok(result.prewarmUrls.includes("https://mainland-beta.example/"));
  assert.ok(result.prewarmUrls.includes("https://mainland-beta.example/reading"));
  assert.ok(
    result.prewarmUrls.includes(
      "https://mainland-beta.example/_next/static/chunks/shared.js",
    ),
  );
  assert.ok(
    result.prewarmUrls.includes(
      "https://mainland-beta.example/_next/static/chunks/reading.js",
    ),
  );
  assert.ok(
    result.prewarmUrls.includes(
      "https://mainland-beta.example/_next/image?url=%2FcardsV2%2Freveal%2Fmajor_0_fool.webp&w=384&q=75",
    ),
  );
});

test("formatted report never includes secret values", async () => {
  const repoRoot = makeRepoFixture();
  const env = {
    ...fullEnv,
    AETHERTAROT_READING_PROVIDER: "llm",
    AETHERTAROT_LLM_BASE_URL: "https://llm.example",
    AETHERTAROT_LLM_MODEL: "deepseek-test",
    AETHERTAROT_LLM_API_KEY: "sk-test-secret-value",
    AETHERTAROT_LLM_THINKING_MODE: "disabled",
    AETHERTAROT_LLM_RESPONSE_FORMAT: "json_object",
    AETHERTAROT_LLM_TEMPERATURE: "0.3",
    AETHERTAROT_LLM_TIMEOUT_MS: "120000",
    AETHERTAROT_LLM_MAX_OUTPUT_TOKENS: "1800",
    PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----",
  };

  const result = await collectProductionReadinessChecks({
    repoRoot,
    env,
    nodeVersion: "v22.11.0",
    origin: "https://aethertarot.example",
  });
  const report = formatReadinessReport(result);

  assert.equal(result.ok, true);
  assert.doesNotMatch(report, /fake-auth-secret-value/);
  assert.doesNotMatch(report, /fake-service-role-secret/);
  assert.doesNotMatch(report, /fake-ip-hash-salt/);
  assert.doesNotMatch(report, /sk-test-secret-value/);
  assert.doesNotMatch(report, /BEGIN PRIVATE KEY/);
});

function makeRepoFixture({ includeBuild = true, missingFiles = [] } = {}) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aethertarot-ready-"));
  const deckPath = path.join(repoRoot, "data/decks/rider-waite-smith.json");
  const cardsRoot = path.join(repoRoot, "apps/web/public/cardsV2");
  const revealRoot = path.join(cardsRoot, "reveal");
  const thumbsRoot = path.join(cardsRoot, "thumbs");

  writeJson(deckPath, [
    {
      id: "fool",
      imageUrl: "/cardsV2/major_0_fool.png",
      thumbnailUrl: "/cardsV2/thumbs/major_0_fool.webp",
    },
  ]);
  writeFile(path.join(cardsRoot, "major_0_fool.png"), "png");
  writeFile(path.join(revealRoot, "major_0_fool.webp"), "webp");
  writeFile(path.join(thumbsRoot, "major_0_fool.webp"), "webp");

  if (includeBuild) {
    writeFile(path.join(repoRoot, "apps/web/.next/BUILD_ID"), "test-build");
    writeJson(path.join(repoRoot, "apps/web/.next/required-server-files.json"), {});
    writeJson(path.join(repoRoot, "apps/web/.next/routes-manifest.json"), {});
    writeJson(path.join(repoRoot, "apps/web/.next/build-manifest.json"), {});
    writeFile(path.join(repoRoot, "apps/web/.next/server/.keep"), "");
    writeFile(path.join(repoRoot, "apps/web/.next/static/.keep"), "");
    writeJson(path.join(repoRoot, "apps/web/.next/diagnostics/route-bundle-stats.json"), [
      {
        route: "/reading",
        firstLoadChunkPaths: [
          ".next/static/chunks/shared.js",
          ".next/static/chunks/reading.js",
        ],
      },
    ]);
  }

  for (const filePath of missingFiles) {
    fs.rmSync(path.join(repoRoot, filePath), { force: true });
  }

  return repoRoot;
}

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function writeJson(filePath, value) {
  writeFile(filePath, JSON.stringify(value, null, 2));
}
