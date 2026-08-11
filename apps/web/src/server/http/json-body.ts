import "server-only";

import { ReadingServiceError } from "@/server/reading/errors";

async function readWithSignal(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
) {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  return new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    reader.read().then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

export async function readBoundedJsonBody(
  request: Request,
  maxBytes: number,
  label: string,
) {
  const contentType = request.headers.get("content-type")?.trim() ?? "";
  const [mediaType, ...parameters] = contentType.split(";").map((part) => part.trim());
  const validCharset = parameters.every((parameter) =>
    /^charset=(?:utf-8|"utf-8")$/i.test(parameter)
  );
  if (mediaType.toLowerCase() !== "application/json" || !validCharset) {
    throw new ReadingServiceError(
      "invalid_request",
      `${label}仅接受 application/json 请求。`,
      415,
    );
  }

  const rawContentLength = request.headers.get("content-length");
  const contentLength = rawContentLength && /^\d+$/.test(rawContentLength)
    ? Number(rawContentLength)
    : null;

  if (contentLength !== null && Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ReadingServiceError(
      "invalid_request",
      `${label}请求体过大。`,
      413,
    );
  }

  if (!request.body) {
    throw new ReadingServiceError(
      "invalid_request",
      `${label}请求体不能为空。`,
      400,
    );
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await readWithSignal(reader, request.signal);
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("request_body_too_large").catch(() => undefined);
        throw new ReadingServiceError(
          "invalid_request",
          `${label}请求体过大。`,
          413,
        );
      }
      chunks.push(value);
    }
  } finally {
    if (request.signal.aborted) {
      await reader.cancel(request.signal.reason).catch(() => undefined);
    }
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    throw new ReadingServiceError("invalid_request", `${label}请求体不能为空。`, 400);
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let body: string;
  try {
    body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(body) as unknown;
  } catch {
    throw new ReadingServiceError(
      "invalid_request",
      `${label}请求体不是有效的 JSON。`,
      400,
    );
  }
}
