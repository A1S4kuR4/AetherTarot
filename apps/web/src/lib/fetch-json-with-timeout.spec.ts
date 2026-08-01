import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJsonWithTimeout } from "./fetch-json-with-timeout";

describe("fetchJsonWithTimeout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns a successful JSON payload with the response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ));

    const result = await fetchJsonWithTimeout<{ ok: boolean }>("/api/reading", {
      method: "POST",
      timeoutMs: 1000,
    });

    expect(result.response.ok).toBe(true);
    expect(result.payload).toEqual({ ok: true });
  });

  it("returns an HTTP error payload without hiding the status", async () => {
    const payload = {
      error: {
        code: "provider_unavailable",
        message: "模型暂时不可用。",
      },
    };

    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify(payload), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    ));

    const result = await fetchJsonWithTimeout<typeof payload>("/api/reading", {
      method: "POST",
      timeoutMs: 1000,
    });

    expect(result.response.ok).toBe(false);
    expect(result.response.status).toBe(503);
    expect(result.payload).toEqual(payload);
  });

  it("aborts and surfaces the configured timeout message", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | null = null;

    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        capturedSignal = init?.signal ?? null;
        capturedSignal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
    ));

    const request = fetchJsonWithTimeout("/api/reading", {
      timeoutMs: 25,
      timeoutMessage: "解读生成等待超时。",
    });
    const rejection = expect(request).rejects.toThrow("解读生成等待超时。");

    await vi.advanceTimersByTimeAsync(25);

    await rejection;
    expect(capturedSignal).not.toBeNull();
    expect((capturedSignal as unknown as AbortSignal).aborted).toBe(true);
  });
});
