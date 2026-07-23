import { describe, expect, it } from "vitest";
import {
  buildReadingRunTrace,
  toPersistedReadingTraceV2,
} from "@/server/reading/trace";

describe("reading run trace", () => {
  it("keeps observation_count independent from tool_call_count", () => {
    const trace = buildReadingRunTrace(
      {
        runId: "trace-count-test",
        traceStartedAt: "2026-05-21T00:00:00.000Z",
        groundingStatus: "none",
        agentActions: [
          {
            step: 2,
            type: "final_answer",
            reason: "测试最终解读。",
            created_at: "2026-05-21T00:00:01.000Z",
          },
        ],
        observations: [
          {
            source: "retrieve_tarot_knowledge",
            confidence: "none",
            content: {
              groundingStatus: "none",
              chunks: [],
            },
          },
          {
            source: "manual_review",
            confidence: "low",
            content: {
              note: "This observation is not backed by a tool call.",
            },
          },
        ],
        toolCalls: [
          {
            id: "tool-call-1",
            step: 1,
            tool_name: "retrieve_tarot_knowledge",
            permission: "public",
            risk_level: "low",
            input_summary: { query: "星星" },
            output_summary: { grounding_status: "none" },
            ok: true,
            latency_ms: 12,
            created_at: "2026-05-21T00:00:00.500Z",
          },
        ],
      },
      {
        status: "success",
        endedAt: "2026-05-21T00:00:02.000Z",
      },
    );

    expect(trace.agent_steps[0]?.state_summary).toMatchObject({
      observation_count: 2,
      tool_call_count: 1,
    });
  });

  it("persists only structural diagnostics and grounding identifiers", () => {
    const rawQuestion = "这是绝不能被持久化的用户问题";
    const providerText = "这是绝不能被持久化的 Provider 输出";
    const trace = buildReadingRunTrace(
      {
        runId: "trace-redaction-test",
        traceStartedAt: "2026-07-23T00:00:00.000Z",
        agentActions: [{
          step: 1,
          type: "get_session_memory",
          reason: rawQuestion,
          output: {
            output: {
              memory: {
                topics: [rawQuestion],
                cards: [],
                last_advice_summary: providerText,
              },
            },
          },
        }],
        observations: [{
          source: "retrieve_tarot_knowledge",
          content: {
            groundingStatus: "retrieved",
            chunks: [{
              id: "chunk-1",
              source_id: "source-1",
              title: rawQuestion,
              content: providerText,
            }],
          },
        }],
      },
      { status: "success", endedAt: "2026-07-23T00:00:01.000Z" },
    );

    const persisted = toPersistedReadingTraceV2(trace);
    const serialized = JSON.stringify(persisted);
    expect(persisted.schema_version).toBe(2);
    expect(persisted.grounding).toMatchObject({
      source_ids: ["source-1"],
      chunk_ids: ["chunk-1"],
      retrieved_chunk_count: 1,
      grounded_card_count: 0,
      degraded_source_count: 0,
      citation_count: 0,
    });
    expect(persisted.safety).toEqual({
      policy_version: "safety-rules-v1",
      rule_ids: [],
      action_type: "pass",
    });
    expect(serialized).not.toContain(rawQuestion);
    expect(serialized).not.toContain(providerText);
  });
});
