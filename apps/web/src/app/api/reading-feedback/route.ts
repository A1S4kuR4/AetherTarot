import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireBetaTesterAccess } from "@/server/beta/access";
import { getClientIpHash } from "@/server/beta/ip";
import { isReadingServiceError, ReadingServiceError } from "@/server/reading/errors";

export const runtime = "nodejs";

const feedbackLabelSchema = z.enum([
  "accurate",
  "template_like",
  "too_agreeable",
  "helpful",
]);

const feedbackPayloadSchema = z.object({
  reading_id: z.string().trim().min(1),
  labels: z.array(feedbackLabelSchema).min(1).max(4),
  note: z.string().trim().max(1000).optional(),
});

function buildErrorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return buildErrorResponse("invalid_request", "请求体不是有效的 JSON。", 400);
  }

  try {
    const parsedPayload = feedbackPayloadSchema.parse(payload);
    const tester = await requireBetaTesterAccess();
    const adminClient = createAdminClient();

    if (!adminClient) {
      throw new ReadingServiceError(
        "provider_unavailable",
        "反馈记录未配置 Supabase service role key。",
        503,
      );
    }

    const { error } = await adminClient.from("reading_feedback").insert({
      reading_id: parsedPayload.reading_id,
      user_id: tester.userId,
      email: tester.email,
      ip_hash: getClientIpHash(request),
      labels: parsedPayload.labels,
      note: parsedPayload.note ?? null,
    });

    if (error) {
      throw new ReadingServiceError(
        "provider_unavailable",
        "反馈记录失败，请稍后再试。",
        503,
      );
    }

    return Response.json({ ok: true });
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
