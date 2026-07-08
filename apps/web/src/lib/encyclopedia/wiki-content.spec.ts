import { describe, expect, it } from "vitest";
import { resolveInitialCardId } from "./card-selection";
import {
  disabledLabelFromHref,
  formatSourceLabel,
  isDisabledHref,
  isSourceHref,
  mapWikiHref,
  prepareWikiMarkdown,
  sourceLabelFromHref,
} from "./wiki-content";

describe("encyclopedia card selection", () => {
  it("falls back when the requested card id is not known", () => {
    expect(
      resolveInitialCardId({
        requestedCardId: "not-real",
        fallbackCardId: "fool",
        knownCardIds: ["fool", "magician"],
      }),
    ).toBe("fool");
    expect(
      resolveInitialCardId({
        requestedCardId: "the-magician",
        fallbackCardId: "fool",
        knownCardIds: ["fool", "magician"],
      }),
    ).toBe("magician");
  });
});

describe("wiki markdown helpers", () => {
  it("maps internal markdown links to encyclopedia card routes", () => {
    expect(mapWikiHref("./the-magician.md")).toBe("/encyclopedia?card=the-magician");
    expect(mapWikiHref("../major-arcana/the-fool.md")).toBe("/encyclopedia?card=the-fool");
    expect(mapWikiHref("../minor-arcana/swords/two-of-swords.md")).toBe(
      "/encyclopedia?card=two-of-swords",
    );
  });

  it("renders concept or spread wiki links as disabled placeholders", () => {
    const conceptHref = mapWikiHref("../concepts/four-elements.md");
    const spreadHref = mapWikiHref("../spreads/celtic-cross.md");

    expect(isDisabledHref(conceptHref)).toBe(true);
    expect(disabledLabelFromHref(conceptHref)).toBe("four-elements");
    expect(isDisabledHref(spreadHref)).toBe(true);
    expect(disabledLabelFromHref(spreadHref)).toBe("celtic-cross");
  });

  it("keeps external links as external hrefs", () => {
    expect(mapWikiHref("https://example.com/wiki")).toBe("https://example.com/wiki");
  });

  it("prepares source notes as renderable source links", () => {
    const prepared = prepareWikiMarkdown("文本 [来源: 78W] 和 [来源: BOTA]");
    const sourceHref = prepared.match(/\((aether-source:[^)]+)\)/)?.[1];

    expect(prepared).toContain("[来源: 78W](aether-source:78W)");
    expect(sourceHref).toBeDefined();
    expect(isSourceHref(sourceHref)).toBe(true);
    expect(sourceLabelFromHref(sourceHref ?? "")).toBe("《78度的智慧》");
  });

  it("formats registered source abbreviation to Chinese book title", () => {
    expect(formatSourceLabel("78W")).toBe("《78度的智慧》");
    expect(formatSourceLabel("YAT")).toBe("《其实你已经很塔罗了》");
    expect(formatSourceLabel("CTB")).toBe("《塔罗全书》");
    expect(formatSourceLabel("BOTA")).toBe("BOTA"); // Fallback for unregistered IDs
  });
});
