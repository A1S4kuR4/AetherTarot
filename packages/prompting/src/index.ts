import type { DrawnCard, Spread } from "@aethertarot/shared-types";

export function buildReadingMarkdown(
  question: string,
  spread: Spread,
  drawnCards: DrawnCard[],
) {
  const cardSections = drawnCards
    .map((drawnCard) => {
      const position = spread.positions.find(
        (item) => item.id === drawnCard.positionId,
      );
      const keywords = drawnCard.isReversed
        ? drawnCard.card.reversedKeywords
        : drawnCard.card.uprightKeywords;
      const orientation = drawnCard.isReversed ? "逆位" : "正位";

      return `### ${position?.name ?? "未知位置"}：${drawnCard.card.name}（${orientation}）

这张牌把问题带回 **${keywords.slice(0, 2).join("、")}** 的主题。${position?.description ?? "它提醒你留意这个位置所指向的层面。"}  
牌面的底色更像是在邀请你观察：${drawnCard.card.description}
`;
    })
    .join("\n");

  const allKeywords = drawnCards.flatMap((drawnCard) =>
    drawnCard.isReversed
      ? drawnCard.card.reversedKeywords.slice(0, 2)
      : drawnCard.card.uprightKeywords.slice(0, 2),
  );

  const synthesisKeywords = [...new Set(allKeywords)].slice(0, 4).join("、");

  return `## 启示之问

你带来的问题是：“${question}”。  
${spread.name} 像一面缓慢显影的镜子，它没有急着给出结论，而是在邀请你先看见当前处境里的 **${synthesisKeywords || "情绪、节奏与选择"}**。

## 符号解析

${cardSections}

## 能量连接

这些牌并没有把你推向单一答案，而是在共同勾勒一种变化中的轨迹。  
你会发现，有些能量在提醒你先稳住内在的判断，有些能量则鼓励你把迟疑翻译成更清晰的行动。真正重要的不是“事情会不会发生”，而是你准备以怎样的姿态回应它。

## 最终合成

这组牌更像是一个温和而明确的提示：先承认你已经感受到的部分，再决定你愿意投入什么。  
如果你愿意，把接下来一周当成一次小范围实验，观察哪些选择让你更接近平静、诚实与连贯，而不是急着追求某个被许诺的终点。`;
}
