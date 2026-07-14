import { describe, expect, it, vi } from "vitest";
import {
  AGENT_PROFILE_LEGACY_ALIASES,
  normalizeAgentProfile,
  restoreAgentProfile,
  type AgentProfile,
} from "./index";

describe("agent profile normalization", () => {
  describe("normalizeAgentProfile (strict, for API validation)", () => {
    it.each<[unknown, AgentProfile | null]>([
      ["lite", "lite"],
      ["standard", "standard"],
      ["sober", "sober"],
      ["quick", "lite"],
      ["daily", "standard"],
      ["professional", "sober"],
      ["clear", "sober"],
      ["rational", "sober"],
      ["default", "standard"],
      // case-insensitive
      ["LITE", "lite"],
      ["Standard", "standard"],
      ["PROFESSIONAL", "sober"],
      // whitespace trimming
      ["  lite  ", "lite"],
      [" daily ", "standard"],
      // unknown / malformed
      ["unknown-reader", null],
      ["expert-v2", null],
      ["", null],
      ["   ", null],
      [null, null],
      [undefined, null],
      [123, null],
      [{}, null],
      [[], null],
    ])("normalizeAgentProfile(%j) === %j", (input, expected) => {
      expect(normalizeAgentProfile(input)).toBe(expected);
    });
  });

  describe("restoreAgentProfile (lenient, for drafts/history)", () => {
    it.each<[unknown, AgentProfile]>([
      ["lite", "lite"],
      ["standard", "standard"],
      ["sober", "sober"],
      ["quick", "lite"],
      ["daily", "standard"],
      ["professional", "sober"],
      ["clear", "sober"],
      ["rational", "sober"],
      ["default", "standard"],
      ["LITE", "lite"],
      ["  daily ", "standard"],
      // safe fallback for unknown/malformed
      ["unknown-reader", "standard"],
      ["expert-v2", "standard"],
      ["", "standard"],
      ["   ", "standard"],
      [null, "standard"],
      [undefined, "standard"],
      [123, "standard"],
      [{}, "standard"],
      [[], "standard"],
    ])("restoreAgentProfile(%j) === %j", (input, expected) => {
      expect(restoreAgentProfile(input)).toBe(expected);
    });

    it("invokes the fallback callback for unknown values", () => {
      const onFallback = vi.fn();
      const result = restoreAgentProfile("expert-v2", onFallback);

      expect(result).toBe("standard");
      expect(onFallback).toHaveBeenCalledTimes(1);
      expect(onFallback).toHaveBeenCalledWith("expert-v2", "standard");
    });

    it("does not invoke the fallback callback for known canonical or alias values", () => {
      const onFallback = vi.fn();

      expect(restoreAgentProfile("professional", onFallback)).toBe("sober");
      expect(restoreAgentProfile("lite", onFallback)).toBe("lite");
      expect(restoreAgentProfile("standard", onFallback)).toBe("standard");
      expect(onFallback).not.toHaveBeenCalled();
    });

    it("exposes the expected legacy alias set", () => {
      expect(AGENT_PROFILE_LEGACY_ALIASES).toMatchObject({
        quick: "lite",
        daily: "standard",
        default: "standard",
        professional: "sober",
        clear: "sober",
        rational: "sober",
      });
    });
  });
});
