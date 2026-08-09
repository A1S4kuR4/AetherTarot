import { describe, expect, it } from "vitest";
import { getSpreadFieldMetrics, getSpreadLayout } from "./spreadLayout";

const CANONICAL_SPREADS = [
  { spreadId: "single", total: 1, shortLabel: "聚焦" },
  { spreadId: "holy-triangle", total: 3, shortLabel: "时间之流" },
  { spreadId: "four-aspects", total: 4, shortLabel: "四元素" },
  { spreadId: "seven-card", total: 7, shortLabel: "深度综合" },
  { spreadId: "celtic-cross", total: 10, shortLabel: "经典十字" },
] as const;

describe("reading altar spread layouts", () => {
  it("provides a complete semantic coordinate preset for every canonical spread", () => {
    for (const { spreadId, total, shortLabel } of CANONICAL_SPREADS) {
      const layout = getSpreadLayout(spreadId, total);
      expect(layout.points, spreadId).toHaveLength(total);
      expect(layout.shortLabel, spreadId).toBe(shortLabel);
    }
  });

  it("keeps the widened seven-card vertical positions", () => {
    const layout = getSpreadLayout("seven-card", 7);

    expect(layout.points[5]).toEqual({ x: 110, y: -176 });
    expect(layout.points[6]).toEqual({ x: 110, y: 176 });
  });

  it("keeps the celtic challenge crossed above the core and widens the staff", () => {
    const layout = getSpreadLayout("celtic-cross", 10);

    expect(layout.points[1]).toEqual({ x: 0, y: 0, rotate: 90 });
    expect(layout.points.slice(6).map((point) => point.y)).toEqual([-264, -88, 88, 264]);
  });

  it("derives a positive field box for responsive stage fitting", () => {
    const metrics = getSpreadFieldMetrics(getSpreadLayout("celtic-cross", 10));

    expect(metrics.fieldWidth).toBeGreaterThan(600);
    expect(metrics.fieldHeight).toBeGreaterThan(600);
    expect(metrics.cardHeight).toBeCloseTo(142.8);
  });

  it("falls back without borrowing a canonical preset when the card count mismatches", () => {
    const layout = getSpreadLayout("holy-triangle", 2);

    expect(layout.shortLabel).toBe("牌阵结构");
    expect(layout.points).toHaveLength(2);
  });
});
