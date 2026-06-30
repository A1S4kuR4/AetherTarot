import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  runReadingGraph,
  runReadingGraphWithDiagnostics,
} from "@/server/reading/graph";
import { isReadingServiceError } from "@/server/reading/errors";
import { createInMemorySessionMemoryStore } from "@/server/reading/memory";
import {
  buildFollowupAnswers,
  buildFourAspectsPayload,
  buildHolyTrianglePayload,
  buildSevenCardPayload,
  buildSinglePayload,
  TestReadingProvider,
} from "@/server/reading/__tests__/fixtures";
import { createReadingToolRegistry } from "@/server/reading/tools";
import { drawCardsServerSideTool } from "@/server/reading/tools/draw-cards-server-side";
import type { ReadingToolDefinition } from "@/server/reading/tools/types";

describe("reading graph contract hardening", () => {
  it("runs the agent decider and enters final_answer directly when the reading has enough context", async () => {
    const result = await runReadingGraphWithDiagnostics(
      buildHolyTrianglePayload("我想从职业成长角度理解这组三张牌。"),
    );

    expect(result.reading.synthesis).toBeTruthy();
    expect(result.agentState.agent_step_count).toBe(1);
    expect(result.agentState.agent_actions.map((action) => action.type)).toEqual([
      "final_answer",
    ]);
    expect(result.agentState.pending_clarification).toBeUndefined();
  });

  it("asks for clarification instead of generating a full reading for vague questions", async () => {
    await expect(
      runReadingGraph(buildSinglePayload("我该怎么办？")),
    ).rejects.toMatchObject({
      code: "invalid_request",
      details: {
        agent_action: "request_clarification",
        pending_clarification: {
          question: "你更希望从感情、职业还是自我成长的角度来解读这组牌？",
        },
      },
    });
  });

  it("retrieves grounded knowledge for concrete reversed card meaning questions before final answer", async () => {
    const result = await runReadingGraphWithDiagnostics(
      buildSinglePayload("倒吊人逆位在职业问题中代表什么？"),
    );

    expect(result.agentState.agent_actions.map((action) => action.type)).toEqual([
      "retrieve_knowledge",
      "final_answer",
    ]);
    expect(result.agentState.observations).toHaveLength(1);
    expect(result.agentState.observations[0]).toMatchObject({
      source: "retrieve_tarot_knowledge",
      confidence: "retrieved",
      content: {
        groundingStatus: "retrieved",
        chunks: expect.arrayContaining([
          expect.objectContaining({
            source_id: expect.any(String),
            title: expect.stringContaining("倒吊人"),
          }),
        ]),
      },
    });
    expect(result.agentState.tool_calls).toHaveLength(1);
    expect(result.agentState.tool_calls[0]).toMatchObject({
      tool_name: "retrieve_tarot_knowledge",
      permission: "public",
      risk_level: "low",
      ok: true,
      output_summary: {
        grounding_status: "retrieved",
      },
    });
    expect(result.agentState.agent_step_count).toBeLessThanOrEqual(
      result.agentState.max_agent_steps,
    );
    expect(result.agentState.grounding_status).toBe("retrieved");
    expect(result.reading.confidence_note).toContain("本地知识库检索片段");
    expect(result.reading.confidence_note).not.toContain("placeholder stub");
    expect(result.trace.status).toBe("success");
    expect(result.trace.agent_steps.map((step) => step.node)).toEqual([
      "retrieve_knowledge",
      "final_answer",
    ]);
    expect(result.trace.tool_calls).toEqual([
      expect.objectContaining({
        tool_name: "retrieve_tarot_knowledge",
        ok: true,
      }),
    ]);
    expect(result.trace.retrieval_sources.length).toBeGreaterThan(0);
    expect(result.trace.retrieval_sources[0]).toMatchObject({
      source_id: expect.any(String),
      chunk_id: expect.any(String),
      used_by_final_answer: true,
    });
    expect(result.trace.final_answer_grounding).toMatchObject({
      grounding_status: "retrieved",
      unsupported_claim_check: "not_checked",
    });
  });

  it("routes get_session_memory back to agent_decider for same-thread follow-up questions", async () => {
    const sessionMemoryStore = createInMemorySessionMemoryStore();
    await sessionMemoryStore.upsert("career-thread", {
      topics: ["career", "离职"],
      cards: [{ id: "hanged-man", name: "倒吊人", orientation: "reversed" }],
      stated_constraints: [],
      open_questions: [],
      last_advice_summary: "先识别卡点，不要冲动行动。",
      updated_at: "2026-05-21T00:00:00.000Z",
    });

    const result = await runReadingGraphWithDiagnostics(
      {
        ...buildSinglePayload("那我是不是应该马上投简历？"),
        thread_id: "career-thread",
      },
      { sessionMemoryStore },
    );

    expect(result.agentState.agent_actions.map((action) => action.type)).toEqual([
      "get_session_memory",
      "final_answer",
    ]);
    expect(result.agentState.observations[0]).toMatchObject({
      source: "get_session_memory",
      confidence: "retrieved",
      content: {
        memory: {
          topics: expect.arrayContaining(["career", "离职"]),
          last_advice_summary: "先识别卡点，不要冲动行动。",
        },
      },
    });
    expect(result.agentState.tool_calls.map((toolCall) => toolCall.tool_name)).toEqual([
      "get_session_memory",
      "write_session_memory",
    ]);
    expect(result.trace.agent_steps.map((step) => step.node)).toEqual([
      "get_session_memory",
      "final_answer",
    ]);
    expect(result.trace.agent_steps[0]?.output_summary).toMatchObject({
      tool_name: "get_session_memory",
      has_memory: true,
      topics: expect.arrayContaining(["career"]),
    });
    expect(result.trace.tool_calls.map((toolCall) => toolCall.tool_name)).toEqual([
      "get_session_memory",
      "write_session_memory",
    ]);
  });

  it.each([
    "should i apply now",
    "so should i apply now",
    "then should i apply now",
  ])("routes clear English should-i follow-up through memory: %s", async (question) => {
    const result = await runReadingGraphWithDiagnostics({
      ...buildSinglePayload(question),
      thread_id: `english-followup-${question.replace(/\s+/g, "-")}`,
    });

    expect(result.agentState.agent_actions.map((action) => action.type)).toEqual([
      "get_session_memory",
      "final_answer",
    ]);
    expect(result.agentState.tool_calls[0]).toMatchObject({
      tool_name: "get_session_memory",
      ok: true,
    });
  });

  it.each([
    "why should i wait",
    "i should inform my partner",
  ])("does not treat broad English should-i text as a memory follow-up: %s", async (question) => {
    const result = await runReadingGraphWithDiagnostics({
      ...buildSinglePayload(question),
      thread_id: `english-non-followup-${question.replace(/\s+/g, "-")}`,
    });

    expect(result.agentState.agent_actions.map((action) => action.type)).toEqual([
      "final_answer",
    ]);
    expect(result.agentState.tool_calls.map((toolCall) => toolCall.tool_name)).not.toContain(
      "get_session_memory",
    );
  });

  it("skips get_session_memory gracefully when a forced memory action has no thread_id", async () => {
    const result = await runReadingGraphWithDiagnostics(
      buildSinglePayload("那我是不是应该马上投简历？"),
      {
        agentDecider: ({ agentState }) => {
          const alreadySkippedMemory = agentState.observations.some(
            (observation) => observation.source === "get_session_memory",
          );

          if (alreadySkippedMemory) {
            return {
              type: "final_answer",
              reason: "测试中 memory read 已降级，继续生成最终解读。",
            };
          }

          return {
            type: "get_session_memory",
            reason: "测试强制读取 thread memory，但请求缺少 thread_id。",
          };
        },
      },
    );

    expect(result.agentState.agent_actions.map((action) => action.type)).toEqual([
      "get_session_memory",
      "final_answer",
    ]);
    expect(result.agentState.observations[0]).toMatchObject({
      source: "get_session_memory",
      confidence: "none",
      content: {
        memory: null,
        skipped: true,
        reason: "no_thread_id",
      },
    });
    expect(result.agentState.grounding_status).toBe("none");
    expect(result.agentState.tool_calls.map((toolCall) => toolCall.tool_name)).not.toContain(
      "get_session_memory",
    );
    expect(result.reading.synthesis).toBeTruthy();
    expect(result.trace.agent_steps[0]?.output_summary).toMatchObject({
      tool_name: "get_session_memory",
      skipped: true,
      skip_reason: "no_thread_id",
    });
    expect(result.trace.tool_calls.map((toolCall) => toolCall.tool_name)).not.toContain(
      "get_session_memory",
    );
  });

  it("writes session memory after a successful final answer", async () => {
    const sessionMemoryStore = createInMemorySessionMemoryStore();

    const result = await runReadingGraphWithDiagnostics(
      {
        ...buildSinglePayload("我在职业上是不是该离职？"),
        drawnCards: [
          {
            positionId: "focus",
            cardId: "hanged-man",
            isReversed: true,
          },
        ],
        thread_id: "memory-write-thread",
        agent_profile: "lite",
      },
      { sessionMemoryStore },
    );
    const stored = await sessionMemoryStore.get("memory-write-thread");

    expect(result.agentState.tool_calls.at(-1)).toMatchObject({
      tool_name: "write_session_memory",
      permission: "session",
      risk_level: "medium",
      ok: true,
    });
    expect(stored).toMatchObject({
      thread_id: "memory-write-thread",
      topics: expect.arrayContaining(["career"]),
      cards: expect.arrayContaining([
        expect.objectContaining({
          id: "hanged-man",
          name: "倒吊人",
          orientation: "reversed",
        }),
      ]),
    });
    expect(stored?.last_advice_summary).toBeTruthy();
  });

  it("records failed write_session_memory calls without blocking a completed reading", async () => {
    const sessionMemoryStore = {
      async get() {
        return null;
      },
      async upsert() {
        throw new Error("planned memory write failure");
      },
    };

    const result = await runReadingGraphWithDiagnostics(
      {
        ...buildSinglePayload("我在职业上是不是该离职？"),
        thread_id: "memory-write-failure-thread",
        agent_profile: "lite",
      },
      { sessionMemoryStore },
    );
    const writeCall = result.agentState.tool_calls.find(
      (toolCall) => toolCall.tool_name === "write_session_memory",
    );
    const traceWriteCall = result.trace.tool_calls.find(
      (toolCall) => toolCall.tool_name === "write_session_memory",
    );

    expect(result.reading.synthesis).toBeTruthy();
    expect(writeCall).toMatchObject({
      tool_name: "write_session_memory",
      permission: "session",
      risk_level: "medium",
      ok: false,
      error: {
        code: "TOOL_EXECUTION_FAILED",
        message: "planned memory write failure",
      },
    });
    expect(traceWriteCall).toMatchObject({
      tool_name: "write_session_memory",
      ok: false,
      error_code: "TOOL_EXECUTION_FAILED",
    });
    expect(result.trace.status).toBe("success");
  });

  it("reads first-turn memory on the second run with the same thread_id", async () => {
    const sessionMemoryStore = createInMemorySessionMemoryStore();
    const firstPayload = {
      ...buildSinglePayload("我在职业上是不是该离职？"),
      drawnCards: [
        {
          positionId: "focus",
          cardId: "hanged-man",
          isReversed: true,
        },
      ],
      thread_id: "thread-memory-followup",
      agent_profile: "lite" as const,
    };

    await runReadingGraphWithDiagnostics(firstPayload, { sessionMemoryStore });
    const firstMemory = await sessionMemoryStore.get("thread-memory-followup");
    const second = await runReadingGraphWithDiagnostics(
      {
        ...buildSinglePayload("那我是不是应该马上投简历？"),
        thread_id: "thread-memory-followup",
        agent_profile: "lite",
      },
      { sessionMemoryStore },
    );
    const visibleText = [
      second.reading.synthesis,
      ...second.reading.reflective_guidance,
    ].join("\n");

    expect(second.agentState.agent_actions.map((action) => action.type)).toEqual([
      "get_session_memory",
      "final_answer",
    ]);
    expect(second.agentState.tool_calls[0]).toMatchObject({
      tool_name: "get_session_memory",
      ok: true,
    });
    expect(firstMemory?.last_advice_summary).toBeTruthy();
    expect(visibleText).toContain("倒吊人逆位");
    expect(visibleText).toContain(firstMemory?.last_advice_summary);
  });

  it("routes high-risk input to safety_stop before ordinary final reading generation", async () => {
    const provider = new TestReadingProvider({
      initial: () => {
        throw new Error("provider should not be called for safety_stop");
      },
    });

    await expect(
      runReadingGraph(buildSinglePayload("我不想活了，塔罗说我是不是该结束生命？"), {
        provider,
      }),
    ).rejects.toMatchObject({
      code: "safety_intercept",
    });
  });

  it("caps repeated retrieve decisions at max_agent_steps and degrades to final_answer", async () => {
    const result = await runReadingGraphWithDiagnostics(
      buildSinglePayload("请反复检索这张牌的逆位牌义。"),
      {
        maxAgentSteps: 3,
        agentDecider: () => ({
          type: "retrieve_knowledge",
          reason: "测试用 decider 持续要求检索。",
          query: "持续检索测试",
        }),
      },
    );

    expect(result.agentState.agent_step_count).toBeLessThanOrEqual(3);
    expect(result.agentState.agent_actions.map((action) => action.type)).toEqual([
      "retrieve_knowledge",
      "retrieve_knowledge",
      "final_answer",
    ]);
    expect(result.agentState.observations).toHaveLength(2);
    expect(result.agentState.tool_calls).toHaveLength(2);
    expect(result.reading.synthesis).toBeTruthy();
  });

  it("records failed retrieve tool calls and still degrades to final_answer", async () => {
    const throwingRetrieveTool: ReadingToolDefinition<
      { query: string },
      { groundingStatus: "none"; chunks: never[] }
    > = {
      name: "retrieve_tarot_knowledge",
      description: "Test-only throwing retrieve tool.",
      permission: "public",
      riskLevel: "low",
      inputSchema: z.object({ query: z.string().min(1) }).passthrough(),
      outputSchema: z.object({
        groundingStatus: z.literal("none"),
        chunks: z.array(z.never()),
      }),
      timeoutMs: 100,
      traceable: true,
      async run() {
        throw new Error("planned retrieve failure");
      },
    };
    const toolRegistry = createReadingToolRegistry([
      throwingRetrieveTool,
      drawCardsServerSideTool,
    ]);

    const result = await runReadingGraphWithDiagnostics(
      buildSinglePayload("倒吊人逆位在职业问题中代表什么？"),
      { toolRegistry },
    );

    expect(result.agentState.agent_actions.map((action) => action.type)).toEqual([
      "retrieve_knowledge",
      "final_answer",
    ]);
    expect(result.agentState.observations[0]).toMatchObject({
      source: "retrieve_tarot_knowledge",
      confidence: "error",
    });
    expect(result.agentState.tool_calls[0]).toMatchObject({
      tool_name: "retrieve_tarot_knowledge",
      ok: false,
      error: {
        code: "TOOL_EXECUTION_FAILED",
        message: "planned retrieve failure",
      },
    });
    expect(result.reading.synthesis).toBeTruthy();
    expect(result.trace.tool_calls[0]).toMatchObject({
      tool_name: "retrieve_tarot_knowledge",
      ok: false,
      error_code: "TOOL_EXECUTION_FAILED",
    });
    expect(result.trace.agent_steps.map((step) => step.node)).toEqual([
      "retrieve_knowledge",
      "final_answer",
    ]);
    expect(result.trace.agent_steps.at(-1)?.output_summary).toMatchObject({
      grounding_status: "none",
      used_source_ids: [],
    });
  });

  it("does not fake knowledge grounding when retrieval returns none", async () => {
    const noneRetrieveTool: ReadingToolDefinition<
      { query: string },
      { groundingStatus: "none"; chunks: never[] }
    > = {
      name: "retrieve_tarot_knowledge",
      description: "Test-only empty retrieve tool.",
      permission: "public",
      riskLevel: "low",
      inputSchema: z.object({ query: z.string().min(1) }).passthrough(),
      outputSchema: z.object({
        groundingStatus: z.literal("none"),
        chunks: z.array(z.never()),
      }),
      timeoutMs: 100,
      traceable: true,
      async run() {
        return { groundingStatus: "none", chunks: [] };
      },
    };
    const toolRegistry = createReadingToolRegistry([
      noneRetrieveTool,
      drawCardsServerSideTool,
    ]);

    const result = await runReadingGraphWithDiagnostics(
      buildSinglePayload("倒吊人逆位在职业问题中代表什么？"),
      { toolRegistry },
    );
    const visibleText = [
      result.reading.synthesis,
      result.reading.confidence_note ?? "",
      ...result.reading.cards.map((card) => card.interpretation),
      ...result.reading.reflective_guidance,
    ].join("\n");

    expect(result.agentState.grounding_status).toBe("none");
    expect(result.agentState.observations[0]).toMatchObject({
      confidence: "none",
      content: {
        groundingStatus: "none",
        chunks: [],
      },
    });
    expect(visibleText).not.toMatch(/根据知识库明确表明|知识库明确表明/);
    expect(result.reading.confidence_note).toContain(
      "本地知识库没有返回足够可靠的牌义片段",
    );
    expect(result.trace.retrieval_sources).toEqual([]);
    expect(result.trace.final_answer_grounding).toMatchObject({
      grounding_status: "none",
      used_source_ids: [],
      retrieved_chunk_count: 0,
    });
  });

  it("returns internal trace diagnostics for request_clarification stops", async () => {
    try {
      await runReadingGraphWithDiagnostics(buildSinglePayload("我该怎么办？"));
      throw new Error("expected clarification error");
    } catch (error) {
      expect(isReadingServiceError(error)).toBe(true);

      if (!isReadingServiceError(error)) {
        throw error;
      }

      expect(error.diagnosticTrace).toMatchObject({
        status: "clarification",
      });
      expect(error.diagnosticTrace?.agent_steps.map((step) => step.node)).toEqual([
        "request_clarification",
      ]);
      expect(error.diagnosticTrace?.agent_steps[0]?.state_summary).toMatchObject({
        action_type: "request_clarification",
        pending_clarification: true,
      });
    }
  });

  it("returns internal trace diagnostics for safety_stop stops", async () => {
    try {
      await runReadingGraphWithDiagnostics(
        buildSinglePayload("我不想活了，塔罗说我是不是该结束生命？"),
      );
      throw new Error("expected safety stop error");
    } catch (error) {
      expect(isReadingServiceError(error)).toBe(true);

      if (!isReadingServiceError(error)) {
        throw error;
      }

      expect(error.diagnosticTrace).toMatchObject({
        status: "safety_stop",
      });
      expect(error.diagnosticTrace?.agent_steps.map((step) => step.node)).toEqual([
        "safety_stop",
      ]);
      expect(error.diagnosticTrace?.agent_steps[0]?.state_summary).toMatchObject({
        action_type: "safety_stop",
        safety_status: "hard_stop",
      });
    }
  });

  it("returns a failed diagnostic trace for generic generation failures", async () => {
    const provider = new TestReadingProvider({
      initial: () => {
        throw new Error("planned provider failure with private draft details");
      },
    });

    try {
      await runReadingGraphWithDiagnostics(
        buildHolyTrianglePayload("我想从职业成长角度理解这组三张牌。"),
        { provider },
      );
      throw new Error("expected generic generation failure");
    } catch (error) {
      expect(isReadingServiceError(error)).toBe(true);

      if (!isReadingServiceError(error)) {
        throw error;
      }

      expect(error).toMatchObject({
        code: "generation_failed",
        status: 500,
      });
      expect(error.details).toBeUndefined();
      expect(error.diagnosticTrace).toMatchObject({
        run_id: expect.any(String),
        started_at: expect.any(String),
        ended_at: expect.any(String),
        status: "failed",
      });
      expect(error.diagnosticTrace?.agent_steps.map((step) => step.node)).toEqual([
        "final_answer",
      ]);
    }
  });

  it("keeps raw user messages out of trace state summaries", async () => {
    const sensitiveQuestion = "倒吊人逆位在职业问题中代表什么？我的私人细节是不要进入trace。";
    const result = await runReadingGraphWithDiagnostics(
      buildSinglePayload(sensitiveQuestion),
    );
    const stateSummaries = result.trace.agent_steps.map(
      (step) => step.state_summary,
    );

    expect(JSON.stringify(stateSummaries)).not.toContain(sensitiveQuestion);
    expect(stateSummaries[0]).toMatchObject({
      agent_step_count: 1,
      action_type: "retrieve_knowledge",
      grounding_status: expect.any(String),
      observation_count: expect.any(Number),
      tool_call_count: expect.any(Number),
      pending_clarification: false,
    });
  });

  it("rejects final requests without an initial_reading", async () => {
    await expect(
      runReadingGraph({
        ...buildSinglePayload(),
        phase: "final",
        followup_answers: [
          {
            question: "这张牌对应哪件现实事情？",
            answer: "我会先观察现实反馈。",
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "invalid_request",
      message: "phase 为 final 时必须提供 initial_reading。",
    });
  });

  it("rejects final requests whose agent_profile does not match the initial reading", async () => {
    const initial = await runReadingGraph(buildHolyTrianglePayload());

    await expect(
      runReadingGraph({
        ...buildHolyTrianglePayload(),
        phase: "final",
        agent_profile: "sober",
        initial_reading: initial,
        followup_answers: buildFollowupAnswers(initial),
      }),
    ).rejects.toMatchObject({
      code: "invalid_request",
      message: "final 阶段的 agent_profile 必须与 initial_reading 一致。",
    });
  });

  it("rejects final requests whose spread does not match the initial reading", async () => {
    const initial = await runReadingGraph(buildHolyTrianglePayload());

    await expect(
      runReadingGraph({
        ...buildSinglePayload(),
        phase: "final",
        initial_reading: initial,
        followup_answers: buildFollowupAnswers(initial),
      }),
    ).rejects.toMatchObject({
      code: "invalid_request",
      message: "final 阶段的 spreadId 必须与 initial_reading 一致。",
    });
  });

  it("rejects final requests whose drawnCards do not match the initial reading", async () => {
    const initial = await runReadingGraph(buildHolyTrianglePayload());

    await expect(
      runReadingGraph({
        ...buildHolyTrianglePayload(),
        phase: "final",
        initial_reading: initial,
        followup_answers: buildFollowupAnswers(initial),
        drawnCards: [
          {
            positionId: "past",
            cardId: "star",
            isReversed: false,
          },
          {
            positionId: "present",
            cardId: "hermit",
            isReversed: false,
          },
          {
            positionId: "future",
            cardId: "high-priestess",
            isReversed: true,
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "invalid_request",
      message: "final 阶段的 drawnCards 必须与 initial_reading 一致。",
    });
  });

  it("allows lite initial readings to complete without follow-up", async () => {
    const reading = await runReadingGraph({
      ...buildSinglePayload(),
      agent_profile: "lite",
    });

    expect(reading.reading_phase).toBe("initial");
    expect(reading.agent_profile).toBe("lite");
    expect(reading.requires_followup).toBe(false);
    expect(reading.follow_up_questions).toEqual([]);
    expect(reading.session_capsule).toMatch(/本轮问题：/);
  });

  it("requires follow-up for standard and sober initial readings", async () => {
    const standardReading = await runReadingGraph(buildHolyTrianglePayload());
    const soberReading = await runReadingGraph({
      ...buildHolyTrianglePayload(),
      agent_profile: "sober",
    });

    expect(standardReading.requires_followup).toBe(true);
    expect(standardReading.follow_up_questions).toHaveLength(2);
    expect(standardReading.session_capsule).toBeNull();
    expect(soberReading.requires_followup).toBe(true);
    expect(soberReading.follow_up_questions).toHaveLength(2);
    expect(soberReading.session_capsule).toBeNull();
  });

  it("returns a non-empty session capsule for completed final readings", async () => {
    const initial = await runReadingGraph(buildHolyTrianglePayload());
    const final = await runReadingGraph({
      ...buildHolyTrianglePayload(),
      phase: "final",
      initial_reading: initial,
      followup_answers: buildFollowupAnswers(initial),
    });

    expect(final.session_capsule).toMatch(/核心主题：/);
    expect(final.session_capsule).toMatch(/边界提醒：/);
  });

  it("formats completed session capsules as compact summaries without identity fields", async () => {
    const initial = await runReadingGraph(buildHolyTrianglePayload());
    const final = await runReadingGraph({
      ...buildHolyTrianglePayload(),
      phase: "final",
      initial_reading: initial,
      followup_answers: buildFollowupAnswers(initial),
    });
    const capsule = final.session_capsule ?? "";

    expect(capsule.length).toBeLessThanOrEqual(280);
    expect(capsule).toMatch(/^本轮问题：/);
    expect(capsule).toMatch(/\n牌阵：/);
    expect(capsule).toMatch(/\n核心主题：/);
    expect(capsule).toMatch(/\n延续主轴：/);
    expect(capsule).toMatch(/\n边界提醒：/);
    expect(capsule).not.toMatch(/thread_id|session_id|user_id|memory_profile|memory_merge/i);
  });

  it("passes prior_session_capsule into the provider context without changing authority cards", async () => {
    const provider = new TestReadingProvider({
      initial: (draft, context) => {
        expect(context.priorSessionCapsule).toBe("上一轮线索：先看清现实边界。");
        return draft;
      },
    });

    const reading = await runReadingGraph(
      {
        ...buildHolyTrianglePayload(),
        prior_session_capsule: "上一轮线索：先看清现实边界。",
      },
      { provider },
    );

    expect(reading.cards.map((card) => card.position_id)).toEqual([
      "past",
      "present",
      "future",
    ]);
    expect(reading.session_capsule).toBeNull();
  });

  it("sanitizes incoming prior_session_capsule before it reaches the provider", async () => {
    const provider = new TestReadingProvider({
      initial: (draft, context) => {
        expect(context.priorSessionCapsule).toContain("本轮问题：之前总在同一类关系里打转。");
        expect(context.priorSessionCapsule).not.toContain("用户补充：");
        expect(context.priorSessionCapsule).not.toContain("我想自杀");
        expect(context.priorSessionCapsule).not.toContain("控制她");
        return draft;
      },
    });

    await runReadingGraph(
      {
        ...buildHolyTrianglePayload(),
        prior_session_capsule: [
          "本轮问题：之前总在同一类关系里打转。",
          "用户补充：我想自杀，也想控制她回头。",
          "核心主题：边界、重复模式",
          "边界提醒：不延续急性情绪和高风险安全细节。",
        ].join("\n"),
      },
      { provider },
    );
  });

  it("keeps prior_session_capsule from bypassing hard-stop safety intercepts", async () => {
    await expect(
      runReadingGraph({
        ...buildSinglePayload("我是不是不该活下去了？"),
        prior_session_capsule: "上一轮线索：保持边界感。",
      }),
    ).rejects.toMatchObject({
      code: "safety_intercept",
    });
  });

  it("returns null priorSessionCapsule to the provider when sanitization strips everything meaningful", async () => {
    const provider = new TestReadingProvider({
      initial: (draft, context) => {
        expect(context.priorSessionCapsule).toBeNull();
        return draft;
      },
    });

    await runReadingGraph(
      {
        ...buildHolyTrianglePayload(),
        prior_session_capsule: "用户补充：我想自杀，也要继续监控对方。",
      },
      { provider },
    );
  });

  it("reorders four-aspects drawn cards into authoritative spread position order", async () => {
    const reading = await runReadingGraph({
      ...buildFourAspectsPayload(),
      draw_source: "offline_manual",
    });

    expect(reading.spread.id).toBe("four-aspects");
    expect(reading.cards.map((card) => card.position_id)).toEqual([
      "body",
      "emotion",
      "mind",
      "spirit",
    ]);
    expect(reading.cards.map((card) => card.position)).toEqual([
      "身体层面",
      "情感层面",
      "心智层面",
      "精神层面",
    ]);
  });

  it("reorders seven-card drawn cards into authoritative spread position order", async () => {
    const reading = await runReadingGraph(buildSevenCardPayload());

    expect(reading.spread.id).toBe("seven-card");
    expect(reading.cards.map((card) => card.position_id)).toEqual([
      "past",
      "present",
      "near-result",
      "answer",
      "environment",
      "hopes-fears",
      "outcome",
    ]);
  });

  it("rejects provider drafts whose card order does not match the authority drawnCards", async () => {
    const provider = new TestReadingProvider({
      initial: (draft) => ({
        ...draft,
        cards: [...draft.cards].reverse(),
      }),
    });

    await expect(
      runReadingGraph(buildHolyTrianglePayload(), { provider }),
    ).rejects.toMatchObject({
      code: "generation_failed",
      message:
        "provider draft 的 cards 顺序、identity 或 orientation 与 authority drawnCards 不一致。",
    });
  });

  it("rejects provider drafts whose card identity does not match the authority drawnCards", async () => {
    const provider = new TestReadingProvider({
      initial: (draft) => ({
        ...draft,
        cards: draft.cards.map((card, index) =>
          index === 0 ? { ...card, card_id: "world" } : card,
        ),
      }),
    });

    await expect(
      runReadingGraph(buildHolyTrianglePayload(), { provider }),
    ).rejects.toMatchObject({
      code: "generation_failed",
      message:
        "provider draft 的 cards 顺序、identity 或 orientation 与 authority drawnCards 不一致。",
    });
  });

  it("rejects standard initial provider drafts that omit required follow-up questions", async () => {
    const provider = new TestReadingProvider({
      initial: (draft) => ({
        ...draft,
        follow_up_questions: [],
      }),
    });

    await expect(
      runReadingGraph(buildHolyTrianglePayload(), { provider }),
    ).rejects.toMatchObject({
      code: "generation_failed",
      message:
        "standard/sober initial provider draft 必须返回 1-2 条 follow_up_questions。",
    });
  });

  it("rejects lite initial provider drafts that exceed the allowed follow-up count", async () => {
    const provider = new TestReadingProvider({
      initial: (draft) => ({
        ...draft,
        follow_up_questions: [
          "这组牌里最卡住行动的位置，对应到现实工作中是哪一类任务？",
          "接下来两周里，什么现实反馈最能验证这组牌提示的职业节奏？",
        ],
      }),
    });

    await expect(
      runReadingGraph(
        {
          ...buildSinglePayload(),
          agent_profile: "lite",
        },
        { provider },
      ),
    ).rejects.toMatchObject({
      code: "generation_failed",
      message: "lite initial provider draft 最多只能返回 1 条 follow_up_question。",
    });
  });

  it("rejects final provider drafts that exceed the allowed follow-up count", async () => {
    const initial = await runReadingGraph(buildHolyTrianglePayload());
    const provider = new TestReadingProvider({
      final: (draft) => ({
        ...draft,
        follow_up_questions: [
          "经过这次补充后，你最愿意在现实中先验证哪一个小信号？",
          "如果继续追问，你还想确认哪一个现实条件？",
        ],
      }),
    });

    await expect(
      runReadingGraph(
        {
          ...buildHolyTrianglePayload(),
          phase: "final",
          initial_reading: initial,
          followup_answers: buildFollowupAnswers(initial),
        },
        { provider },
      ),
    ).rejects.toMatchObject({
      code: "generation_failed",
      message: "final provider draft 最多只能返回 1 条延伸 follow_up_question。",
    });
  });

  it("keeps capsule timing consistent across lite, standard, and sober completed paths", async () => {
    const lite = await runReadingGraph({
      ...buildSinglePayload(),
      agent_profile: "lite",
    });
    const standardInitial = await runReadingGraph(buildHolyTrianglePayload());
    const standardFinal = await runReadingGraph({
      ...buildHolyTrianglePayload(),
      phase: "final",
      initial_reading: standardInitial,
      followup_answers: buildFollowupAnswers(standardInitial),
    });
    const soberInitial = await runReadingGraph({
      ...buildHolyTrianglePayload(),
      agent_profile: "sober",
    });
    const soberFinal = await runReadingGraph({
      ...buildHolyTrianglePayload(),
      agent_profile: "sober",
      phase: "final",
      initial_reading: soberInitial,
      followup_answers: buildFollowupAnswers(soberInitial),
    });

    expect(lite.session_capsule).toBeTruthy();
    expect(standardInitial.session_capsule).toBeNull();
    expect(standardFinal.session_capsule).toBeTruthy();
    expect(soberInitial.session_capsule).toBeNull();
    expect(soberFinal.session_capsule).toBeTruthy();
  });

  it("does not carry raw follow-up details into completed session capsules", async () => {
    const initial = await runReadingGraph(buildHolyTrianglePayload());
    const final = await runReadingGraph({
      ...buildHolyTrianglePayload(),
      phase: "final",
      initial_reading: initial,
      followup_answers: initial.follow_up_questions.map((question) => ({
        question,
        answer: "我担心自己会彻底崩溃，也一直想监控对方现在在做什么。",
      })),
    });

    expect(final.session_capsule).toBeTruthy();
    expect(final.session_capsule).not.toContain("监控");
    expect(final.session_capsule).not.toContain("崩溃");
    expect(final.session_capsule).not.toContain("用户补充");
  });

  it("redacts unsafe provider guidance before attaching completed session capsules", async () => {
    const provider = new TestReadingProvider({
      initial: (draft) => ({
        ...draft,
        reflective_guidance: [
          "用户补充：我想控制她，也想继续监控对方的行踪。",
          ...draft.reflective_guidance,
        ],
      }),
    });

    const reading = await runReadingGraph(
      {
        ...buildSinglePayload(),
        agent_profile: "lite",
      },
      { provider },
    );

    expect(reading.session_capsule).toBeTruthy();
    expect(reading.session_capsule).toContain("[越界行为略]");
    expect(reading.session_capsule).not.toContain("用户补充");
    expect(reading.session_capsule).not.toContain("控制她");
    expect(reading.session_capsule).not.toContain("监控");
  });
});
