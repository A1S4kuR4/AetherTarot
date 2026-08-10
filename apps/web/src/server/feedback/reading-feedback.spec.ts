import { beforeEach, describe, expect, it, vi } from "vitest";
import { persistReadingFeedback } from "@/server/feedback/reading-feedback";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

function createAdminMock({
  completedReading = { reading_id: "reading-1" },
  insertError = null,
}: {
  completedReading?: { reading_id: string } | null;
  insertError?: { code: string } | null;
} = {}) {
  const readingQuery = {
    select: vi.fn(() => readingQuery),
    eq: vi.fn(() => readingQuery),
    or: vi.fn(() => readingQuery),
    is: vi.fn(() => readingQuery),
    limit: vi.fn(() => readingQuery),
    maybeSingle: vi.fn(async () => ({ data: completedReading, error: null })),
  };
  const feedbackQuery = {
    insert: vi.fn(async () => ({ error: insertError })),
  };
  const from = vi.fn((table: string) =>
    table === "reading_events" ? readingQuery : feedbackQuery,
  );

  mocks.createAdminClient.mockReturnValue({ from });
  return { feedbackQuery, from, readingQuery };
}

describe("reading feedback persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts an anonymous actor only for a completed reading from the same IP", async () => {
    const { feedbackQuery, readingQuery } = createAdminMock();

    const result = await persistReadingFeedback({
      actor: { userId: null, email: null, role: "anonymous" },
      ipHash: "ip-hash",
      readingId: "reading-1",
      labels: ["helpful", "too_agreeable"],
      note: null,
      replayConsent: false,
    });

    expect(result).toBe("inserted");
    expect(readingQuery.eq).toHaveBeenCalledWith("reading_id", "reading-1");
    expect(readingQuery.eq).toHaveBeenCalledWith("status", "success");
    expect(readingQuery.or).toHaveBeenCalledWith(
      "completed_initial.eq.true,completed_final.eq.true",
    );
    expect(readingQuery.is).toHaveBeenCalledWith("user_id", null);
    expect(readingQuery.eq).toHaveBeenCalledWith("ip_hash", "ip-hash");
    expect(feedbackQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: null,
        email: null,
        ip_hash: "ip-hash",
        labels: ["helpful", "too_agreeable"],
      }),
    );
  });

  it("does not insert feedback when the reading does not belong to the actor", async () => {
    const { feedbackQuery } = createAdminMock({ completedReading: null });

    const result = await persistReadingFeedback({
      actor: {
        userId: "user-1",
        email: "tester@example.com",
        role: "tester",
      },
      ipHash: "ip-hash",
      readingId: "another-reading",
      labels: ["did_not_answer"],
      note: "没有回应重点",
      replayConsent: true,
    });

    expect(result).toBe("not_found");
    expect(feedbackQuery.insert).not.toHaveBeenCalled();
  });

  it("treats the unique constraint as an idempotent duplicate", async () => {
    createAdminMock({ insertError: { code: "23505" } });

    await expect(
      persistReadingFeedback({
        actor: { userId: null, email: null, role: "anonymous" },
        ipHash: "ip-hash",
        readingId: "reading-1",
        labels: ["template_like"],
        note: null,
        replayConsent: false,
      }),
    ).resolves.toBe("duplicate");
  });
});
