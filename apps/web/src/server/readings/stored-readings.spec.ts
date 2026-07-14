import type {
  ReadingHistoryEntry,
  StructuredReading,
} from "@aethertarot/shared-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listStoredReadings,
  migrateStoredReadings,
  saveStoredReading,
} from "@/server/readings/stored-readings";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

const USER_ID = "00000000-0000-0000-0000-000000000001";

function buildReading(id = "reading-1"): StructuredReading {
  return {
    reading_id: id,
    locale: "zh-CN",
    question: "我该如何整理当前状态？",
    question_type: "self_growth",
    agent_profile: "lite",
    reading_phase: "initial",
    requires_followup: false,
    initial_reading_id: null,
    followup_answers: null,
    spread: {
      id: "single",
      name: "单牌启示",
      englishName: "Single Card",
      description: "单牌启示",
      icon: "sparkles",
      positions: [
        {
          id: "focus",
          name: "观察入口",
          description: "当前最值得观察的入口。",
        },
      ],
    },
    cards: [
      {
        card_id: "star",
        name: "星星",
        english_name: "The Star",
        orientation: "upright",
        position_id: "focus",
        position: "观察入口",
        position_meaning: "当前最值得观察的入口。",
        interpretation: "这张牌提示你先恢复节奏。",
      },
    ],
    themes: ["恢复节奏", "现实验证"],
    synthesis: "这次阅读更像是在提醒你把注意力收回可行动的地方。",
    reflective_guidance: [
      "先做一个能在今天完成的小整理。",
      "再记录一个可以核实的现实信号。",
    ],
    follow_up_questions: [],
    safety_note: null,
    confidence_note: "塔罗适合作为反思线索，而不是确定性结论。",
    session_capsule: "问题 / 牌阵 / 核心主题：恢复节奏。",
  };
}

function buildEntry(id = "reading-1"): ReadingHistoryEntry {
  return {
    id,
    createdAt: "2026-06-18T00:00:00.000Z",
    spreadId: "single",
    drawSource: "digital_random",
    drawnCards: [
      {
        positionId: "focus",
        cardId: "star",
        isReversed: false,
      },
    ],
    reading: buildReading(id),
    user_notes: "初始笔记",
  };
}

function createQueryMock(data: unknown[] = []) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(async () => ({ data, error: null })),
    insert: vi.fn(async () => ({ error: null })),
    upsert: vi.fn(async () => ({ error: null })),
    update: vi.fn(() => query),
  };

  return query;
}

describe("stored readings service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts repeated user and reading ids instead of inserting duplicate records", async () => {
    const query = createQueryMock();
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => query),
    });

    const result = await saveStoredReading(USER_ID, buildEntry());

    expect(result.error).toBeNull();
    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_ID,
        reading_id: "reading-1",
      }),
      { onConflict: "user_id,reading_id" },
    );
    expect(query.insert).not.toHaveBeenCalled();
  });

  it("uses upsert for idempotent local history migration", async () => {
    const query = createQueryMock();
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => query),
    });

    const result = await migrateStoredReadings(USER_ID, [
      buildEntry("reading-1"),
      buildEntry("reading-1"),
    ]);

    expect(result).toEqual({ migrated: 1, error: null });
    expect(query.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          user_id: USER_ID,
          reading_id: "reading-1",
        }),
      ],
      { onConflict: "user_id,reading_id" },
    );
    expect(query.insert).not.toHaveBeenCalled();
  });

  it("limits account history lists by default", async () => {
    const query = createQueryMock();
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => query),
    });

    const result = await listStoredReadings(USER_ID);

    expect(result.error).toBeNull();
    expect(query.limit).toHaveBeenCalledWith(50);
  });

  it("canonicalizes historical profiles and skips structurally damaged database rows", async () => {
    const legacyEntry = buildEntry("reading-legacy");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const query = createQueryMock([
      {
        reading_id: legacyEntry.id,
        created_at: legacyEntry.createdAt,
        spread_id: legacyEntry.spreadId,
        draw_source: legacyEntry.drawSource,
        drawn_cards: legacyEntry.drawnCards,
        reading: { ...legacyEntry.reading, agent_profile: "professional" },
        user_notes: null,
      },
      {
        reading_id: "reading-damaged",
        created_at: legacyEntry.createdAt,
        spread_id: legacyEntry.spreadId,
        draw_source: legacyEntry.drawSource,
        drawn_cards: [],
        reading: { reading_id: "reading-damaged" },
        user_notes: null,
      },
    ]);
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => query) });

    const result = await listStoredReadings(USER_ID);

    expect(result.data).toHaveLength(1);
    expect(result.data?.[0]?.reading.agent_profile).toBe("sober");
    expect(warnSpy).toHaveBeenCalledWith(
      "[stored-readings] skipped invalid reading",
      { readingId: "reading-damaged" },
    );
    warnSpy.mockRestore();
  });
});
