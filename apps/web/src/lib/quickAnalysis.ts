import type { DrawnCard } from "@aethertarot/shared-types";

export interface QuickAnalysis {
  core: string;
  keywords: string[];
  action: string;
  boundary: string;
}

function extractFirstSentence(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  const match = normalized.match(/^.+?[。！？.!?]/);

  return match?.[0] ?? normalized;
}

function summarizeSymbolism(symbolism: string[]) {
  const [firstSymbol] = symbolism
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return firstSymbol ?? "";
}

function buildActionPrompt({
  cardName,
  isReversed,
  keywords,
  symbol,
}: {
  cardName: string;
  isReversed: boolean;
  keywords: string[];
  symbol: string;
}): string {
  if (keywords.length === 0) {
    return symbol
      ? `今天遇到一个让你停下来的瞬间时，回想一下 ${cardName} 的这个画面：${symbol}`
      : `今天遇到一个让你停下来的瞬间时，回想一下 ${cardName} 的意象。`;
  }

  const primaryKeyword = keywords[0];

  if (isReversed) {
    return `今天先留意“${primaryKeyword}”是不是让你变得紧绷或失衡；有条件的话，先把反应放慢一步。`;
  }

  if (symbol) {
    return `今天可以借 ${cardName} 的画面提醒自己：${symbol} 先选择一个能呼应“${primaryKeyword}”的小行动。`;
  }

  return `今天当“${primaryKeyword}”浮现时，先选择一个现实中可观察、可收回的小行动。`;
}

export function buildLocalQuickAnalysis(drawnCard: DrawnCard): QuickAnalysis {
  const { card, isReversed } = drawnCard;
  const orientationLabel = isReversed ? "逆位" : "正位";
  const keywords = isReversed
    ? card.reversedKeywords.slice(0, 3)
    : card.uprightKeywords.slice(0, 3);

  const firstSentence = extractFirstSentence(card.description);
  const symbol = summarizeSymbolism(card.symbolism);
  const keywordSummary = keywords.join("、") || "当下的转变";
  const core = isReversed
    ? `${card.name}（${orientationLabel}）把注意力放在“${keywordSummary}”的卡点上。${firstSentence || "它提醒你先看见哪里正在失衡，而不是急着把答案推向未来。"}`
    : `${card.name}（${orientationLabel}）把当下的主轴带向“${keywordSummary}”。${firstSentence || "它更像是在提醒你辨认已经出现的资源与方向。"}`;

  return {
    core,
    keywords,
    action: buildActionPrompt({
      cardName: card.name,
      isReversed,
      keywords,
      symbol,
    }),
    boundary: "这只是一面映照当下的镜子，不是对未来的确定承诺。",
  };
}
