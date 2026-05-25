import { describe, expect, it } from "vitest";
import { getReservationTokenCount } from "@/server/beta/token-budget";

describe("llm token budget", () => {
  it("reserves UTF-8 prompt bytes plus the maximum output tokens", () => {
    expect(getReservationTokenCount("abc", 100)).toBe(103);
    expect(getReservationTokenCount("塔罗", 100)).toBe(106);
  });
});
