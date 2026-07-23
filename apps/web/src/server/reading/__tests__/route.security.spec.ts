import { describe, expect, it, vi } from "vitest";
import { handleReadingPost } from "@/app/api/reading/route";
import { ReadingServiceError } from "@/server/reading/errors";
import { runReadingGraph } from "@/server/reading/graph";
import { buildSinglePayload } from "@/server/reading/__tests__/fixtures";
import type { AuthenticatedTester, PublicFeatureActor } from "@/server/beta/access";
import { createInMemoryReadingRuntimeStores } from "@/server/reading/runtime-persistence";

const TESTER: AuthenticatedTester = {
  userId: "00000000-0000-0000-0000-000000000001",
  email: "tester@example.com",
  role: "tester",
};
const ANONYMOUS: PublicFeatureActor = {
  userId: null,
  email: null,
  role: "anonymous",
};
type RouteDependencies = NonNullable<Parameters<typeof handleReadingPost>[1]>;

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/reading", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify(body),
  });
}

function buildDependencies(overrides: RouteDependencies = {}) {
  const runtimeStores = createInMemoryReadingRuntimeStores();
  return {
    getIpHash: () => "ip-hash",
    getProviderName: () => "llm",
    requireAccess: vi.fn(async () => TESTER),
    consumeQuota: vi.fn(async () => undefined),
    refundQuota: vi.fn(async () => undefined),
    generateReading: vi.fn((payload, options) =>
      runReadingGraph(payload, options)
    ),
    collectUsage: vi.fn(async (callback) => ({
      result: await callback(),
      calls: [],
    })),
    recordEvent: vi.fn(async () => undefined),
    ...runtimeStores,
    ...overrides,
  };
}

async function readJson(response: Response) {
  return (await response.json()) as {
    error?: { code?: string; message?: string };
  };
}

describe("reading route beta access and quota", () => {
  it("rejects invalid authenticated sessions before calling the provider", async () => {
    const deps = buildDependencies({
      requireAccess: vi.fn(async () => {
        throw new ReadingServiceError(
          "forbidden",
          "当前登录状态不完整，请重新登录。",
          403,
        );
      }),
    });

    const response = await handleReadingPost(buildRequest(buildSinglePayload()), deps);
    const payload = await readJson(response);

    expect(response.status).toBe(403);
    expect(payload.error?.code).toBe("forbidden");
    expect(deps.generateReading).not.toHaveBeenCalled();
    expect(deps.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failure",
        errorCode: "forbidden",
      }),
    );
  });

  it("allows anonymous guests with null event identity", async () => {
    const deps = buildDependencies({
      requireAccess: vi.fn(async () => ANONYMOUS),
    });
    const response = await handleReadingPost(buildRequest(buildSinglePayload()), deps);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      locale: "zh-CN",
      reading_phase: "initial",
    });
    expect(deps.consumeQuota).toHaveBeenCalledWith({
      actor: ANONYMOUS,
      ipHash: "ip-hash",
    });
    expect(deps.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        email: null,
        status: "success",
      }),
    );
  });

  it("rejects quota-limited requests before calling the provider", async () => {
    const deps = buildDependencies({
      consumeQuota: vi.fn(async () => {
        throw new ReadingServiceError(
          "rate_limited",
          "你今日的 reading 次数已达上限，请明天再试。",
          429,
          undefined,
          undefined,
          { reason: "user_daily" },
        );
      }),
    });

    const response = await handleReadingPost(buildRequest(buildSinglePayload()), deps);
    const payload = await readJson(response);

    expect(response.status).toBe(429);
    expect(payload.error?.code).toBe("rate_limited");
    expect(deps.generateReading).not.toHaveBeenCalled();
    expect(deps.refundQuota).not.toHaveBeenCalled();
  });

  it("rejects anonymous daily quota before calling the provider", async () => {
    const deps = buildDependencies({
      requireAccess: vi.fn(async () => ANONYMOUS),
      consumeQuota: vi.fn(async () => {
        throw new ReadingServiceError(
          "rate_limited",
          "今日访客 reading 体验次数已用完。登录内测账号可使用更多次数。",
          429,
          undefined,
          undefined,
          { reason: "user_daily" },
        );
      }),
    });

    const response = await handleReadingPost(buildRequest(buildSinglePayload()), deps);
    const payload = await readJson(response);

    expect(response.status).toBe(429);
    expect(payload.error?.message).toContain("访客");
    expect(deps.consumeQuota).toHaveBeenCalledWith({
      actor: ANONYMOUS,
      ipHash: "ip-hash",
    });
    expect(deps.generateReading).not.toHaveBeenCalled();
  });

  it("rejects oversized reading input before access and provider work", async () => {
    const deps = buildDependencies();
    const response = await handleReadingPost(
      buildRequest(buildSinglePayload("问".repeat(70_000))),
      deps,
    );
    const payload = await readJson(response);

    expect(response.status).toBe(413);
    expect(payload.error?.code).toBe("invalid_request");
    expect(deps.requireAccess).not.toHaveBeenCalled();
    expect(deps.generateReading).not.toHaveBeenCalled();
  });

  it("rejects questions over the configured character boundary", async () => {
    const deps = buildDependencies();
    const response = await handleReadingPost(
      buildRequest(buildSinglePayload("问".repeat(1001))),
      deps,
    );
    const payload = await readJson(response);

    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe("invalid_request");
    expect(deps.requireAccess).not.toHaveBeenCalled();
    expect(deps.generateReading).not.toHaveBeenCalled();
  });

  it("rejects oversized continuity identifiers and capsule text", async () => {
    const deps = buildDependencies();
    const response = await handleReadingPost(
      buildRequest({
        ...buildSinglePayload(),
        thread_id: "t".repeat(129),
        prior_session_capsule: "c".repeat(281),
      }),
      deps,
    );
    const payload = await readJson(response);

    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe("invalid_request");
    expect(deps.requireAccess).not.toHaveBeenCalled();
  });

  it("returns token-limit errors without changing the error envelope", async () => {
    const deps = buildDependencies({
      generateReading: vi.fn(async () => {
        throw new ReadingServiceError(
          "token_limit_exceeded",
          "今日体验额度已用完，请于明日再试。",
          429,
        );
      }),
    });
    const response = await handleReadingPost(buildRequest(buildSinglePayload()), deps);
    const payload = await readJson(response);

    expect(response.status).toBe(429);
    expect(payload.error?.code).toBe("token_limit_exceeded");
    expect(deps.refundQuota).toHaveBeenCalledTimes(1);
  });

  it("keeps successful StructuredReading payloads unchanged", async () => {
    const deps = buildDependencies();
    const response = await handleReadingPost(
      buildRequest({
        ...buildSinglePayload(),
        agent_profile: "lite",
      }),
      deps,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      locale: "zh-CN",
      reading_phase: "initial",
      agent_profile: "lite",
      requires_followup: false,
    });
    expect(deps.consumeQuota).toHaveBeenCalledWith({
      actor: TESTER,
      ipHash: "ip-hash",
    });
    expect(deps.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        completedInitial: true,
      }),
    );
  });

  it("accepts known legacy agent_profile aliases and maps them to canonical IDs", async () => {
    const deps = buildDependencies();
    const aliases = [
      { raw: "quick", canonical: "lite" },
      { raw: "daily", canonical: "standard" },
      { raw: "professional", canonical: "sober" },
      { raw: "clear", canonical: "sober" },
      { raw: "rational", canonical: "sober" },
    ] as const;

    for (const { raw, canonical } of aliases) {
      const response = await handleReadingPost(
        buildRequest({
          ...buildSinglePayload(),
          agent_profile: raw,
        }),
        deps,
      );
      const payload = await response.json();

      expect(response.status, `alias ${raw}`).toBe(200);
      expect(payload.agent_profile, `alias ${raw}`).toBe(canonical);
    }
  });

  it("rejects completely unknown agent_profile values instead of silently defaulting", async () => {
    const deps = buildDependencies();
    const response = await handleReadingPost(
      buildRequest({
        ...buildSinglePayload(),
        agent_profile: "expert-v2",
      }),
      deps,
    );
    const payload = await readJson(response);

    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe("invalid_request");
    expect(deps.requireAccess).not.toHaveBeenCalled();
    expect(deps.generateReading).not.toHaveBeenCalled();
  });

  it("shares one provider generation for concurrent duplicate requests", async () => {
    const payload = {
      ...buildSinglePayload("我现在最需要看清什么？"),
      request_id: "00000000-0000-4000-8000-000000000001",
      agent_profile: "lite",
    };
    let releaseGeneration: () => void = () => undefined;
    const generationGate = new Promise<void>((resolve) => {
      releaseGeneration = resolve;
    });
    const deps = buildDependencies({
      generateReading: vi.fn(async (readingPayload) => {
        await generationGate;
        return runReadingGraph(readingPayload);
      }),
    });

    const firstResponse = handleReadingPost(buildRequest(payload), deps);
    await vi.waitFor(() => {
      expect(deps.generateReading).toHaveBeenCalledTimes(1);
    });

    const secondResponse = handleReadingPost(buildRequest(payload), deps);
    await new Promise((resolve) => setTimeout(resolve, 20));

    try {
      expect(deps.generateReading).toHaveBeenCalledTimes(1);
    } finally {
      releaseGeneration();
    }

    const responses = await Promise.all([firstResponse, secondResponse]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const readings = await Promise.all(responses.map((response) => response.json()));

    expect(readings[0]).toMatchObject({ question: payload.question });
    expect(readings[1]).toMatchObject({ question: payload.question });
    expect(deps.consumeQuota).toHaveBeenCalledTimes(1);
    expect(deps.recordEvent).toHaveBeenCalledTimes(1);
    expect(deps.refundQuota).not.toHaveBeenCalled();
  });

  it("replays a completed request without consuming quota or recording another event", async () => {
    const requestPayload = {
      ...buildSinglePayload("我现在最需要看清什么？"),
      request_id: "00000000-0000-4000-8000-000000000002",
      agent_profile: "lite",
    };
    const deps = buildDependencies();

    const firstResponse = await handleReadingPost(buildRequest(requestPayload), deps);
    const firstReading = await firstResponse.json();
    const secondResponse = await handleReadingPost(buildRequest(requestPayload), deps);
    const secondReading = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(secondReading).toEqual(firstReading);
    expect(deps.consumeQuota).toHaveBeenCalledTimes(1);
    expect(deps.generateReading).toHaveBeenCalledTimes(1);
    expect(deps.recordEvent).toHaveBeenCalledTimes(1);
  });

  it("rejects reuse of one request_id for a different payload", async () => {
    const requestId = "00000000-0000-4000-8000-000000000003";
    const deps = buildDependencies();
    const firstResponse = await handleReadingPost(buildRequest({
      ...buildSinglePayload("第一个问题"),
      request_id: requestId,
      agent_profile: "lite",
    }), deps);
    const secondResponse = await handleReadingPost(buildRequest({
      ...buildSinglePayload("另一个问题"),
      request_id: requestId,
      agent_profile: "lite",
    }), deps);
    const secondPayload = await readJson(secondResponse);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(409);
    expect(secondPayload.error?.code).toBe("invalid_request");
    expect(deps.consumeQuota).toHaveBeenCalledTimes(1);
    expect(deps.generateReading).toHaveBeenCalledTimes(1);
    expect(deps.recordEvent).toHaveBeenCalledTimes(1);
  });

  it("refunds a failed generation and allows the same request to retry", async () => {
    const requestPayload = {
      ...buildSinglePayload("失败后重试"),
      request_id: "00000000-0000-4000-8000-000000000004",
      agent_profile: "lite",
    };
    let attempts = 0;
    const deps = buildDependencies({
      generateReading: vi.fn(async (payload) => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("temporary provider failure");
        }
        return runReadingGraph(payload);
      }),
    });

    const failedResponse = await handleReadingPost(buildRequest(requestPayload), deps);
    const retryResponse = await handleReadingPost(buildRequest(requestPayload), deps);

    expect(failedResponse.status).toBe(500);
    expect(retryResponse.status).toBe(200);
    expect(deps.consumeQuota).toHaveBeenCalledTimes(2);
    expect(deps.refundQuota).toHaveBeenCalledTimes(1);
    expect(deps.generateReading).toHaveBeenCalledTimes(2);
    expect(deps.recordEvent).toHaveBeenCalledTimes(2);
    expect(deps.recordEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      requestId: requestPayload.request_id,
      status: "failure",
    }));
    expect(deps.recordEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      requestId: requestPayload.request_id,
      status: "success",
    }));
  });

  it("restores Final input from the server snapshot and ignores legacy body text", async () => {
    const deps = buildDependencies();
    const initialRequest = {
      ...buildSinglePayload("我该怎样稳住现在的节奏？"),
      request_id: "00000000-0000-4000-8000-000000000101",
      thread_id: "00000000-0000-4000-8000-000000000201",
      agent_profile: "standard",
    };
    const initialResponse = await handleReadingPost(
      buildRequest(initialRequest),
      deps,
    );
    const initial = await initialResponse.json();
    expect(initialResponse.status).toBe(200);
    expect(initial.requires_followup).toBe(true);

    const finalResponse = await handleReadingPost(buildRequest({
      ...initialRequest,
      request_id: "00000000-0000-4000-8000-000000000102",
      phase: "final",
      initial_reading_id: initial.reading_id,
      initial_reading: {
        reading_id: initial.reading_id,
        synthesis: "客户端注入的正文绝不能进入 Final。",
      },
      followup_answers: initial.follow_up_questions.map((question: string) => ({
        question,
        answer: "我会先观察一周。",
      })),
    }), deps);
    const finalReading = await finalResponse.json();

    expect(finalResponse.status).toBe(200);
    expect(finalReading.reading_phase).toBe("final");
    expect(finalReading.initial_reading_id).toBe(initial.reading_id);
    const finalCall = vi.mocked(deps.generateReading).mock.calls.at(-1);
    expect(finalCall?.[1]?.initialReading?.synthesis).toBe(initial.synthesis);
    expect(JSON.stringify(finalCall)).not.toContain("客户端注入");
  });

  it("rejects a Final request whose follow-up questions differ from the snapshot", async () => {
    const deps = buildDependencies();
    const initialRequest = {
      ...buildSinglePayload("我需要补充看清什么？"),
      request_id: "00000000-0000-4000-8000-000000000103",
      thread_id: "00000000-0000-4000-8000-000000000203",
      agent_profile: "standard",
    };
    const initialResponse = await handleReadingPost(
      buildRequest(initialRequest),
      deps,
    );
    const initial = await initialResponse.json();

    const finalResponse = await handleReadingPost(buildRequest({
      ...initialRequest,
      request_id: "00000000-0000-4000-8000-000000000104",
      phase: "final",
      initial_reading_id: initial.reading_id,
      followup_answers: initial.follow_up_questions.map(() => ({
        question: "篡改后的追问",
        answer: "答案",
      })),
    }), deps);

    expect(finalResponse.status).toBe(400);
    expect(deps.consumeQuota).toHaveBeenCalledTimes(1);
    expect(deps.generateReading).toHaveBeenCalledTimes(1);
  });
});
