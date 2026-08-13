import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createInMemorySessionMemoryStore,
  sessionMemorySchema,
} from "@/server/reading/memory";
import {
  createInMemoryReadingRuntimeStores,
  createSupabaseInitialReadingSnapshotStore,
} from "@/server/reading/runtime-persistence";
import { runReadingGraph } from "@/server/reading/graph";
import { buildHolyTrianglePayload } from "@/server/reading/__tests__/fixtures";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";
const THREAD = "00000000-0000-4000-8000-000000000010";
const SUPABASE_TIMESTAMP = "2026-08-03T13:20:52.332+00:00";

describe("durable reading runtime stores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts PostgREST timestamps with an explicit UTC offset", () => {
    expect(sessionMemorySchema.parse({
      thread_id: THREAD,
      topics: [],
      cards: [],
      stated_constraints: [],
      open_questions: [],
      updated_at: SUPABASE_TIMESTAMP,
    }).updated_at).toBe(SUPABASE_TIMESTAMP);
  });

  it("parses a saved initial snapshot returned with a PostgREST timestamp", async () => {
    let savedRow: Record<string, unknown> | undefined;
    const query = {
      upsert: vi.fn((row: Record<string, unknown>) => {
        savedRow = row;
        return query;
      }),
      select: vi.fn(() => query),
      single: vi.fn(async () => ({
        data: { ...savedRow, expires_at: SUPABASE_TIMESTAMP },
        error: null,
      })),
    };
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => query),
    });
    const request = {
      ...buildHolyTrianglePayload("请解释这组三张牌的职业含义。"),
      request_id: "00000000-0000-4000-8000-000000000021",
      thread_id: THREAD,
      agent_profile: "standard" as const,
      draw_source: "digital_random" as const,
    };
    const reading = await runReadingGraph(request);

    const snapshot = await createSupabaseInitialReadingSnapshotStore().save({
      subjectKey: USER_A,
      initialReadingId: reading.reading_id,
      requestId: request.request_id,
      question: request.question,
      spreadId: request.spreadId,
      drawnCards: request.drawnCards,
      agentProfile: request.agent_profile,
      drawSource: request.draw_source,
      threadId: request.thread_id,
      continuityContext: [
        "上一轮线索：先看清现实边界。",
        "用户补充：这行原始细节不得保存。",
      ].join("\n"),
      initialReading: reading,
      followUpQuestions: reading.follow_up_questions,
    });

    expect(snapshot.expiresAt).toBe(SUPABASE_TIMESTAMP);
    expect(savedRow?.continuity_context).toBe("上一轮线索：先看清现实边界。");
    expect(snapshot.continuityContext).toBe("上一轮线索：先看清现实边界。");
  });

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
