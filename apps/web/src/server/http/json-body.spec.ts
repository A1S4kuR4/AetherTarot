import { describe, expect, it, vi } from "vitest";
import { readBoundedJsonBody } from "@/server/http/json-body";

function requestFromChunks(chunks: string[], headers: Record<string, string> = {}) {
  const encoder = new TextEncoder();
  let index = 0;
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) return controller.close();
      controller.enqueue(encoder.encode(chunks[index++]));
    },
    cancel,
  });
  return {
    request: new Request("http://local.test", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" }),
    cancel,
  };
}

describe("readBoundedJsonBody", () => {
  it("stops an oversized chunked body without Content-Length", async () => {
    const input = requestFromChunks(["{\"x\":\"", "1234567890", "never-read"]);
    await expect(readBoundedJsonBody(input.request, 10, "test")).rejects.toMatchObject({ status: 413 });
    expect(input.cancel).toHaveBeenCalled();
  });

  it("rejects actual bytes when Content-Length is forged smaller", async () => {
    const input = requestFromChunks([JSON.stringify({ value: "too-large" })], { "Content-Length": "1" });
    await expect(readBoundedJsonBody(input.request, 8, "test")).rejects.toMatchObject({ status: 413 });
  });

  it("rejects non-JSON media types", async () => {
    const input = requestFromChunks(["{}"], { "Content-Type": "text/plain" });
    await expect(readBoundedJsonBody(input.request, 10, "test")).rejects.toMatchObject({ status: 415 });
  });

  it.each(["", "{"])("classifies empty or malformed bodies", async (body) => {
    const input = requestFromChunks(body ? [body] : []);
    await expect(readBoundedJsonBody(input.request, 10, "test")).rejects.toMatchObject({ status: 400 });
  });

  it.each(["Reading", "百科问答", "反馈"])(
    "keeps the malformed JSON API contract label-independent for %s",
    async (label) => {
      const input = requestFromChunks(["{"]);
      await expect(readBoundedJsonBody(input.request, 10, label)).rejects.toMatchObject({
        status: 400,
        message: "请求体不是有效的 JSON。",
      });
    },
  );

  it("cancels body reading when the caller aborts", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ cancel });
    const controller = new AbortController();
    const request = new Request("http://local.test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stream,
      signal: controller.signal,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const pending = readBoundedJsonBody(request, 10, "test");
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalled();
  });
});
