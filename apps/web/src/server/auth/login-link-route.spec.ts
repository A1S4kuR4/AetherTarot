import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleLoginLinkPost } from "@/app/api/auth/login-link/route";
import { ReadingServiceError } from "@/server/reading/errors";

type RouteDependencies = NonNullable<Parameters<typeof handleLoginLinkPost>[1]>;

function buildRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://127.0.0.1:3000/api/auth/login-link", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-host": "aethertarot.cn",
      "x-forwarded-proto": "https",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function buildDependencies(overrides: RouteDependencies = {}) {
  return {
    getIpHash: () => "ip-hash",
    consumeQuota: vi.fn(async () => undefined),
    findActiveTesterEmail: vi.fn(async (email: string) => email),
    sendLoginLink: vi.fn(async () => undefined),
    recordEvent: vi.fn(async () => undefined),
    ...overrides,
  };
}

async function readJson(response: Response) {
  return (await response.json()) as {
    ok?: boolean;
    error?: { code?: string; message?: string };
  };
}

describe("login link route", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends Supabase login links only after quota and active tester checks", async () => {
    const deps = buildDependencies();
    const response = await handleLoginLinkPost(
      buildRequest({
        email: " Tester@Example.COM ",
        next: "/admin",
      }),
      deps,
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(deps.consumeQuota).toHaveBeenCalledWith({
      email: "tester@example.com",
      ipHash: "ip-hash",
    });
    expect(deps.findActiveTesterEmail).toHaveBeenCalledWith("tester@example.com");
    expect(deps.sendLoginLink).toHaveBeenCalledWith({
      email: "tester@example.com",
      redirectTo: "https://aethertarot.cn/auth/callback?next=%2Fadmin",
    });
    expect(deps.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "tester@example.com",
        ipHash: "ip-hash",
        status: "success",
        errorCode: null,
      }),
    );
  });

  it("does not send email for inactive or unknown tester emails", async () => {
    const deps = buildDependencies({
      findActiveTesterEmail: vi.fn(async () => null),
    });
    const response = await handleLoginLinkPost(
      buildRequest({ email: "unknown@example.com" }),
      deps,
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(deps.sendLoginLink).not.toHaveBeenCalled();
    expect(deps.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "unknown@example.com",
        status: "failure",
        errorCode: "not_whitelisted",
      }),
    );
  });

  it("rejects rate-limited attempts before checking the tester list", async () => {
    const deps = buildDependencies({
      consumeQuota: vi.fn(async () => {
        throw new ReadingServiceError(
          "rate_limited",
          "这个邮箱的登录链接请求过于频繁，请稍后再试。",
          429,
        );
      }),
    });
    const response = await handleLoginLinkPost(
      buildRequest({ email: "tester@example.com" }),
      deps,
    );
    const payload = await readJson(response);

    expect(response.status).toBe(429);
    expect(payload.error?.code).toBe("rate_limited");
    expect(deps.findActiveTesterEmail).not.toHaveBeenCalled();
    expect(deps.sendLoginLink).not.toHaveBeenCalled();
  });

  it("rejects malformed email payloads before quota work", async () => {
    const deps = buildDependencies();
    const response = await handleLoginLinkPost(
      buildRequest({ email: "not-an-email" }),
      deps,
    );
    const payload = await readJson(response);

    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe("invalid_request");
    expect(deps.consumeQuota).not.toHaveBeenCalled();
    expect(deps.sendLoginLink).not.toHaveBeenCalled();
  });

  it("falls back unsafe next redirects to the application root", async () => {
    const deps = buildDependencies();
    await handleLoginLinkPost(
      buildRequest({
        email: "tester@example.com",
        next: "https://outside.example/admin",
      }),
      deps,
    );

    expect(deps.sendLoginLink).toHaveBeenCalledWith({
      email: "tester@example.com",
      redirectTo: "https://aethertarot.cn/auth/callback?next=%2F",
    });
  });
});
