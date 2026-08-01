import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { loadTarotKnowledgeChunks } from "@/server/reading/knowledge/loader";
import { createInMemorySessionMemoryStore } from "@/server/reading/memory";
import { executeReadingTool } from "@/server/reading/tools/executor";
import type { DrawCardsOutput } from "@/server/reading/tools/draw-cards-server-side";
import type { RetrieveTarotKnowledgeOutput } from "@/server/reading/tools/retrieve-tarot-knowledge";
import type { GetSessionMemoryOutput } from "@/server/reading/tools/session-memory";
import {
  createReadingToolRegistry,
  getSessionMemoryTool,
  readingToolRegistry,
  retrieveTarotKnowledgeTool,
  writeSessionMemoryTool,
  type ReadingToolDefinition,
} from "@/server/reading/tools";

describe("reading tool system", () => {
  it("lists the default reading tools", () => {
    const toolNames = readingToolRegistry.listTools().map((tool) => tool.name);

    expect(toolNames).toContain("retrieve_tarot_knowledge");
    expect(toolNames).toContain("draw_cards_server_side");
    expect(toolNames).toContain("get_session_memory");
    expect(toolNames).toContain("write_session_memory");
  });

  it("stores, updates, reads, and clears session memory in memory store", async () => {
    const store = createInMemorySessionMemoryStore();

    expect(await store.get("thread-1")).toBeNull();

    const first = await store.upsert("thread-1", {
      topics: ["career", "行动节奏"],
      cards: [{ id: "hanged-man", name: "倒吊人", orientation: "reversed" }],
      stated_constraints: [],
      open_questions: ["先确认卡点在哪里？"],
      last_advice_summary: "先识别卡点，不要冲动行动。",
      updated_at: "2026-05-21T00:00:00.000Z",
    });
    const second = await store.upsert("thread-1", {
      topics: ["career", "行动节奏", " 离职 "],
      cards: [
        { id: "hanged-man", name: "倒吊人更新", orientation: "reversed" },
        { id: "hanged-man", name: "倒吊人正位", orientation: "upright" },
        { id: "star", name: "星星", orientation: "upright" },
      ],
      stated_constraints: ["reality_check_required", "reality_check_required"],
      open_questions: ["先确认卡点在哪里？"],
      updated_at: "2026-05-21T00:01:00.000Z",
    });

    expect(first.thread_id).toBe("thread-1");
    expect(second.topics).toEqual(["career", "行动节奏", "离职"]);
    expect(second.cards).toHaveLength(3);
    expect(second.cards).toEqual([
      { id: "hanged-man", name: "倒吊人更新", orientation: "reversed" },
      { id: "hanged-man", name: "倒吊人正位", orientation: "upright" },
      { id: "star", name: "星星", orientation: "upright" },
    ]);
    expect(second.stated_constraints).toEqual(["reality_check_required"]);
    expect(second.open_questions).toEqual(["先确认卡点在哪里？"]);
    expect(second.last_advice_summary).toBe("先识别卡点，不要冲动行动。");

    await store.clear?.("thread-1");
    expect(await store.get("thread-1")).toBeNull();
  });

  it("rejects duplicate tool names during registration", () => {
    expect(() =>
      createReadingToolRegistry([
        retrieveTarotKnowledgeTool,
        retrieveTarotKnowledgeTool,
      ]),
    ).toThrow(/already registered/);
  });

  it("returns a standard error for unknown tools", async () => {
    const execution = await executeReadingTool({
      toolName: "unknown_tool",
      input: {},
      registry: readingToolRegistry,
    });

    expect(execution.result.ok).toBe(false);
    expect(execution.result.error?.code).toBe("TOOL_NOT_FOUND");
    expect(execution.auditEntry.ok).toBe(false);
    expect(execution.auditEntry.error?.code).toBe("TOOL_NOT_FOUND");
  });

  it("denies non-public tools when context permissions are missing", async () => {
    const sessionTool: ReadingToolDefinition<{ value: string }, { value: string }> = {
      name: "session_only_test_tool",
      description: "Test-only session permission tool.",
      permission: "session",
      riskLevel: "medium",
      inputSchema: z.object({ value: z.string().min(1) }),
      outputSchema: z.object({ value: z.string().min(1) }),
      timeoutMs: 100,
      traceable: true,
      async run(input) {
        return input;
      },
    };
    const registry = createReadingToolRegistry([sessionTool]);

    const execution = await executeReadingTool({
      toolName: "session_only_test_tool",
      input: { value: "hello" },
      registry,
      context: { permissions: ["public"] },
    });

    expect(execution.result.ok).toBe(false);
    expect(execution.result.error?.code).toBe("TOOL_PERMISSION_DENIED");
    expect(execution.auditEntry.permission).toBe("session");
    expect(execution.auditEntry.risk_level).toBe("medium");
  });

  it("executes get_session_memory through the executor", async () => {
    const store = createInMemorySessionMemoryStore();
    await store.upsert("thread-memory-tool", {
      topics: ["career"],
      cards: [{ id: "hanged-man", name: "倒吊人", orientation: "reversed" }],
      stated_constraints: [],
      open_questions: [],
      last_advice_summary: "先识别卡点，不要冲动行动。",
      updated_at: "2026-05-21T00:00:00.000Z",
    });
    const execution = await executeReadingTool<GetSessionMemoryOutput>({
      toolName: "get_session_memory",
      input: { threadId: "thread-memory-tool" },
      registry: createReadingToolRegistry([getSessionMemoryTool]),
      context: {
        permissions: ["public", "session"],
        sessionMemoryStore: store,
      },
    });

    expect(execution.result.ok).toBe(true);
    expect(execution.result.output?.memory).toMatchObject({
      thread_id: "thread-memory-tool",
      topics: ["career"],
      last_advice_summary: "先识别卡点，不要冲动行动。",
    });
    expect(execution.auditEntry).toMatchObject({
      tool_name: "get_session_memory",
      permission: "session",
      risk_level: "medium",
      ok: true,
    });
  });

  it("returns null for get_session_memory when a thread has no prior memory", async () => {
    const execution = await executeReadingTool({
      toolName: "get_session_memory",
      input: { threadId: "thread-memory-empty" },
      registry: createReadingToolRegistry([getSessionMemoryTool]),
      context: {
        permissions: ["public", "session"],
        sessionMemoryStore: createInMemorySessionMemoryStore(),
      },
    });

    expect(execution.result.ok).toBe(true);
    expect(execution.result.output).toEqual({ memory: null });
    expect(execution.auditEntry).toMatchObject({
      tool_name: "get_session_memory",
      ok: true,
    });
  });

  it("executes write_session_memory through the executor", async () => {
    const store = createInMemorySessionMemoryStore();
    const execution = await executeReadingTool({
      toolName: "write_session_memory",
      input: {
        threadId: "thread-memory-write",
        patch: {
          topics: ["career"],
          cards: [{ id: "hanged-man", name: "倒吊人", orientation: "reversed" }],
          stated_constraints: [],
          open_questions: ["是否马上投简历？"],
          last_advice_summary: "先识别卡点，不要冲动行动。",
        },
      },
      registry: createReadingToolRegistry([writeSessionMemoryTool]),
      context: {
        permissions: ["public", "session"],
        now: "2026-05-21T00:00:00.000Z",
        sessionMemoryStore: store,
      },
    });

    expect(execution.result.ok).toBe(true);
    expect(execution.result.output).toMatchObject({
      updated: true,
      memory: {
        thread_id: "thread-memory-write",
        topics: ["career"],
        updated_at: "2026-05-21T00:00:00.000Z",
      },
    });
    await expect(store.get("thread-memory-write")).resolves.toMatchObject({
      last_advice_summary: "先识别卡点，不要冲动行动。",
    });
  });

  it("denies session memory tools when session permission is missing", async () => {
    const execution = await executeReadingTool({
      toolName: "get_session_memory",
      input: { threadId: "thread-no-permission" },
      registry: createReadingToolRegistry([getSessionMemoryTool]),
      context: { permissions: ["public"] },
    });

    expect(execution.result.ok).toBe(false);
    expect(execution.result.error?.code).toBe("TOOL_PERMISSION_DENIED");
    expect(execution.auditEntry).toMatchObject({
      tool_name: "get_session_memory",
      permission: "session",
      risk_level: "medium",
      ok: false,
    });
  });

  it("executes retrieve_tarot_knowledge through the executor with real local wiki chunks", async () => {
    const execution = await executeReadingTool<RetrieveTarotKnowledgeOutput>({
      toolName: "retrieve_tarot_knowledge",
      input: {
        query: "倒吊人逆位在职业问题中代表什么？",
        card: "hanged-man",
        orientation: "reversed",
        topic: "career",
      },
      registry: readingToolRegistry,
      decisionReason: "测试检索工具链路。",
      step: 1,
    });

    expect(execution.result.ok).toBe(true);
    expect(execution.result.toolName).toBe("retrieve_tarot_knowledge");
    expect(execution.result.output?.groundingStatus).toBe("retrieved");
    expect(execution.result.output?.chunks.length).toBeGreaterThan(0);
    expect(execution.result.output?.chunks[0]).toMatchObject({
      source_id: expect.any(String),
      confidence: expect.stringMatching(/low|medium|high/),
    });
    expect(execution.result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(execution.auditEntry.tool_name).toBe("retrieve_tarot_knowledge");
    expect(execution.auditEntry.output_summary).toMatchObject({
      grounding_status: "retrieved",
    });
  });

  it("returns none when retrieve_tarot_knowledge finds no reliable local chunks", async () => {
    const execution = await executeReadingTool({
      toolName: "retrieve_tarot_knowledge",
      input: {
        query: "zzzznomatch998877",
        card: "not-a-real-card",
        orientation: "unknown",
        topic: "not-a-real-topic",
      },
      registry: readingToolRegistry,
    });

    expect(execution.result.ok).toBe(true);
    expect(execution.result.output).toEqual({
      chunks: [],
      groundingStatus: "none",
    });
  });

  it("loads tarot knowledge chunks with metadata from markdown files", async () => {
    const chunks = await loadTarotKnowledgeChunks();
    const hangedManReversed = chunks.find(
      (chunk) =>
        chunk.card === "the-hanged-man"
        && chunk.orientation === "reversed",
    );

    expect(hangedManReversed).toMatchObject({
      source_id: expect.stringContaining("78W"),
      title: expect.stringContaining("倒吊人"),
      source: expect.stringContaining("knowledge/wiki/major-arcana/the-hanged-man.md"),
      tags: expect.arrayContaining(["reversed"]),
    });
  });

  it("handles empty knowledge roots and malformed markdown gracefully", async () => {
    const emptyRoot = await mkdtemp(path.join(tmpdir(), "aethertarot-empty-wiki-"));
    await expect(
      loadTarotKnowledgeChunks({ wikiRoot: emptyRoot }),
    ).resolves.toEqual([]);

    const malformedRoot = await mkdtemp(
      path.join(tmpdir(), "aethertarot-malformed-wiki-"),
    );
    await mkdir(path.join(malformedRoot, "major-arcana"), { recursive: true });
    await writeFile(
      path.join(malformedRoot, "major-arcana", "broken.md"),
      "---\nnot valid frontmatter\n# Broken\n\n## 逆位\n仍然应被当作普通 markdown 安全读取。",
      "utf8",
    );

    await expect(
      loadTarotKnowledgeChunks({ wikiRoot: malformedRoot }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_id: "unregistered",
          orientation: "reversed",
        }),
      ]),
    );
  });

  it("executes draw_cards_server_side through the executor", async () => {
    const execution = await executeReadingTool<DrawCardsOutput>({
      toolName: "draw_cards_server_side",
      input: {
        spreadType: "three_card",
        allowReversed: true,
        seed: "contract-test-seed",
      },
      registry: readingToolRegistry,
    });

    expect(execution.result.ok).toBe(true);
    expect(execution.result.output?.source).toBe("server_side_tool");
    expect(execution.result.output?.cards).toHaveLength(3);
    expect(
      execution.result.output?.cards.every((card) =>
        card.orientation === "upright" || card.orientation === "reversed",
      ),
    ).toBe(true);
  });

  it("captures thrown tool errors as failed results and audit entries", async () => {
    const throwingTool: ReadingToolDefinition<{ value: string }, { value: string }> = {
      name: "throwing_test_tool",
      description: "Test-only throwing tool.",
      permission: "public",
      riskLevel: "low",
      inputSchema: z.object({ value: z.string().min(1) }),
      outputSchema: z.object({ value: z.string().min(1) }),
      timeoutMs: 100,
      traceable: true,
      async run() {
        throw new Error("planned tool failure");
      },
    };
    const registry = createReadingToolRegistry([throwingTool]);

    const execution = await executeReadingTool({
      toolName: "throwing_test_tool",
      input: { value: "hello" },
      registry,
    });

    expect(execution.result.ok).toBe(false);
    expect(execution.result.error?.code).toBe("TOOL_EXECUTION_FAILED");
    expect(execution.auditEntry.ok).toBe(false);
    expect(execution.auditEntry.error).toMatchObject({
      code: "TOOL_EXECUTION_FAILED",
      message: "planned tool failure",
    });
  });

  it("captures invalid tool outputs as failed results and audit entries", async () => {
    const invalidOutputTool: ReadingToolDefinition<
      { value: string },
      { value: string }
    > = {
      name: "invalid_output_test_tool",
      description: "Test-only invalid output tool.",
      permission: "public",
      riskLevel: "low",
      inputSchema: z.object({ value: z.string().min(1) }),
      outputSchema: z.object({ value: z.string().min(1) }),
      timeoutMs: 100,
      traceable: true,
      async run() {
        return { value: "" };
      },
    };
    const registry = createReadingToolRegistry([invalidOutputTool]);

    const execution = await executeReadingTool({
      toolName: "invalid_output_test_tool",
      input: { value: "hello" },
      registry,
    });

    expect(execution.result.ok).toBe(false);
    expect(execution.result.error?.code).toBe("TOOL_INVALID_OUTPUT");
    expect(execution.auditEntry.ok).toBe(false);
    expect(execution.auditEntry.error?.code).toBe("TOOL_INVALID_OUTPUT");
  });

  it("times out slow tools and records the timeout in audit", async () => {
    const slowTool: ReadingToolDefinition<{ value: string }, { value: string }> = {
      name: "slow_test_tool",
      description: "Test-only slow tool.",
      permission: "public",
      riskLevel: "low",
      inputSchema: z.object({ value: z.string().min(1) }),
      outputSchema: z.object({ value: z.string().min(1) }),
      timeoutMs: 5,
      traceable: true,
      async run(input) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return input;
      },
    };
    const registry = createReadingToolRegistry([slowTool]);

    const execution = await executeReadingTool({
      toolName: "slow_test_tool",
      input: { value: "hello" },
      registry,
    });

    expect(execution.result.ok).toBe(false);
    expect(execution.result.error?.code).toBe("TOOL_TIMEOUT");
    expect(execution.auditEntry.ok).toBe(false);
    expect(execution.auditEntry.error?.code).toBe("TOOL_TIMEOUT");
    expect(execution.auditEntry.latency_ms).toBeGreaterThanOrEqual(5);
  });
});
