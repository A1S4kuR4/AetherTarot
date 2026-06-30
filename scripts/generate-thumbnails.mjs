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
const revealDir = path.join(publicDir, "cardsV2/reveal");

const THUMB_WIDTH = 120;
const THUMB_HEIGHT = 204;
const THUMB_QUALITY = 70;
const REVEAL_WIDTH = 384;
const REVEAL_HEIGHT = 653;
const REVEAL_QUALITY = 76;

const deck = JSON.parse(readFileSync(deckPath, "utf-8"));

if (!Array.isArray(deck) || deck.length !== 78) {
  console.error(`Expected 78 cards, got ${deck?.length ?? 0}`);
  process.exit(1);
}

if (!existsSync(thumbsDir)) {
  mkdirSync(thumbsDir, { recursive: true });
}

if (!existsSync(revealDir)) {
  mkdirSync(revealDir, { recursive: true });
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
  const thumbOutPath = path.join(thumbsDir, `${baseName}.webp`);
  const revealOutPath = path.join(revealDir, `${baseName}.webp`);

  if (!existsSync(srcPath)) {
    console.warn(`[skip] ${card.id}: source not found at ${srcPath}`);
    skipped++;
    continue;
  }

  await sharp(srcPath)
    .resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: "cover" })
    .webp({ quality: THUMB_QUALITY })
    .toFile(thumbOutPath);

  await sharp(srcPath)
    .resize(REVEAL_WIDTH, REVEAL_HEIGHT, { fit: "cover" })
    .webp({ quality: REVEAL_QUALITY })
    .toFile(revealOutPath);

  generated++;
}

console.log(`\nDone: ${generated} thumbnail/reveal asset pairs generated, ${skipped} skipped`);
console.log(`Thumbnails: ${thumbsDir}`);
console.log(`Reveal: ${revealDir}`);
