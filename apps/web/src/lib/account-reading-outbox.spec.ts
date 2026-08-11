import { describe, expect, it } from "vitest";
import type { ReadingHistoryEntry } from "@aethertarot/shared-types";
import {
  ACCOUNT_READING_OUTBOX_STORAGE_KEY,
  enqueueAccountReading,
  readAccountReadingOutbox,
  removeAccountReadingFromOutbox,
} from "@/lib/account-reading-outbox";
import { IdentityRequestLifecycle } from "@/lib/identity-request-lifecycle";

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
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

describe("account reading outbox", () => {
  it("survives refresh while remaining identity scoped", async () => {
    const local = storage();
    await enqueueAccountReading(local, "a@example.test", entry("A"), transactionalLockManager());
    expect(readAccountReadingOutbox(local, "a@example.test").map((item) => item.id)).toEqual(["A"]);
    expect(readAccountReadingOutbox(local, "b@example.test")).toEqual([]);
    expect([...JSON.parse(local.getItem(ACCOUNT_READING_OUTBOX_STORAGE_KEY) ?? "[]")][0].owner)
      .not.toContain("a@example.test");
  });

  it("removes only the successfully synced identity entry", async () => {
    const local = storage();
    const locks = transactionalLockManager();
    await enqueueAccountReading(local, "a", entry("A"), locks);
    await enqueueAccountReading(local, "b", entry("B"), locks);
    await removeAccountReadingFromOutbox(local, "a", "A", locks);
    expect(readAccountReadingOutbox(local, "a")).toEqual([]);
    expect(readAccountReadingOutbox(local, "b").map((item) => item.id)).toEqual(["B"]);
  });

  it("serializes concurrent tab writes and merges both account entries", async () => {
    const local = storage();
    const locks = transactionalLockManager();
    await Promise.all([
      enqueueAccountReading(local, "a", entry("A-1"), locks),
      enqueueAccountReading(local, "a", entry("A-2"), locks),
    ]);
    expect(readAccountReadingOutbox(local, "a").map((item) => item.id).sort())
      .toEqual(["A-1", "A-2"]);
  });

  it("does not commit an old identity entry after waiting for the outbox lock", async () => {
    const local = storage();
    const lifecycle = new IdentityRequestLifecycle("account:a");
    const request = lifecycle.begin("account:a");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const locks = {
      async request<T>(_name: string, callback: () => Promise<T> | T) {
        await gate;
        return callback();
      },
    };
    const pending = enqueueAccountReading(
      local,
      "a",
      entry("A"),
      locks,
      () => lifecycle.isCurrent(request, "account:b"),
    );
    lifecycle.transition("account:b");
    release();
    await pending;
    expect(readAccountReadingOutbox(local, "a")).toEqual([]);
  });
});
