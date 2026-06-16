import { describe, expect, it, vi } from "vitest";
import { handleReadingPost } from "@/app/api/reading/route";
import { ReadingServiceError } from "@/server/reading/errors";
import { runReadingGraph } from "@/server/reading/graph";
import { buildSinglePayload } from "@/server/reading/__tests__/fixtures";
import type { AuthenticatedTester } from "@/server/beta/access";

const TESTER: AuthenticatedTester = {
  userId: "00000000-0000-0000-0000-000000000001",
  email: "tester@example.com",
  role: "tester",
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
  return {
    getIpHash: () => "ip-hash",
    getProviderName: () => "llm",
    requireAccess: vi.fn(async () => TESTER),
    consumeQuota: vi.fn(async () => undefined),
    generateReading: vi.fn((payload) => runReadingGraph(payload)),
    collectUsage: vi.fn(async (callback) => ({
      result: await callback(),
      calls: [],
    })),
    recordEvent: vi.fn(async () => undefined),
    ...overrides,
  };
}

async function readJson(response: Response) {
  return (await response.json()) as {
    error?: { code?: string; message?: string };
  };
}

describe("reading route beta access and quota", () => {
  it("rejects unauthenticated requests before calling the provider", async () => {
    const deps = buildDependencies({
      requireAccess: vi.fn(async () => {
        throw new ReadingServiceError(
          "unauthorized",
          "请先登录后再使用内测 reading 服务。",
          401,
        );
      }),
    });

    const response = await handleReadingPost(buildRequest(buildSinglePayload()), deps);
    const payload = await readJson(response);

    expect(response.status).toBe(401);
    expect(payload.error?.code).toBe("unauthorized");
    expect(deps.generateReading).not.toHaveBeenCalled();
    expect(deps.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failure",
        errorCode: "unauthorized",
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
      tester: TESTER,
      ipHash: "ip-hash",
    });
    expect(deps.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        completedInitial: true,
      }),
    );
  });

  it("shares one provider generation for concurrent duplicate requests", async () => {
    const payload = {
      ...buildSinglePayload("我现在最需要看清什么？"),
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
  });
});
