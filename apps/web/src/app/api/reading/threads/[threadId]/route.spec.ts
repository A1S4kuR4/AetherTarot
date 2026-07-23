import { describe, expect, it, vi } from "vitest";
import { handleDeleteThreadMemory } from "@/app/api/reading/threads/[threadId]/route";
import { createInMemorySessionMemoryStore } from "@/server/reading/memory";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const THREAD_ID = "00000000-0000-4000-8000-000000000002";

describe("DELETE reading thread memory", () => {
  it("deletes only the authenticated user's selected thread and is idempotent", async () => {
    const memoryStore = createInMemorySessionMemoryStore();
    await memoryStore.upsert({ userId: USER_ID, threadId: THREAD_ID }, {
      topics: ["career"],
    });
    const dependencies = {
      requireAccess: vi.fn(async () => ({
        userId: USER_ID,
        email: "tester@example.com",
        role: "tester" as const,
      })),
      memoryStore,
    };

    const first = await handleDeleteThreadMemory(THREAD_ID, dependencies);
    const second = await handleDeleteThreadMemory(THREAD_ID, dependencies);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await memoryStore.get({
      userId: USER_ID,
      threadId: THREAD_ID,
    })).toBeNull();
  });
});
