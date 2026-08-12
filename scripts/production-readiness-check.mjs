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
const edgeResponseTimeoutMs = 130_000;
const placeholderSecretPattern = /(?:change[-_ ]?me|example|placeholder|replace[-_ ]?me|your[-_ ]?secret|fake)/i;

const requiredEnvNames = [
  "NODE_ENV",
  "NEXT_PUBLIC_SITE_URL",
  "AUTH_SECRET",
  "AUTH_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AETHERTAROT_READING_PROVIDER",
  "AETHERTAROT_ENCYCLOPEDIA_PROVIDER",
  "AETHERTAROT_READING_GENERATION_MODE",
  "AETHERTAROT_IP_HASH_SALT",
  "AETHERTAROT_PROXY_SHARED_SECRET",
  "AETHERTAROT_READING_DAILY_LIMIT_PER_USER",
  "AETHERTAROT_READING_DAILY_LIMIT_PER_ANONYMOUS_IP",
  "AETHERTAROT_ENCYCLOPEDIA_DAILY_LIMIT_PER_USER",
  "AETHERTAROT_ENCYCLOPEDIA_DAILY_LIMIT_PER_ANONYMOUS_IP",
  "AETHERTAROT_LLM_IP_LIMIT_PER_MINUTE",
  "AETHERTAROT_LLM_DAILY_TOKEN_LIMIT",
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
  "AETHERTAROT_LLM_MAX_RESPONSE_BYTES",
  "AETHERTAROT_LLM_MAX_CONCURRENCY",
  "AETHERTAROT_LLM_MAX_QUEUE",
  "AETHERTAROT_LLM_QUEUE_TIMEOUT_MS",
];

const numericEnvRanges = {
  AETHERTAROT_READING_DAILY_LIMIT_PER_USER: [1, 1000],
  AETHERTAROT_READING_DAILY_LIMIT_PER_ANONYMOUS_IP: [1, 100],
  AETHERTAROT_ENCYCLOPEDIA_DAILY_LIMIT_PER_USER: [1, 1000],
  AETHERTAROT_ENCYCLOPEDIA_DAILY_LIMIT_PER_ANONYMOUS_IP: [1, 100],
  AETHERTAROT_LLM_IP_LIMIT_PER_MINUTE: [1, 1000],
  AETHERTAROT_LLM_DAILY_TOKEN_LIMIT: [1000, 1_000_000_000],
  AETHERTAROT_LLM_TIMEOUT_MS: [1000, 120_000],
  AETHERTAROT_LLM_MAX_OUTPUT_TOKENS: [1, 100_000],
  AETHERTAROT_LLM_MAX_RESPONSE_BYTES: [1024, 4 * 1024 * 1024],
  AETHERTAROT_LLM_MAX_CONCURRENCY: [1, 64],
  AETHERTAROT_LLM_MAX_QUEUE: [0, 512],
  AETHERTAROT_LLM_QUEUE_TIMEOUT_MS: [100, 120_000],
};

const urlEnvNames = new Set([
  "NEXT_PUBLIC_SITE_URL",
  "AUTH_URL",
  "SUPABASE_URL",
  "AETHERTAROT_LLM_BASE_URL",
]);

const allowedEnvValues = {
  AETHERTAROT_READING_PROVIDER: ["placeholder", "llm"],
  AETHERTAROT_ENCYCLOPEDIA_PROVIDER: ["disabled", "llm"],
  AETHERTAROT_READING_GENERATION_MODE: ["monolithic"],
  AETHERTAROT_LLM_THINKING_MODE: ["enabled", "disabled"],
  AETHERTAROT_LLM_RESPONSE_FORMAT: ["json_object"],
};

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

  const checks = names.map((name) => {
    const value = env[name]?.trim();
    if (!value) {
      return fail("env", name, "missing or empty");
    }

    if (name === "NODE_ENV" && value !== "production") {
      return fail("env", name, "must be production");
    }

    const allowedValues = allowedEnvValues[name];
    if (allowedValues && !allowedValues.includes(value)) {
      const message = name === "AETHERTAROT_READING_GENERATION_MODE"
        ? "guest launch requires monolithic"
        : `must be ${allowedValues.join(" or ")}`;
      return fail("env", name, message);
    }

    if (urlEnvNames.has(name)) {
      try {
        const parsed = new URL(value);
        if (parsed.protocol !== "https:") {
          return fail("env", name, "must be an absolute HTTPS URL");
        }
      } catch {
        return fail("env", name, "must be a valid absolute URL");
      }
    }

    const range = numericEnvRanges[name];
    if (range) {
      const number = Number(value);
      if (!Number.isInteger(number) || number < range[0] || number > range[1]) {
        return fail("env", name, `must be an integer in ${range[0]}-${range[1]}`);
      }
    }

    if (
      (name === "AUTH_SECRET" || name === "AETHERTAROT_PROXY_SHARED_SECRET" || name === "AETHERTAROT_IP_HASH_SALT")
      && value.length < 32
    ) {
      return fail("env", name, "must contain at least 32 characters");
    }

    if (
      (name === "AUTH_SECRET" || name === "AETHERTAROT_PROXY_SHARED_SECRET" || name === "AETHERTAROT_IP_HASH_SALT")
      && placeholderSecretPattern.test(value)
    ) {
      return fail("env", name, "must not use an example or placeholder value");
    }

    if (name === "AETHERTAROT_LLM_TEMPERATURE") {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0 || number > 2) {
        return fail("env", name, "must be a number in 0-2");
      }
    }

    if (name === "AETHERTAROT_LLM_API_KEY") {
      const reference = /^\$([A-Z0-9_]+)$|^\$\{([A-Z0-9_]+)\}$/.exec(value);
      if (reference && !env[reference[1] ?? reference[2]]?.trim()) {
        return fail("env", name, "references a missing or empty environment variable");
      }
    }

    return pass("env", name, "set");
  });

  const proxySecret = env.AETHERTAROT_PROXY_SHARED_SECRET?.trim();
  const ipSalt = env.AETHERTAROT_IP_HASH_SALT?.trim();
  if (proxySecret && ipSalt && proxySecret === ipSalt) {
    checks.push(fail("env", "proxy/IP secrets", "AETHERTAROT_PROXY_SHARED_SECRET and AETHERTAROT_IP_HASH_SALT must be different"));
  }
  if (readingProvider === "llm" || encyclopediaProvider === "llm") {
    const llmDeadlineMs = Number(env.AETHERTAROT_LLM_TIMEOUT_MS);
    if (Number.isInteger(llmDeadlineMs) && llmDeadlineMs >= edgeResponseTimeoutMs) {
      checks.push(fail(
        "env",
        "LLM/edge deadline",
        `AETHERTAROT_LLM_TIMEOUT_MS must be lower than the edge response timeout (${edgeResponseTimeoutMs}ms)`,
      ));
    }
  }
  if (env.AETHERTAROT_READING_GENERATION_MODE?.trim() === "adaptive_staged") {
    const llmDeadlineMs = Number(env.AETHERTAROT_LLM_TIMEOUT_MS);
    const stagedWholeRouteDeadlineMs = llmDeadlineMs * 4;
    if (
      Number.isInteger(llmDeadlineMs)
      && stagedWholeRouteDeadlineMs >= edgeResponseTimeoutMs
    ) {
      checks.push(fail(
        "env",
        "adaptive staged whole-route deadline",
        `four provider deadlines (${stagedWholeRouteDeadlineMs}ms) must stay below the edge response timeout (${edgeResponseTimeoutMs}ms)`,
      ));
    }
  }
  return checks;
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
