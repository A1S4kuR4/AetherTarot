import type { ReadingHistoryEntry } from "@aethertarot/shared-types";

export const ACCOUNT_READING_OUTBOX_STORAGE_KEY = "aether_tarot_account_reading_outbox_v1";
const ACCOUNT_READING_OUTBOX_LOCK_NAME = "aethertarot:account-reading-outbox:v1";
type StorageLike = Pick<Storage, "getItem" | "setItem">;
type OutboxRecord = { owner: string; entry: ReadingHistoryEntry };
export type AccountReadingOutboxLockManager = {
  request<T>(name: string, callback: () => Promise<T> | T): Promise<T>;
};

function getBrowserLockManager(): AccountReadingOutboxLockManager {
  if (typeof navigator !== "undefined" && navigator.locks) return navigator.locks;
  throw new Error("Account outbox transactional storage is unavailable in this browser.");
}

function ownerFingerprint(identity: string) {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(identity)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return `v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function readAll(storage: StorageLike): OutboxRecord[] {
  try {
    const parsed = JSON.parse(storage.getItem(ACCOUNT_READING_OUTBOX_STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed as OutboxRecord[] : [];
  } catch {
    return [];
  }
}

function writeAll(storage: StorageLike, records: OutboxRecord[]) {
  storage.setItem(ACCOUNT_READING_OUTBOX_STORAGE_KEY, JSON.stringify(records));
}

export function readAccountReadingOutbox(storage: StorageLike, identity: string) {
  const owner = ownerFingerprint(identity);
  return readAll(storage).filter((record) => record.owner === owner).map((record) => record.entry);
}

export function enqueueAccountReading(
  storage: StorageLike,
  identity: string,
  entry: ReadingHistoryEntry,
  lockManager: AccountReadingOutboxLockManager = getBrowserLockManager(),
  shouldCommit: () => boolean = () => true,
) {
  return lockManager.request(ACCOUNT_READING_OUTBOX_LOCK_NAME, () => {
    if (!shouldCommit()) return;
    const owner = ownerFingerprint(identity);
    const records = readAll(storage).filter((record) =>
      record.owner !== owner || record.entry.id !== entry.id
    );
    writeAll(storage, [...records, { owner, entry }]);
  });
}

export function removeAccountReadingFromOutbox(
  storage: StorageLike,
  identity: string,
  readingId: string,
  lockManager: AccountReadingOutboxLockManager = getBrowserLockManager(),
  shouldCommit: () => boolean = () => true,
) {
  return lockManager.request(ACCOUNT_READING_OUTBOX_LOCK_NAME, () => {
    if (!shouldCommit()) return;
    const owner = ownerFingerprint(identity);
    writeAll(storage, readAll(storage).filter((record) =>
      record.owner !== owner || record.entry.id !== readingId
    ));
  });
}
