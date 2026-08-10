import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeEncyclopediaQuota,
  consumeReadingQuota,
  refundReadingQuota,
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

  it("charges an anonymous initial phase against the complete-reading daily quota", async () => {
    const rpc = vi.fn(async () => ({ data: { allowed: true }, error: null }));
    createAdminClientMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof createAdminClient>);

    await expect(
      consumeReadingQuota({
        actor: ANONYMOUS,
        ipHash: "ip-hash",
        phase: "initial",
        config: {
          userDailyLimit: 10,
          anonymousDailyLimit: 3,
          ipMinuteLimit: 6,
        },
      }),
    ).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith("consume_anonymous_reading_phase_quota", {
      p_ip_hash: "ip-hash",
      p_anonymous_daily_limit: 3,
      p_ip_minute_limit: 6,
      p_charge_daily_quota: true,
    });
  });

  it("keeps a valid final phase under the minute guard without charging daily quota again", async () => {
    const rpc = vi.fn(async () => ({ data: { allowed: true }, error: null }));
    createAdminClientMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof createAdminClient>);
    const tester = buildTester("tester");

    await expect(
      consumeReadingQuota({
        actor: tester,
        ipHash: "ip-hash",
        phase: "final",
        config: {
          userDailyLimit: 10,
          anonymousDailyLimit: 3,
          ipMinuteLimit: 6,
        },
      }),
    ).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith("consume_reading_phase_quota", {
      p_user_id: tester.userId,
      p_ip_hash: "ip-hash",
      p_user_daily_limit: 10,
      p_ip_minute_limit: 6,
      p_charge_daily_quota: false,
    });
  });

  it("refunds an authenticated reading daily quota reservation", async () => {
    const rpc = vi.fn(async () => ({ data: { refunded: true }, error: null }));
    createAdminClientMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof createAdminClient>);
    const tester = buildTester("tester");

    await expect(refundReadingQuota({
      actor: tester,
      ipHash: "ip-hash",
    })).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith("refund_reading_daily_quota", {
      p_user_id: tester.userId,
      p_ip_hash: "ip-hash",
    });
  });

  it("refunds an anonymous reading quota by its IP subject", async () => {
    const rpc = vi.fn(async () => ({ data: { refunded: true }, error: null }));
    createAdminClientMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof createAdminClient>);

    await expect(refundReadingQuota({
      actor: ANONYMOUS,
      ipHash: "ip-hash",
    })).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith("refund_reading_daily_quota", {
      p_user_id: null,
      p_ip_hash: "ip-hash",
    });
  });

  it("does not refund quota for an admin who bypasses consumption", async () => {
    const rpc = vi.fn();
    createAdminClientMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof createAdminClient>);

    await expect(refundReadingQuota({
      actor: buildTester("admin"),
      ipHash: "ip-hash",
    })).resolves.toBeUndefined();

    expect(rpc).not.toHaveBeenCalled();
  });
});
