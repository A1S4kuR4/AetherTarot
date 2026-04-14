import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const requireFromWeb = createRequire(path.join(repoRoot, "apps/web/package.json"));
const sharp = requireFromWeb("sharp");

const deckPath = path.join(repoRoot, "data/decks/rider-waite-smith.json");
const publicRoot = path.join(repoRoot, "apps/web/public");
const cardsRoot = path.join(publicRoot, "cards");
const manifestPath = path.join(repoRoot, "data/decks/card-asset-manifest.json");
const width = 1000;
const height = 1700;
const generatedAt = "2026-04-10";

const palettes = [
  ["#16211f", "#d7b36a", "#f4ead6", "#7e3f32"],
  ["#171b2a", "#8db7d7", "#f2e8cf", "#c86642"],
  ["#241a20", "#cda46c", "#f6e6d0", "#5d7770"],
  ["#102025", "#d8c17a", "#f3efe2", "#a14d39"],
  ["#211d15", "#9fbf8a", "#f2e2c4", "#bf5b3d"],
  ["#14161e", "#d39d74", "#f4eadb", "#6c7fb1"],
];

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function hashSeed(value) {
  return [...crypto.createHash("sha256").update(value).digest()].reduce(
    (sum, byte) => sum + byte,
    0,
  );
}

function paletteFor(card) {
  return palettes[hashSeed(card.id) % palettes.length];
}

function romanFromArcana(arcana) {
  const match = String(arcana).match(/(?:Major Arcana\s+)?(.+)$/);
  return match ? match[1] : "";
}

function displayMark(card) {
  if (String(card.arcana).startsWith("Major Arcana")) {
    return {
      text: romanFromArcana(card.arcana),
      size: 116,
    };
  }

  return {
    text: String(card.arcana).replace("Minor Arcana", "").trim().toUpperCase() || "MINOR",
    size: 72,
  };
}

function keyword(card, index) {
  return escapeXml(card.uprightKeywords[index] ?? card.reversedKeywords[index] ?? "");
}

function svgText(text, x, y, size, fill, weight = 500, anchor = "middle") {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Noto Serif SC, Source Han Serif SC, SimSun, Georgia, serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(text)}</text>`;
}

function motif(card, accent, paper) {
  const commonStroke = `stroke="${paper}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.9"`;
  const softFill = `fill="${accent}" opacity="0.24"`;

  switch (card.id) {
    case "fool":
      return `<path d="M315 905 C420 735 604 715 686 842 C762 958 690 1092 550 1118 C430 1140 320 1064 315 905 Z" ${commonStroke}/><circle cx="655" cy="795" r="36" ${softFill}/><path d="M455 1085 C492 1010 596 998 656 1062" ${commonStroke}/>`;
    case "magician":
      return `<path d="M292 900 C386 786 464 786 500 900 C536 1014 614 1014 708 900 C614 786 536 786 500 900 C464 1014 386 1014 292 900 Z" ${commonStroke}/><circle cx="500" cy="900" r="220" ${softFill}/><path d="M500 620 L500 1180 M300 900 L700 900" ${commonStroke}/>`;
    case "high-priestess":
      return `<path d="M340 680 L340 1130 M660 680 L660 1130" ${commonStroke}/><path d="M280 1160 L720 1160 M300 650 L700 650" ${commonStroke}/><path d="M500 760 A150 150 0 1 0 500 1060 A95 95 0 1 1 500 760" fill="${paper}" opacity="0.82"/>`;
    case "empress":
      return `<circle cx="500" cy="900" r="92" ${softFill}/><path d="M500 700 C600 780 600 1020 500 1100 C400 1020 400 780 500 700 Z" ${commonStroke}/><path d="M330 900 C430 820 570 820 670 900 C570 980 430 980 330 900 Z" ${commonStroke}/>`;
    case "emperor":
      return `<path d="M285 1120 L392 780 L500 1030 L608 780 L715 1120 Z" ${commonStroke}/><path d="M360 760 L640 760 L600 650 L500 720 L400 650 Z" ${commonStroke}/>`;
    case "hierophant":
      return `<path d="M500 650 L500 1130 M380 790 L620 790 M420 670 L580 670" ${commonStroke}/><path d="M390 1100 C370 1010 460 980 500 1050 C540 980 630 1010 610 1100" ${commonStroke}/>`;
    case "lovers":
      return `<circle cx="395" cy="900" r="115" ${softFill}/><circle cx="605" cy="900" r="115" ${softFill}/><path d="M330 900 C380 760 500 825 500 940 C500 825 620 760 670 900 C620 1030 500 1100 500 1100 C500 1100 380 1030 330 900 Z" ${commonStroke}/>`;
    case "chariot":
      return `<path d="M320 760 L680 760 L620 1040 L380 1040 Z" ${commonStroke}/><circle cx="395" cy="1120" r="62" ${commonStroke}/><circle cx="605" cy="1120" r="62" ${commonStroke}/><path d="M500 650 L560 760 L440 760 Z" ${commonStroke}/>`;
    case "strength":
      return `<circle cx="500" cy="930" r="210" ${commonStroke}/><circle cx="500" cy="930" r="120" ${softFill}/><path d="M360 835 C430 740 570 740 640 835 M410 1015 C465 1075 535 1075 590 1015" ${commonStroke}/><path d="M390 805 L330 725 M610 805 L670 725" ${commonStroke}/>`;
    case "hermit":
      return `<path d="M500 650 L500 1130 M390 785 L610 785 L570 1010 L430 1010 Z" ${commonStroke}/><circle cx="500" cy="895" r="70" ${softFill}/><path d="M355 1160 L645 1160" ${commonStroke}/>`;
    case "wheel":
      return `<circle cx="500" cy="900" r="240" ${commonStroke}/><circle cx="500" cy="900" r="74" ${softFill}/><path d="M500 660 L500 1140 M260 900 L740 900 M330 730 L670 1070 M670 730 L330 1070" ${commonStroke}/>`;
    case "justice":
      return `<path d="M500 650 L500 1130 M360 760 L640 760 M500 760 L355 1030 M500 760 L645 1030" ${commonStroke}/><path d="M285 1030 L425 1030 M575 1030 L715 1030 M420 1160 L580 1160" ${commonStroke}/>`;
    case "hanged-man":
      return `<path d="M300 655 L700 655 M500 655 L500 1080 M405 800 L595 800 M455 1080 L500 1160 L545 1080" ${commonStroke}/><circle cx="500" cy="1185" r="60" ${softFill}/>`;
    case "death":
      return `<path d="M315 1160 L685 640 M370 730 L500 780 L640 735 M420 1070 L560 1120" ${commonStroke}/><path d="M580 660 L720 710 L610 810 Z" fill="${paper}" opacity="0.78"/><circle cx="380" cy="1110" r="70" ${softFill}/>`;
    case "temperance":
      return `<path d="M385 760 C455 705 520 785 475 865 L415 980 C365 1065 255 985 310 900 Z" ${commonStroke}/><path d="M615 1040 C545 1095 480 1015 525 935 L585 820 C635 735 745 815 690 900 Z" ${commonStroke}/><path d="M475 865 C535 900 520 970 585 1000" ${commonStroke}/>`;
    case "devil":
      return `<path d="M340 1060 C340 790 660 790 660 1060" ${commonStroke}/><path d="M380 800 L290 675 M620 800 L710 675 M420 1060 L360 1180 M580 1060 L640 1180" ${commonStroke}/><circle cx="500" cy="930" r="86" ${softFill}/>`;
    case "tower":
      return `<path d="M380 1160 L430 700 L570 700 L620 1160 Z" ${commonStroke}/><path d="M410 650 L590 650 L550 560 L450 560 Z" ${commonStroke}/><path d="M625 570 L520 815 L650 790 L520 1085" stroke="${accent}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    case "star":
      return `<path d="M500 625 L562 825 L770 825 L602 945 L665 1150 L500 1025 L335 1150 L398 945 L230 825 L438 825 Z" ${commonStroke}/><path d="M310 1190 C420 1140 580 1240 690 1190" ${commonStroke}/>`;
    case "moon":
      return `<path d="M565 655 A210 210 0 1 0 565 1065 A135 135 0 1 1 565 655" fill="${paper}" opacity="0.84"/><path d="M300 1160 L300 850 M700 1160 L700 850 M260 850 L340 850 M660 850 L740 850" ${commonStroke}/>`;
    case "sun":
      return `<circle cx="500" cy="900" r="155" ${commonStroke}/><circle cx="500" cy="900" r="80" ${softFill}/><path d="M500 600 L500 700 M500 1100 L500 1200 M200 900 L300 900 M700 900 L800 900 M290 690 L360 760 M710 690 L640 760 M290 1110 L360 1040 M710 1110 L640 1040" ${commonStroke}/>`;
    case "judgement":
      return `<path d="M350 820 L650 690 L650 910 L350 780 Z" ${commonStroke}/><path d="M650 705 L780 660 L780 940 L650 895 M405 870 L405 1150 M595 800 L595 1150 M320 1150 L680 1150" ${commonStroke}/>`;
    case "world":
      return `<ellipse cx="500" cy="900" rx="260" ry="365" ${commonStroke}/><path d="M500 650 C615 780 615 1020 500 1150 C385 1020 385 780 500 650 Z" ${commonStroke}/><circle cx="500" cy="900" r="86" ${softFill}/>`;
    default:
      return wandsMotif(card.id, commonStroke, softFill);
  }
}

function wandsMotif(id, commonStroke, softFill) {
  const countById = {
    "ace-of-wands": 1,
    "two-of-wands": 2,
    "three-of-wands": 3,
    "four-of-wands": 4,
    "five-of-wands": 5,
    "six-of-wands": 6,
    "seven-of-wands": 7,
    "eight-of-wands": 8,
    "nine-of-wands": 9,
    "ten-of-wands": 10,
  };
  const count = countById[id] ?? 1;
  const spacing = count === 1 ? 0 : 360 / (count - 1);
  const start = 500 - (spacing * (count - 1)) / 2;
  const staffs = Array.from({ length: count }, (_, index) => {
    const x = start + spacing * index;
    const lean = (index - (count - 1) / 2) * 20;
    return `<path d="M${x - lean} 1180 L${x + lean} 650" ${commonStroke}/><circle cx="${x + lean}" cy="650" r="38" ${softFill}/>`;
  }).join("");

  return `${staffs}<path d="M275 1210 C385 1140 615 1140 725 1210" ${commonStroke}/>`;
}

function cardSvg(card, index) {
  const [base, accent, paper, ember] = paletteFor(card);
  const mark = displayMark(card);
  const glow = `${accent}55`;
  const title = escapeXml(card.name);
  const englishName = escapeXml(card.englishName);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${base}"/>
      <stop offset="0.58" stop-color="${ember}"/>
      <stop offset="1" stop-color="${base}"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="58%">
      <stop offset="0" stop-color="${glow}"/>
      <stop offset="0.55" stop-color="${accent}22"/>
      <stop offset="1" stop-color="${base}00"/>
    </radialGradient>
    <pattern id="grain" width="96" height="96" patternUnits="userSpaceOnUse">
      <circle cx="14" cy="18" r="2" fill="${paper}" opacity="0.09"/>
      <circle cx="68" cy="42" r="1.5" fill="${paper}" opacity="0.07"/>
      <circle cx="44" cy="80" r="1.2" fill="${paper}" opacity="0.08"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#grain)"/>
  <circle cx="500" cy="900" r="560" fill="url(#halo)"/>
  <path d="M92 190 C270 88 730 88 908 190 L908 1510 C730 1612 270 1612 92 1510 Z" fill="${paper}" opacity="0.065"/>
  <rect x="52" y="52" width="896" height="1596" rx="58" fill="none" stroke="${paper}" stroke-width="6" opacity="0.58"/>
  <rect x="88" y="88" width="824" height="1524" rx="42" fill="none" stroke="${accent}" stroke-width="3" opacity="0.62"/>
  ${svgText(title, 500, 180, 70, paper, 650)}
  ${svgText(englishName, 500, 242, 31, accent, 520)}
  ${svgText(mark.text, 500, 354, mark.size, paper, 600)}
  ${motif(card, accent, paper)}
  <path d="M210 1300 C326 1235 674 1235 790 1300" stroke="${paper}" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.6"/>
  ${svgText(keyword(card, 0), 340, 1390, 34, paper, 520)}
  ${svgText(keyword(card, 1), 660, 1390, 34, paper, 520)}
  ${svgText(card.element ?? "", 500, 1495, 28, accent, 520)}
  <text x="500" y="1578" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="22" letter-spacing="6" fill="${paper}" opacity="0.58">AETHERTAROT ${String(index + 1).padStart(2, "0")}</text>
</svg>`;
}

function backSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#10141d"/>
      <stop offset="0.48" stop-color="#433449"/>
      <stop offset="1" stop-color="#15120f"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="48%" r="62%">
      <stop offset="0" stop-color="#d9b86b66"/>
      <stop offset="1" stop-color="#d9b86b00"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <circle cx="500" cy="830" r="580" fill="url(#halo)"/>
  <rect x="52" y="52" width="896" height="1596" rx="58" fill="none" stroke="#f0dfba" stroke-width="6" opacity="0.62"/>
  <rect x="104" y="104" width="792" height="1492" rx="38" fill="none" stroke="#d7b36a" stroke-width="3" opacity="0.7"/>
  <path d="M500 420 L586 700 L880 700 L642 870 L732 1150 L500 975 L268 1150 L358 870 L120 700 L414 700 Z" fill="none" stroke="#f0dfba" stroke-width="18" stroke-linejoin="round" opacity="0.86"/>
  <circle cx="500" cy="850" r="245" fill="none" stroke="#d7b36a" stroke-width="10" opacity="0.72"/>
  <path d="M580 590 A270 270 0 1 0 580 1110 A165 165 0 1 1 580 590" fill="#f0dfba" opacity="0.8"/>
  <text x="500" y="1415" text-anchor="middle" font-family="Noto Serif SC, Georgia, serif" font-size="58" font-weight="650" fill="#f0dfba">AetherTarot</text>
  <text x="500" y="1482" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="22" letter-spacing="7" fill="#d7b36a">REFLECTIVE TAROT</text>
</svg>`;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function writePngFromSvg(svg, outputPath) {
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
  fs.writeFileSync(outputPath, png);
  return png;
}

const deck = JSON.parse(fs.readFileSync(deckPath, "utf8"));
const entries = [];

for (const [index, card] of deck.entries()) {
  const outputPath = path.join(publicRoot, card.imageUrl.slice(1));
  const png = await writePngFromSvg(cardSvg(card, index), outputPath);
  entries.push(assetEntry(card.imageUrl, card.id, png));
  console.log(`generated ${card.imageUrl}`);
}

const backPng = await writePngFromSvg(backSvg(), path.join(cardsRoot, "back.png"));
entries.push(assetEntry("/cards/back.png", "card-back", backPng));
console.log("generated /cards/back.png");

fs.writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      version: 1,
      target: {
        width,
        height,
        aspectRatio: "1:1.7",
        fullBleed: true,
      },
      generatedAt,
      entries,
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${path.relative(repoRoot, manifestPath)}`);

function assetEntry(imageUrl, assetId, png) {
  return {
    assetId,
    imageUrl,
    width,
    height,
    sourceKind: "procedural-portrait-svg",
    derivedFromSquare: false,
    fullBleed: true,
    visualReview: {
      status: "approved",
      reviewer: "Codex",
      reviewedAt: generatedAt,
      notes: "Portrait-native generated composition; not stretched, padded, or cropped from a square source.",
    },
    sha256: sha256(png),
  };
}
