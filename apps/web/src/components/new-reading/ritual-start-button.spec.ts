import { describe, expect, it } from "vitest";
import {
  getRitualStartHoldProgress,
  RITUAL_START_HOLD_MS,
} from "./ritual-start-button";

describe("ritual start hold progress", () => {
  it("advances linearly over the configured hold duration", () => {
    expect(getRitualStartHoldProgress(100, 450)).toBe(0.5);
    expect(RITUAL_START_HOLD_MS).toBe(700);
  });

  it("clamps progress before and after the hold window", () => {
    expect(getRitualStartHoldProgress(100, 50)).toBe(0);
    expect(getRitualStartHoldProgress(100, 900)).toBe(1);
  });
});
