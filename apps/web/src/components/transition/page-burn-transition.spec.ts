import { describe, expect, it } from "vitest";
import { getBurnIgnition, getBurnPixelRatio } from "./page-burn-transition";

describe("page burn transition geometry", () => {
  it("maps a button center into WebGL coordinates with an inverted y axis", () => {
    expect(
      getBurnIgnition(
        { left: 400, top: 600, width: 200, height: 100 },
        1000,
        1000,
      ),
    ).toEqual({ x: 0.5, y: 0.35 });
  });

  it("clamps an ignition point to the visible viewport", () => {
    expect(
      getBurnIgnition(
        { left: -200, top: 1200, width: 100, height: 100 },
        1000,
        1000,
      ),
    ).toEqual({ x: 0, y: 0 });
  });

  it("caps render density by device ratio and maximum texture dimensions", () => {
    expect(getBurnPixelRatio(1000, 800, 3)).toBe(1.5);
    expect(getBurnPixelRatio(3200, 1800, 2)).toBe(0.5);
  });
});
