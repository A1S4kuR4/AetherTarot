import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertRequiredRole,
  getE2eAccessBypassTester,
  isE2eAccessBypassEnabled,
  normalizeAuthSession,
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

  it("normalizes auth sessions by subject and email", () => {
    expect(
      normalizeAuthSession({
        user: {
          id: " user-subject ",
          email: " Tester@Example.COM ",
        },
      }),
    ).toEqual({
      subject: "user-subject",
      email: "tester@example.com",
    });
  });

  it("rejects auth sessions without a subject or email", () => {
    expect(
      normalizeAuthSession({
        user: {
          id: "user-subject",
        },
      }),
    ).toBeNull();
    expect(
      normalizeAuthSession({
        user: {
          email: "tester@example.com",
        },
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

  it("gives local-only development the admin bypass without Supabase", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AETHERTAROT_LOCAL_ONLY", "1");

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

  it("does not allow the local-only admin bypass in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AETHERTAROT_LOCAL_ONLY", "1");

    expect(isE2eAccessBypassEnabled()).toBe(false);
    expect(getE2eAccessBypassTester()).toBeNull();
  });
});
