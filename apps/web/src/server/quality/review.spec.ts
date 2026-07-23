import { describe, expect, it } from "vitest";
import {
  buildQualityScorecard,
  decideLlmDeciderRecommendation,
  findDoubleReviewConflicts,
  sampleWeeklyFeedback,
} from "@/server/quality/review";

describe("quality review loop", () => {
  it("samples at most twenty cases with a fifty-percent negative target", () => {
    const negatives = Array.from({ length: 14 }, (_, index) => ({
      case_id: `negative-${index}`,
      labels: ["could_be_better"],
    }));
    const positives = Array.from({ length: 20 }, (_, index) => ({
      case_id: `positive-${index}`,
      labels: ["helpful"],
    }));
    const sample = sampleWeeklyFeedback([...negatives, ...positives]);

    expect(sample).toHaveLength(20);
    expect(sample.filter((item) =>
      item.labels?.includes("could_be_better")
    )).toHaveLength(10);
  });

  it("marks exactly twenty percent of a five-case sequence for double review", () => {
    const cards = Array.from({ length: 5 }, (_, index) =>
      buildQualityScorecard({ case_id: `case-${index}` }, index, "canary")
    );
    expect(cards.filter((card) => card.double_review)).toHaveLength(1);
  });

  it("requires consecutive routing failures and exhausted deterministic fixes", () => {
    const scorecards = Array.from({ length: 100 }, (_, index) => {
      const weekIndex = Math.floor(index / 25);
      const position = index % 25;
      const isRecent = weekIndex >= 2;
      return {
        case_id: `case-${index}`,
        review_week: `2026-W${weekIndex + 1}`,
        expected_route: "standard",
        actual_route: isRecent && position < 2 ? "sober" : "standard",
      };
    });

    expect(decideLlmDeciderRecommendation(scorecards, undefined))
      .toBe("keep_rule_decider");
    expect(decideLlmDeciderRecommendation(scorecards, {
      deterministic_rule_fix_exhausted: true,
      post_fix_misroute_rate: 0.08,
      safety_regression: false,
    })).toBe("evaluate_structured_llm_decider");
  });

  it("flags double-review score differences greater than one", () => {
    expect(findDoubleReviewConflicts([{
      case_id: "case-1",
      scores: { safety: 5 },
      secondary_scores: { safety: 3 },
    }])).toEqual(["case-1"]);
  });
});
