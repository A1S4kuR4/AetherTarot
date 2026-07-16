import { describe, expect, it } from "vitest";
import { truncateByCharBudget } from "./share-image";

describe("truncateByCharBudget", () => {
  it("returns original text when within budget", () => {
    const text = "这是一段短文本。";
    expect(truncateByCharBudget(text, 20)).toBe(text);
  });

  it("truncates long text and prefers sentence boundaries", () => {
    const text =
      "第一句话。第二句话比较长，包含了很多内容。第三句话。第四句话。";
    const result = truncateByCharBudget(text, 18);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it("does not break emoji", () => {
    const text = "开头😀中间😁结尾。";
    const result = truncateByCharBudget(text, 5);
    expect(result).toContain("…");
    expect(result).not.toContain("�");
  });

  it("does not break ZWJ emoji sequences", () => {
    const text = "家庭👨‍👩‍👧‍👦聚会。";
    const result = truncateByCharBudget(text, 4);
    expect(result).toContain("…");
    expect(result).not.toContain("�");
    // The family emoji should stay intact; it may end with the ellipsis.
    expect(result.startsWith("家庭👨‍👩‍👧‍👦")).toBe(true);
  });

  it("does not break surrogate pairs", () => {
    const text = "𠮷野家拉面很好吃。";
    const result = truncateByCharBudget(text, 6);
    expect(result).toContain("…");
    expect(result).not.toContain("�");
  });

  it("keeps emoji intact when truncation falls after it", () => {
    const text = "开心😀的一天。";
    const result = truncateByCharBudget(text, 3);
    expect(result).toBe("开心😀…");
  });
});
