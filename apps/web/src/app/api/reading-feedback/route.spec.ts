import { describe, expect, it, vi } from "vitest";
import {
  feedbackPayloadSchema,
  handleFeedbackPost,
} from "@/app/api/reading-feedback/route";
import type { PublicFeatureActor } from "@/server/beta/access";

const ANONYMOUS: PublicFeatureActor = {
  userId: null,
  email: null,
  role: "anonymous",
};

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/reading-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("reading feedback replay consent", () => {
  it("defaults replay consent to false", () => {
    expect(feedbackPayloadSchema.parse({
      reading_id: "reading-1",
      labels: ["helpful"],
    }).replay_consent).toBe(false);
  });

  it("preserves explicit opt-in and rejects non-boolean consent", () => {
    expect(feedbackPayloadSchema.parse({
      reading_id: "reading-1",
      labels: ["template_like"],
      replay_consent: true,
    }).replay_consent).toBe(true);
    expect(() => feedbackPayloadSchema.parse({
      reading_id: "reading-1",
      labels: ["helpful"],
      replay_consent: "yes",
    })).toThrow();
  });

  it("accepts the four public feedback labels and rejects retired labels", () => {
    expect(feedbackPayloadSchema.parse({
      reading_id: "reading-1",
      labels: ["helpful", "template_like", "too_agreeable", "did_not_answer"],
    }).labels).toEqual([
      "helpful",
      "template_like",
      "too_agreeable",
      "did_not_answer",
    ]);
    expect(() => feedbackPayloadSchema.parse({
      reading_id: "reading-1",
      labels: ["could_be_better"],
    })).toThrow();
  });

  it("rejects duplicate feedback labels", () => {
    expect(() => feedbackPayloadSchema.parse({
      reading_id: "reading-1",
      labels: ["helpful", "helpful"],
    })).toThrow("反馈标签不能重复。");
  });

  it("allows an anonymous visitor to submit feedback for a completed reading", async () => {
    const persist = vi.fn(async () => "inserted" as const);
    const response = await handleFeedbackPost(
      buildRequest({
        reading_id: "reading-1",
        labels: ["did_not_answer"],
        note: "没有回应我的核心问题。",
      }),
      {
        resolveActor: vi.fn(async () => ANONYMOUS),
        getIpHash: () => "ip-hash",
        persist,
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, duplicate: false });
    expect(persist).toHaveBeenCalledWith({
      actor: ANONYMOUS,
      ipHash: "ip-hash",
      readingId: "reading-1",
      labels: ["did_not_answer"],
      note: "没有回应我的核心问题。",
      replayConsent: false,
    });
  });

  it("rejects feedback that does not belong to a completed reading", async () => {
    const response = await handleFeedbackPost(
      buildRequest({
        reading_id: "unknown-reading",
        labels: ["helpful"],
      }),
      {
        resolveActor: vi.fn(async () => ANONYMOUS),
        getIpHash: () => "ip-hash",
        persist: vi.fn(async () => "not_found" as const),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "invalid_request",
        message: "只能为当前访客已完成的解读提交反馈。",
      },
    });
  });

  it("treats duplicate feedback as an idempotent success", async () => {
    const response = await handleFeedbackPost(
      buildRequest({ reading_id: "reading-1", labels: ["helpful"] }),
      {
        resolveActor: vi.fn(async () => ANONYMOUS),
        getIpHash: () => "ip-hash",
        persist: vi.fn(async () => "duplicate" as const),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, duplicate: true });
  });
});
