import { describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleTransport } from "@/server/llm/openai-compatible-transport";
import { ReadingServiceError } from "@/server/reading/errors";

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
    } satisfies Partial<ReadingServiceError>);
    expect(tokenGate.settle).toHaveBeenCalledTimes(1);
  });
});
