export interface ReadingSpreadPoint {
  x: number;
  y: number;
  rotate?: 90;
}

export interface ReadingSpreadLayout {
  shortLabel: string;
  cardWidth: number;
  points: readonly ReadingSpreadPoint[];
}

export interface ReadingSpreadFieldMetrics {
  cardHeight: number;
  fieldHeight: number;
  fieldWidth: number;
}

const READING_SPREAD_LAYOUTS: Record<string, ReadingSpreadLayout> = {
  single: {
    shortLabel: "聚焦",
    cardWidth: 104,
    points: [{ x: 0, y: 0 }],
  },
  "holy-triangle": {
    shortLabel: "时间之流",
    cardWidth: 104,
    points: [
      { x: 0, y: -130 },
      { x: -110, y: 110 },
      { x: 110, y: 110 },
    ],
  },
  "four-aspects": {
    shortLabel: "四元素",
    cardWidth: 104,
    points: [
      { x: -115, y: -90 },
      { x: 115, y: -90 },
      { x: -115, y: 90 },
      { x: 115, y: 90 },
    ],
  },
  "seven-card": {
    shortLabel: "深度综合",
    cardWidth: 84,
    points: [
      { x: -220, y: 0 },
      { x: -110, y: 0 },
      { x: 0, y: 0 },
      { x: 110, y: 0 },
      { x: 220, y: 0 },
      { x: 110, y: -176 },
      { x: 110, y: 176 },
    ],
  },
  "celtic-cross": {
    shortLabel: "经典十字",
    cardWidth: 84,
    points: [
      { x: 0, y: 0 },
      { x: 0, y: 0, rotate: 90 },
      { x: 0, y: -176 },
      { x: 0, y: 176 },
      { x: -135, y: 0 },
      { x: 135, y: 0 },
      { x: 260, y: -264 },
      { x: 260, y: -88 },
      { x: 260, y: 88 },
      { x: 260, y: 264 },
    ],
  },
};

function createFallbackLayout(total: number): ReadingSpreadLayout {
  const cardWidth = total >= 7 ? 84 : 104;
  const gap = cardWidth + 24;
  const midpoint = (Math.max(total, 1) - 1) / 2;

  return {
    shortLabel: "牌阵结构",
    cardWidth,
    points: Array.from({ length: Math.max(total, 1) }, (_, index) => ({
      x: Math.round((index - midpoint) * gap),
      y: 0,
    })),
  };
}

export function getSpreadLayout(spreadId: string, total: number): ReadingSpreadLayout {
  const preset = READING_SPREAD_LAYOUTS[spreadId];

  if (preset?.points.length === total) {
    return preset;
  }

  return createFallbackLayout(total);
}

export function getSpreadFieldMetrics(
  layout: ReadingSpreadLayout,
): ReadingSpreadFieldMetrics {
  const cardHeight = layout.cardWidth * 1.7;
  const labelPadding = 44;
  const maxAbsX = Math.max(...layout.points.map((point) => Math.abs(point.x)), 0);
  const maxAbsY = Math.max(...layout.points.map((point) => Math.abs(point.y)), 0);

  return {
    cardHeight,
    fieldWidth: (maxAbsX + layout.cardWidth / 2 + labelPadding) * 2,
    fieldHeight: (maxAbsY + cardHeight / 2 + labelPadding) * 2,
  };
}
