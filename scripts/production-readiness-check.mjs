import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildPrewarmUrls } from "./prewarm-production.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(__dirname, "..");
const defaultDeckPath = "data/decks/rider-waite-smith.json";
const defaultRouteStatsPath =
  "apps/web/.next/diagnostics/route-bundle-stats.json";
const defaultOrigin = "https://aethertarot.cn";
const defaultRoutes = ["/", "/new", "/ritual", "/reveal", "/reading", "/encyclopedia"];

const requiredEnvNames = [
  "NODE_ENV",
  "NEXT_PUBLIC_SITE_URL",
  "AUTH_SECRET",
  "AUTH_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AETHERTAROT_READING_PROVIDER",
  "AETHERTAROT_ENCYCLOPEDIA_PROVIDER",
  "AETHERTAROT_IP_HASH_SALT",
  "AETHERTAROT_READING_DAILY_LIMIT_PER_USER",
  "AETHERTAROT_ENCYCLOPEDIA_DAILY_LIMIT_PER_USER",
  "AETHERTAROT_LLM_IP_LIMIT_PER_MINUTE",
  "AETHERTAROT_LLM_DAILY_TOKEN_LIMIT",
  "AETHERTAROT_AUTH_EMAIL_HOURLY_LIMIT_PER_EMAIL",
  "AETHERTAROT_AUTH_EMAIL_DAILY_LIMIT_PER_EMAIL",
  "AETHERTAROT_AUTH_EMAIL_HOURLY_LIMIT_PER_IP",
  "AETHERTAROT_AUTH_EMAIL_HOURLY_LIMIT_GLOBAL",
];

const llmEnvNames = [
  "AETHERTAROT_LLM_BASE_URL",
  "AETHERTAROT_LLM_MODEL",
  "AETHERTAROT_LLM_API_KEY",
  "AETHERTAROT_LLM_THINKING_MODE",
  "AETHERTAROT_LLM_RESPONSE_FORMAT",
  "AETHERTAROT_LLM_TEMPERATURE",
  "AETHERTAROT_LLM_TIMEOUT_MS",
  "AETHERTAROT_LLM_MAX_OUTPUT_TOKENS",
];

const nextBuildArtifacts = [
  { type: "file", path: "apps/web/.next/BUILD_ID" },
  { type: "file", path: "apps/web/.next/required-server-files.json" },
  { type: "file", path: "apps/web/.next/routes-manifest.json" },
  { type: "file", path: "apps/web/.next/build-manifest.json" },
  { type: "dir", path: "apps/web/.next/server" },
  { type: "dir", path: "apps/web/.next/static" },
  { type: "file", path: defaultRouteStatsPath },
];

export async function collectProductionReadinessChecks({
  repoRoot = defaultRepoRoot,
  env = process.env,
  nodeVersion = process.version,
  origin = env.NEXT_PUBLIC_SITE_URL || defaultOrigin,
  prewarmRoutes = defaultRoutes,
  imageLimit = 8,
} = {}) {
  const checks = [
    ...checkRequiredEnv(env),
    ...checkNodeVersion(nodeVersion),
    ...checkNextBuildArtifacts(repoRoot),
  ];

  const deckPath = path.join(repoRoot, defaultDeckPath);
  const routeStatsPath = path.join(repoRoot, defaultRouteStatsPath);
  const deckResult = readJson(deckPath);
  const routeStatsResult = readJson(routeStatsPath);

  if (!deckResult.ok) {
    checks.push(fail("assets", relative(repoRoot, deckPath), deckResult.message));
  } else {
    checks.push(...checkCardAssets(repoRoot, deckResult.value));
  }

  if (!routeStatsResult.ok) {
    checks.push(
      fail("prewarm", relative(repoRoot, routeStatsPath), routeStatsResult.message),
    );
  }

  let prewarmUrls = [];
  if (deckResult.ok && routeStatsResult.ok) {
    try {
      prewarmUrls = buildPrewarmUrls({
        origin,
        routes: prewarmRoutes,
        routeStats: routeStatsResult.value,
        deck: deckResult.value,
        imageWidths: [384],
        imageQuality: 75,
        imageLimit,
      });
      checks.push(
        pass("prewarm", "prewarm URL construction", `${prewarmUrls.length} URLs`),
      );
    } catch (error) {
      checks.push(
        fail(
          "prewarm",
          "prewarm URL construction",
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }

  return {
    ok: checks.every((check) => check.status !== "fail"),
    checks,
    prewarmUrls,
  };
}

export function formatReadinessReport(result) {
  const lines = [
    "Production readiness check",
    `Status: ${result.ok ? "PASS" : "FAIL"}`,
    "",
  ];

  for (const check of result.checks) {
    const marker = check.status === "pass" ? "PASS" : "FAIL";
    lines.push(`[${marker}] ${check.category}: ${check.name}`);
    if (check.message) {
      lines.push(`  ${check.message}`);
    }
  }

  if (result.prewarmUrls.length > 0) {
    lines.push("", "Prewarm URLs:");
    for (const url of result.prewarmUrls) {
      lines.push(`- ${url}`);
    }
  }

  return lines.join("\n");
}

export async function main(argv = process.argv.slice(2), io = console) {
  const args = parseArgs(argv);
  const result = await collectProductionReadinessChecks({
    repoRoot: args.repoRoot,
    origin: args.origin,
    imageLimit: args.imageLimit,
  });

  io.log(formatReadinessReport(result));
  if (!result.ok) {
    process.exitCode = 1;
  }
}

function checkRequiredEnv(env) {
  const names = [...requiredEnvNames];
  const readingProvider = env.AETHERTAROT_READING_PROVIDER?.trim();
  const encyclopediaProvider = env.AETHERTAROT_ENCYCLOPEDIA_PROVIDER?.trim();

  if (readingProvider === "llm" || encyclopediaProvider === "llm") {
    names.push(...llmEnvNames);
  }

  return names.map((name) => {
    const value = env[name]?.trim();
    if (!value) {
      return fail("env", name, "missing or empty");
    }

    if (name === "NODE_ENV" && value !== "production") {
      return fail("env", name, "must be production");
    }

    return pass("env", name, "set");
  });
}

function checkNodeVersion(nodeVersion) {
  const version = String(nodeVersion).replace(/^v/, "");
  const major = Number(version.split(".")[0]);
  if (!Number.isInteger(major)) {
    return [fail("runtime", "Node.js version", `cannot parse ${nodeVersion}`)];
  }

  if (major < 20) {
    return [fail("runtime", "Node.js version", `requires major >= 20; found ${version}`)];
  }

  return [pass("runtime", "Node.js version", `major ${major}`)];
}

function checkNextBuildArtifacts(repoRoot) {
  return nextBuildArtifacts.map((artifact) => {
    const absolutePath = path.join(repoRoot, artifact.path);
    const exists = fs.existsSync(absolutePath);
    const stats = exists ? fs.statSync(absolutePath) : null;
    const ok =
      artifact.type === "dir" ? stats?.isDirectory() === true : stats?.isFile() === true;

    if (!ok) {
      return fail("build", artifact.path.replaceAll("\\", "/"), "missing");
    }

    return pass("build", artifact.path.replaceAll("\\", "/"), "present");
  });
}

function checkCardAssets(repoRoot, deck) {
  if (!Array.isArray(deck)) {
    return [fail("assets", defaultDeckPath, "deck JSON must be an array")];
  }

  const checks = [];
  for (const card of deck) {
    const cardId = typeof card?.id === "string" ? card.id : "unknown-card";
    const imageUrl = typeof card?.imageUrl === "string" ? card.imageUrl : "";
    const thumbnailUrl =
      typeof card?.thumbnailUrl === "string"
        ? card.thumbnailUrl
        : deriveAssetUrl(imageUrl, "/cardsV2/thumbs/", ".webp");
    const revealUrl = deriveAssetUrl(imageUrl, "/cardsV2/reveal/", ".webp");

    checks.push(checkPublicAsset(repoRoot, imageUrl, `${cardId} imageUrl`));
    checks.push(checkPublicAsset(repoRoot, revealUrl, `${cardId} reveal asset`));
    checks.push(checkPublicAsset(repoRoot, thumbnailUrl, `${cardId} thumbnail asset`));
  }

  return checks;
}

function checkPublicAsset(repoRoot, assetUrl, label) {
  if (!assetUrl || !assetUrl.startsWith("/")) {
    return fail("assets", label, "missing public asset URL");
  }

  const relativePath = `apps/web/public${assetUrl}`.replaceAll("\\", "/");
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    return fail("assets", relativePath, "missing");
  }

  return pass("assets", relativePath, "present");
}

function deriveAssetUrl(imageUrl, directory, extension) {
  if (!imageUrl || !imageUrl.startsWith("/cardsV2/")) {
    return "";
  }

  return `${directory}${path.basename(imageUrl, path.extname(imageUrl))}${extension}`;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, message: "missing" };
  }

  try {
    return {
      ok: true,
      value: JSON.parse(fs.readFileSync(filePath, "utf8")),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function parseArgs(argv) {
  const args = {
    repoRoot: defaultRepoRoot,
    origin: process.env.NEXT_PUBLIC_SITE_URL || defaultOrigin,
    imageLimit: 8,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--origin" && next) {
      args.origin = next;
      index += 1;
    } else if (arg === "--repo-root" && next) {
      args.repoRoot = path.resolve(next);
      index += 1;
    } else if (arg === "--image-limit" && next) {
      args.imageLimit = Math.max(0, Number(next) || 0);
      index += 1;
    }
  }

  return args;
}

function pass(category, name, message = "") {
  return { status: "pass", category, name, message };
}

function fail(category, name, message = "") {
  return { status: "fail", category, name, message };
}

function relative(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).replaceAll("\\", "/");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
