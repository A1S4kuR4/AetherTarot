import { describe, expect, it } from "vitest";
import { getContentBudget } from "./constants";

describe("getContentBudget", () => {
  it("allows more content for 1-3 cards", () => {
    const budget = getContentBudget(3);
    expect(budget.maxQuestionLines).toBe(4);
    expect(budget.maxSynthesisLines).toBe(8);
    expect(budget.maxGuidanceCount).toBe(3);
  });

  it("reduces budget for 4-7 cards", () => {
    const budget = getContentBudget(7);
    expect(budget.maxQuestionLines).toBe(3);
    expect(budget.maxSynthesisLines).toBe(6);
    expect(budget.maxGuidanceCount).toBe(2);
  });

  it("uses the tightest budget for 8-10 cards", () => {
    const budget = getContentBudget(10);
    expect(budget.maxQuestionLines).toBe(2);
    expect(budget.maxSynthesisLines).toBe(4);
    expect(budget.maxGuidanceCount).toBe(2);
  });
});
