import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const defaultStatsPath = path.join(
  repoRoot,
  "apps/web/.next/diagnostics/route-bundle-stats.json",
);
const defaultDeckPath = path.join(repoRoot, "data/decks/rider-waite-smith.json");
const defaultRoutes = ["/", "/new", "/ritual", "/reveal", "/reading", "/encyclopedia"];
const defaultImageWidths = [260, 384];

function unique(values) {
  return [...new Set(values)];
}

function normalizeOrigin(origin) {
  const parsed = new URL(origin);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("origin must use http or https");
  }

  return parsed.origin;
}

function normalizeRoute(route) {
  if (!route.startsWith("/")) {
    return `/${route}`;
  }

  return route;
}

function normalizeStaticPath(chunkPath) {
  const normalized = chunkPath.replaceAll("\\", "/");
  const staticIndex = normalized.indexOf(".next/static/");

  if (staticIndex < 0) {
    return null;
  }

  return `/_next/static/${normalized.slice(staticIndex + ".next/static/".length)}`;
}

function getRevealImageUrl(imageUrl) {
  if (typeof imageUrl !== "string" || !imageUrl.startsWith("/cardsV2/")) {
    return null;
  }

  const fileName = imageUrl.split("/").at(-1);

  if (!fileName) {
    return null;
  }

  return `/cardsV2/reveal/${fileName.replace(/\.[^.]+$/, "")}.webp`;
}

export function buildPrewarmUrls({
  origin,
  routes = defaultRoutes,
  routeStats = [],
  deck = [],
  imageWidths = defaultImageWidths,
  imageQuality = 75,
  imageLimit = 8,
}) {
  const baseOrigin = normalizeOrigin(origin);
  const urls = [];

  for (const route of routes) {
    urls.push(new URL(normalizeRoute(route), baseOrigin).toString());
  }

  const chunkPaths = routeStats
    .flatMap((entry) => entry?.firstLoadChunkPaths ?? [])
    .map((chunkPath) => normalizeStaticPath(String(chunkPath)))
    .filter(Boolean);

  for (const chunkPath of unique(chunkPaths)) {
    urls.push(new URL(chunkPath, baseOrigin).toString());
  }

  for (const card of deck.slice(0, imageLimit)) {
    const revealImageUrl = getRevealImageUrl(card?.imageUrl);

    if (!revealImageUrl) {
      continue;
    }

    for (const width of imageWidths) {
      const url = new URL("/_next/image", baseOrigin);
      url.searchParams.set("url", revealImageUrl);
      url.searchParams.set("w", String(width));
      url.searchParams.set("q", String(imageQuality));
      urls.push(url.toString());
    }
  }

  return unique(urls);
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseArgs(argv) {
  const args = {
    origin: "https://aethertarot.cn",
    statsPath: defaultStatsPath,
    deckPath: defaultDeckPath,
    dryRun: false,
    imageLimit: 8,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--origin" && next) {
      args.origin = next;
      index += 1;
    } else if (arg === "--stats" && next) {
      args.statsPath = path.resolve(next);
      index += 1;
    } else if (arg === "--deck" && next) {
      args.deckPath = path.resolve(next);
      index += 1;
    } else if (arg === "--image-limit" && next) {
      args.imageLimit = Math.max(0, Number(next) || 0);
      index += 1;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    }
  }

  return args;
}

async function prewarm(urls) {
  let ok = 0;
  let failed = 0;

  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        ok += 1;
      } else {
        failed += 1;
        console.warn(`[prewarm] ${response.status} ${url}`);
      }
    } catch (error) {
      failed += 1;
      console.warn(`[prewarm] failed ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { ok, failed };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const urls = buildPrewarmUrls({
    origin: args.origin,
    routeStats: readJson(args.statsPath, []),
    deck: readJson(args.deckPath, []),
    imageLimit: args.imageLimit,
  });

  if (args.dryRun) {
    console.log(urls.join("\n"));
    return;
  }

  const result = await prewarm(urls);
  console.log(`Prewarm complete: ${result.ok} ok, ${result.failed} failed.`);

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
