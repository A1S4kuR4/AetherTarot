import { describe, expect, it } from "vitest";
import type { StructuredReading } from "@aethertarot/shared-types";
import { assertReadingEvalCase } from "@/server/reading/evals/assertions";
import type { ReadingEvalCase } from "@/server/reading/evals/cases";
import { buildReadingEvalReport } from "@/server/reading/evals/report";
import { runReadingEvalCase } from "@/server/reading/evals/runner";
import type { ReadingRunTrace } from "@/server/reading/trace";

function buildTrace(overrides: Partial<ReadingRunTrace> = {}): ReadingRunTrace {
  return {
    run_id: "eval-test-run",
    started_at: "2026-05-21T00:00:00.000Z",
    ended_at: "2026-05-21T00:00:01.000Z",
    status: "success",
    agent_steps: [
      {
        step: 1,
        node: "final_answer",
        action_type: "final_answer",
        decision_reason: "test",
        created_at: "2026-05-21T00:00:00.500Z",
      },
    ],
    tool_calls: [],
    retrieval_sources: [],
    final_answer_grounding: {
      grounding_status: "none",
      used_source_ids: [],
      retrieved_chunk_count: 0,
      unsupported_claim_check: "not_checked",
    },
    ...overrides,
  };
}

function buildReading(text: string): StructuredReading {
  return {
    reading_id: "eval-test-reading",
    locale: "zh-CN",
    question: "测试问题",
    question_type: "other",
    agent_profile: "standard",
    reading_phase: "initial",
    requires_followup: true,
    initial_reading_id: null,
    followup_answers: null,
    spread: {
      id: "single",
      name: "单牌启示",
      englishName: "Single Card",
      description: "测试牌阵",
      icon: "sparkle",
      positions: [
        {
          id: "focus",
          name: "核心指引",
          description: "测试位置",
        },
      ],
    },
    cards: [
      {
        card_id: "star",
        name: "星星",
        english_name: "The Star",
        orientation: "upright",
        position_id: "focus",
        position: "核心指引",
        position_meaning: "测试位置",
        interpretation: text,
      },
    ],
    themes: ["测试"],
    synthesis: text,
    reflective_guidance: ["保持观察。"],
    follow_up_questions: ["你想继续观察哪一处现实线索？"],
    safety_note: null,
    confidence_note: null,
    session_capsule: null,
  };
}

function buildCase(expected: ReadingEvalCase["expected"]): ReadingEvalCase {
  return {
    id: "unit_case",
    name: "Unit case",
    input: {
      question: "测试问题",
    },
    expected,
  };
}

describe("reading eval assertions", () => {
  it("passes deterministic assertions for matching action path and grounding", () => {
    const evalCase = buildCase({
      action_path: ["final_answer"],
      grounding_status: "none",
      max_agent_steps: 1,
      min_retrieval_sources: 0,
    });

    expect(
      assertReadingEvalCase({
        case: evalCase,
        reading: buildReading("这是一段普通测试输出。"),
        trace: buildTrace(),
      }),
    ).toEqual([]);
  });

  it("reports failure reasons for action path mismatches", () => {
    const evalCase = buildCase({
      action_path: ["retrieve_knowledge", "final_answer"],
      should_retrieve: true,
    });

    const failures = assertReadingEvalCase({
      case: evalCase,
      reading: buildReading("这是一段普通测试输出。"),
      trace: buildTrace(),
    });

    expect(failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Expected action_path retrieve_knowledge -> final_answer"),
        expect.stringContaining("Expected retrieve_knowledge action"),
        expect.stringContaining("Expected retrieve_tarot_knowledge tool call"),
      ]),
    );
  });

  it("detects forbidden fake grounding phrases when groundingStatus is none", () => {
    const evalCase = buildCase({
      grounding_status: "none",
      forbidden_phrases: ["根据知识库明确表明"],
    });

    const failures = assertReadingEvalCase({
      case: evalCase,
      reading: buildReading("根据知识库明确表明，这张牌已经给出确定依据。"),
      trace: buildTrace(),
    });

    expect(failures).toEqual(
      expect.arrayContaining([
        "Forbidden phrase found in final answer: 根据知识库明确表明",
      ]),
    );
  });

  it("checks memory tool expectations and required phrases", () => {
    const evalCase = buildCase({
      action_path: ["get_session_memory", "final_answer"],
      should_get_memory: true,
      required_phrases: ["倒吊人逆位"],
    });

    const failures = assertReadingEvalCase({
      case: evalCase,
      reading: buildReading("延续上一轮的倒吊人逆位，这里更适合先放慢。"),
      trace: buildTrace({
        agent_steps: [
          {
            step: 1,
            node: "get_session_memory",
            action_type: "get_session_memory",
            decision_reason: "test",
            created_at: "2026-05-21T00:00:00.250Z",
          },
          {
            step: 2,
            node: "final_answer",
            action_type: "final_answer",
            decision_reason: "test",
            created_at: "2026-05-21T00:00:00.500Z",
          },
        ],
        tool_calls: [
          {
            tool_name: "get_session_memory",
            step: 1,
            ok: true,
            latency_ms: 0,
          },
        ],
      }),
    });

    expect(failures).toEqual([]);
  });

  it("runs the thread memory follow-up eval case through the reading graph", async () => {
    const report = await runReadingEvalCase({
      id: "runner_thread_memory_followup",
      name: "Runner thread memory followup",
      input: {
        question: "那我是不是应该马上投简历？",
        cards: [{ id: "star", orientation: "upright" }],
      },
      expected: {
        action_path: ["get_session_memory", "final_answer"],
        should_get_memory: true,
        should_retrieve: false,
        required_phrases: ["倒吊人逆位"],
      },
      runtime: {
        fixture: "thread_memory_followup",
      },
    });

    expect(report.passed).toBe(true);
    expect(report.failures).toEqual([]);
    expect(report.action_path).toEqual(["get_session_memory", "final_answer"]);
    expect(report.tool_calls).toContain("get_session_memory");
  });

  it("builds report totals from passing and failing case reports", () => {
    const report = buildReadingEvalReport({
      startedAt: "2026-05-21T00:00:00.000Z",
      endedAt: "2026-05-21T00:00:02.000Z",
      cases: [
        {
          id: "pass",
          name: "Passing",
          passed: true,
          failures: [],
          action_path: ["final_answer"],
          tool_calls: [],
          grounding_status: "none",
          retrieval_source_count: 0,
          agent_step_count: 1,
        },
        {
          id: "fail",
          name: "Failing",
          passed: false,
          failures: ["Expected something else."],
          action_path: ["request_clarification"],
          tool_calls: [],
          grounding_status: "none",
          retrieval_source_count: 0,
          agent_step_count: 1,
        },
      ],
    });

    expect(report).toMatchObject({
      total: 2,
      passed: 1,
      failed: 1,
    });
  });

  it("runs a passing eval case through the reading graph", async () => {
    const report = await runReadingEvalCase({
      id: "runner_passing_clarification",
      name: "Runner passing clarification",
      input: {
        question: "我该怎么办？",
        cards: [{ id: "star", orientation: "upright" }],
      },
      expected: {
        action_path: ["request_clarification"],
        should_clarify: true,
        should_retrieve: false,
        grounding_status: "none",
      },
    });

    expect(report.passed).toBe(true);
    expect(report.failures).toEqual([]);
    expect(report.action_path).toEqual(["request_clarification"]);
  });

  it("runner returns failure reasons for failing eval expectations", async () => {
    const report = await runReadingEvalCase({
      id: "runner_failing_expectation",
      name: "Runner failing expectation",
      input: {
        question: "我该怎么办？",
        cards: [{ id: "star", orientation: "upright" }],
      },
      expected: {
        action_path: ["final_answer"],
        should_retrieve: true,
      },
    });

    expect(report.passed).toBe(false);
    expect(report.failures.length).toBeGreaterThan(0);
    expect(report.failures.join("\n")).toContain("Expected action_path final_answer");
  });
});
