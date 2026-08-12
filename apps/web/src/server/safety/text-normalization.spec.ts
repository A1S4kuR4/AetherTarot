import { describe, expect, it } from "vitest";
import {
  findSafetyMatchSpans,
  hasUncoveredSafetyMatch,
  normalizeSafetyText,
  segmentSafetyText,
  type SafetyPattern,
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

  it("maps normalized and compact matches into one concrete span coordinate", () => {
    const segment = segmentSafetyText("You should m o n i t o r your ex")[0];
    const patterns: SafetyPattern[] = [{
      form: "compact",
      pattern: /youshouldmonitor/i,
    }];

    if (!segment) throw new Error("expected one normalized segment");
    expect(findSafetyMatchSpans(segment, patterns)).toEqual([{
      start: 0,
      end: "You should m o n i t o r".length,
    }]);
  });

  it("only exempts a danger match covered by the same local context span", () => {
    const danger: SafetyPattern[] = [{
      form: "compact",
      pattern: /youshouldmonitor/i,
    }];
    const safe: SafetyPattern[] = [{
      form: "compact",
      pattern: /donotstalk/i,
    }];
    const segment = segmentSafetyText(
      "Do not stalk anyone and you should monitor your ex",
    )[0];

    if (!segment) throw new Error("expected one normalized segment");
    expect(hasUncoveredSafetyMatch(segment, danger, safe)).toBe(true);
  });
});
