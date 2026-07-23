import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildQualityScorecard,
  decideLlmDeciderRecommendation,
  findDoubleReviewConflicts,
  QUALITY_DIMENSIONS,
  QUALITY_FATAL_FLAGS,
  sampleWeeklyFeedback,
  type DeciderEvidence,
  type ReplayCase,
} from "../src/server/quality/review";

async function main() {
  const [command, inputPath, canaryPath] = process.argv.slice(2);
  if (!command || !inputPath) {
    throw new Error("Usage: quality-review.ts <pack|aggregate> <input.json> [canary.json]");
  }
  const input = JSON.parse(await readFile(path.resolve(inputPath), "utf8")) as {
    cases?: ReplayCase[];
    scorecards?: Array<Record<string, unknown>>;
    decider_evidence?: DeciderEvidence;
  };
  const outputDir = path.resolve(process.cwd(), "..", "..", "outputs", "evals");
  await mkdir(outputDir, { recursive: true });

  if (command === "aggregate") {
    const scorecards = input.scorecards ?? [];
    const doubleReviewConflicts = findDoubleReviewConflicts(scorecards);
    const report = {
      version: 1,
      sample_count: scorecards.length,
      double_review_conflicts: doubleReviewConflicts,
      fatal_case_count: scorecards.filter((item) =>
        Object.values(
          (item.fatal_flags as Record<string, boolean> | undefined) ?? {},
        ).some(Boolean)
      ).length,
      decider_recommendation: decideLlmDeciderRecommendation(
        scorecards,
        input.decider_evidence,
      ),
      llm_decider_gate: {
        minimum_weeks: 4,
        minimum_samples: 100,
        overall_misroute_threshold: 0.08,
        bucket_threshold: { rate: 0.15, minimum_samples: 20 },
        deterministic_fix_target: 0.05,
        shadow_release_gate: {
          relative_misroute_reduction: 0.3,
          safety_identity_grounding_bypasses: 0,
          max_extra_token_ratio: 0.1,
          max_p95_latency_increase: 0.2,
        },
      },
    };
    const outputPath = path.join(outputDir, "quality-review-report.json");
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stdout.write(`${outputPath}\n`);
    return;
  }

  const feedback = sampleWeeklyFeedback(input.cases ?? []);
  const canary = canaryPath
    ? (JSON.parse(await readFile(path.resolve(canaryPath), "utf8")) as { cases?: ReplayCase[] })
        .cases ?? []
    : [];
  const scorecards = [
    ...feedback.map((item, index) =>
      buildQualityScorecard(item, index, "feedback")
    ),
    ...canary.map((item, index) =>
      buildQualityScorecard(item, feedback.length + index, "canary")
    ),
  ];
  const outputPath = path.join(outputDir, "quality-review-pack.json");
  await writeFile(
    outputPath,
    `${JSON.stringify({
      version: 1,
      rubric: {
        dimensions: QUALITY_DIMENSIONS,
        fatal_flags: QUALITY_FATAL_FLAGS,
        score_range: [1, 5],
      },
      scorecards,
    }, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(`${outputPath}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
