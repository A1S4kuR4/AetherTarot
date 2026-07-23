import { describe, expect, it } from "vitest";
import { parseWikiClaims, slugifyWikiHeading } from "@/server/knowledge/wiki";

describe("shared wiki claim parser", () => {
  it("splits paragraphs and list items into stable claim units", () => {
    const claims = parseWikiClaims([
      "## 核心牌义",
      "第一段内容。[来源: SRC-1, SRC-2]",
      "",
      "第二段内容。",
      "- 列表中的独立主张。[来源: SRC-3]",
    ].join("\n"));

    expect(claims).toEqual([
      {
        heading: "核心牌义",
        paragraphIndex: 0,
        content: "第一段内容。",
        sourceIds: ["SRC-1", "SRC-2"],
        hasInlineSource: true,
      },
      {
        heading: "核心牌义",
        paragraphIndex: 1,
        content: "第二段内容。",
        sourceIds: [],
        hasInlineSource: false,
      },
      {
        heading: "核心牌义",
        paragraphIndex: 2,
        content: "列表中的独立主张。",
        sourceIds: ["SRC-3"],
        hasInlineSource: true,
      },
    ]);
    expect(slugifyWikiHeading(claims[0].heading)).toBe("核心牌义");
  });

  it("does not leak inline source markers into model-visible content", () => {
    const [claim] = parseWikiClaims(
      "## 逆位\n不要把停滞写成宿命。[来源: BOOK-9]",
    );

    expect(claim.content).not.toContain("[来源:");
    expect(claim.sourceIds).toEqual(["BOOK-9"]);
  });
});
