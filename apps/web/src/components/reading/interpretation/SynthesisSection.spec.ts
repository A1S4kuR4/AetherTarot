import { describe, expect, it } from "vitest";
import { splitSynthesisParagraphs } from "./SynthesisSection";

describe("splitSynthesisParagraphs", () => {
  it("keeps meaningful line breaks as separate paragraphs", () => {
    expect(splitSynthesisParagraphs("第一段。\n\n第二段。\n第三段。")).toEqual([
      "第一段。",
      "第二段。",
      "第三段。",
    ]);
  });

  it("caps long provider output at four rendered paragraphs without losing text", () => {
    expect(splitSynthesisParagraphs("一\n二\n三\n四\n五")).toEqual([
      "一",
      "二",
      "三",
      "四\n五",
    ]);
  });
});
