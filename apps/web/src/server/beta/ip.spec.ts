import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getClientIp,
  hashClientIp,
  INTERNAL_CLIENT_IP_HEADER,
  INTERNAL_PROXY_SECRET_HEADER,
  resolveIpHashSalt,
  validateProductionIpSecrets,
} from "@/server/beta/ip";

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
    vi.stubEnv("AETHERTAROT_IP_HASH_SALT", " production-ip-salt-value-1234567890 ");

    expect(resolveIpHashSalt()).toBe("production-ip-salt-value-1234567890");
    expect(hashClientIp("127.0.0.1")).toBe(
      hashClientIp("127.0.0.1", "production-ip-salt-value-1234567890"),
    );
  });

  it("ignores client-forged standard proxy headers", () => {
    const request = new Request("http://local", { headers: {
      "CF-Connecting-IP": "1.1.1.1",
      "X-Forwarded-For": "2.2.2.2",
      "X-Real-IP": "3.3.3.3",
    } });
    expect(getClientIp(request, { NODE_ENV: "test", AETHERTAROT_DEV_CLIENT_IP: "127.0.0.9" } as NodeJS.ProcessEnv)).toBe("127.0.0.9");
  });

  it.each(["", "wrong"])("fails closed in production with missing or wrong proxy secret", (secret) => {
    const request = new Request("http://local", { headers: {
      [INTERNAL_CLIENT_IP_HEADER]: "203.0.113.7",
      [INTERNAL_PROXY_SECRET_HEADER]: secret,
    } });
    expect(() => getClientIp(request, { NODE_ENV: "production", AETHERTAROT_PROXY_SHARED_SECRET: "correct-proxy-secret-value-123456789", AETHERTAROT_IP_HASH_SALT: "correct-ip-hash-salt-value-123456789" } as NodeJS.ProcessEnv)).toThrow(/Trusted reverse-proxy/);
  });

  it("accepts only a valid internal IP header paired with the shared secret", () => {
    const request = new Request("http://local", { headers: {
      [INTERNAL_CLIENT_IP_HEADER]: "203.0.113.7",
      [INTERNAL_PROXY_SECRET_HEADER]: "correct-proxy-secret-value-123456789",
    } });
    expect(getClientIp(request, { NODE_ENV: "production", AETHERTAROT_PROXY_SHARED_SECRET: "correct-proxy-secret-value-123456789", AETHERTAROT_IP_HASH_SALT: "correct-ip-hash-salt-value-123456789" } as NodeJS.ProcessEnv)).toBe("203.0.113.7");
  });

  it.each(["short", "replace-me-with-a-production-secret-value"])("rejects unsafe production proxy secrets: %s", (secret) => {
    expect(() => validateProductionIpSecrets({ NODE_ENV: "production", AETHERTAROT_PROXY_SHARED_SECRET: secret, AETHERTAROT_IP_HASH_SALT: "valid-and-distinct-ip-hash-salt-123456" } as NodeJS.ProcessEnv)).toThrow();
  });

  it("rejects reusing the proxy secret as the IP hash salt", () => {
    const secret = "same-production-secret-value-123456789";
    expect(() => validateProductionIpSecrets({ NODE_ENV: "production", AETHERTAROT_PROXY_SHARED_SECRET: secret, AETHERTAROT_IP_HASH_SALT: secret } as NodeJS.ProcessEnv)).toThrow(/must be different/);
  });

  it("never falls back to the shared literal unknown subject", () => {
    expect(getClientIp(new Request("http://local"), { NODE_ENV: "test" } as NodeJS.ProcessEnv)).toBe("127.0.0.1");
  });
});
