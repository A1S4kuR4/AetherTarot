export const NEW_READING_QUESTION_DRAFT_STORAGE_KEY = "aether_tarot_new_question_draft_v1";

type DraftStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export function readNewReadingQuestionDraft(storage: DraftStorage): string | null {
  const draft = storage.getItem(NEW_READING_QUESTION_DRAFT_STORAGE_KEY);

  return draft?.trim() ? draft : null;
}

export function saveNewReadingQuestionDraft(storage: DraftStorage, question: string): boolean {
  if (!question.trim()) {
    storage.removeItem(NEW_READING_QUESTION_DRAFT_STORAGE_KEY);
    return false;
  }

  storage.setItem(NEW_READING_QUESTION_DRAFT_STORAGE_KEY, question);
  return true;
}
