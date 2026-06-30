import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeEncyclopediaQuota,
  consumeReadingQuota,
  shouldBypassRequestQuota,
} from "@/server/beta/quota";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuthenticatedTester, PublicFeatureActor } from "@/server/beta/access";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

function buildTester(role: AuthenticatedTester["role"]): AuthenticatedTester {
  return {
    userId: "00000000-0000-0000-0000-000000000001",
    email: `${role}@example.com`,
    role,
  };
}

const ANONYMOUS: PublicFeatureActor = {
  userId: null,
  email: null,
  role: "anonymous",
};

const createAdminClientMock = vi.mocked(createAdminClient);

beforeEach(() => {
  createAdminClientMock.mockReset();
});

describe("reading quota", () => {
  it("lets admins bypass reading quota for local and beta testing", () => {
    expect(shouldBypassRequestQuota(buildTester("admin"))).toBe(true);
  });

  it("keeps regular testers under reading quota", () => {
    expect(shouldBypassRequestQuota(buildTester("tester"))).toBe(false);
  });

  it("lets admins bypass encyclopedia quota as well", async () => {
    await expect(
      consumeEncyclopediaQuota({
        actor: buildTester("admin"),
        ipHash: "ip-hash",
      }),
    ).resolves.toBeUndefined();
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("checks anonymous reading quota by IP hash", async () => {
    const rpc = vi.fn(async () => ({ data: { allowed: true }, error: null }));
    createAdminClientMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof createAdminClient>);

    await expect(
      consumeReadingQuota({
        actor: ANONYMOUS,
        ipHash: "ip-hash",
        config: {
          userDailyLimit: 10,
          anonymousDailyLimit: 1,
          ipMinuteLimit: 6,
        },
      }),
    ).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith("consume_anonymous_reading_quota", {
      p_ip_hash: "ip-hash",
      p_anonymous_daily_limit: 1,
      p_ip_minute_limit: 6,
    });
  });
});
