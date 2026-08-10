import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  growthEventPayloadSchema,
  handleGrowthEventPost,
  persistGrowthEvent,
} from "@/app/api/growth-events/route";
import type { PublicFeatureActor } from "@/server/beta/access";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

const ANONYMOUS: PublicFeatureActor = {
  userId: null,
  email: null,
  role: "anonymous",
};

const BASE_EVENT = {
  event_id: "00000000-0000-4000-8000-000000000001",
  event_type: "page_view" as const,
  session_id: "00000000-0000-4000-8000-000000000002",
  attribution_id: "00000000-0000-4000-8000-000000000003",
  flow_id: null,
  reading_id: null,
  utm_source: "douyin",
  utm_medium: "video",
  utm_campaign: "launch-01",
  utm_content: null,
  utm_term: null,
  landing_path: "/",
  referrer_host: "www.douyin.com",
};

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/growth-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("growth event route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a sanitized Douyin page view", () => {
    expect(growthEventPayloadSchema.parse(BASE_EVENT)).toMatchObject({
      event_type: "page_view",
      utm_source: "douyin",
      landing_path: "/",
    });
  });

  it("requires flow and reading identity for completion events", () => {
    expect(() => growthEventPayloadSchema.parse({
      ...BASE_EVENT,
      event_type: "reading_completed",
    })).toThrow();
    expect(() => growthEventPayloadSchema.parse({
      ...BASE_EVENT,
      event_type: "reading_completed",
      flow_id: "00000000-0000-4000-8000-000000000004",
    })).toThrow();
  });

  it("persists anonymous events with a hashed network subject", async () => {
    const persist = vi.fn(async () => "inserted" as const);
    const response = await handleGrowthEventPost(buildRequest(BASE_EVENT), {
      resolveActor: vi.fn(async () => ANONYMOUS),
      getIpHash: () => "ip-hash",
      persist,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, duplicate: false });
    expect(persist).toHaveBeenCalledWith({
      actor: ANONYMOUS,
      ipHash: "ip-hash",
      payload: BASE_EVENT,
    });
  });

  it("treats a repeated client event id as an idempotent success", async () => {
    const response = await handleGrowthEventPost(buildRequest(BASE_EVENT), {
      resolveActor: vi.fn(async () => ANONYMOUS),
      getIpHash: () => "ip-hash",
      persist: vi.fn(async () => "duplicate" as const),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, duplicate: true });
  });

  it("checks the per-IP telemetry quota before inserting", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    mocks.createAdminClient.mockReturnValue({
      rpc,
      from: vi.fn(() => ({ insert })),
    });

    await expect(persistGrowthEvent({
      actor: ANONYMOUS,
      ipHash: "ip-hash",
      payload: growthEventPayloadSchema.parse(BASE_EVENT),
    })).resolves.toBe("inserted");

    expect(rpc).toHaveBeenCalledWith("consume_growth_event_quota", {
      p_ip_hash: "ip-hash",
      p_ip_minute_limit: 120,
    });
    expect(insert).toHaveBeenCalledOnce();
  });

  it("rejects telemetry above the per-IP minute limit without inserting", async () => {
    const insert = vi.fn();
    mocks.createAdminClient.mockReturnValue({
      rpc: vi.fn(async () => ({ data: false, error: null })),
      from: vi.fn(() => ({ insert })),
    });

    await expect(persistGrowthEvent({
      actor: ANONYMOUS,
      ipHash: "ip-hash",
      payload: growthEventPayloadSchema.parse(BASE_EVENT),
    })).rejects.toMatchObject({ code: "rate_limited", status: 429 });
    expect(insert).not.toHaveBeenCalled();
  });
});
