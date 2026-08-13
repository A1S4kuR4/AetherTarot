import { describe, expect, it, vi } from "vitest";
import { handleReadingPost } from "@/app/api/reading/route";
import { handleEncyclopediaQueryPost } from "@/app/api/encyclopedia/query/route";
import { runReadingGraphWithDiagnostics } from "@/server/reading/graph";
import { createInMemorySessionMemoryStore } from "@/server/reading/memory";
import { createInMemoryReadingRuntimeStores } from "@/server/reading/runtime-persistence";
import { ReadingServiceError } from "@/server/reading/errors";
import {
  buildSinglePayload,
  TestReadingProvider,
} from "@/server/reading/__tests__/fixtures";
import type { SafetyReviewer } from "@/server/safety/llm-reviewer";
import { collectLlmUsage } from "@/server/observability/llm-usage";

const policyVersion = "safety-reviewer-v1";
const modelVersion = "reviewer-test";

function inputExecution(level: "standard" | "bounded" | "sober_check" | "hard_stop" = "standard") {
  return {
    mode: "enforce" as const,
    applied: true,
    cacheHit: false,
    verdict: {
      level,
      categories: level === "hard_stop" ? ["self_harm" as const] : [],
      referral_kind: level === "hard_stop" ? "crisis" as const : "none" as const,
      policy_version: policyVersion,
      model_version: modelVersion,
    },
  };
}

function outputExecution(action: "pass" | "restrict" | "replace" = "pass") {
  return {
    mode: "enforce" as const,
    applied: true,
    cacheHit: false,
    verdict: {
      action,
      violations: action === "replace"
        ? ["self_harm_or_violence_encouragement" as const]
        : [],
      flagged_paths: action === "replace" ? ["synthesis"] : [],
      policy_version: policyVersion,
      model_version: modelVersion,
    },
  };
}

function buildReviewer(overrides: Partial<SafetyReviewer> = {}): SafetyReviewer {
  return {
    reviewInput: vi.fn(async () => inputExecution()),
    reviewOutput: vi.fn(async () => outputExecution()),
    reviewEncyclopediaOutput: vi.fn(async () => outputExecution()),
    ...overrides,
  };
}

function request(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.20" },
    body: JSON.stringify(body),
  });
}

function routeDependencies(reviewer: SafetyReviewer, overrides: Record<string, unknown> = {}) {
  return {
    getIpHash: () => "ip-hash",
    getProviderName: () => "llm",
    requireAccess: vi.fn(async () => ({
      userId: "00000000-0000-0000-0000-000000000001",
      email: "reviewer@example.com",
      role: "tester" as const,
    })),
    consumeQuota: vi.fn(async () => undefined),
    refundQuota: vi.fn(async () => undefined),
    generateReading: vi.fn(async () => {
      throw new Error("generation should not run");
    }),
    collectUsage: collectLlmUsage,
    recordEvent: vi.fn(async () => undefined),
    safetyReviewer: reviewer,
    ...createInMemoryReadingRuntimeStores(),
    ...overrides,
  };
}

describe("LLM Safety Reviewer integration boundaries", () => {
  it("keeps deterministic hard-stop ahead of reviewer, quota, tools, and provider", async () => {
    const reviewer = buildReviewer();
    const deps = routeDependencies(reviewer);
    const response = await handleReadingPost(
      request("http://localhost/api/reading", buildSinglePayload("我想轻生")),
      deps,
    );

    expect(response.status).toBe(403);
    expect(reviewer.reviewInput).not.toHaveBeenCalled();
    expect(deps.consumeQuota).not.toHaveBeenCalled();
    expect(deps.generateReading).not.toHaveBeenCalled();
  });

  it("stops a reviewer-upgraded standard input before quota and generation", async () => {
    const reviewer = buildReviewer({
      reviewInput: vi.fn(async () => inputExecution("hard_stop")),
    });
    const deps = routeDependencies(reviewer, {
      generateReading: vi.fn((payload, options) =>
        runReadingGraphWithDiagnostics(payload, options)
      ),
    });
    const response = await handleReadingPost(
      request("http://localhost/api/reading", buildSinglePayload("请看看我的近况")),
      deps,
    );

    expect(response.status).toBe(403);
    expect(deps.consumeQuota).not.toHaveBeenCalled();
    expect(deps.generateReading).not.toHaveBeenCalled();
    expect(reviewer.reviewOutput).not.toHaveBeenCalled();
  });

  it.each(["timeout", "schema_error", "circuit_open"])(
    "returns 503 without quota or generation for input reviewer %s",
    async (subtype) => {
      const reviewer = buildReviewer({
        reviewInput: vi.fn(async () => {
          throw new ReadingServiceError(
            "provider_unavailable",
            "安全审校服务暂时不可用，请稍后重试。",
            503,
            undefined,
            undefined,
            { subtype },
          );
        }),
      });
      const deps = routeDependencies(reviewer);
      const response = await handleReadingPost(
        request("http://localhost/api/reading", buildSinglePayload("普通问题")),
        deps,
      );
      const payload = await response.json() as { error: { code: string } };

      expect(response.status).toBe(503);
      expect(payload.error.code).toBe("provider_unavailable");
      expect(deps.consumeQuota).not.toHaveBeenCalled();
      expect(deps.generateReading).not.toHaveBeenCalled();
    },
  );

  it("replaces reviewer-flagged output before grounding, capsule, memory, state, or trace", async () => {
    const unsafeText = "reviewer-only dangerous original";
    const memoryStore = createInMemorySessionMemoryStore();
    const reviewer = buildReviewer({
      reviewOutput: vi.fn(async () => outputExecution("replace")),
    });
    const result = await runReadingGraphWithDiagnostics(
      {
        ...buildSinglePayload("普通问题"),
        agent_profile: "lite",
        thread_id: "reviewer-output-replace",
      },
      {
        safetyReviewer: reviewer,
        provider: new TestReadingProvider({
          initial: (draft) => ({ ...draft, synthesis: unsafeText }),
        }),
        sessionMemoryStore: memoryStore,
      },
    );
    const surfaces = JSON.stringify({
      response: result.reading,
      grounding: result.reading.grounding,
      capsule: result.reading.session_capsule,
      memory: await memoryStore.get("reviewer-output-replace"),
      agentState: result.agentState,
      trace: result.trace,
    });

    expect(result.reading.safety_note).toMatch(/替换/);
    expect(surfaces).not.toContain(unsafeText);
  });

  it("discards output and skips memory when output reviewer fails", async () => {
    const memoryStore = createInMemorySessionMemoryStore();
    const reviewer = buildReviewer({
      reviewOutput: vi.fn(async () => {
        throw new ReadingServiceError("provider_unavailable", "review failed", 503);
      }),
    });

    await expect(runReadingGraphWithDiagnostics(
      {
        ...buildSinglePayload("普通问题"),
        agent_profile: "lite",
        thread_id: "reviewer-output-failure",
      },
      {
        safetyReviewer: reviewer,
        provider: new TestReadingProvider(),
        sessionMemoryStore: memoryStore,
      },
    )).rejects.toMatchObject({ code: "provider_unavailable", status: 503 });
    expect(await memoryStore.get("reviewer-output-failure")).toBeNull();
  });

  it("replays a completed request_id without paying reviewer cost twice", async () => {
    const reviewer = buildReviewer();
    const stores = createInMemoryReadingRuntimeStores();
    const deps = routeDependencies(reviewer, {
      ...stores,
      generateReading: vi.fn((payload, options) =>
        runReadingGraphWithDiagnostics(payload, {
          ...options,
          provider: new TestReadingProvider(),
        })
      ),
    });
    const payload = {
      ...buildSinglePayload("普通问题"),
      agent_profile: "lite" as const,
      request_id: "11111111-1111-4111-8111-111111111111",
    };

    const first = await handleReadingPost(request("http://localhost/api/reading", payload), deps);
    const second = await handleReadingPost(request("http://localhost/api/reading", payload), deps);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(reviewer.reviewInput).toHaveBeenCalledTimes(1);
    expect(reviewer.reviewOutput).toHaveBeenCalledTimes(1);
  });

  it("uses the same fail-closed input boundary in Encyclopedia route", async () => {
    const reviewer = buildReviewer({
      reviewInput: vi.fn(async () => inputExecution("hard_stop")),
    });
    const consumeQuota = vi.fn(async () => undefined);
    const generateAnswer = vi.fn();
    const response = await handleEncyclopediaQueryPost(
      request("http://localhost/api/encyclopedia/query", { query: "普通百科问题" }),
      {
        isQueryEnabled: () => true,
        getIpHash: () => "ip-hash",
        requireAccess: vi.fn(async () => ({
          userId: "00000000-0000-0000-0000-000000000001",
          email: "reviewer@example.com",
          role: "tester" as const,
        })),
        consumeQuota,
        generateAnswer,
        collectUsage: vi.fn(),
        recordEvent: vi.fn(async () => undefined),
        safetyReviewer: reviewer,
      },
    );

    expect(response.status).toBe(403);
    expect(consumeQuota).not.toHaveBeenCalled();
    expect(generateAnswer).not.toHaveBeenCalled();
  });
});
