import { describe, expect, it, vi } from "vitest";
import {
  OpenAiCompatibleTransport,
  parseOpenAiJsonObject,
} from "@/server/llm/openai-compatible-transport";
import {
  collectLlmUsage,
  unwrapLlmUsageError,
} from "@/server/observability/llm-usage";
import { ReadingGenerationError } from "@/server/reading/errors";

const config = {
  baseUrl: "http://provider.test/v1",
  model: "test-model",
  temperature: 0.3,
  timeoutMs: 1_000,
  maxOutputTokens: 900,
} as const;

function createTokenGate() {
  return {
    reserve: vi.fn(async () => ({ id: "reservation-1", reservedTokens: 100 })),
    settle: vi.fn(async () => undefined),
  };
}

describe("OpenAI-compatible transport", () => {
  it.each([
    ["plain object", "{\"answer\":\"ok\"}"],
    ["markdown fence", "```json\n{\"answer\":\"ok\"}\n```"],
    ["explanatory text", "Result follows: {\"answer\":\"ok\"} done."],
    [
      "escaped braces in strings",
      "prefix {\"answer\":\"a } brace and an escaped quote \\\" ok\"} suffix",
    ],
  ])("parses a unique balanced JSON object from %s", (_label, rawText) => {
    expect(parseOpenAiJsonObject(rawText)).toMatchObject({ answer: expect.any(String) });
  });

  it.each([
    ["empty completion", ""],
    ["malformed object", "{\"answer\":\"missing close\""],
    ["multiple objects", "{\"a\":1} and {\"b\":2}"],
    ["array boundary", "[{\"answer\":\"nested\"}]"],
  ])("classifies %s without leaking SyntaxError", (_label, rawText) => {
    try {
      parseOpenAiJsonObject(rawText);
      throw new Error("expected parser failure");
    } catch (error) {
      expect(error).not.toBeInstanceOf(SyntaxError);
      expect(error).toMatchObject({
        code: "generation_failed",
        subtype: rawText === "" ? "empty_completion" : "malformed_json",
      });
    }
  });

  it("accepts an empty JSON object as a structurally valid object", () => {
    expect(parseOpenAiJsonObject("{}")).toEqual({});
  });

  it("joins multipart content, parses JSON, and settles once without usage", async () => {
    const tokenGate = createTokenGate();
    const transport = new OpenAiCompatibleTransport(
      config,
      vi.fn(async () => Response.json({
        choices: [{
          finish_reason: "stop",
          message: {
            content: [
              { type: "text", text: "```json\n{\"answer\":" },
              { type: "text", text: "\"ok\"}\n```" },
            ],
          },
        }],
      })),
      tokenGate,
    );

    const result = await transport.request({
      source: "encyclopedia",
      prompt: { system: "system", user: "user" },
      maxOutputTokens: 100,
      parse: (payload) => payload.answer,
      truncatedMessage: "truncated",
    });

    expect(result).toBe("ok");
    expect(tokenGate.settle).toHaveBeenCalledTimes(1);
  });

  it("keeps the complete parsed payload for constrained contract repair", async () => {
    const tokenGate = createTokenGate();
    const completion = {
      themes: ["保留的初始主题", "新的整合视角"],
      synthesis: "这段内容本身有效。",
      follow_up_questions: "这一个字段错误地使用了字符串。",
    };
    const transport = new OpenAiCompatibleTransport(
      config,
      vi.fn(async () => Response.json({
        choices: [{
          finish_reason: "stop",
          message: { content: JSON.stringify(completion) },
        }],
      })),
      tokenGate,
    );
    let collectedError: unknown;

    try {
      await collectLlmUsage(() => transport.request({
        source: "reading",
        prompt: { system: "system", user: "user" },
        maxOutputTokens: 100,
        parse: (payload) => {
          throw new ReadingGenerationError({
            subtype: "schema_violation",
            message: "follow_up_questions must be an array",
            retryable: true,
            invalidPayload: payload.follow_up_questions,
            issues: ["follow_up_questions must be an array"],
          });
        },
        truncatedMessage: "truncated",
      }));
    } catch (error) {
      collectedError = error;
    }
    const unwrapped = unwrapLlmUsageError(collectedError);

    expect(unwrapped.cause).toMatchObject({
      subtype: "schema_violation",
      issues: ["follow_up_questions must be an array"],
      invalidPayload: completion,
    });
    expect(unwrapped.calls).toEqual([
      expect.objectContaining({
        success: false,
        subtype: "schema_violation",
      }),
    ]);
    expect(tokenGate.settle).toHaveBeenCalledTimes(1);
  });

  it("rejects length-truncated output and still settles exactly once", async () => {
    const tokenGate = createTokenGate();
    const transport = new OpenAiCompatibleTransport(
      config,
      vi.fn(async () => Response.json({
        choices: [{
          finish_reason: "length",
          message: { content: "{\"answer\":\"partial" },
        }],
      })),
      tokenGate,
    );

    await expect(transport.request({
      source: "encyclopedia",
      prompt: { system: "system", user: "user" },
      maxOutputTokens: 100,
      parse: (payload) => payload,
      truncatedMessage: "百科回答被截断。",
    })).rejects.toMatchObject({
      code: "generation_failed",
      message: "百科回答被截断。",
      subtype: "truncated_output",
    });
    expect(tokenGate.settle).toHaveBeenCalledTimes(1);
  });

  it("records stage and attempt metric identifiers", async () => {
    const tokenGate = createTokenGate();
    const transport = new OpenAiCompatibleTransport(
      config,
      vi.fn(async () => Response.json({
        choices: [{
          finish_reason: "stop",
          message: { content: "{\"answer\":\"ok\"}" },
        }],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 4,
          total_tokens: 16,
        },
      })),
      tokenGate,
    );
    const { calls } = await collectLlmUsage(() => transport.request({
      source: "reading",
      prompt: { system: "system", user: "user" },
      maxOutputTokens: 100,
      parse: (payload) => payload.answer,
      truncatedMessage: "truncated",
      metric: {
        runId: "run-1",
        stageId: "run-1:compact",
        attemptId: "run-1:compact:2",
        stage: "compact",
        attempt: 2,
        kind: "repair",
      },
    }));

    expect(calls).toEqual([
      expect.objectContaining({
        runId: "run-1",
        stageId: "run-1:compact",
        attemptId: "run-1:compact:2",
        stage: "compact",
        attempt: 2,
        kind: "repair",
        totalTokens: 16,
      }),
    ]);
  });

  it("classifies caller cancellation and settles exactly once", async () => {
    const tokenGate = createTokenGate();
    const controller = new AbortController();
    const transport = new OpenAiCompatibleTransport(
      config,
      vi.fn(async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          if (init?.signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
          }
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          }, { once: true });
        })
      ),
      tokenGate,
    );
    const pending = transport.request({
      source: "reading",
      prompt: { system: "system", user: "user" },
      maxOutputTokens: 100,
      parse: (payload) => payload,
      truncatedMessage: "truncated",
      signal: controller.signal,
    });
    controller.abort();

    await expect(pending).rejects.toMatchObject({
      subtype: "cancelled",
      retryable: false,
    });
    expect(tokenGate.settle).toHaveBeenCalledTimes(1);
  });

  it.each([
    [400, false],
    [429, true],
    [503, true],
  ])("classifies HTTP %s retryability", async (status, retryable) => {
    const tokenGate = createTokenGate();
    const transport = new OpenAiCompatibleTransport(
      config,
      vi.fn(async () => new Response("failed", { status })),
      tokenGate,
    );

    await expect(transport.request({
      source: "reading",
      prompt: { system: "system", user: "user" },
      maxOutputTokens: 100,
      parse: (payload) => payload,
      truncatedMessage: "truncated",
    })).rejects.toMatchObject({
      code: "provider_unavailable",
      subtype: "provider_http_error",
      retryable,
      httpStatus: status,
    });
    expect(tokenGate.settle).toHaveBeenCalledTimes(1);
  });

  it("uses the fixed failure taxonomy in HTTP metrics", async () => {
    const transport = new OpenAiCompatibleTransport(
      config,
      vi.fn(async () => new Response("failed", { status: 503 })),
      createTokenGate(),
    );
    let collectedError: unknown;
    try {
      await collectLlmUsage(() => transport.request({
        source: "reading",
        prompt: { system: "system", user: "user" },
        maxOutputTokens: 100,
        parse: (payload) => payload,
        truncatedMessage: "truncated",
      }));
    } catch (error) {
      collectedError = error;
    }
    const unwrapped = unwrapLlmUsageError(collectedError);

    expect(unwrapped.cause).toMatchObject({
      subtype: "provider_http_error",
    });
    expect(unwrapped.calls).toEqual([
      expect.objectContaining({
        subtype: "provider_http_error",
        errorCode: "http_503",
        httpStatus: 503,
      }),
    ]);
  });
});
