import { describe, expect, it } from "vitest";
import { FALLBACK_LAYOUT, getSpreadLayout } from "./spreadLayout";

// Canonical spreads shipped by the product: 1 / 3 / 4 / 7 / 10 cards.
// Each must keep a dedicated composition; a regression to the generic
// flex-wrap fallback must fail here instead of shipping silently.
const CANONICAL_SPREADS: Array<{ spreadId: string; total: number }> = [
  { spreadId: "single", total: 1 },
  { spreadId: "holy-triangle", total: 3 },
  { spreadId: "four-aspects", total: 4 },
  { spreadId: "seven-card", total: 7 },
  { spreadId: "celtic-cross", total: 10 },
];

describe("getSpreadLayout", () => {
  it("gives every canonical spread a dedicated composition", () => {
    for (const { spreadId, total } of CANONICAL_SPREADS) {
      const layout = getSpreadLayout(spreadId, total);
      expect(layout.container, spreadId).not.toBe(FALLBACK_LAYOUT.container);
    }
  });

  it("keeps distinct containers per canonical spread", () => {
    const containers = CANONICAL_SPREADS.map(
      ({ spreadId, total }) => getSpreadLayout(spreadId, total).container,
    );
    expect(new Set(containers).size).toBe(CANONICAL_SPREADS.length);
  });

  it("anchors the four-aspects spread on a two-column grid", () => {
    const layout = getSpreadLayout("four-aspects", 4);
    expect(layout.container).toContain("grid");
    expect(layout.container).toContain("grid-cols-2");
  });

  it("lays the celtic-cross out as a structured grid on desktop", () => {
    const layout = getSpreadLayout("celtic-cross", 10);
    expect(layout.container).toContain("md:grid");
    expect(layout.container).toContain("md:grid-cols-4");
    expect(layout.isEmphasized(0)).toBe(true);
    expect(layout.isEmphasized(1)).toBe(true);
    expect(layout.isEmphasized(2)).toBe(false);
  });

  it("emphasizes the answer axis of the seven-card spread", () => {
    const layout = getSpreadLayout("seven-card", 7);
    expect(layout.isEmphasized(3)).toBe(true);
    expect(layout.isEmphasized(0)).toBe(false);
  });

  it("falls back to the generic layout only for unknown spreads", () => {
    expect(getSpreadLayout("unknown-spread", 5).container).toBe(
      FALLBACK_LAYOUT.container,
    );
    expect(getSpreadLayout("holy-triangle", 2).container).toBe(
      FALLBACK_LAYOUT.container,
    );
  });
});
