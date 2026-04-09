import { ZodError } from "zod";
import type { ReadingErrorPayload } from "@aethertarot/shared-types";
import { isReadingServiceError } from "@/server/reading/errors";
import { readingRequestPayloadSchema } from "@/server/reading/schemas";
import { generateStructuredReading } from "@/server/reading/service";

function buildErrorResponse(
  code: ReadingErrorPayload["error"]["code"],
  message: string,
  status: number,
  intercept_reason?: string,
  referral_links?: string[]
) {
  const payload: ReadingErrorPayload = {
    error: {
      code,
      message,
      intercept_reason,
      referral_links,
    },
  };

  return Response.json(payload, { status });
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return buildErrorResponse(
      "invalid_request",
      "请求体不是有效的 JSON。",
      400,
    );
  }

  try {
    const parsedPayload = readingRequestPayloadSchema.parse(payload);
    const reading = await generateStructuredReading(parsedPayload);

    return Response.json(reading);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0]?.message ?? "请求参数无效。";
      return buildErrorResponse("invalid_request", firstIssue, 400);
    }

    if (isReadingServiceError(error)) {
      return buildErrorResponse(
        error.code,
        error.message,
        error.status,
        error.intercept_reason,
        error.referral_links
      );
    }

    return buildErrorResponse(
      "generation_failed",
      "解读生成失败，请稍后再试。",
      500,
    );
  }
}
