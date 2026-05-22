import { describe, expect, it } from "vitest";
import { retrieveTarotKnowledgeChunks } from "@/server/reading/knowledge/retrieval";
import type { TarotKnowledgeChunk } from "@/server/reading/knowledge/types";

function chunk(overrides: Partial<TarotKnowledgeChunk>): TarotKnowledgeChunk {
  return {
    id: overrides.id ?? "chunk",
    source_id: "TEST",
    title: overrides.title ?? "测试牌 - 概述",
    content: overrides.content ?? "用于检索测试的内容。",
    source: overrides.source ?? "knowledge/wiki/test.md",
    card: overrides.card,
    orientation: overrides.orientation ?? "unknown",
    topic: overrides.topic ?? [],
    tags: overrides.tags ?? [],
  };
}

describe("retrieveTarotKnowledgeChunks", () => {
  it("prioritizes exact card metadata matches", () => {
    const results = retrieveTarotKnowledgeChunks({
      chunks: [
        chunk({ id: "hanged", card: "the-hanged-man" }),
        chunk({ id: "fool", card: "the-fool" }),
      ],
      query: "职业停滞怎么理解？",
      card: "the-hanged-man",
    });

    expect(results[0]?.id).toBe("hanged");
    expect(results.find((result) => result.id === "fool")).toBeUndefined();
  });

  it("matches hanged-man input to the-hanged-man wiki metadata", () => {
    const results = retrieveTarotKnowledgeChunks({
      chunks: [chunk({ id: "hanged", card: "the-hanged-man" })],
      query: "倒吊人是什么意思？",
      card: "hanged-man",
    });

    expect(results[0]).toMatchObject({
      id: "hanged",
      card: "the-hanged-man",
    });
  });

  it("weights orientation matches above unknown and mismatched chunks", () => {
    const results = retrieveTarotKnowledgeChunks({
      chunks: [
        chunk({ id: "upright", card: "the-hanged-man", orientation: "upright" }),
        chunk({ id: "unknown", card: "the-hanged-man", orientation: "unknown" }),
        chunk({ id: "reversed", card: "the-hanged-man", orientation: "reversed" }),
      ],
      query: "倒吊人逆位代表什么？",
      card: "the-hanged-man",
      orientation: "reversed",
    });

    expect(results.map((result) => result.id)).toEqual([
      "reversed",
      "unknown",
      "upright",
    ]);
  });

  it("maps Chinese topic aliases during scoring", () => {
    const results = retrieveTarotKnowledgeChunks({
      chunks: [
        chunk({
          id: "relationship",
          card: "the-fool",
          topic: ["relationship"],
        }),
        chunk({
          id: "career",
          card: "the-fool",
          topic: ["career"],
        }),
      ],
      query: "愚者在情感关系里怎么理解？",
      card: "the-fool",
      topic: "情感",
    });

    expect(results[0]?.id).toBe("relationship");
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
  });

  it("detects multiple cards mentioned in the query", () => {
    const results = retrieveTarotKnowledgeChunks({
      chunks: [
        chunk({ id: "fool", card: "the-fool" }),
        chunk({ id: "magician", card: "the-magician" }),
        chunk({ id: "hanged", card: "the-hanged-man" }),
      ],
      query: "愚者和魔术师同时出现时，选择的重点是什么？",
    });

    expect(results.map((result) => result.id)).toEqual(["fool", "magician"]);
  });

  it("penalizes chunks for the wrong detected card", () => {
    const results = retrieveTarotKnowledgeChunks({
      chunks: [
        chunk({
          id: "correct",
          card: "the-fool",
          title: "愚者 - 选择",
          content: "愚者与选择、行动、开始有关。",
        }),
        chunk({
          id: "wrong",
          card: "the-hanged-man",
          title: "愚者 - 选择",
          content: "愚者与选择、行动、开始有关。",
        }),
      ],
      query: "愚者的选择和行动是什么意思？",
    });

    const correct = results.find((result) => result.id === "correct");
    const wrong = results.find((result) => result.id === "wrong");

    expect(correct?.score).toBeGreaterThan(wrong?.score ?? 0);
  });

  it("drops chunks below the score threshold", () => {
    const results = retrieveTarotKnowledgeChunks({
      chunks: [
        chunk({
          id: "weak",
          content: "只有一个很弱的孤独命中。",
        }),
      ],
      query: "孤独",
    });

    expect(results).toEqual([]);
  });

  it("uses Chinese query terms in title, tags, and content matching", () => {
    const results = retrieveTarotKnowledgeChunks({
      chunks: [
        chunk({
          id: "chinese",
          title: "等待选择",
          content: "停滞等待选择时，需要先辨认真正的问题。",
          tags: ["停滞"],
        }),
      ],
      query: "停滞等待选择",
    });

    expect(results[0]).toMatchObject({
      id: "chinese",
      score: expect.any(Number),
    });
  });
});
