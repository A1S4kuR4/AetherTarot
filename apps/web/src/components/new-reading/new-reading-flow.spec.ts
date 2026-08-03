import { describe, expect, it } from "vitest";
import {
  CATEGORIZED_PROMPT_POOL,
  getPromptBatch,
  needsDecisionBoundary,
  normalizeDecisionQuestion,
  PROMPTS_PER_BATCH,
} from "./new-reading-flow";

describe("new reading prompt rotation", () => {
  it("keeps the first three batches unique for every category", () => {
    for (const category of Object.keys(CATEGORIZED_PROMPT_POOL) as Array<keyof typeof CATEGORIZED_PROMPT_POOL>) {
      const prompts = Array.from(
        { length: 3 },
        (_, batchIndex) => getPromptBatch(category, batchIndex),
      ).flat();

      expect(prompts).toHaveLength(PROMPTS_PER_BATCH * 3);
      expect(new Set(prompts)).toHaveLength(PROMPTS_PER_BATCH * 3);
    }
  });

  it("includes each specific category in every all-category batch", () => {
    for (let batchIndex = 0; batchIndex < 3; batchIndex += 1) {
      const prompts = getPromptBatch("all", batchIndex);

      for (const category of ["relationship", "career", "self_growth", "decision"] as const) {
        expect(prompts.some((prompt) => CATEGORIZED_PROMPT_POOL[category].includes(prompt))).toBe(true);
      }
    }
  });
});

describe("decision question normalization", () => {
  it("treats trim and newline-only differences as the same question", () => {
    expect(normalizeDecisionQuestion("  我应该离婚吗？\r\n")).toBe(
      normalizeDecisionQuestion("我应该离婚吗？"),
    );
  });

  it("remembers only the confirmed normalized question", () => {
    const confirmedQuestion = normalizeDecisionQuestion("我应该离婚吗？\n");

    expect(needsDecisionBoundary({
      isMajorDecisionQuestion: true,
      question: "  我应该离婚吗？  ",
      confirmedQuestion,
    })).toBe(false);
    expect(needsDecisionBoundary({
      isMajorDecisionQuestion: true,
      question: "我应该现在离婚吗？",
      confirmedQuestion,
    })).toBe(true);
  });
});
