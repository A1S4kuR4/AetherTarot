import "server-only";

import { findCardById } from "@aethertarot/domain-tarot";
import type { EncyclopediaSource } from "@aethertarot/shared-types";
import type {
  EncyclopediaWikiPage,
  EncyclopediaWikiSection,
} from "@/server/encyclopedia/wiki";

export interface EncyclopediaRetrievedSource extends EncyclopediaSource {
  content: string;
}

interface ScoredSection {
  page: EncyclopediaWikiPage;
  section: EncyclopediaWikiSection;
  score: number;
}

const MAX_EXCERPT_LENGTH = 180;

const QUERY_STOP_WORDS = new Set([
  "什么",
  "怎么",
  "如何",
  "是不是",
  "是否",
  "一个",
  "一下",
  "这张牌",
  "这张",
  "这牌",
  "牌",
  "意思",
  "意义",
  "代表",
  "理解",
]);

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function extractQueryTerms(query: string) {
  const normalizedQuery = normalize(query);
  const chineseTerms = query
    .split(/[，。！？、\s,.!?;；:："'“”‘’()[\]{}<>《》/\\|-]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && !QUERY_STOP_WORDS.has(item));
  const chineseBigrams = chineseTerms.flatMap((item) => {
    const chars = Array.from(item);

    if (chars.length <= 2) {
      return [];
    }

    return chars
      .slice(0, -1)
      .map((char, index) => `${char}${chars[index + 1]}`)
      .filter((term) => !QUERY_STOP_WORDS.has(term));
  });
  const englishTerms = query
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((item) => item.length >= 3);

  return unique([
    ...chineseTerms,
    ...chineseBigrams,
    ...englishTerms,
    normalizedQuery.includes("逆位") ? "逆位" : "",
    normalizedQuery.includes("正位") ? "正位" : "",
    normalizedQuery.includes("赛尔特") ? "赛尔特" : "",
  ]);
}

function getSelectedCardTerms(cardId: string | undefined) {
  if (!cardId) {
    return [];
  }

  const card = findCardById(cardId);

  if (!card) {
    return [cardId];
  }

  return unique([
    card.id,
    card.name,
    card.englishName,
    ...card.englishName.toLowerCase().split(/\s+/),
  ]);
}

function scoreText(text: string, terms: string[], weight: number) {
  const normalizedText = normalize(text);

  return terms.reduce(
    (sum, term) => sum + (normalizedText.includes(normalize(term)) ? weight : 0),
    0,
  );
}

function scorePageIdentity(
  page: EncyclopediaWikiPage,
  queryTerms: string[],
  selectedCardTerms: string[],
) {
  const identityText = [
    page.title,
    page.cardId ?? "",
    page.spreadId ?? "",
    page.path,
  ].join(" ");

  return (
    scoreText(identityText, queryTerms, 8)
    + scoreText(identityText, selectedCardTerms, 12)
  );
}

function buildExcerpt(content: string) {
  const compact = content
    .replace(/\[来源:\s*[^\]]+\]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (compact.length <= MAX_EXCERPT_LENGTH) {
    return compact;
  }

  return `${compact.slice(0, MAX_EXCERPT_LENGTH - 1)}…`;
}

function toRetrievedSource(item: ScoredSection): EncyclopediaRetrievedSource {
  const content = `${item.section.heading}\n${item.section.content}`;

  return {
    title: item.page.title,
    path: item.page.path,
    type: item.page.type,
    source_ids: item.page.sourceIds,
    excerpt: buildExcerpt(item.section.content),
    content,
  };
}

export function retrieveEncyclopediaSources({
  pages,
  query,
  cardId,
  limit = 5,
}: {
  pages: EncyclopediaWikiPage[];
  query: string;
  cardId?: string;
  limit?: number;
}) {
  const queryTerms = extractQueryTerms(query);
  const selectedCardTerms = getSelectedCardTerms(cardId);
  const scoredSections: ScoredSection[] = [];

  for (const page of pages) {
    const identityScore = scorePageIdentity(page, queryTerms, selectedCardTerms);

    for (const section of page.sections) {
      const sectionScore =
        identityScore
        + scoreText(section.heading, queryTerms, 5)
        + scoreText(section.content, queryTerms, 2)
        + scoreText(section.content, selectedCardTerms, 3);

      if (sectionScore > 0) {
        scoredSections.push({ page, section, score: sectionScore });
      }
    }
  }

  const byPage = new Map<string, ScoredSection>();

  for (const item of scoredSections.sort((a, b) => b.score - a.score)) {
    if (!byPage.has(item.page.path)) {
      byPage.set(item.page.path, item);
    }
  }

  return [...byPage.values()]
    .slice(0, limit)
    .map((item) => toRetrievedSource(item));
}

export function deriveRelatedItems(sources: EncyclopediaSource[]) {
  return {
    related_cards: sources
      .filter((source) => source.type === "card")
      .map((source) => source.title)
      .slice(0, 5),
    related_concepts: sources
      .filter((source) => source.type === "concept")
      .map((source) => source.title)
      .slice(0, 5),
    related_spreads: sources
      .filter((source) => source.type === "spread")
      .map((source) => source.title)
      .slice(0, 5),
  };
}
