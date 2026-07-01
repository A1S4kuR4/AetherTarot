import { describe, expect, it } from "vitest";
import {
  uniqueStrings,
  formatFallbackSentence,
  getLeadSentence,
} from "./utils";

describe("Reading interpretation utilities", () => {
  describe("uniqueStrings", () => {
    it("removes empty, null, and duplicate strings", () => {
      expect(uniqueStrings(["A", "", "B", "A", "C", ""])).toEqual(["A", "B", "C"]);
    });
  });

  describe("formatFallbackSentence", () => {
    it("handles empty keywords", () => {
      expect(formatFallbackSentence([])).toBe("本次解读的脉络正围绕着你当下的议题展开。");
    });

    it("handles single keyword", () => {
      expect(formatFallbackSentence(["自我成长"])).toBe("本次解读的脉络正围绕着：自我成长 展开。");
    });

    it("handles two keywords", () => {
      expect(formatFallbackSentence(["自我成长", "职业发展"])).toBe(
        "本次解读的脉络正围绕着：自我成长 与 职业发展 展开。"
      );
    });

    it("handles three or more keywords", () => {
      expect(formatFallbackSentence(["自我成长", "职业发展", "人际关系"])).toBe(
        "本次解读的脉络正围绕着：自我成长、职业发展 与 人际关系 展开。"
      );
    });
  });

  describe("getLeadSentence", () => {
    it("returns the first sentence if it is under 65 characters", () => {
      const value = "自我怀疑削弱了你内心的稳定。命运之轮正在悄然转动。";
      expect(getLeadSentence(value, ["自我怀疑", "改变"])).toBe("自我怀疑削弱了你内心的稳定。");
    });

    it("returns the fallback sentence if the first sentence is over 65 characters", () => {
      const value = "这是一个非常长非常长非常长非常长非常长非常长非常长非常长非常长非常长非常长非常长非常长非常长非常长的句子，超出了六十五个字的限制啊。";
      expect(getLeadSentence(value, ["主题A", "主题B"])).toBe(
        "本次解读的脉络正围绕着：主题A 与 主题B 展开。"
      );
    });

    it("handles empty or whitespace value", () => {
      expect(getLeadSentence("  ", ["主题A", "主题B"])).toBe(
        "本次解读的脉络正围绕着：主题A 与 主题B 展开。"
      );
    });

    it("handles text without standard punctuation and truncates properly if over 65 characters", () => {
      const value = "这是一个没有句号的长句子这是一个没有句号的长句子这是一个没有句号的长句子这是一个没有句号的长句子这是一个没有句号的长句子这是一个没有句号的长句子";
      expect(getLeadSentence(value, ["主题A"])).toBe("本次解读的脉络正围绕着：主题A 展开。");
    });
  });
});
