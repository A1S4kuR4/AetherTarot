import "server-only";

import type { EncyclopediaWikiPage, EncyclopediaWikiSection } from "./wiki";

export interface CardWikiSummary {
  cardId: string;
  title: string;
  sections: EncyclopediaWikiSection[];
  sourceIds: string[];
}

export interface EncyclopediaKnowledgeCounts {
  cards: number;
  concepts: number;
  spreads: number;
}

type CardWikiPage = EncyclopediaWikiPage & { cardId: string };

function toRuntimeCardId(cardId: string) {
  // Major-arcana wiki IDs keep the traditional "the-" prefix, while runtime deck IDs do not.
  return cardId.replace(/^the-/, "");
}

function isCardWikiPage(page: EncyclopediaWikiPage): page is CardWikiPage {
  return page.type === "card" && Boolean(page.cardId);
}

export function buildCardWikiSummaries(pages: EncyclopediaWikiPage[]) {
  return pages
    .filter(isCardWikiPage)
    .map((page) => ({
      cardId: toRuntimeCardId(page.cardId),
      title: page.title,
      sections: page.sections,
      sourceIds: page.sourceIds,
    })) satisfies CardWikiSummary[];
}

export function countEncyclopediaWikiPages(
  pages: EncyclopediaWikiPage[],
): EncyclopediaKnowledgeCounts {
  return {
    cards: pages.filter((page) => page.type === "card").length,
    concepts: pages.filter((page) => page.type === "concept").length,
    spreads: pages.filter((page) => page.type === "spread").length,
  };
}
