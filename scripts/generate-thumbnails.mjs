import { createRequire } from "node:module";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const requireFromWeb = createRequire(
  path.join(import.meta.dirname, "..", "apps/web/package.json"),
);
const sharp = requireFromWeb("sharp");

const repoRoot = path.join(import.meta.dirname, "..");
const deckPath = path.join(repoRoot, "data/decks/rider-waite-smith.json");
const publicDir = path.join(repoRoot, "apps/web/public");
const thumbsDir = path.join(publicDir, "cardsV2/thumbs");

const THUMB_WIDTH = 120;
const THUMB_HEIGHT = 204;
const THUMB_QUALITY = 70;

const deck = JSON.parse(readFileSync(deckPath, "utf-8"));

if (!Array.isArray(deck) || deck.length !== 78) {
  console.error(`Expected 78 cards, got ${deck?.length ?? 0}`);
  process.exit(1);
}

if (!existsSync(thumbsDir)) {
  mkdirSync(thumbsDir, { recursive: true });
}

let generated = 0;
let skipped = 0;

for (const card of deck) {
  if (!card.imageUrl || !card.imageUrl.startsWith("/cardsV2/")) {
    console.warn(`[skip] ${card.id}: invalid imageUrl`);
    skipped++;
    continue;
  }

  const srcPath = path.join(publicDir, card.imageUrl.replace(/^\//, ""));
  const baseName = path.basename(card.imageUrl, path.extname(card.imageUrl));
  const outPath = path.join(thumbsDir, `${baseName}.webp`);

  if (!existsSync(srcPath)) {
    console.warn(`[skip] ${card.id}: source not found at ${srcPath}`);
    skipped++;
    continue;
  }

  await sharp(srcPath)
    .resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: "cover" })
    .webp({ quality: THUMB_QUALITY })
    .toFile(outPath);

  generated++;
}

console.log(`\nDone: ${generated} thumbnails generated, ${skipped} skipped`);
console.log(`Output: ${thumbsDir}`);
