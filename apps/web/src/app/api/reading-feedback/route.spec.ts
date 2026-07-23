import { describe, expect, it } from "vitest";
import { feedbackPayloadSchema } from "@/app/api/reading-feedback/route";

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
      labels: ["could_be_better"],
      replay_consent: true,
    }).replay_consent).toBe(true);
    expect(() => feedbackPayloadSchema.parse({
      reading_id: "reading-1",
      labels: ["helpful"],
      replay_consent: "yes",
    })).toThrow();
  });
});
