import { describe, expect, it } from "vitest";
import type { ReadingHistoryEntry } from "@aethertarot/shared-types";
import {
  GUEST_HISTORY_STORAGE_KEY,
  mergeGuestHistoryEntry,
  readGuestHistory,
  updateGuestHistoryNotes,
} from "@/lib/guest-reading-history";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

function transactionalLockManager() {
  let tail = Promise.resolve();
  return {
    request<T>(_name: string, callback: () => Promise<T> | T) {
      const result = tail.then(callback);
      tail = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}

const entry = (id: string) => ({ id, createdAt: id }) as ReadingHistoryEntry;

describe("guest reading history", () => {
  it("never reads the legacy account-contaminated key", () => {
    const storage = memoryStorage();
    storage.setItem("aether_tarot_history_v3", JSON.stringify([entry("account-a")]));
    expect(readGuestHistory(storage)).toEqual([]);
    expect(GUEST_HISTORY_STORAGE_KEY).toBe("aether_tarot_guest_history_v1");
  });

  it("serializes truly concurrent tab writes without losing either entry", async () => {
    const storage = memoryStorage();
    const locks = transactionalLockManager();
    await Promise.all([
      mergeGuestHistoryEntry(storage, entry("guest-a"), locks),
      mergeGuestHistoryEntry(storage, entry("guest-b"), locks),
    ]);
    expect(readGuestHistory(storage).map((item) => item.id)).toEqual(["guest-b", "guest-a"]);
  });

  it("updates notes only in guest storage", async () => {
    const storage = memoryStorage();
    const locks = transactionalLockManager();
    await mergeGuestHistoryEntry(storage, entry("guest-a"), locks);
    expect((await updateGuestHistoryNotes(storage, "guest-a", "仅此浏览器", locks))[0]?.user_notes)
      .toBe("仅此浏览器");
  });
});
