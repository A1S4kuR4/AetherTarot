import { describe, expect, it } from "vitest";
import {
  getReadingChapterLabels,
  READING_NAV_ITEMS,
  type ReadingSectionId,
} from "./constants";

describe("reading chapter labels", () => {
  it("numbers the complete reading continuously from I through X", () => {
    const ids = READING_NAV_ITEMS.map((item) => item.id);
    const labels = getReadingChapterLabels(ids);

    expect(ids.map((id) => labels[id])).toEqual([
      "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
    ]);
  });

  it("closes gaps when optional sections are absent", () => {
    const ids: ReadingSectionId[] = [
      "reading-spread",
      "reading-quick",
      "reading-cards",
      "reading-synthesis",
      "reading-evidence",
      "reading-radar",
      "reading-feedback",
    ];

    const labels = getReadingChapterLabels(ids);

    expect(ids.map((id) => labels[id])).toEqual(["I", "II", "III", "IV", "V", "VI", "VII"]);
  });
});
