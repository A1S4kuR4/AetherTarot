import type { ReadingHistoryEntry } from "@aethertarot/shared-types";

export const GUEST_HISTORY_STORAGE_KEY = "aether_tarot_guest_history_v1";
const GUEST_HISTORY_LOCK_NAME = "aethertarot:guest-history:v1";

export type GuestHistoryLockManager = {
  request<T>(name: string, callback: () => Promise<T> | T): Promise<T>;
};

function getBrowserLockManager(): GuestHistoryLockManager {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks;
  }
  throw new Error("Guest history transactional storage is unavailable in this browser.");
}

export function dedupeReadingHistory(entries: ReadingHistoryEntry[]) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

export function readGuestHistory(storage: Pick<Storage, "getItem">) {
  try {
    const raw = storage.getItem(GUEST_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? dedupeReadingHistory(parsed as ReadingHistoryEntry[])
      : [];
  } catch {
    return [];
  }
}

export async function mergeGuestHistoryEntry(
  storage: Pick<Storage, "getItem" | "setItem">,
  entry: ReadingHistoryEntry,
  lockManager: GuestHistoryLockManager = getBrowserLockManager(),
  shouldCommit: () => boolean = () => true,
) {
  return lockManager.request(GUEST_HISTORY_LOCK_NAME, () => {
    const latest = readGuestHistory(storage);
    if (!shouldCommit()) return latest;
    const merged = [entry, ...latest.filter((item) => item.id !== entry.id)];
    storage.setItem(GUEST_HISTORY_STORAGE_KEY, JSON.stringify(merged));
    return merged;
  });
}

export async function updateGuestHistoryNotes(
  storage: Pick<Storage, "getItem" | "setItem">,
  readingId: string,
  notes: string,
  lockManager: GuestHistoryLockManager = getBrowserLockManager(),
  shouldCommit: () => boolean = () => true,
) {
  return lockManager.request(GUEST_HISTORY_LOCK_NAME, () => {
    const latest = readGuestHistory(storage);
    if (!shouldCommit()) return latest;
    const updated = latest.map((entry) =>
      entry.id === readingId ? { ...entry, user_notes: notes } : entry
    );
    storage.setItem(GUEST_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  });
}
