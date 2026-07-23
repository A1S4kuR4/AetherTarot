export const QUALITY_DIMENSIONS = [
  "question_relevance",
  "spread_respect",
  "grounding_fidelity",
  "citation_correctness",
  "synthesis_depth",
  "readability",
  "reflective_value",
  "safety",
  "style",
] as const;

export const QUALITY_FATAL_FLAGS = [
  "wrong_source",
  "missing_per_card_grounding",
  "citation_not_supported",
  "safety_violation",
  "schema_broken",
] as const;

export interface ReplayCase {
  case_id: string;
  labels?: string[];
  [key: string]: unknown;
}

export interface DeciderEvidence {
  deterministic_rule_fix_exhausted?: boolean;
  post_fix_misroute_rate?: number;
  safety_regression?: boolean;
}

function isNegative(item: ReplayCase) {
  return item.labels?.some((label) =>
    ["could_be_better", "template_like", "too_agreeable"].includes(label)
  ) ?? false;
}

export function sampleWeeklyFeedback(cases: ReplayCase[]) {
  const negatives = cases.filter(isNegative);
  const positives = cases.filter((item) => !isNegative(item));
  return [
    ...negatives.slice(0, 10),
    ...positives.slice(0, 20 - Math.min(10, negatives.length)),
  ].slice(0, 20);
}

export function buildQualityScorecard(
  item: ReplayCase,
  index: number,
  source: "feedback" | "canary",
) {
  return {
    case_id: item.case_id,
    source,
    double_review: index % 5 === 0,
    review_week: null,
    actual_route: null,
    expected_route: null,
    misroute_reason: null,
    scores: Object.fromEntries(
      QUALITY_DIMENSIONS.map((dimension) => [dimension, null]),
    ),
    fatal_flags: Object.fromEntries(
      QUALITY_FATAL_FLAGS.map((flag) => [flag, false]),
    ),
    reviewer_notes: null,
    payload: item,
  };
}

export function decideLlmDeciderRecommendation(
  scores: Array<Record<string, unknown>>,
  evidence: DeciderEvidence | undefined,
) {
  const evaluable = scores.filter((score) =>
    typeof score.actual_route === "string"
    && typeof score.expected_route === "string"
    && typeof score.review_week === "string"
  );
  const weekIds = [...new Set(
    evaluable.map((score) => String(score.review_week)),
  )].sort();
  if (weekIds.length < 4 || evaluable.length < 100) {
    return "insufficient_data";
  }
  const latestPeriods = weekIds.slice(-2).map((week) =>
    evaluable.filter((score) => score.review_week === week)
  );
  const highOverall = latestPeriods.every((period) =>
    period.length > 0
    && period.filter((score) => score.actual_route !== score.expected_route).length
      / period.length >= 0.08
  );
  const bucketNames = new Set(
    latestPeriods.flatMap((period) =>
      period.map((score) => String(score.expected_route))
    ),
  );
  const highBucket = [...bucketNames].some((bucket) =>
    latestPeriods.every((period) => {
      const bucketCases = period.filter(
        (score) => String(score.expected_route) === bucket,
      );
      return bucketCases.length >= 20
        && bucketCases.filter(
          (score) => score.actual_route !== score.expected_route,
        ).length / bucketCases.length >= 0.15;
    })
  );
  if (!highOverall && !highBucket) {
    return "keep_rule_decider";
  }
  const deterministicFixFailed = evidence?.deterministic_rule_fix_exhausted === true
    && (evidence.post_fix_misroute_rate ?? 0) >= 0.05
    && evidence.safety_regression !== true;
  return deterministicFixFailed
    ? "evaluate_structured_llm_decider"
    : "keep_rule_decider";
}

export function findDoubleReviewConflicts(
  scorecards: Array<Record<string, unknown>>,
) {
  return scorecards.filter((item) => {
    const primary = item.scores as Record<string, number> | undefined;
    const secondary = item.secondary_scores as Record<string, number> | undefined;
    return primary && secondary && QUALITY_DIMENSIONS.some(
      (dimension) =>
        Number.isFinite(primary[dimension])
        && Number.isFinite(secondary[dimension])
        && Math.abs(primary[dimension] - secondary[dimension]) > 1,
    );
  }).map((item) => item.case_id);
}
