import { describe, expect, it } from "vitest";
import { ProviderBulkhead } from "@/server/llm/provider-bulkhead";

describe("provider bulkhead", () => {
  it("never grants more permits than configured", async () => {
    const bulkhead = new ProviderBulkhead({ maxConcurrent: 2, maxQueued: 2, queueTimeoutMs: 100 });
    const releaseA = await bulkhead.acquire();
    const releaseB = await bulkhead.acquire();
    const pending = bulkhead.acquire();
    expect(bulkhead.stats).toEqual({ active: 2, queued: 1 });
    releaseA();
    const releaseC = await pending;
    expect(bulkhead.stats.active).toBe(2);
    releaseB();
    releaseC();
    expect(bulkhead.stats).toEqual({ active: 0, queued: 0 });
  });

  it("rejects a full queue and a timed-out waiter", async () => {
    const bulkhead = new ProviderBulkhead({ maxConcurrent: 1, maxQueued: 1, queueTimeoutMs: 10 });
    const release = await bulkhead.acquire();
    const timedOut = bulkhead.acquire();
    await expect(bulkhead.acquire()).rejects.toMatchObject({ subtype: "queue_full", status: 503 });
    await expect(timedOut).rejects.toMatchObject({ subtype: "queue_timeout", status: 503 });
    release();
    expect(bulkhead.stats).toEqual({ active: 0, queued: 0 });
  });

  it("removes a cancelled waiter", async () => {
    const bulkhead = new ProviderBulkhead({ maxConcurrent: 1, maxQueued: 1, queueTimeoutMs: 100 });
    const release = await bulkhead.acquire();
    const controller = new AbortController();
    const pending = bulkhead.acquire(controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ subtype: "cancelled" });
    release();
    expect(bulkhead.stats).toEqual({ active: 0, queued: 0 });
  });
});
