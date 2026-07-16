/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const fontDir = path.resolve(__dirname, "../public/fonts/aether-serif");
const sourceCssPath = path.join(fontDir, "aether-serif.css");
const outputCssPath = path.join(fontDir, "aether-serif-share-embed.css");

function loadGb2312Chars() {
  const chars = new Set();
  const decoder = new TextDecoder("gb18030", { fatal: true });

  const addDecodedCharacter = (bytes) => {
    const character = decoder.decode(Uint8Array.from(bytes));
    const codePoint = character.codePointAt(0);
    if (codePoint >= 0xe000 && codePoint <= 0xf8ff) return;
    chars.add(character);
  };

  for (let b1 = 0xb0; b1 <= 0xd7; b1++) {
    for (let b2 = 0xa1; b2 <= 0xfe; b2++) {
      try {
        addDecodedCharacter([b1, b2]);
      } catch {
        // ignore invalid sequences
      }
    }
  }
  for (let b1 = 0xd8; b1 <= 0xf7; b1++) {
    for (let b2 = 0xa1; b2 <= 0xfe; b2++) {
      try {
        addDecodedCharacter([b1, b2]);
      } catch {
        // ignore invalid sequences
      }
    }
  }
  return chars;
}

function loadCardNames() {
  const deckPath = path.resolve(__dirname, "../../../data/decks/rider-waite-smith.json");
  const deck = JSON.parse(fs.readFileSync(deckPath, "utf-8"));
  const chars = new Set();
  for (const card of deck) {
    if (card.name) chars.add(card.name);
    if (card.englishName) chars.add(card.englishName);
  }
  return chars;
}

function loadFixedCopy() {
  return [
    "灵语塔罗",
    "AetherTarot",
    "牌阵",
    "正位",
    "逆位",
    "主题",
    "我的问题",
    "综合解读",
    "可以带走的思考",
    "导出于",
    "每张牌都是当下的镜子",
    "安全提醒",
    "置信说明",
    "过去",
    "现在",
    "未来",
    "自我",
    "处境",
    "阻碍",
    "基础",
    "目标",
    "关系",
    "职业",
    "自我成长",
    "行动选择",
    "综合议题",
    "年月日",
    "，。、；：？！…—·～（）《》",
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  ].join("");
}

function parseUnicodeRange(range) {
  const ranges = [];
  const parts = range.split(",").map((p) => p.trim());
  for (const part of parts) {
    const m = part.match(/^U\+([0-9a-fA-F]+)(?:-([0-9a-fA-F]+))?$/);
    if (!m) continue;
    const start = parseInt(m[1], 16);
    const end = m[2] ? parseInt(m[2], 16) : start;
    ranges.push({ start, end });
  }
  return ranges;
}

function codePointInRanges(codePoint, ranges) {
  for (const { start, end } of ranges) {
    if (codePoint >= start && codePoint <= end) return true;
  }
  return false;
}

function extractFontFaces(css) {
  const regex = /@font-face\{([^}]+)\}/g;
  const faces = [];
  let match;
  while ((match = regex.exec(css)) !== null) {
    const block = match[1];
    const familyMatch = block.match(/font-family:([^;]+)/);
    const rangeMatch = block.match(/unicode-range:([^;]+)/);
    if (familyMatch && rangeMatch) {
      faces.push({
        block: match[0],
        family: familyMatch[1].trim().replace(/^["']|["']$/g, ""),
        unicodeRange: rangeMatch[1].trim(),
        ranges: parseUnicodeRange(rangeMatch[1].trim()),
      });
    }
  }
  return faces;
}

function inlineFontFiles(fontFace) {
  return fontFace.replace(
    /url\(["']?\.\/([^"')]+)["']?\)/g,
    (_match, fileName) => {
      const filePath = path.join(fontDir, fileName);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Referenced font file not found: ${filePath}`);
      }

      const base64 = fs.readFileSync(filePath).toString("base64");
      return `url("data:font/woff2;base64,${base64}")`;
    },
  ).replace(/src:local\([^)]*\),/g, "src:");
}

function buildShareFontEmbed() {
  if (!fs.existsSync(sourceCssPath)) {
    console.error("Source font CSS not found:", sourceCssPath);
    console.error("Run: node scripts/copy-share-font.js");
    process.exit(1);
  }

  const css = fs.readFileSync(sourceCssPath, "utf-8");
  const faces = extractFontFaces(css);

  const gb2312Chars = loadGb2312Chars();
  const neededChars = new Set(gb2312Chars);
  for (const name of loadCardNames()) {
    for (const char of name) neededChars.add(char);
  }
  for (const char of loadFixedCopy()) neededChars.add(char);

  const neededCodePoints = new Set(
    Array.from(neededChars).flatMap((char) => {
      const codePoints = [];
      for (let i = 0; i < char.length; ) {
        const cp = char.codePointAt(i);
        codePoints.push(cp);
        i += cp > 0xffff ? 2 : 1;
      }
      return codePoints;
    }),
  );

  const selectedFaces = faces.filter((face) =>
    Array.from(neededCodePoints).some((cp) => codePointInRanges(cp, face.ranges)),
  );

  const uncoveredCodePoints = Array.from(neededCodePoints).filter(
    (cp) => !selectedFaces.some((face) => codePointInRanges(cp, face.ranges)),
  );
  if (uncoveredCodePoints.length > 0) {
    const preview = uncoveredCodePoints
      .slice(0, 10)
      .map((cp) => `U+${cp.toString(16).toUpperCase()}`)
      .join(", ");
    throw new Error(`Font does not cover required characters: ${preview}`);
  }

  if (!gb2312Chars.has("啊") || gb2312Chars.size !== 6_763) {
    throw new Error("GB2312 character decoding is incomplete");
  }

  const outputCss = selectedFaces
    .map((face) => inlineFontFiles(face.block))
    .join("\n");
  if (!outputCss.includes("data:font/woff2;base64,") || /url\(["']?\.\//.test(outputCss)) {
    throw new Error("Share font CSS must contain only embedded font Data URLs");
  }
  fs.writeFileSync(outputCssPath, outputCss, "utf-8");

  console.log(`Selected ${selectedFaces.length} / ${faces.length} font faces`);
  console.log(`Output: ${outputCssPath}`);

  console.log(`GB2312 characters: ${gb2312Chars.size}`);
  console.log(`Embedded CSS size: ${(Buffer.byteLength(outputCss) / 1024 / 1024).toFixed(2)} MB`);
}

buildShareFontEmbed();
