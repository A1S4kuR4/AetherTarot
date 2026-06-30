import { describe, expect, it } from "vitest";
import { getBeijingDayWindow } from "@/server/beta/admin-summary";

describe("admin summary day window", () => {
  it("rolls the daily window over at Beijing midnight", () => {
    expect(getBeijingDayWindow(new Date("2026-05-24T15:59:59.000Z"))).toEqual({
      usageDay: "2026-05-24",
      since: "2026-05-23T16:00:00.000Z",
    });
    expect(getBeijingDayWindow(new Date("2026-05-24T16:00:00.000Z"))).toEqual({
      usageDay: "2026-05-25",
      since: "2026-05-24T16:00:00.000Z",
    });
  });
});
