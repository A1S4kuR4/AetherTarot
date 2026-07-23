import { describe, expect, it } from "vitest";
import {
  createCanaryTokenGate,
  isCanaryReport,
} from "@/server/quality/canary";

describe("LLM canary quality guard", () => {
  it("allows exactly five fake transport calls and settles each reservation once", async () => {
    const canary = createCanaryTokenGate();

    for (let index = 0; index < 5; index += 1) {
      const reservation = await canary.gate.reserve({
        source: "reading",
        promptText: "fixed canary prompt",
        maxOutputTokens: 800,
      });
      await canary.gate.settle({ reservation, actualTokens: 500 });
    }

    expect(canary.snapshot()).toEqual({
      settled_tokens: 2_500,
      reservations: 5,
      settled_reservations: 5,
    });
    await expect(canary.gate.reserve({
      source: "reading",
      promptText: "sixth call",
      maxOutputTokens: 100,
    })).rejects.toThrow(/five|5-call/);
  });

  it("rejects token overrun and duplicate settlement", async () => {
    const canary = createCanaryTokenGate({ tokenBudget: 100, callLimit: 5 });
    const reservation = await canary.gate.reserve({
      source: "reading",
      promptText: "short",
      maxOutputTokens: 20,
    });
    await canary.gate.settle({ reservation, actualTokens: 90 });
    await expect(canary.gate.settle({
      reservation,
      actualTokens: 1,
    })).rejects.toThrow(/more than once/);
    await expect(canary.gate.reserve({
      source: "reading",
      promptText: "another prompt",
      maxOutputTokens: 20,
    })).rejects.toThrow(/budget/);
  });

  it("validates the report envelope", () => {
    expect(isCanaryReport({
      version: 1,
      cases: [],
      failures: [],
      budget: {
        maximum_tokens: 12_000,
        settled_tokens: 0,
        reservations: 0,
      },
    })).toBe(true);
    expect(isCanaryReport({ version: 1, cases: [] })).toBe(false);
  });
});
