import { describe, expect, it } from "vitest";
import { findCardById, findSpreadById } from "@aethertarot/domain-tarot";
import { buildMinimumReadingGrounding } from "@/server/reading/grounding";

describe("minimum reading grounding", () => {
  it("uses the indexed authority card when Wiki only has the opposite orientation", () => {
    const card = findCardById("hermit");
    const spread = findSpreadById("single");
    if (!card || !spread) {
      throw new Error("missing test authority data");
    }

    const grounding = buildMinimumReadingGrounding({
      output: {
        groundingStatus: "retrieved",
        chunks: [{
          id: "hermit-reversed",
          title: "隐者逆位资料",
          content: "这条资料只描述逆位。",
          source: "test",
          source_ids: ["test"],
          source_id: "test",
          card: card.id,
          orientation: "reversed",
          score: 1,
          confidence: "high",
        }],
      },
      drawnCards: [{
        positionId: spread.positions[0].id,
        card,
        isReversed: false,
      }],
      spread,
    });

    expect(grounding.status).toBe("degraded");
    expect(grounding.chunks[0]).toMatchObject({
      ref: "K1",
      id: "authority-card:hermit:upright",
      kind: "authority_card",
      card: "hermit",
      orientation: "upright",
    });
    expect(grounding.chunks).toHaveLength(1);
  });
});
