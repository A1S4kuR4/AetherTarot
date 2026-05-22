import "server-only";

import { getAllCards } from "@aethertarot/domain-tarot";
import type {
  ScoredTarotKnowledgeChunk,
  TarotKnowledgeChunk,
  TarotKnowledgeOrientation,
} from "@/server/reading/knowledge/types";

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
  "含义",
]);

const TOPIC_ALIASES: Record<string, string[]> = {
  relationship: ["relationship", "关系", "情感", "亲密"],
  career: ["career", "职业", "事业", "工作", "发展"],
  self_growth: ["self_growth", "self-growth", "成长", "自我", "反思"],
  decision: ["decision", "选择", "决策", "权衡"],
  other: ["other", "主题", "当下"],
};

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function normalizeCardId(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "")
    .replace(/^the/, "");
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
  ]);
}

function getCardAliases(card: ReturnType<typeof getAllCards>[number]) {
  return unique([
    card.id,
    card.name,
    card.englishName,
    card.englishName.replace(/^The\s+/i, ""),
    ...card.englishName.toLowerCase().split(/\s+/),
  ]);
}

function detectCardsFromQuery(query: string) {
  const normalizedQuery = normalizeCardId(query);

  return getAllCards()
    .filter((card) =>
      getCardAliases(card).some((alias) => {
        const normalizedAlias = normalizeCardId(alias);

        return (
          normalizedAlias.length >= 2
          && normalizedQuery.includes(normalizedAlias)
        );
      }),
    )
    .map((card) => card.id);
}

function sameCard(left: string | undefined, right: string | undefined) {
  if (!left || !right) {
    return false;
  }

  return normalizeCardId(left) === normalizeCardId(right);
}

function scoreText(text: string, terms: string[], weight: number) {
  const normalizedText = normalize(text);

  return terms.reduce(
    (sum, term) => sum + (normalizedText.includes(normalize(term)) ? weight : 0),
    0,
  );
}

function inferOrientationFromQuery(
  query: string,
  orientation?: TarotKnowledgeOrientation,
): TarotKnowledgeOrientation | undefined {
  if (orientation && orientation !== "unknown") {
    return orientation;
  }

  if (/逆位|reversed/i.test(query)) {
    return "reversed";
  }

  if (/正位|upright/i.test(query)) {
    return "upright";
  }

  return orientation;
}

function normalizeTopic(topic: string | undefined) {
  if (!topic) {
    return undefined;
  }

  const normalizedTopic = normalize(topic);

  return Object.entries(TOPIC_ALIASES).find(([, aliases]) =>
    aliases.some((alias) => normalizedTopic.includes(normalize(alias))),
  )?.[0];
}

function chunkMatchesTargetCard(
  chunk: TarotKnowledgeChunk,
  targetCardIds: string[],
) {
  return targetCardIds.some((cardId) => sameCard(chunk.card, cardId));
}

function scoreChunk({
  chunk,
  queryTerms,
  targetCardIds,
  orientation,
  topic,
}: {
  chunk: TarotKnowledgeChunk;
  queryTerms: string[];
  targetCardIds: string[];
  orientation?: TarotKnowledgeOrientation;
  topic?: string;
}) {
  let score = 0;

  if (targetCardIds.length > 0 && chunk.card) {
    score += chunkMatchesTargetCard(chunk, targetCardIds) ? 80 : -20;
  }

  if (orientation && orientation !== "unknown") {
    if (chunk.orientation === orientation) {
      score += 24;
    } else if (chunk.orientation === "unknown") {
      score += 4;
    }
  }

  if (topic && chunk.topic?.includes(topic)) {
    score += 18;
  }

  score += scoreText(chunk.title, queryTerms, 6);
  score += scoreText((chunk.tags ?? []).join(" "), queryTerms, 5);
  score += scoreText(chunk.content, queryTerms, 2);

  return score;
}

function toConfidence(score: number): ScoredTarotKnowledgeChunk["confidence"] {
  if (score >= 100) {
    return "high";
  }

  if (score >= 55) {
    return "medium";
  }

  return "low";
}

export function retrieveTarotKnowledgeChunks({
  chunks,
  query,
  card,
  orientation,
  topic,
  topK = 5,
}: {
  chunks: TarotKnowledgeChunk[];
  query: string;
  card?: string;
  orientation?: TarotKnowledgeOrientation;
  topic?: string;
  topK?: number;
}) {
  const queryTerms = extractQueryTerms(query);
  const queryCardIds = detectCardsFromQuery(query);
  const targetCardIds = queryCardIds.length > 0 ? queryCardIds : card ? [card] : [];
  const targetOrientation = inferOrientationFromQuery(query, orientation);
  const targetTopic = normalizeTopic(topic) ?? normalizeTopic(query);

  return chunks
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk({
        chunk,
        queryTerms,
        targetCardIds,
        orientation: targetOrientation,
        topic: targetTopic,
      }),
    }))
    .filter((chunk) => chunk.score >= 20)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, topK)
    .map((chunk) => ({
      ...chunk,
      score: Number(chunk.score.toFixed(2)),
      confidence: toConfidence(chunk.score),
    }));
}
