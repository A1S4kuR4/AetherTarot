import "server-only";

import { ReadingServiceError } from "@/server/reading/errors";

export async function readBoundedJsonBody(
  request: Request,
  maxBytes: number,
  label: string,
) {
  const contentLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ReadingServiceError(
      "invalid_request",
      `${label}请求体过大。`,
      413,
    );
  }

  const body = await request.text();

  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    throw new ReadingServiceError(
      "invalid_request",
      `${label}请求体过大。`,
      413,
    );
  }

  return JSON.parse(body) as unknown;
}
