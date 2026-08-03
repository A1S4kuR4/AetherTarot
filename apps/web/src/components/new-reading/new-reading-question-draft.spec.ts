import { describe, expect, it } from "vitest";
import {
  NEW_READING_QUESTION_DRAFT_STORAGE_KEY,
  readNewReadingQuestionDraft,
  saveNewReadingQuestionDraft,
} from "./new-reading-question-draft";

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));

  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("new reading question draft", () => {
  it("persists and restores the exact unsubmitted question", () => {
    const storage = createStorage();
    const question = "我现在最需要看清什么？\n请从关系与工作两方面看。";

    expect(saveNewReadingQuestionDraft(storage, question)).toBe(true);
    expect(readNewReadingQuestionDraft(storage)).toBe(question);
  });

  it("removes a blank draft instead of treating it as saved", () => {
    const storage = createStorage({
      [NEW_READING_QUESTION_DRAFT_STORAGE_KEY]: "之前的问题",
    });

    expect(saveNewReadingQuestionDraft(storage, "  \n ")).toBe(false);
    expect(readNewReadingQuestionDraft(storage)).toBeNull();
  });
});
