import { describe, expect, it } from "vitest";
import {
  ACCOUNT_NEW_READING_QUESTION_DRAFT_STORAGE_KEY,
  GUEST_NEW_READING_QUESTION_DRAFT_STORAGE_KEY,
  LEGACY_NEW_READING_QUESTION_DRAFT_STORAGE_KEY,
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

describe("identity-scoped new reading question draft", () => {
  it("restores a guest draft after refresh without exposing it to account A", () => {
    const local = createStorage();
    const session = createStorage();
    saveNewReadingQuestionDraft({ kind: "guest", storage: local }, "guest draft");

    expect(readNewReadingQuestionDraft({ kind: "guest", storage: local })).toBe("guest draft");
    expect(readNewReadingQuestionDraft({ kind: "account", storage: session, ownerId: "a@example.test" })).toBeNull();
  });

  it("does not expose account A draft to guest or account B", () => {
    const local = createStorage();
    const session = createStorage();
    saveNewReadingQuestionDraft({ kind: "account", storage: session, ownerId: "a@example.test" }, "A draft");

    expect(readNewReadingQuestionDraft({ kind: "guest", storage: local })).toBeNull();
    expect(readNewReadingQuestionDraft({ kind: "account", storage: session, ownerId: "b@example.test" })).toBeNull();
    expect(session.getItem(ACCOUNT_NEW_READING_QUESTION_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("keeps guest draft when guest signs into account A", () => {
    const local = createStorage();
    const session = createStorage();
    saveNewReadingQuestionDraft({ kind: "guest", storage: local }, "guest draft");
    saveNewReadingQuestionDraft({ kind: "account", storage: session, ownerId: "a@example.test" }, "A draft");

    expect(readNewReadingQuestionDraft({ kind: "guest", storage: local })).toBe("guest draft");
    expect(readNewReadingQuestionDraft({ kind: "account", storage: session, ownerId: "a@example.test" })).toBe("A draft");
  });

  it("deletes the legacy global key without importing it into either scope", () => {
    const local = createStorage({ [LEGACY_NEW_READING_QUESTION_DRAFT_STORAGE_KEY]: "legacy" });
    expect(readNewReadingQuestionDraft({ kind: "guest", storage: local })).toBeNull();
    expect(local.getItem(LEGACY_NEW_READING_QUESTION_DRAFT_STORAGE_KEY)).toBeNull();
    expect(local.getItem(GUEST_NEW_READING_QUESTION_DRAFT_STORAGE_KEY)).toBeNull();
  });
});
