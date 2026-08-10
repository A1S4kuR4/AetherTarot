import { z } from "zod";
import { READING_FEEDBACK_LABELS } from "@/lib/reading-feedback";
import {
  E2E_ACCESS_BYPASS_HEADER,
  isE2eAccessBypassEnabled,
  resolvePublicFeatureActor,
  type PublicFeatureActor,
} from "@/server/beta/access";
import { getClientIpHash } from "@/server/beta/ip";
import { readBoundedJsonBody } from "@/server/http/json-body";
import { isReadingServiceError } from "@/server/reading/errors";
import {
  persistReadingFeedback,
  type PersistReadingFeedbackInput,
  type PersistReadingFeedbackResult,
} from "@/server/feedback/reading-feedback";

export const runtime = "nodejs";
const MAX_FEEDBACK_REQUEST_BYTES = 8 * 1024;

const feedbackLabelSchema = z.enum(READING_FEEDBACK_LABELS);

export const feedbackPayloadSchema = z.object({
  reading_id: z.string().trim().min(1),
  labels: z
    .array(feedbackLabelSchema)
    .min(1)
    .max(4)
    .refine((labels) => new Set(labels).size === labels.length, {
      message: "反馈标签不能重复。",
    }),
  note: z.string().trim().max(1000).optional(),
  replay_consent: z.boolean().optional().default(false),
});

function buildErrorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

interface FeedbackRouteDependencies {
  resolveActor: () => Promise<PublicFeatureActor>;
  getIpHash: (request: Request) => string;
  persist: (
    input: PersistReadingFeedbackInput,
  ) => Promise<PersistReadingFeedbackResult>;
}

const DEFAULT_DEPENDENCIES: FeedbackRouteDependencies = {
  resolveActor: () => resolvePublicFeatureActor(),
  getIpHash: getClientIpHash,
  persist: persistReadingFeedback,
};

export async function handleFeedbackPost(
  request: Request,
  dependencies: Partial<FeedbackRouteDependencies> = {},
) {
  const deps = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  let payload: unknown;

  try {
    payload = await readBoundedJsonBody(
      request,
      MAX_FEEDBACK_REQUEST_BYTES,
      "反馈",
    );
  } catch (error) {
    if (isReadingServiceError(error)) {
      return buildErrorResponse(error.code, error.message, error.status);
    }
    return buildErrorResponse("invalid_request", "请求体不是有效的 JSON。", 400);
  }

  try {
    const parsedPayload = feedbackPayloadSchema.parse(payload);
    const actor = await deps.resolveActor();
    const ipHash = deps.getIpHash(request);
    const shouldSkipPersistence = isE2eAccessBypassEnabled(
      request.headers.get(E2E_ACCESS_BYPASS_HEADER),
    );

    if (shouldSkipPersistence) {
      return Response.json({ ok: true });
    }

    const result = await deps.persist({
      actor,
      ipHash,
      readingId: parsedPayload.reading_id,
      labels: parsedPayload.labels,
      note: parsedPayload.note ?? null,
      replayConsent: parsedPayload.replay_consent,
    });

    if (result === "not_found") {
      return buildErrorResponse(
        "invalid_request",
        "只能为当前访客已完成的解读提交反馈。",
        400,
      );
    }

    return Response.json({ ok: true, duplicate: result === "duplicate" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return buildErrorResponse(
        "invalid_request",
        error.issues[0]?.message ?? "请求参数无效。",
        400,
      );
    }

    if (isReadingServiceError(error)) {
      return buildErrorResponse(error.code, error.message, error.status);
    }

    return buildErrorResponse("generation_failed", "反馈记录失败，请稍后再试。", 500);
  }
}

export async function POST(request: Request) {
  return handleFeedbackPost(request);
}
