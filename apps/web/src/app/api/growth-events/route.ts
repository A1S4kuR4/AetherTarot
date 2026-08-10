import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { GROWTH_EVENT_TYPES } from "@/lib/growth-attribution";
import {
  E2E_ACCESS_BYPASS_HEADER,
  isE2eAccessBypassEnabled,
  resolvePublicFeatureActor,
  type PublicFeatureActor,
} from "@/server/beta/access";
import { getClientIpHash } from "@/server/beta/ip";
import { readBoundedJsonBody } from "@/server/http/json-body";
import { isReadingServiceError, ReadingServiceError } from "@/server/reading/errors";

export const runtime = "nodejs";
const MAX_GROWTH_EVENT_BYTES = 8 * 1024;
const GROWTH_EVENT_IP_LIMIT_PER_MINUTE = 120;
const optionalCampaignValue = z.string().trim().min(1).max(120).nullable().optional();

export const growthEventPayloadSchema = z.object({
  event_id: z.string().uuid(),
  event_type: z.enum(GROWTH_EVENT_TYPES),
  session_id: z.string().uuid(),
  attribution_id: z.string().uuid(),
  flow_id: z.string().uuid().nullable().optional(),
  reading_id: z.string().trim().min(1).max(128).nullable().optional(),
  utm_source: optionalCampaignValue,
  utm_medium: optionalCampaignValue,
  utm_campaign: optionalCampaignValue,
  utm_content: optionalCampaignValue,
  utm_term: optionalCampaignValue,
  landing_path: z.string().trim().startsWith("/").max(256),
  referrer_host: z.string().trim().min(1).max(255).nullable().optional(),
}).superRefine((payload, context) => {
  if (payload.event_type !== "page_view" && !payload.flow_id) {
    context.addIssue({
      code: "custom",
      message: "解读漏斗事件必须提供 flow_id。",
      path: ["flow_id"],
    });
  }
  if (
    (payload.event_type === "reading_completed"
      || payload.event_type === "feedback_submitted")
    && !payload.reading_id
  ) {
    context.addIssue({
      code: "custom",
      message: "完成与反馈事件必须提供 reading_id。",
      path: ["reading_id"],
    });
  }
});

type GrowthEventPayload = z.infer<typeof growthEventPayloadSchema>;

interface GrowthEventRouteDependencies {
  resolveActor: () => Promise<PublicFeatureActor>;
  getIpHash: (request: Request) => string;
  persist: (input: {
    actor: PublicFeatureActor;
    ipHash: string;
    payload: GrowthEventPayload;
  }) => Promise<"inserted" | "duplicate">;
}

export async function persistGrowthEvent({
  actor,
  ipHash,
  payload,
}: {
  actor: PublicFeatureActor;
  ipHash: string;
  payload: GrowthEventPayload;
}): Promise<"inserted" | "duplicate"> {
  const adminClient = createAdminClient();
  if (!adminClient) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "运营统计未配置 Supabase service role key。",
      503,
    );
  }

  const { data: quotaAllowed, error: quotaError } = await adminClient.rpc(
    "consume_growth_event_quota",
    {
      p_ip_hash: ipHash,
      p_ip_minute_limit: GROWTH_EVENT_IP_LIMIT_PER_MINUTE,
    },
  );

  if (quotaError) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "运营事件限流暂时不可用。",
      503,
    );
  }

  if (quotaAllowed !== true) {
    throw new ReadingServiceError(
      "rate_limited",
      "运营事件提交过于频繁。",
      429,
    );
  }

  const { error } = await adminClient.from("growth_events").insert({
    event_id: payload.event_id,
    event_type: payload.event_type,
    session_id: payload.session_id,
    attribution_id: payload.attribution_id,
    flow_id: payload.flow_id ?? null,
    reading_id: payload.reading_id ?? null,
    user_id: actor.userId,
    ip_hash: ipHash,
    utm_source: payload.utm_source ?? null,
    utm_medium: payload.utm_medium ?? null,
    utm_campaign: payload.utm_campaign ?? null,
    utm_content: payload.utm_content ?? null,
    utm_term: payload.utm_term ?? null,
    landing_path: payload.landing_path,
    referrer_host: payload.referrer_host ?? null,
  });

  if (error?.code === "23505") return "duplicate";
  if (error) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "运营事件记录失败。",
      503,
    );
  }
  return "inserted";
}

const DEFAULT_DEPENDENCIES: GrowthEventRouteDependencies = {
  resolveActor: () => resolvePublicFeatureActor(),
  getIpHash: getClientIpHash,
  persist: persistGrowthEvent,
};

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function handleGrowthEventPost(
  request: Request,
  dependencies: Partial<GrowthEventRouteDependencies> = {},
) {
  const deps = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  let body: unknown;
  try {
    body = await readBoundedJsonBody(
      request,
      MAX_GROWTH_EVENT_BYTES,
      "运营事件",
    );
  } catch (error) {
    if (isReadingServiceError(error)) {
      return errorResponse(error.code, error.message, error.status);
    }
    return errorResponse("invalid_request", "请求体不是有效的 JSON。", 400);
  }

  try {
    const payload = growthEventPayloadSchema.parse(body);
    const actor = await deps.resolveActor();
    const ipHash = deps.getIpHash(request);
    if (isE2eAccessBypassEnabled(request.headers.get(E2E_ACCESS_BYPASS_HEADER))) {
      return Response.json({ ok: true });
    }
    const result = await deps.persist({ actor, ipHash, payload });
    return Response.json({ ok: true, duplicate: result === "duplicate" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(
        "invalid_request",
        error.issues[0]?.message ?? "运营事件参数无效。",
        400,
      );
    }
    if (isReadingServiceError(error)) {
      return errorResponse(error.code, error.message, error.status);
    }
    return errorResponse("generation_failed", "运营事件记录失败。", 500);
  }
}

export async function POST(request: Request) {
  return handleGrowthEventPost(request);
}
