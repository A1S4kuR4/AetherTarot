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
  AUTH_SECRET: "f8N6xQ2mV9rT4kP7sL3cD5wY8uH1jB0z",
  AUTH_URL: "https://aethertarot.example",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "fake-service-role-secret",
  AETHERTAROT_READING_PROVIDER: "placeholder",
  AETHERTAROT_ENCYCLOPEDIA_PROVIDER: "disabled",
  AETHERTAROT_READING_GENERATION_MODE: "monolithic",
  AETHERTAROT_IP_HASH_SALT: "production-ip-hash-salt-value-123456789",
  AETHERTAROT_PROXY_SHARED_SECRET: "production-proxy-secret-value-123456789",
  AETHERTAROT_READING_DAILY_LIMIT_PER_USER: "10",
  AETHERTAROT_READING_DAILY_LIMIT_PER_ANONYMOUS_IP: "3",
  AETHERTAROT_ENCYCLOPEDIA_DAILY_LIMIT_PER_USER: "20",
  AETHERTAROT_ENCYCLOPEDIA_DAILY_LIMIT_PER_ANONYMOUS_IP: "1",
  AETHERTAROT_LLM_IP_LIMIT_PER_MINUTE: "6",
  AETHERTAROT_LLM_DAILY_TOKEN_LIMIT: "200000",
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
    AETHERTAROT_LLM_MAX_RESPONSE_BYTES: "1048576",
    AETHERTAROT_LLM_MAX_CONCURRENCY: "4",
    AETHERTAROT_LLM_MAX_QUEUE: "16",
    AETHERTAROT_LLM_QUEUE_TIMEOUT_MS: "15000",
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
  assert.doesNotMatch(report, /f8N6xQ2mV9rT4kP7sL3cD5wY8uH1jB0z/);
  assert.doesNotMatch(report, /fake-service-role-secret/);
  assert.doesNotMatch(report, /production-ip-hash-salt/);
  assert.doesNotMatch(report, /sk-test-secret-value/);
  assert.doesNotMatch(report, /BEGIN PRIVATE KEY/);
});

test("env validation rejects bad URLs, numeric ranges, and unresolved references", async () => {
  const repoRoot = makeRepoFixture();
  const result = await collectProductionReadinessChecks({
    repoRoot,
    env: {
      ...fullEnv,
      NEXT_PUBLIC_SITE_URL: "http://insecure.example",
      AETHERTAROT_READING_DAILY_LIMIT_PER_ANONYMOUS_IP: "0",
      AETHERTAROT_READING_PROVIDER: "llm",
      AETHERTAROT_LLM_BASE_URL: "not-a-url",
      AETHERTAROT_LLM_MODEL: "model",
      AETHERTAROT_LLM_API_KEY: "$MISSING_KEY",
      AETHERTAROT_LLM_THINKING_MODE: "disabled",
      AETHERTAROT_LLM_RESPONSE_FORMAT: "json_object",
      AETHERTAROT_LLM_TEMPERATURE: "0.3",
      AETHERTAROT_LLM_TIMEOUT_MS: "120000",
      AETHERTAROT_LLM_MAX_OUTPUT_TOKENS: "1800",
      AETHERTAROT_LLM_MAX_RESPONSE_BYTES: "99999999",
      AETHERTAROT_LLM_MAX_CONCURRENCY: "4",
      AETHERTAROT_LLM_MAX_QUEUE: "16",
      AETHERTAROT_LLM_QUEUE_TIMEOUT_MS: "15000",
    },
    nodeVersion: "v22.11.0",
  });
  const report = formatReadinessReport(result);
  assert.equal(result.ok, false);
  assert.match(report, /absolute HTTPS URL/);
  assert.match(report, /AETHERTAROT_LLM_MAX_RESPONSE_BYTES/);
  assert.match(report, /references a missing/);
});

test("env validation rejects placeholder and reused proxy/IP secrets", async () => {
  const repoRoot = makeRepoFixture();
  const same = "replace-me-production-secret-value-123456789";
  const result = await collectProductionReadinessChecks({
    repoRoot,
    env: { ...fullEnv, AETHERTAROT_PROXY_SHARED_SECRET: same, AETHERTAROT_IP_HASH_SALT: same },
    nodeVersion: "v22.11.0",
  });
  const report = formatReadinessReport(result);
  assert.equal(result.ok, false);
  assert.match(report, /placeholder/);
  assert.match(report, /must be different/);
});

test("env validation rejects weak AUTH_SECRET and an LLM deadline at the edge timeout", async () => {
  const repoRoot = makeRepoFixture();
  const result = await collectProductionReadinessChecks({
    repoRoot,
    env: {
      ...fullEnv,
      AUTH_SECRET: "replace-me-auth-secret",
      AETHERTAROT_READING_PROVIDER: "llm",
      AETHERTAROT_LLM_BASE_URL: "https://llm.example",
      AETHERTAROT_LLM_MODEL: "model",
      AETHERTAROT_LLM_API_KEY: "sk-test",
      AETHERTAROT_LLM_THINKING_MODE: "disabled",
      AETHERTAROT_LLM_RESPONSE_FORMAT: "json_object",
      AETHERTAROT_LLM_TEMPERATURE: "0.3",
      AETHERTAROT_LLM_TIMEOUT_MS: "130000",
      AETHERTAROT_LLM_MAX_OUTPUT_TOKENS: "1800",
      AETHERTAROT_LLM_MAX_RESPONSE_BYTES: "1048576",
      AETHERTAROT_LLM_MAX_CONCURRENCY: "4",
      AETHERTAROT_LLM_MAX_QUEUE: "16",
      AETHERTAROT_LLM_QUEUE_TIMEOUT_MS: "15000",
    },
    nodeVersion: "v22.11.0",
  });
  const report = formatReadinessReport(result);
  assert.equal(result.ok, false);
  assert.match(report, /AUTH_SECRET/);
  assert.match(report, /at least 32 characters|placeholder/);
  assert.match(report, /edge response timeout/);
});

test("env validation rejects unsupported providers before runtime", async () => {
  const repoRoot = makeRepoFixture();
  const result = await collectProductionReadinessChecks({
    repoRoot,
    env: {
      ...fullEnv,
      AETHERTAROT_READING_PROVIDER: "typo-provider",
      AETHERTAROT_ENCYCLOPEDIA_PROVIDER: "enabled",
    },
    nodeVersion: "v22.11.0",
  });
  const report = formatReadinessReport(result);

  assert.equal(result.ok, false);
  assert.match(report, /AETHERTAROT_READING_PROVIDER/);
  assert.match(report, /placeholder or llm/);
  assert.match(report, /AETHERTAROT_ENCYCLOPEDIA_PROVIDER/);
  assert.match(report, /disabled or llm/);
});

test("env validation rejects unsupported LLM enum values before runtime", async () => {
  const repoRoot = makeRepoFixture();
  const result = await collectProductionReadinessChecks({
    repoRoot,
    env: {
      ...fullEnv,
      AETHERTAROT_READING_PROVIDER: "llm",
      AETHERTAROT_LLM_BASE_URL: "https://llm.example",
      AETHERTAROT_LLM_MODEL: "model",
      AETHERTAROT_LLM_API_KEY: "sk-test",
      AETHERTAROT_LLM_THINKING_MODE: "sometimes",
      AETHERTAROT_LLM_RESPONSE_FORMAT: "text",
      AETHERTAROT_LLM_TEMPERATURE: "0.3",
      AETHERTAROT_LLM_TIMEOUT_MS: "120000",
      AETHERTAROT_LLM_MAX_OUTPUT_TOKENS: "1800",
      AETHERTAROT_LLM_MAX_RESPONSE_BYTES: "1048576",
      AETHERTAROT_LLM_MAX_CONCURRENCY: "4",
      AETHERTAROT_LLM_MAX_QUEUE: "16",
      AETHERTAROT_LLM_QUEUE_TIMEOUT_MS: "15000",
    },
    nodeVersion: "v22.11.0",
  });
  const report = formatReadinessReport(result);

  assert.equal(result.ok, false);
  assert.match(report, /AETHERTAROT_LLM_THINKING_MODE/);
  assert.match(report, /enabled or disabled/);
  assert.match(report, /AETHERTAROT_LLM_RESPONSE_FORMAT/);
  assert.match(report, /json_object/);
});

test("guest launch requires monolithic generation and bounds retained staged mode", async () => {
  const repoRoot = makeRepoFixture();
  const result = await collectProductionReadinessChecks({
    repoRoot,
    env: {
      ...fullEnv,
      AETHERTAROT_READING_PROVIDER: "llm",
      AETHERTAROT_READING_GENERATION_MODE: "adaptive_staged",
      AETHERTAROT_LLM_BASE_URL: "https://llm.example",
      AETHERTAROT_LLM_MODEL: "model",
      AETHERTAROT_LLM_API_KEY: "sk-test",
      AETHERTAROT_LLM_THINKING_MODE: "disabled",
      AETHERTAROT_LLM_RESPONSE_FORMAT: "json_object",
      AETHERTAROT_LLM_TEMPERATURE: "0.3",
      AETHERTAROT_LLM_TIMEOUT_MS: "40000",
      AETHERTAROT_LLM_MAX_OUTPUT_TOKENS: "1800",
      AETHERTAROT_LLM_MAX_RESPONSE_BYTES: "1048576",
      AETHERTAROT_LLM_MAX_CONCURRENCY: "4",
      AETHERTAROT_LLM_MAX_QUEUE: "16",
      AETHERTAROT_LLM_QUEUE_TIMEOUT_MS: "15000",
    },
    nodeVersion: "v22.11.0",
  });
  const report = formatReadinessReport(result);

  assert.equal(result.ok, false);
  assert.match(report, /guest launch requires monolithic/);
  assert.match(report, /adaptive staged whole-route deadline/);
});

test("Caddy example keeps trusted headers, host rejection, redirects, and route body caps", () => {
  const caddyfile = fs.readFileSync(
    path.join(import.meta.dirname, "..", "docs", "70-ops", "Caddyfile.aethertarot.example"),
    "utf8",
  );
  assert.match(caddyfile, /request_header -CF-Connecting-IP/);
  assert.match(caddyfile, /request_header -X-AetherTarot-Client-IP/);
  assert.match(caddyfile, /request_header X-AetherTarot-Client-IP \{remote_host\}/);
  assert.match(caddyfile, /http:\/\/\s*\{\s*respond "unrecognized host" 421/s);
  assert.match(caddyfile, /https:\/\/www\.aethertarot\.cn[\s\S]*redir https:\/\/aethertarot\.cn/);
  assert.match(caddyfile, /handle \/api\/readings\/migrate[\s\S]*max_size 2MiB/);
  assert.match(caddyfile, /handle \/api\/reading[\s\S]*max_size 64KiB/);
  assert.match(caddyfile, /handle \/api\/\*[\s\S]*max_size 256KiB/);
  assert.match(caddyfile, /response_header_timeout 130s/);
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
