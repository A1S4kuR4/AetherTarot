import type { ReadingEvalRunResult } from "@/server/reading/evals/assertions";
import { assertReadingEvalCase, summarizeEvalResult } from "@/server/reading/evals/assertions";

export interface ReadingEvalCaseReport {
  id: string;
  name: string;
  passed: boolean;
  failures: string[];
  action_path: string[];
  tool_calls: string[];
  grounding_status?: string;
  retrieval_source_count: number;
  agent_step_count: number;
}

export interface ReadingEvalReport {
  started_at: string;
  ended_at: string;
  total: number;
  passed: number;
  failed: number;
  cases: ReadingEvalCaseReport[];
}

export function buildReadingEvalCaseReport(
  result: ReadingEvalRunResult,
): ReadingEvalCaseReport {
  const failures = assertReadingEvalCase(result);
  const summary = summarizeEvalResult(result);

  return {
    id: result.case.id,
    name: result.case.name,
    passed: failures.length === 0,
    failures,
    ...summary,
  };
}

export function buildReadingEvalReport({
  startedAt,
  endedAt,
  cases,
}: {
  startedAt: string;
  endedAt: string;
  cases: ReadingEvalCaseReport[];
}): ReadingEvalReport {
  const passed = cases.filter((item) => item.passed).length;

  return {
    started_at: startedAt,
    ended_at: endedAt,
    total: cases.length,
    passed,
    failed: cases.length - passed,
    cases,
  };
}
