export interface RitualPositionLayout {
  x: number;
  y: number;
  labelAbove: boolean;
}

const DENSE_SPACING = 120;
const DENSE_ARCH_TOP = -280;
const DENSE_ARCH_DEPTH = 136;

export function getRitualPositionLayout(count: number): RitualPositionLayout[] {
  if (count <= 0) {
    return [];
  }

  if (count >= 6) {
    const maxX = (DENSE_SPACING * (count - 1)) / 2;

    return Array.from({ length: count }, (_, index) => {
      const x = index * DENSE_SPACING - maxX;
      const normalizedX = maxX === 0 ? 0 : x / maxX;

      return {
        x,
        y: DENSE_ARCH_TOP + DENSE_ARCH_DEPTH * normalizedX ** 2,
        labelAbove: index % 2 === 1,
      };
    });
  }

  const arcSpan = count === 1 ? 0 : Math.min(140 + (count - 3) * 10, 170);
  const baseRadius = 228 + Math.max(0, count - 3) * 5;

  return Array.from({ length: count }, (_, index) => {
    const angle =
      count === 1
        ? 270
        : 270 - arcSpan / 2 + (arcSpan * index) / (count - 1);
    const radians = (angle * Math.PI) / 180;
    const radius = baseRadius + 36 * Math.cos(((angle - 270) * Math.PI) / 180);

    return {
      x: radius * Math.cos(radians),
      y: radius * Math.sin(radians),
      labelAbove: false,
    };
  });
}
