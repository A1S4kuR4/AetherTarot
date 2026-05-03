import { describe, expect, it } from "vitest";
import {
  consumeEncyclopediaQuota,
  shouldBypassReadingQuota,
} from "@/server/beta/quota";
import type { AuthenticatedTester } from "@/server/beta/access";

function buildTester(role: AuthenticatedTester["role"]): AuthenticatedTester {
  return {
    userId: "00000000-0000-0000-0000-000000000001",
    email: `${role}@example.com`,
    role,
  };
}

describe("reading quota", () => {
  it("lets admins bypass reading quota for local and beta testing", () => {
    expect(shouldBypassReadingQuota(buildTester("admin"))).toBe(true);
  });

  it("keeps regular testers under reading quota", () => {
    expect(shouldBypassReadingQuota(buildTester("tester"))).toBe(false);
  });

  it("lets admins bypass encyclopedia quota as well", async () => {
    await expect(
      consumeEncyclopediaQuota({
        tester: buildTester("admin"),
        ipHash: "ip-hash",
      }),
    ).resolves.toBeUndefined();
  });
});
