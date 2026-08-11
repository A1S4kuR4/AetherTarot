import { describe, expect, it, vi } from "vitest";
import { checkAuthRateLimit } from "@/server/auth/rate-limit";

describe("auth rate limit", () => {
  it.each([
    ["RPC error", { data: { allowed: true }, error: { message: "database unavailable" } }],
    ["empty response", { data: null, error: null }],
    ["malformed response", { data: {}, error: null }],
    ["explicit refusal", { data: { allowed: false }, error: null }],
  ])("fails closed on %s", async (_label, result) => {
    const rpc = vi.fn().mockResolvedValue(result);
    await expect(checkAuthRateLimit({ rpc }, "user@example.test", "ip-hash"))
      .resolves.toBe(false);
  });

  it("fails closed when the RPC throws", async () => {
    const rpc = vi.fn().mockRejectedValue(new Error("connection lost"));
    await expect(checkAuthRateLimit({ rpc }, "user@example.test", "ip-hash"))
      .resolves.toBe(false);
  });

  it("allows only an explicit allowed response", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { allowed: true }, error: null });
    await expect(checkAuthRateLimit({ rpc }, "user@example.test", "ip-hash"))
      .resolves.toBe(true);
  });
});
