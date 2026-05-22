import type { StructuredReading } from "@aethertarot/shared-types";
import { DEFAULT_FAKE_GROUNDING_PHRASES, type ReadingEvalCase } from "@/server/reading/evals/cases";
import type { ReadingAgentState } from "@/server/reading/reading-agent-core";
import type { ReadingRunTrace } from "@/server/reading/trace";

export interface ReadingEvalRunResult {
  case: ReadingEvalCase;
  reading?: StructuredReading;
  agentState?: ReadingAgentState;
  trace?: ReadingRunTrace;
  error?: unknown;
}

function sameStringArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function collectVisibleReadingText(reading: StructuredReading | undefined) {
  if (!reading) {
    return "";
  }

  return [
    reading.synthesis,
    reading.confidence_note ?? "",
    reading.safety_note ?? "",
    ...reading.cards.map((card) => card.interpretation),
    ...reading.reflective_guidance,
    ...reading.follow_up_questions,
  ].join("\n");
}

function getActionPath(trace: ReadingRunTrace | undefined) {
  return trace?.agent_steps.map((step) => step.action_type ?? step.node) ?? [];
}

function getGroundingStatus(trace: ReadingRunTrace | undefined) {
  return trace?.final_answer_grounding?.grounding_status;
}

function hasRetrieveToolCall(trace: ReadingRunTrace | undefined) {
  return (trace?.tool_calls ?? []).some(
    (toolCall) => toolCall.tool_name === "retrieve_tarot_knowledge",
  );
}

function hasMemoryToolCall(trace: ReadingRunTrace | undefined) {
  return (trace?.tool_calls ?? []).some(
    (toolCall) => toolCall.tool_name === "get_session_memory",
  );
}

function phraseIsPresent(text: string, phrase: string) {
  return text.includes(phrase);
}

export function assertReadingEvalCase(result: ReadingEvalRunResult) {
  const failures: string[] = [];
  const expected = result.case.expected;
  const trace = result.trace;
  const actionPath = getActionPath(trace);
  const retrievalSourceCount = trace?.retrieval_sources.length ?? 0;
  const agentStepCount = result.agentState?.agent_step_count ?? trace?.agent_steps.length ?? 0;
  const groundingStatus = getGroundingStatus(trace);

  if (!trace) {
    failures.push("No diagnostic trace was produced.");
    return failures;
  }

  if (expected.action_path && !sameStringArray(actionPath, expected.action_path)) {
    failures.push(
      `Expected action_path ${expected.action_path.join(" -> ")} but got ${actionPath.join(" -> ") || "(empty)"}.`,
    );
  }

  if (expected.should_retrieve === true) {
    if (!actionPath.includes("retrieve_knowledge")) {
      failures.push("Expected retrieve_knowledge action, but action_path did not include it.");
    }

    if (!hasRetrieveToolCall(trace)) {
      failures.push("Expected retrieve_tarot_knowledge tool call, but no matching tool call was recorded.");
    }
  }

  if (expected.should_retrieve === false) {
    if (actionPath.includes("retrieve_knowledge")) {
      failures.push("Expected no retrieve_knowledge action, but action_path included it.");
    }

    if (hasRetrieveToolCall(trace)) {
      failures.push("Expected no retrieve_tarot_knowledge tool call, but one was recorded.");
    }
  }

  if (expected.should_get_memory === true) {
    if (!actionPath.includes("get_session_memory")) {
      failures.push("Expected get_session_memory action, but action_path did not include it.");
    }

    if (!hasMemoryToolCall(trace)) {
      failures.push("Expected get_session_memory tool call, but no matching tool call was recorded.");
    }
  }

  if (expected.should_clarify === true) {
    if (trace.status !== "clarification" && !actionPath.includes("request_clarification")) {
      failures.push("Expected request_clarification stop, but trace did not enter clarification.");
    }

    if (result.reading) {
      failures.push("Expected clarification without a completed reading, but a reading was produced.");
    }
  }

  if (expected.should_safety_stop === true) {
    if (trace.status !== "safety_stop" && !actionPath.includes("safety_stop")) {
      failures.push("Expected safety_stop, but trace did not enter safety_stop.");
    }

    if (result.reading) {
      failures.push("Expected safety_stop without a completed reading, but a reading was produced.");
    }
  }

  if (expected.grounding_status && groundingStatus !== expected.grounding_status) {
    failures.push(
      `Expected grounding_status ${expected.grounding_status} but got ${groundingStatus ?? "(missing)"}.`,
    );
  }

  if (
    expected.min_retrieval_sources !== undefined
    && retrievalSourceCount < expected.min_retrieval_sources
  ) {
    failures.push(
      `Expected at least ${expected.min_retrieval_sources} retrieval_sources but got ${retrievalSourceCount}.`,
    );
  }

  if (expected.max_agent_steps !== undefined && agentStepCount > expected.max_agent_steps) {
    failures.push(
      `Expected agent_step_count <= ${expected.max_agent_steps} but got ${agentStepCount}.`,
    );
  }

  const visibleText = collectVisibleReadingText(result.reading);
  const forbiddenPhrases = [
    ...(expected.forbidden_phrases ?? []),
    ...(groundingStatus === "none" ? DEFAULT_FAKE_GROUNDING_PHRASES : []),
  ];
  const uniqueForbiddenPhrases = [...new Set(forbiddenPhrases)];

  for (const phrase of uniqueForbiddenPhrases) {
    if (phraseIsPresent(visibleText, phrase)) {
      failures.push(`Forbidden phrase found in final answer: ${phrase}`);
    }
  }

  for (const phrase of expected.required_phrases ?? []) {
    if (!phraseIsPresent(visibleText, phrase)) {
      failures.push(`Required phrase missing from final answer: ${phrase}`);
    }
  }

  return failures;
}

export function summarizeEvalResult(result: ReadingEvalRunResult) {
  const trace = result.trace;

  return {
    action_path: getActionPath(trace),
    tool_calls: trace?.tool_calls.map((toolCall) => toolCall.tool_name) ?? [],
    grounding_status: getGroundingStatus(trace),
    retrieval_source_count: trace?.retrieval_sources.length ?? 0,
    agent_step_count: result.agentState?.agent_step_count ?? trace?.agent_steps.length ?? 0,
  };
}
