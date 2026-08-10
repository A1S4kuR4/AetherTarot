import { describe, expect, it } from "vitest";
import {
  normalizeGrowthValue,
  parseGrowthAttribution,
} from "@/lib/growth-attribution";

describe("growth attribution", () => {
  it("captures Douyin UTM values without retaining the full referrer URL", () => {
    expect(parseGrowthAttribution({
      search: "?utm_source=douyin&utm_medium=video&utm_campaign=launch-01&utm_content=creator-a",
      pathname: "/",
      referrer: "https://www.douyin.com/video/123?private=value",
      currentHost: "aethertarot.cn",
      now: 1_786_291_200_000,
      attributionId: "00000000-0000-4000-8000-000000000001",
    })).toEqual({
      attributionId: "00000000-0000-4000-8000-000000000001",
      capturedAt: 1_786_291_200_000,
      utmSource: "douyin",
      utmMedium: "video",
      utmCampaign: "launch-01",
      utmContent: "creator-a",
      utmTerm: null,
      landingPath: "/",
      referrerHost: "www.douyin.com",
    });
  });

  it("trims control characters and bounds campaign values", () => {
    expect(normalizeGrowthValue("  douyin\nlaunch  ")).toBe("douyin launch");
    expect(normalizeGrowthValue("x".repeat(150))).toHaveLength(120);
    expect(normalizeGrowthValue("  ")).toBeNull();
  });

  it("does not treat an internal referrer as an external source", () => {
    expect(parseGrowthAttribution({
      search: "",
      pathname: "/new",
      referrer: "https://aethertarot.cn/",
      currentHost: "aethertarot.cn",
      now: 1_786_291_200_000,
      attributionId: "00000000-0000-4000-8000-000000000002",
    }).referrerHost).toBeNull();
  });
});
