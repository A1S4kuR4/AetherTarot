import type {
  ReadingHistoryEntry,
  StructuredReading,
} from "@aethertarot/shared-types";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedTester } from "@/server/beta/access";
import {
  handleReadingsGet,
  handleReadingsPatch,
  handleReadingsPost,
  type ReadingsRouteDependencies,
} from "@/app/api/readings/route";
import {
  handleMigratePost,
  type MigrateRouteDependencies,
} from "@/app/api/readings/migrate/route";

const TESTER: AuthenticatedTester = {
  userId: "00000000-0000-0000-0000-000000000001",
  email: "tester@example.com",
  role: "tester",
};

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
    themes: ["恢复节奏"],
    synthesis: "这次阅读更像是在提醒你把注意力收回可行动的地方。",
    reflective_guidance: ["先做一个能在今天完成的小整理。"],
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
  };
}

function buildRequest(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildReadingsDeps(
  overrides: Partial<ReadingsRouteDependencies> = {},
): ReadingsRouteDependencies {
  return {
    requireAccess: vi.fn(async () => TESTER),
    save: vi.fn(async () => ({ error: null })),
    list: vi.fn(async () => ({ data: [], error: null })),
    updateNotes: vi.fn(async () => ({ error: null })),
    ...overrides,
  };
}

function buildMigrateDeps(
  overrides: Partial<MigrateRouteDependencies> = {},
): MigrateRouteDependencies {
  return {
    requireAccess: vi.fn(async () => TESTER),
    migrate: vi.fn(async (userId, entries) => ({
      migrated: entries.length,
      error: null,
    })),
    ...overrides,
  };
}

async function readJson(response: Response) {
  return await response.json() as {
    readings?: ReadingHistoryEntry[];
    migrated?: number;
    error?: { code?: string; message?: string };
  };
}

describe("readings account history routes", () => {
  it("passes the default safe limit to account history listing", async () => {
    const deps = buildReadingsDeps();

    const response = await handleReadingsGet(deps);
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.readings).toEqual([]);
    expect(deps.list).toHaveBeenCalledWith(TESTER.userId, { limit: 50 });
  });

  it("rejects invalid stored reading payloads", async () => {
    const deps = buildReadingsDeps();

    const response = await handleReadingsPost(
      buildRequest("/api/readings", {
        id: "reading-1",
        spreadId: "single",
        reading: {},
      }),
      deps,
    );
    const payload = await readJson(response);

    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe("invalid_request");
    expect(deps.save).not.toHaveBeenCalled();
  });

  it("rejects notes over the supported storage limit", async () => {
    const deps = buildReadingsDeps();

    const response = await handleReadingsPatch(
      buildRequest("/api/readings", {
        reading_id: "reading-1",
        user_notes: "记".repeat(2001),
      }),
      deps,
    );
    const payload = await readJson(response);

    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe("invalid_request");
    expect(deps.updateNotes).not.toHaveBeenCalled();
  });

  it("passes duplicate migration entries through to an idempotent service", async () => {
    const deps = buildMigrateDeps({
      migrate: vi.fn(async () => ({
        migrated: 1,
        error: null,
      })),
    });
    const duplicateEntries = [buildEntry("reading-1"), buildEntry("reading-1")];

    const response = await handleMigratePost(
      buildRequest("/api/readings/migrate", duplicateEntries),
      deps,
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.migrated).toBe(1);
    expect(deps.migrate).toHaveBeenCalledWith(TESTER.userId, duplicateEntries);
  });

  it("rejects invalid migration entries", async () => {
    const deps = buildMigrateDeps();

    const response = await handleMigratePost(
      buildRequest("/api/readings/migrate", [
        {
          id: "reading-1",
          spreadId: "single",
          reading: {},
        },
      ]),
      deps,
    );
    const payload = await readJson(response);

    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe("invalid_request");
    expect(deps.migrate).not.toHaveBeenCalled();
  });
});
