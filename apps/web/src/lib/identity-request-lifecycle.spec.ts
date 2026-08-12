import { describe, expect, it, vi } from "vitest";
import { IdentityRequestLifecycle } from "@/lib/identity-request-lifecycle";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe("identity request lifecycle", () => {
  it("invalidates and aborts an old request synchronously on dispose", () => {
    const lifecycle = new IdentityRequestLifecycle("account:a");
    const request = lifecycle.begin("account:a");

    lifecycle.dispose();

    expect(request.signal.aborted).toBe(true);
    expect(lifecycle.isCurrent(request, "account:a")).toBe(false);
  });

  it("invalidates an account A initial response after logout to guest", async () => {
    const lifecycle = new IdentityRequestLifecycle("account:a");
    const request = lifecycle.begin("account:a");
    const response = deferred<{ reading: string }>();
    const state = { reading: null as string | null, history: [] as string[] };
    const completion = response.promise.then((payload) => {
      if (lifecycle.isCurrent(request, "guest")) state.reading = payload.reading;
    });

    lifecycle.transition("guest");
    response.resolve({ reading: "A" });
    await completion;

    expect(request.signal.aborted).toBe(true);
    expect(state).toEqual({ reading: null, history: [] });
  });

  it("invalidates an account A Final response after switching to account B", async () => {
    const lifecycle = new IdentityRequestLifecycle("account:a");
    const request = lifecycle.begin("account:a");
    const response = deferred<{ reading: string; notes: string; continuity: string }>();
    const state = { reading: null as string | null, notes: "", continuity: null as string | null };
    const completion = response.promise.then((payload) => {
      if (!lifecycle.isCurrent(request, "account:b")) return;
      Object.assign(state, payload);
    });

    lifecycle.transition("account:b");
    response.resolve({ reading: "A", notes: "A notes", continuity: "A capsule" });
    await completion;

    expect(state).toEqual({ reading: null, notes: "", continuity: null });
  });

  it("does not dispatch an old history POST after the identity changes", async () => {
    const lifecycle = new IdentityRequestLifecycle("account:a");
    const readingRequest = lifecycle.begin("account:a");
    const response = deferred<string>();
    const post = vi.fn();
    const completion = response.promise.then((reading) => {
      if (lifecycle.isCurrent(readingRequest, "account:b")) post(reading);
    });

    lifecycle.transition("account:b");
    response.resolve("A");
    await completion;

    expect(post).not.toHaveBeenCalled();
  });

  it.each(["reading", "history GET", "notes PATCH", "outbox POST"])(
    "aborts a pending %s and rejects its late state commit on identity switch",
    async () => {
      const lifecycle = new IdentityRequestLifecycle("account:a");
      const request = lifecycle.begin("account:a");
      const response = deferred<string>();
      const commits: string[] = [];
      const completion = response.promise.then((value) => {
        if (lifecycle.isCurrent(request, "account:b")) commits.push(value);
      });

      lifecycle.transition("account:b");
      response.resolve("account-a-data");
      await completion;

      expect(request.signal.aborted).toBe(true);
      expect(commits).toEqual([]);
    },
  );
});
