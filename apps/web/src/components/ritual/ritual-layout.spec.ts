import { describe, expect, it } from "vitest";
import { getRitualPositionLayout } from "./ritual-layout";

describe("getRitualPositionLayout", () => {
  it.each([1, 3, 4, 7, 10])("returns one altar coordinate per %i-card spread", (count) => {
    expect(getRitualPositionLayout(count)).toHaveLength(count);
  });

  it("uses a centered deep arc without alternating labels for compact spreads", () => {
    const layout = getRitualPositionLayout(3);

    expect(layout[1]?.x).toBeCloseTo(0, 5);
    expect(layout[1]?.y).toBeLessThan(layout[0]?.y ?? 0);
    expect(layout.every((position) => !position.labelAbove)).toBe(true);
  });

  it("gives dense spreads enough horizontal and vertical clearance from the deck", () => {
    const sevenCardLayout = getRitualPositionLayout(7);
    const layout = getRitualPositionLayout(10);

    expect((layout[1]?.x ?? 0) - (layout[0]?.x ?? 0)).toBe(120);
    expect(sevenCardLayout[3]).toMatchObject({ x: 0, y: -280 });
    expect(layout[4]?.y).toBeLessThan(-275);
    expect(layout[4]?.y).toBeLessThan(layout[0]?.y ?? 0);
    expect(layout.map((position) => position.labelAbove)).toEqual([
      false,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
    ]);
  });
});
