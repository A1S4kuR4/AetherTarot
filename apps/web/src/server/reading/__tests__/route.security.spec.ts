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
          "当前邮箱今日 reading 次数已达上限，请明天再试。",
          429,
          undefined,
          undefined,
          { reason: "email_daily" },
        );
      }),
    });

    const response = await handleReadingPost(buildRequest(buildSinglePayload()), deps);
    const payload = await readJson(response);

    expect(response.status).toBe(429);
    expect(payload.error?.code).toBe("rate_limited");
    expect(deps.generateReading).not.toHaveBeenCalled();
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
});
