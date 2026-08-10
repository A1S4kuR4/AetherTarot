import { describe, expect, it } from "vitest";
import {
  getBeijingDayWindow,
  summarizeGrowthEvents,
} from "@/server/beta/admin-summary";

describe("admin summary day window", () => {
  it("rolls the daily window over at Beijing midnight", () => {
    expect(getBeijingDayWindow(new Date("2026-05-24T15:59:59.000Z"))).toEqual({
      usageDay: "2026-05-24",
      sinceDay: "2026-05-24",
      since: "2026-05-23T16:00:00.000Z",
    });
    expect(getBeijingDayWindow(new Date("2026-05-24T16:00:00.000Z"))).toEqual({
      usageDay: "2026-05-25",
      sinceDay: "2026-05-25",
      since: "2026-05-24T16:00:00.000Z",
    });
  });

  it("starts multi-day windows at Beijing midnight", () => {
    expect(getBeijingDayWindow(new Date("2026-05-24T16:00:00.000Z"), 7)).toEqual({
      usageDay: "2026-05-25",
      sinceDay: "2026-05-19",
      since: "2026-05-18T16:00:00.000Z",
    });
  });
});

describe("admin growth funnel summary", () => {
  it("groups the four launch events by normalized UTM source", () => {
    const summary = summarizeGrowthEvents([
      { event_type: "page_view", utm_source: "Douyin" },
      { event_type: "reading_started", utm_source: " douyin " },
      { event_type: "reading_completed", utm_source: "douyin" },
      { event_type: "feedback_submitted", utm_source: "DOUYIN" },
      { event_type: "page_view", utm_source: null },
    ]);

    expect(summary.growthFunnel).toEqual({
      visits: 2,
      readingStarts: 1,
      readingCompletions: 1,
      feedbackSubmissions: 1,
    });
    expect(summary.growthBySource).toEqual({
      douyin: {
        visits: 1,
        readingStarts: 1,
        readingCompletions: 1,
        feedbackSubmissions: 1,
      },
      direct: {
        visits: 1,
        readingStarts: 0,
        readingCompletions: 0,
        feedbackSubmissions: 0,
      },
    });
  });
});
