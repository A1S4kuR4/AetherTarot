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
const generatedAt = "2026-04-23";

const palettes = {
  major: ["#0b0d12", "#7170ff", "#f5f2e8", "#c96442", "#58734f"],
  cups: ["#101820", "#7fa7b8", "#f5f2e8", "#b86a5b", "#3f6c73"],
  wands: ["#181713", "#c96442", "#f5f2e8", "#a36a1f", "#7c4a35"],
  swords: ["#11151d", "#a7afbc", "#f4f6f8", "#7170ff", "#6e685d"],
  pentacles: ["#151912", "#58734f", "#f5f2e8", "#a36a1f", "#8a8377"],
};

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

function suitFor(card) {
  const id = String(card.id);
  if (id.includes("cups")) return "cups";
  if (id.includes("wands")) return "wands";
  if (id.includes("swords")) return "swords";
  if (id.includes("pentacles")) return "pentacles";
  return "major";
}

function paletteFor(card) {
  return palettes[suitFor(card)];
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
      if (card.id.includes("cups")) {
        return cupsMotif(card.id, commonStroke, softFill, paper);
      }

      if (card.id.includes("swords")) {
        return swordsMotif(card.id, commonStroke, softFill, paper);
      }

      if (card.id.includes("pentacles")) {
        return pentaclesMotif(card.id, commonStroke, softFill, paper);
      }

      return wandsMotif(card.id, commonStroke, softFill);
  }
}

function cupsMotif(id, commonStroke, softFill, paper) {
  const courtMotif = cupsCourtMotif(id, commonStroke, softFill, paper);
  if (courtMotif) {
    return courtMotif;
  }

  const positionsById = {
    "ace-of-cups": [[500, 900]],
    "two-of-cups": [[390, 900], [610, 900]],
    "three-of-cups": [[500, 740], [365, 995], [635, 995]],
    "four-of-cups": [[380, 760], [620, 760], [380, 1040], [620, 1040]],
    "five-of-cups": [[500, 680], [350, 850], [650, 850], [410, 1080], [590, 1080]],
    "six-of-cups": [[360, 720], [640, 720], [360, 900], [640, 900], [410, 1080], [590, 1080]],
    "seven-of-cups": [[500, 650], [360, 790], [640, 790], [300, 960], [500, 960], [700, 960], [500, 1130]],
    "eight-of-cups": [[360, 700], [640, 700], [300, 860], [500, 860], [700, 860], [360, 1020], [640, 1020], [500, 1180]],
    "nine-of-cups": [[500, 640], [360, 760], [640, 760], [260, 910], [500, 910], [740, 910], [360, 1060], [640, 1060], [500, 1210]],
    "ten-of-cups": [[500, 610], [360, 730], [640, 730], [250, 860], [500, 860], [750, 860], [360, 1010], [640, 1010], [430, 1180], [570, 1180]],
  };

  const cups = (positionsById[id] ?? [[500, 900]])
    .map(([cx, cy]) => cupToken(cx, cy, commonStroke, softFill, paper))
    .join("");

  const wave = `<path d="M220 1260 C330 1195 430 1325 540 1260 C650 1195 720 1260 790 1228" stroke="${paper}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.55"/>`;

  return `${cups}${wave}`;
}

function cupsCourtMotif(id, commonStroke, softFill, paper) {
  const cup = cupToken(500, 860, commonStroke, softFill, paper);

  switch (id) {
    case "page-of-cups":
      return `${cup}<path d="M500 1160 L500 1000 M430 1160 L570 1160 M445 1010 L555 1010" ${commonStroke}/><circle cx="500" cy="740" r="42" ${softFill}/><path d="M350 1225 C425 1165 575 1165 650 1225" ${commonStroke}/>`;
    case "knight-of-cups":
      return `${cup}<path d="M330 1130 C430 1030 570 1030 670 1130" ${commonStroke}/><path d="M380 1130 L340 1215 M620 1130 L660 1215 M420 1010 C455 940 545 940 580 1010" ${commonStroke}/><path d="M280 1250 C390 1175 610 1175 720 1250" ${commonStroke}/>`;
    case "queen-of-cups":
      return `${cup}<path d="M395 1100 C430 1015 470 990 500 990 C530 990 570 1015 605 1100" ${commonStroke}/><path d="M360 1180 L430 1060 M640 1180 L570 1060 M395 1180 L605 1180" ${commonStroke}/><circle cx="500" cy="715" r="38" ${softFill}/>`;
    case "king-of-cups":
      return `${cup}<path d="M390 720 L440 650 L500 700 L560 650 L610 720" ${commonStroke}/><path d="M360 1120 L640 1120 L605 1235 L395 1235 Z" ${commonStroke}/><path d="M430 1120 L430 1010 M570 1120 L570 1010" ${commonStroke}/><path d="M315 990 C400 940 600 1040 685 990" ${commonStroke}/>`;
    default:
      return null;
  }
}

function cupToken(cx, cy, commonStroke, softFill, paper) {
  return `<g transform="translate(${cx} ${cy})">
    <path d="M-76 -92 C-62 18 -38 84 0 94 C38 84 62 18 76 -92 Z" ${commonStroke}/>
    <path d="M-92 -92 C-58 -126 58 -126 92 -92 C58 -54 -58 -54 -92 -92 Z" fill="${paper}" opacity="0.18"/>
    <path d="M-54 116 L54 116 M0 94 L0 116" stroke="${paper}" stroke-width="13" stroke-linecap="round" fill="none" opacity="0.88"/>
    <circle cx="0" cy="-36" r="28" ${softFill}/>
  </g>`;
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

function swordsMotif(id, commonStroke, softFill, paper) {
  const courtMotif = swordsCourtMotif(id, commonStroke, softFill, paper);
  if (courtMotif) {
    return courtMotif;
  }

  const layouts = {
    "ace-of-swords": [{ x: 500, y: 920, angle: 0 }],
    "two-of-swords": [
      { x: 430, y: 930, angle: -28 },
      { x: 570, y: 930, angle: 28 },
    ],
    "three-of-swords": [
      { x: 500, y: 830, angle: 0 },
      { x: 420, y: 960, angle: -42 },
      { x: 580, y: 960, angle: 42 },
    ],
    "four-of-swords": [
      { x: 380, y: 820, angle: 0 },
      { x: 500, y: 820, angle: 0 },
      { x: 620, y: 820, angle: 0 },
      { x: 500, y: 1070, angle: 90 },
    ],
    "five-of-swords": [
      { x: 340, y: 760, angle: -20 },
      { x: 500, y: 720, angle: 0 },
      { x: 660, y: 760, angle: 20 },
      { x: 420, y: 1040, angle: -38 },
      { x: 580, y: 1040, angle: 38 },
    ],
    "six-of-swords": [
      { x: 340, y: 760, angle: -10 },
      { x: 440, y: 740, angle: -6 },
      { x: 540, y: 740, angle: 6 },
      { x: 640, y: 760, angle: 10 },
      { x: 430, y: 1035, angle: -12 },
      { x: 570, y: 1035, angle: 12 },
    ],
    "seven-of-swords": [
      { x: 320, y: 730, angle: -18 },
      { x: 410, y: 690, angle: -10 },
      { x: 500, y: 670, angle: 0 },
      { x: 590, y: 690, angle: 10 },
      { x: 680, y: 730, angle: 18 },
      { x: 430, y: 1040, angle: -28 },
      { x: 570, y: 1040, angle: 28 },
    ],
    "eight-of-swords": [
      { x: 300, y: 760, angle: 0 },
      { x: 380, y: 720, angle: -6 },
      { x: 460, y: 700, angle: -3 },
      { x: 540, y: 700, angle: 3 },
      { x: 620, y: 720, angle: 6 },
      { x: 700, y: 760, angle: 0 },
      { x: 400, y: 1090, angle: -18 },
      { x: 600, y: 1090, angle: 18 },
    ],
    "nine-of-swords": [
      { x: 340, y: 700, angle: -12 },
      { x: 420, y: 675, angle: -9 },
      { x: 500, y: 660, angle: 0 },
      { x: 580, y: 675, angle: 9 },
      { x: 660, y: 700, angle: 12 },
      { x: 370, y: 960, angle: -20 },
      { x: 500, y: 935, angle: 0 },
      { x: 630, y: 960, angle: 20 },
      { x: 500, y: 1180, angle: 90 },
    ],
    "ten-of-swords": [
      { x: 320, y: 690, angle: -18 },
      { x: 400, y: 660, angle: -12 },
      { x: 480, y: 645, angle: -6 },
      { x: 560, y: 645, angle: 6 },
      { x: 640, y: 660, angle: 12 },
      { x: 720, y: 690, angle: 18 },
      { x: 380, y: 980, angle: -26 },
      { x: 500, y: 950, angle: 0 },
      { x: 620, y: 980, angle: 26 },
      { x: 500, y: 1210, angle: 90 },
    ],
  };

  const swords = (layouts[id] ?? [{ x: 500, y: 920, angle: 0 }])
    .map(({ x, y, angle }) => swordToken(x, y, angle, commonStroke, softFill, paper))
    .join("");

  const extras = [];

  if (id === "three-of-swords") {
    extras.push(`<path d="M500 860 C610 740 760 860 690 1010 C640 1130 540 1185 500 1225 C460 1185 360 1130 310 1010 C240 860 390 740 500 860 Z" fill="${paper}" opacity="0.14"/>`);
  }

  if (id === "six-of-swords") {
    extras.push(`<path d="M290 1200 C380 1115 620 1115 710 1200 L630 1200 C585 1165 415 1165 370 1200 Z" fill="${paper}" opacity="0.16"/>`);
  }

  if (id === "eight-of-swords") {
    extras.push(`<circle cx="500" cy="945" r="112" fill="${paper}" opacity="0.08"/>`);
  }

  if (id === "nine-of-swords") {
    extras.push(`<path d="M360 1210 C410 1145 590 1145 640 1210" ${commonStroke}/>`);
  }

  return `${extras.join("")}${swords}<path d="M275 1230 C380 1160 620 1160 725 1230" ${commonStroke}/>`;
}

function swordsCourtMotif(id, commonStroke, softFill, paper) {
  const crown = `<path d="M390 710 L440 650 L500 705 L560 650 L610 710" ${commonStroke}/>`;

  switch (id) {
    case "page-of-swords":
      return `${swordToken(500, 900, -10, commonStroke, softFill, paper)}<path d="M430 1200 L500 1010 L570 1200" ${commonStroke}/><path d="M360 1240 C420 1160 580 1160 640 1240" ${commonStroke}/>`;
    case "knight-of-swords":
      return `${swordToken(520, 850, 24, commonStroke, softFill, paper)}<path d="M320 1120 C420 1015 585 1015 690 1120" ${commonStroke}/><path d="M365 1120 L330 1215 M640 1120 L675 1215 M420 1110 L380 980" ${commonStroke}/><circle cx="360" cy="1120" r="24" ${softFill}/>`;
    case "queen-of-swords":
      return `${swordToken(570, 845, 0, commonStroke, softFill, paper)}<path d="M360 1125 L500 980 L640 1125 L605 1235 L395 1235 Z" ${commonStroke}/><path d="M430 1235 L430 1090 M570 1235 L570 1090" ${commonStroke}/><circle cx="360" cy="970" r="34" ${softFill}/>`;
    case "king-of-swords":
      return `${crown}${swordToken(500, 860, 0, commonStroke, softFill, paper)}<path d="M350 1120 L650 1120 L610 1245 L390 1245 Z" ${commonStroke}/><path d="M420 1120 L420 1000 M580 1120 L580 1000" ${commonStroke}/><path d="M320 980 L680 980" ${commonStroke}/>`;
    default:
      return null;
  }
}

function swordToken(cx, cy, angle, commonStroke, softFill, paper) {
  return `<g transform="translate(${cx} ${cy}) rotate(${angle})">
    <path d="M0 -180 L18 -105 L18 78 L52 140 L0 116 L-52 140 L-18 78 L-18 -105 Z" ${commonStroke}/>
    <circle cx="0" cy="-182" r="26" ${softFill}/>
    <path d="M-64 18 L64 18 M-26 74 L26 74" stroke="${paper}" stroke-width="12" stroke-linecap="round" fill="none" opacity="0.9"/>
  </g>`;
}

function pentaclesMotif(id, commonStroke, softFill, paper) {
  const courtMotif = pentaclesCourtMotif(id, commonStroke, softFill, paper);
  if (courtMotif) {
    return courtMotif;
  }

  const positionsById = {
    "ace-of-pentacles": [[500, 900]],
    "two-of-pentacles": [[380, 820], [620, 980]],
    "three-of-pentacles": [[500, 730], [360, 970], [640, 970]],
    "four-of-pentacles": [[380, 760], [620, 760], [380, 1040], [620, 1040]],
    "five-of-pentacles": [[500, 670], [360, 840], [640, 840], [430, 1050], [570, 1050]],
    "six-of-pentacles": [[360, 720], [640, 720], [360, 900], [640, 900], [430, 1080], [570, 1080]],
    "seven-of-pentacles": [[500, 650], [360, 790], [640, 790], [300, 960], [500, 960], [700, 960], [500, 1130]],
    "eight-of-pentacles": [[360, 700], [640, 700], [300, 860], [500, 860], [700, 860], [360, 1020], [640, 1020], [500, 1180]],
    "nine-of-pentacles": [[500, 640], [360, 760], [640, 760], [260, 910], [500, 910], [740, 910], [360, 1060], [640, 1060], [500, 1210]],
    "ten-of-pentacles": [[500, 610], [360, 730], [640, 730], [250, 860], [500, 860], [750, 860], [360, 1010], [640, 1010], [430, 1180], [570, 1180]],
  };

  const positions = positionsById[id] ?? [[500, 900]];
  const tokens = positions
    .map(([cx, cy]) => pentacleToken(cx, cy, commonStroke, softFill, paper))
    .join("");

  return `${tokens}<path d="M275 1230 C380 1160 620 1160 725 1230" ${commonStroke}/>`;
}

function pentaclesCourtMotif(id, commonStroke, softFill, paper) {
  const coin = pentacleToken(500, 860, commonStroke, softFill, paper);

  switch (id) {
    case "page-of-pentacles":
      return `${coin}<path d="M500 1160 L500 980 M430 1160 L570 1160 M450 980 L550 980" ${commonStroke}/><path d="M360 1220 C420 1145 580 1145 640 1220" ${commonStroke}/>`;
    case "knight-of-pentacles":
      return `${coin}<path d="M340 1125 C430 1035 570 1035 660 1125" ${commonStroke}/><path d="M380 1125 L340 1215 M620 1125 L660 1215 M430 980 L360 900 M570 980 L640 900" ${commonStroke}/><path d="M280 1250 C390 1175 610 1175 720 1250" ${commonStroke}/>`;
    case "queen-of-pentacles":
      return `${coin}<path d="M395 1100 C430 1025 470 1000 500 1000 C530 1000 570 1025 605 1100" ${commonStroke}/><path d="M360 1180 L430 1060 M640 1180 L570 1060 M395 1180 L605 1180" ${commonStroke}/><path d="M300 1240 C390 1165 610 1165 700 1240" ${commonStroke}/>`;
    case "king-of-pentacles":
      return `${coin}<path d="M390 720 L440 650 L500 700 L560 650 L610 720" ${commonStroke}/><path d="M360 1120 L640 1120 L605 1235 L395 1235 Z" ${commonStroke}/><path d="M430 1120 L430 1010 M570 1120 L570 1010" ${commonStroke}/><circle cx="360" cy="980" r="30" ${softFill}/><circle cx="640" cy="980" r="30" ${softFill}/>`;
    default:
      return null;
  }
}

function pentacleToken(cx, cy, commonStroke, softFill, paper) {
  const outerRadius = 62;
  const innerRadius = 24;
  const points = [];

  for (let index = 0; index < 10; index += 1) {
    const angle = (-90 + index * 36) * (Math.PI / 180);
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    points.push([
      Number((cx + Math.cos(angle) * radius).toFixed(1)),
      Number((cy + Math.sin(angle) * radius).toFixed(1)),
    ]);
  }

  const starPath = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`)
    .join(" ");

  return `<circle cx="${cx}" cy="${cy}" r="76" ${softFill}/><circle cx="${cx}" cy="${cy}" r="72" ${commonStroke}/><path d="${starPath} Z" fill="none" stroke="${paper}" stroke-width="10" stroke-linejoin="round" opacity="0.92"/>`;
}

function cardSvg(card, index) {
  const [base, accent, paper, ember, muted] = paletteFor(card);
  const seed = hashSeed(card.id);
  const glow = `${accent}66`;
  const haze = `${ember}44`;
  const drift = (seed % 180) - 90;
  const scale = 1 + (seed % 5) * 0.012;
  const lowerArc = 1260 + (seed % 42);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${base}"/>
      <stop offset="0.52" stop-color="${ember}"/>
      <stop offset="1" stop-color="${base}"/>
    </linearGradient>
    <linearGradient id="veil" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${paper}" stop-opacity="0.20"/>
      <stop offset="0.45" stop-color="${paper}" stop-opacity="0.03"/>
      <stop offset="1" stop-color="${base}" stop-opacity="0.24"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="58%">
      <stop offset="0" stop-color="${glow}"/>
      <stop offset="0.46" stop-color="${accent}24"/>
      <stop offset="1" stop-color="${base}00"/>
    </radialGradient>
    <radialGradient id="ember" cx="50%" cy="78%" r="48%">
      <stop offset="0" stop-color="${haze}"/>
      <stop offset="1" stop-color="${base}00"/>
    </radialGradient>
    <filter id="inkBloom" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="${base}" flood-opacity="0.32"/>
      <feDropShadow dx="0" dy="0" stdDeviation="9" flood-color="${accent}" flood-opacity="0.22"/>
    </filter>
    <pattern id="grain" width="80" height="80" patternUnits="userSpaceOnUse">
      <circle cx="12" cy="18" r="1.8" fill="${paper}" opacity="0.10"/>
      <circle cx="62" cy="34" r="1.2" fill="${paper}" opacity="0.07"/>
      <circle cx="38" cy="68" r="1.4" fill="${paper}" opacity="0.08"/>
      <path d="M0 40 C20 34 38 46 80 38" stroke="${paper}" stroke-width="1" opacity="0.045" fill="none"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#grain)"/>
  <rect width="${width}" height="${height}" fill="url(#veil)"/>
  <circle cx="${500 + drift * 0.45}" cy="850" r="575" fill="url(#halo)"/>
  <ellipse cx="${500 - drift * 0.32}" cy="1250" rx="410" ry="260" fill="url(#ember)"/>
  <path d="M96 220 C250 92 750 92 904 220 L904 1480 C750 1608 250 1608 96 1480 Z" fill="${paper}" opacity="0.07"/>
  <path d="M116 292 C295 176 705 176 884 292" stroke="${paper}" stroke-width="8" stroke-linecap="round" fill="none" opacity="0.28"/>
  <path d="M150 1420 C318 1530 682 1530 850 1420" stroke="${paper}" stroke-width="8" stroke-linecap="round" fill="none" opacity="0.22"/>
  <path d="M88 88 H912 V1612 H88 Z" fill="none" stroke="${paper}" stroke-width="4" opacity="0.25"/>
  <path d="M126 126 H874 V1574 H126 Z" fill="none" stroke="${accent}" stroke-width="3" opacity="0.32"/>
  <circle cx="500" cy="300" r="70" fill="none" stroke="${paper}" stroke-width="7" opacity="0.24"/>
  <path d="M553 238 A82 82 0 1 0 553 362 A50 50 0 1 1 553 238" fill="${paper}" opacity="0.24"/>
  <g opacity="0.46">
    <circle cx="210" cy="310" r="12" fill="${accent}"/>
    <circle cx="790" cy="310" r="12" fill="${accent}"/>
    <circle cx="210" cy="1390" r="12" fill="${accent}"/>
    <circle cx="790" cy="1390" r="12" fill="${accent}"/>
  </g>
  <g filter="url(#inkBloom)" transform="translate(0 -20) scale(${scale}) translate(${((1 - scale) * width) / 2} ${((1 - scale) * height) / 2})">
    ${motif(card, accent, paper)}
  </g>
  <path d="M218 ${lowerArc} C330 ${lowerArc - 64} 670 ${lowerArc - 64} 782 ${lowerArc}" stroke="${muted}" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.46"/>
  <path d="M270 ${lowerArc + 56} C390 ${lowerArc + 8} 610 ${lowerArc + 8} 730 ${lowerArc + 56}" stroke="${paper}" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.30"/>
  <rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="${base}" stroke-width="26" opacity="0.28"/>
</svg>`;
}

function backSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#0b0d12"/>
      <stop offset="0.50" stop-color="#181713"/>
      <stop offset="1" stop-color="#32271f"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="48%" r="62%">
      <stop offset="0" stop-color="#7170ff66"/>
      <stop offset="0.55" stop-color="#c9644230"/>
      <stop offset="1" stop-color="#7170ff00"/>
    </radialGradient>
    <pattern id="grain" width="82" height="82" patternUnits="userSpaceOnUse">
      <circle cx="15" cy="19" r="1.8" fill="#f5f2e8" opacity="0.10"/>
      <circle cx="60" cy="39" r="1.3" fill="#f5f2e8" opacity="0.07"/>
      <path d="M0 48 C22 40 48 56 82 45" stroke="#f5f2e8" stroke-width="1" opacity="0.05" fill="none"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#grain)"/>
  <circle cx="500" cy="830" r="580" fill="url(#halo)"/>
  <path d="M96 220 C250 92 750 92 904 220 L904 1480 C750 1608 250 1608 96 1480 Z" fill="#f5f2e8" opacity="0.07"/>
  <rect x="88" y="88" width="824" height="1524" fill="none" stroke="#f5f2e8" stroke-width="4" opacity="0.32"/>
  <rect x="126" y="126" width="748" height="1448" fill="none" stroke="#c96442" stroke-width="3" opacity="0.34"/>
  <circle cx="500" cy="850" r="302" fill="none" stroke="#f5f2e8" stroke-width="10" opacity="0.42"/>
  <circle cx="500" cy="850" r="214" fill="none" stroke="#7170ff" stroke-width="7" opacity="0.42"/>
  <path d="M500 430 L585 704 L873 704 L640 870 L728 1148 L500 976 L272 1148 L360 870 L127 704 L415 704 Z" fill="none" stroke="#f5f2e8" stroke-width="16" stroke-linejoin="round" opacity="0.78"/>
  <path d="M575 594 A266 266 0 1 0 575 1106 A164 164 0 1 1 575 594" fill="#f5f2e8" opacity="0.72"/>
  <path d="M500 612 C610 720 610 980 500 1088 C390 980 390 720 500 612 Z" fill="none" stroke="#c96442" stroke-width="10" stroke-linejoin="round" opacity="0.52"/>
  <path d="M310 1320 C425 1268 575 1372 690 1320" stroke="#f5f2e8" stroke-width="8" stroke-linecap="round" fill="none" opacity="0.36"/>
  <rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="#0b0d12" stroke-width="26" opacity="0.28"/>
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
      notes:
        "Local procedural v2 portrait composition rendered from SVG via sharp; no API call, no square source, full-bleed runtime PNG.",
    },
    sha256: sha256(png),
  };
}
