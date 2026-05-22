import { describe, expect, it } from "vitest";
import { buildReadingRunTrace } from "@/server/reading/trace";

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
});
