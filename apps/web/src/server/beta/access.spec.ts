import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertRequiredRole,
  getE2eAccessBypassTester,
  isE2eAccessBypassEnabled,
  normalizeTesterRow,
  type AuthenticatedTester,
} from "@/server/beta/access";

describe("beta access helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes active tester rows by email and role", () => {
    expect(
      normalizeTesterRow({
        email: " Tester@Example.COM ",
        role: "tester",
        is_active: true,
      }),
    ).toEqual({
      email: "tester@example.com",
      role: "tester",
    });
  });

  it("rejects inactive or malformed tester rows", () => {
    expect(
      normalizeTesterRow({
        email: "tester@example.com",
        role: "tester",
        is_active: false,
      }),
    ).toBeNull();
    expect(
      normalizeTesterRow({
        email: "tester@example.com",
        role: "owner",
        is_active: true,
      }),
    ).toBeNull();
  });

  it("blocks non-admin testers from admin-only surfaces", () => {
    const tester: AuthenticatedTester = {
      userId: "00000000-0000-0000-0000-000000000001",
      email: "tester@example.com",
      role: "tester",
    };

    expect(() => assertRequiredRole({ tester, requiredRole: "admin" }))
      .toThrow(/管理后台权限/);
  });

  it("allows an explicit non-production e2e beta access bypass", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AETHERTAROT_E2E_BYPASS_BETA_ACCESS", "1");

    expect(getE2eAccessBypassTester()).toEqual({
      userId: "00000000-0000-0000-0000-0000000000e2",
      email: "playwright@example.com",
      role: "admin",
    });
  });

  it("allows a non-production e2e beta access bypass trigger from the request", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(getE2eAccessBypassTester("1")).toEqual({
      userId: "00000000-0000-0000-0000-0000000000e2",
      email: "playwright@example.com",
      role: "admin",
    });
  });

  it("does not allow the e2e beta access bypass in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AETHERTAROT_E2E_BYPASS_BETA_ACCESS", "1");

    expect(isE2eAccessBypassEnabled()).toBe(false);
    expect(getE2eAccessBypassTester()).toBeNull();
  });
});
