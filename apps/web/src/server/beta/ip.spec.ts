import { afterEach, describe, expect, it, vi } from "vitest";
import { hashClientIp, resolveIpHashSalt } from "@/server/beta/ip";

describe("beta IP hashing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses a development fallback salt outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AETHERTAROT_IP_HASH_SALT", "");

    expect(resolveIpHashSalt()).toBe("aethertarot-dev-ip-salt");
    expect(hashClientIp("127.0.0.1")).toHaveLength(64);
  });

  it("requires an explicit salt in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AETHERTAROT_IP_HASH_SALT", "");

    expect(() => resolveIpHashSalt()).toThrow(/AETHERTAROT_IP_HASH_SALT/);
  });

  it("uses the configured salt when present", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AETHERTAROT_IP_HASH_SALT", " production-secret ");

    expect(resolveIpHashSalt()).toBe("production-secret");
    expect(hashClientIp("127.0.0.1")).toBe(
      hashClientIp("127.0.0.1", "production-secret"),
    );
  });
});
