import { describe, expect, it, vi } from "vitest";
import type { ReadingHistoryEntry } from "@aethertarot/shared-types";
import { mergeGuestHistoryEntry } from "@/lib/guest-reading-history";
import { loadIdentityHistory, saveIdentityNotes } from "@/lib/identity-reading-history";
import { IdentityRequestLifecycle } from "@/lib/identity-request-lifecycle";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}
const entry = (id: string) => ({ id, createdAt: id }) as ReadingHistoryEntry;
const locks = {
  request: async <T>(_name: string, callback: () => Promise<T> | T) => callback(),
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe("identity-scoped reading history", () => {
  it("keeps guest history independent across account login and logout", async () => {
    const local = storage();
    await mergeGuestHistoryEntry(local, entry("guest"), locks);
    const accountFetch = vi.fn(async () => Response.json({ readings: [entry("account-a")] }));
    expect((await loadIdentityHistory({ identity: { kind: "account", id: "a" }, storage: local, fetchImplementation: accountFetch })).map((x) => x.id)).toEqual(["account-a"]);
    expect((await loadIdentityHistory({ identity: { kind: "guest" }, storage: local, fetchImplementation: accountFetch })).map((x) => x.id)).toEqual(["guest"]);
  });

  it("does not migrate account A or guest data into an empty account B", async () => {
    const local = storage();
    await mergeGuestHistoryEntry(local, entry("guest"), locks);
    const fetchB = vi.fn(async () => Response.json({ readings: [] }));
    expect(await loadIdentityHistory({ identity: { kind: "account", id: "b" }, storage: local, fetchImplementation: fetchB })).toEqual([]);
    expect(fetchB).toHaveBeenCalledTimes(1);
  });

  it.each([401, 500])("does not fall back to another identity on API %s", async (status) => {
    const local = storage();
    await mergeGuestHistoryEntry(local, entry("guest"), locks);
    const failed = vi.fn(async () => new Response("", { status }));
    expect(await loadIdentityHistory({ identity: { kind: "account", id: "a" }, storage: local, fetchImplementation: failed })).toEqual([]);
  });

  it("saves guest notes without calling the account PATCH API", async () => {
    const local = storage();
    await mergeGuestHistoryEntry(local, entry("guest"), locks);
    const fetchMock = vi.fn();
    const result = await saveIdentityNotes({ identity: { kind: "guest" }, storage: local, fetchImplementation: fetchMock as typeof fetch, readingId: "guest", notes: "local", guestLockManager: locks });
    expect(result.status).toBe("saved_to_browser");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a recognizable failure for account PATCH errors", async () => {
    const result = await saveIdentityNotes({ identity: { kind: "account", id: "a" }, storage: storage(), fetchImplementation: vi.fn(async () => new Response("", { status: 500 })), readingId: "a", notes: "x" });
    expect(result.status).toBe("failed");
  });

  it("rejects a late account history GET commit after switching identity", async () => {
    const lifecycle = new IdentityRequestLifecycle("account:a");
    const request = lifecycle.begin("account:a");
    const response = deferred<Response>();
    const historyPromise = loadIdentityHistory({
      identity: { kind: "account", id: "a" },
      storage: storage(),
      fetchImplementation: vi.fn(() => response.promise),
      signal: request.signal,
    });
    lifecycle.transition("account:b");
    response.resolve(Response.json({ readings: [entry("A")] }));
    const loaded = await historyPromise;
    const visible = lifecycle.isCurrent(request, "account:b") ? loaded : [];
    expect(visible).toEqual([]);
  });

  it("rejects a late notes PATCH commit after switching identity", async () => {
    const lifecycle = new IdentityRequestLifecycle("account:a");
    const request = lifecycle.begin("account:a");
    const response = deferred<Response>();
    const savePromise = saveIdentityNotes({
      identity: { kind: "account", id: "a" },
      storage: storage(),
      fetchImplementation: vi.fn(() => response.promise),
      readingId: "A",
      notes: "account A notes",
      signal: request.signal,
    });
    lifecycle.transition("account:b");
    response.resolve(new Response(null, { status: 200 }));
    const result = await savePromise;
    const committed = lifecycle.isCurrent(request, "account:b") && result.status === "synced";
    expect(committed).toBe(false);
  });
});
