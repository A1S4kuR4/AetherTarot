import { describe, expect, it } from "vitest";
import { createInMemorySessionMemoryStore } from "@/server/reading/memory";
import { createInMemoryReadingRuntimeStores } from "@/server/reading/runtime-persistence";

const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";
const THREAD = "00000000-0000-4000-8000-000000000010";

describe("durable reading runtime stores", () => {
  it("isolates thread memory by both user and thread and enforces merge caps", async () => {
    const store = createInMemorySessionMemoryStore();
    await store.upsert({ userId: USER_A, threadId: THREAD }, {
      summary: "first",
      topics: Array.from({ length: 15 }, (_, index) => `topic-${index}`),
      cards: Array.from({ length: 24 }, (_, index) => ({
        id: `card-${index}`,
        orientation: "upright" as const,
      })),
      stated_constraints: Array.from(
        { length: 10 },
        (_, index) => `constraint-${index}`,
      ),
      open_questions: ["old question"],
    });
    await store.upsert({ userId: USER_A, threadId: THREAD }, {
      summary: "latest",
      open_questions: ["latest question"],
    });

    const memory = await store.get({ userId: USER_A, threadId: THREAD });
    expect(memory).toMatchObject({
      summary: "latest",
      open_questions: ["latest question"],
    });
    expect(memory?.topics).toHaveLength(12);
    expect(memory?.cards).toHaveLength(20);
    expect(memory?.stated_constraints).toHaveLength(8);
    expect(await store.get({ userId: USER_B, threadId: THREAD })).toBeNull();
  });

  it("shares request replay and snapshot claims through injected store instances", async () => {
    const stores = createInMemoryReadingRuntimeStores();
    const request = {
      subjectKey: USER_A,
      requestId: "00000000-0000-4000-8000-000000000020",
      payloadHash: "payload-a",
    };
    const first = await stores.executionStore.claim(request);
    expect(first.status).toBe("owner");
    if (first.status !== "owner") return;

    expect(await stores.executionStore.claim(request)).toEqual({ status: "wait" });
    await stores.executionStore.complete({
      subjectKey: request.subjectKey,
      requestId: request.requestId,
      leaseOwner: first.leaseOwner,
      response: { status: 200, payload: { reading_id: "reading-1" } },
    });
    expect(await stores.executionStore.claim(request)).toMatchObject({
      status: "replay",
      response: { status: 200, payload: { reading_id: "reading-1" } },
    });
    expect(await stores.executionStore.claim({
      ...request,
      payloadHash: "payload-b",
    })).toEqual({ status: "conflict" });
  });
});
