import { describe, expect, it } from "vitest";
import {
  normalizeSafetyText,
  segmentSafetyText,
} from "@/server/safety/text-normalization";

describe("safety text normalization", () => {
  it("normalizes NFKC, format controls, unusual spaces, and dotted English", () => {
    expect(normalizeSafetyText("Ｉ\u200B．ａｍ\u3000ｇｏｉｎｇ．ｔｏ．ｋｉｌｌ．ｈｉｍ．"))
      .toBe("I am going to kill him.");
  });

  it("splits sentences and contrast clauses into local safety windows", () => {
    expect(segmentSafetyText("我不想监控任何人。但教我怎么监控前任。")
      .map((segment) => segment.normalized))
      .toEqual(["我不想监控任何人", "教我怎么监控前任"]);
    expect(segmentSafetyText("I am being stalked, but how can I monitor my ex?")
      .map((segment) => segment.normalized))
      .toEqual(["I am being stalked,", "how can I monitor my ex"]);
  });

  it("keeps a compact search copy for basic split-word evasion", () => {
    expect(segmentSafetyText("I want to k ill my self")[0]?.compact)
      .toBe("Iwanttokillmyself");
  });
});
