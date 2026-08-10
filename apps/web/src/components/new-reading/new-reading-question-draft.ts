export const LEGACY_NEW_READING_QUESTION_DRAFT_STORAGE_KEY = "aether_tarot_new_question_draft_v1";
export const GUEST_NEW_READING_QUESTION_DRAFT_STORAGE_KEY = "aether_tarot_guest_question_draft_v1";
export const ACCOUNT_NEW_READING_QUESTION_DRAFT_STORAGE_KEY = "aether_tarot_account_question_draft_v1";
const ACCOUNT_DRAFT_OWNER_STORAGE_KEY = "aether_tarot_account_question_draft_owner_v1";

type DraftStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;
export type QuestionDraftScope =
  | { kind: "guest"; storage: DraftStorage }
  | { kind: "account"; storage: DraftStorage; ownerId: string };

function opaqueOwnerId(identity: string) {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(identity)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return `v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function getScopeKey(scope: QuestionDraftScope) {
  return scope.kind === "guest"
    ? GUEST_NEW_READING_QUESTION_DRAFT_STORAGE_KEY
    : ACCOUNT_NEW_READING_QUESTION_DRAFT_STORAGE_KEY;
}

export function retireLegacyNewReadingQuestionDraft(storage: DraftStorage) {
  storage.removeItem(LEGACY_NEW_READING_QUESTION_DRAFT_STORAGE_KEY);
}

export function readNewReadingQuestionDraft(scope: QuestionDraftScope): string | null {
  retireLegacyNewReadingQuestionDraft(scope.storage);
  if (scope.kind === "account") {
    const expectedOwner = opaqueOwnerId(scope.ownerId);
    if (scope.storage.getItem(ACCOUNT_DRAFT_OWNER_STORAGE_KEY) !== expectedOwner) {
      scope.storage.removeItem(ACCOUNT_DRAFT_OWNER_STORAGE_KEY);
      scope.storage.removeItem(ACCOUNT_NEW_READING_QUESTION_DRAFT_STORAGE_KEY);
      return null;
    }
  }
  const draft = scope.storage.getItem(getScopeKey(scope));
  return draft?.trim() ? draft : null;
}

export function saveNewReadingQuestionDraft(scope: QuestionDraftScope, question: string): boolean {
  retireLegacyNewReadingQuestionDraft(scope.storage);
  const key = getScopeKey(scope);
  if (!question.trim()) {
    scope.storage.removeItem(key);
    if (scope.kind === "account") scope.storage.removeItem(ACCOUNT_DRAFT_OWNER_STORAGE_KEY);
    return false;
  }
  if (scope.kind === "account") {
    scope.storage.setItem(ACCOUNT_DRAFT_OWNER_STORAGE_KEY, opaqueOwnerId(scope.ownerId));
  }
  scope.storage.setItem(key, question);
  return true;
}
