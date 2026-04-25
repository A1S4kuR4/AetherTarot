import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const deckPath = path.join(repoRoot, "data/decks/rider-waite-smith.json");
const manifestPath = path.join(repoRoot, "data/decks/card-asset-manifest.json");
const publicRoot = path.join(repoRoot, "apps/web/public");
const runtimeCardsRoot = path.join(publicRoot, "cardsV2");
const cardBackImageUrl = "/cardsV2/back.png";
const expectedCardCount = 78;
const expectedManifestEntryCount = expectedCardCount + 1;
const expectedAspectRatio = 1 / 1.7;
const aspectRatioTolerance = 0.035;
const expectedImagePaths = new Set();
const allowedSourceKinds = new Set([
  "image-model-medieval-europe",
  "human-reviewed-portrait",
  "native-portrait-generation",
  "procedural-portrait-svg",
]);

function fail(message) {
  console.error(`Card asset validation failed: ${message}`);
  process.exitCode = 1;
}

function readPngSize(filePath) {
  const header = Buffer.alloc(24);
  const fd = fs.openSync(filePath, "r");
  try {
    fs.readSync(fd, header, 0, header.length, 0);
  } finally {
    fs.closeSync(fd);
  }

  const signature = header.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error("not a PNG");
  }

  return {
    width: header.readUInt32BE(16),
    height: header.readUInt32BE(20),
  };
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`cannot parse ${label} (${error.message})`);
    return null;
  }
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

const deck = readJson(deckPath, path.relative(repoRoot, deckPath));
const manifest = readJson(manifestPath, path.relative(repoRoot, manifestPath));

if (!deck || !manifest) {
  process.exit();
}

const manifestEntries = new Map();
if (!Array.isArray(manifest.entries)) {
  fail("asset manifest must contain an entries array");
} else {
  for (const entry of manifest.entries) {
    if (typeof entry?.imageUrl !== "string") {
      fail("asset manifest contains an entry without imageUrl");
      continue;
    }

    if (manifestEntries.has(entry.imageUrl)) {
      fail(`duplicate manifest imageUrl: ${entry.imageUrl}`);
    }
    manifestEntries.set(entry.imageUrl, entry);
  }
}

if (manifest.target?.aspectRatio !== "1:1.7" || manifest.target?.fullBleed !== true) {
  fail("asset manifest target must be 1:1.7, fullBleed=true");
}

if (!Array.isArray(deck)) {
  fail("deck data must be a JSON array");
  process.exit();
}

if (deck.length !== expectedCardCount) {
  fail(`deck must contain exactly ${expectedCardCount} tarot cards; found ${deck.length}`);
}

if (manifestEntries.size !== expectedManifestEntryCount) {
  fail(
    `asset manifest must contain exactly ${expectedManifestEntryCount} entries (${expectedCardCount} card fronts plus card back); found ${manifestEntries.size}`,
  );
}

const seenIds = new Set();
for (const card of deck) {
  if (!card?.id) {
    fail("deck contains a card without id");
    continue;
  }

  if (seenIds.has(card.id)) {
    fail(`duplicate card id: ${card.id}`);
  }
  seenIds.add(card.id);

  if (typeof card.imageUrl !== "string" || !card.imageUrl.startsWith("/cardsV2/")) {
    fail(`${card.id} has invalid imageUrl: ${card.imageUrl}`);
    continue;
  }

  const imagePath = path.join(publicRoot, card.imageUrl.slice(1));
  expectedImagePaths.add(imagePath);
  validateImage(imagePath, card.id, card.imageUrl);
}

const cardBackPath = path.join(publicRoot, cardBackImageUrl.slice(1));
expectedImagePaths.add(cardBackPath);
validateImage(cardBackPath, "card back", cardBackImageUrl);

if (!manifestEntries.has(cardBackImageUrl)) {
  fail(`asset manifest must include the card back: ${cardBackImageUrl}`);
}

for (const entry of fs.readdirSync(runtimeCardsRoot, { withFileTypes: true })) {
  if (!entry.isFile()) {
    continue;
  }

  const imagePath = path.join(runtimeCardsRoot, entry.name);
  if (path.extname(entry.name).toLowerCase() !== ".png") {
    fail(`unexpected non-PNG file in cardsV2 directory: ${path.relative(repoRoot, imagePath)}`);
    continue;
  }

  const imageUrl = `/cardsV2/${entry.name}`;
  validateImage(imagePath, entry.name, imageUrl);

  if (!expectedImagePaths.has(imagePath)) {
    fail(`unreferenced card image: ${path.relative(repoRoot, imagePath)}`);
  }
}

for (const imageUrl of manifestEntries.keys()) {
  const imagePath = path.join(publicRoot, imageUrl.slice(1));
  if (!expectedImagePaths.has(imagePath)) {
    fail(`manifest references an unexpected image: ${imageUrl}`);
  }
}

if (!process.exitCode) {
  console.log(
    `Validated ${deck.length} tarot cards plus card back in ${path.relative(repoRoot, runtimeCardsRoot)}.`,
  );
}

function validateImage(imagePath, label, imageUrl) {
  const relativePath = path.relative(repoRoot, imagePath);
  if (!fs.existsSync(imagePath)) {
    fail(`${label} image is missing: ${relativePath}`);
    return;
  }

  try {
    const { width, height } = readPngSize(imagePath);
    const aspectRatio = width / height;
    if (Math.abs(aspectRatio - expectedAspectRatio) > aspectRatioTolerance) {
      fail(`${relativePath} is ${width}x${height}; expected portrait ratio close to 1:1.7`);
    }
  } catch (error) {
    fail(`${relativePath} is invalid (${error.message})`);
    return;
  }

  validateManifestEntry(imagePath, imageUrl);
}

function validateManifestEntry(imagePath, imageUrl) {
  const entry = manifestEntries.get(imageUrl);
  const relativePath = path.relative(repoRoot, imagePath);

  if (!entry) {
    fail(`${relativePath} is missing from ${path.relative(repoRoot, manifestPath)}`);
    return;
  }

  const { width, height } = readPngSize(imagePath);
  if (entry.width !== width || entry.height !== height) {
    fail(`${imageUrl} manifest dimensions must be ${width}x${height}`);
  }

  if (!allowedSourceKinds.has(entry.sourceKind)) {
    fail(`${imageUrl} has unsupported sourceKind: ${entry.sourceKind}`);
  }

  if (entry.derivedFromSquare !== false) {
    fail(`${imageUrl} must explicitly set derivedFromSquare=false`);
  }

  if (entry.fullBleed !== true) {
    fail(`${imageUrl} must explicitly set fullBleed=true`);
  }

  if (entry.visualReview?.status !== "approved") {
    fail(`${imageUrl} must have visualReview.status=approved`);
  }

  const actualHash = sha256(imagePath);
  if (entry.sha256 !== actualHash) {
    fail(`${imageUrl} sha256 mismatch; update the asset manifest after review`);
  }
}
