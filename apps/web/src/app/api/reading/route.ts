import type { DrawnCard, Spread, TarotCard } from "@/types";

type ReadingRequestPayload = {
  question?: unknown;
  spread?: unknown;
  drawnCards?: unknown;
};

function isSpread(value: unknown): value is Spread {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<Spread>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    Array.isArray(candidate.positions)
  );
}

function isInterpretationCard(value: unknown): value is Pick<
  TarotCard,
  | "id"
  | "name"
  | "englishName"
  | "description"
  | "uprightKeywords"
  | "reversedKeywords"
> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<TarotCard>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.englishName === "string" &&
    typeof candidate.description === "string" &&
    Array.isArray(candidate.uprightKeywords) &&
    candidate.uprightKeywords.every((keyword) => typeof keyword === "string") &&
    Array.isArray(candidate.reversedKeywords) &&
    candidate.reversedKeywords.every((keyword) => typeof keyword === "string")
  );
}

function isDrawnCardArray(value: unknown): value is DrawnCard[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const candidate = item as Partial<DrawnCard>;
      return (
        typeof candidate.positionId === "string" &&
        typeof candidate.isReversed === "boolean" &&
        !!candidate.card &&
        typeof candidate.card === "object"
      );
    })
  );
}

function hasCompleteInterpretationCards(
  drawnCards: DrawnCard[],
): drawnCards is DrawnCard[] {
  return drawnCards.every((drawnCard) => isInterpretationCard(drawnCard.card));
}

function formatInterpretation(
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

export async function POST(request: Request) {
  let payload: ReadingRequestPayload;

  try {
    payload = (await request.json()) as ReadingRequestPayload;
  } catch {
    return Response.json(
      { error: "请求体不是有效的 JSON。" },
      { status: 400 },
    );
  }

  const question =
    typeof payload.question === "string" ? payload.question.trim() : "";
  const { spread, drawnCards } = payload;

  if (!question || !isSpread(spread) || !isDrawnCardArray(drawnCards)) {
    return Response.json(
      { error: "缺少必要字段：question、spread、drawnCards。" },
      { status: 400 },
    );
  }

  if (drawnCards.length === 0) {
    return Response.json(
      { error: "drawnCards 至少需要包含一张牌。" },
      { status: 400 },
    );
  }

  if (!hasCompleteInterpretationCards(drawnCards)) {
    return Response.json(
      { error: "drawnCards 中的 card 结构不完整。" },
      { status: 400 },
    );
  }

  const allowedPositionIds = new Set(spread.positions.map((position) => position.id));

  if (
    drawnCards.some((drawnCard) => !allowedPositionIds.has(drawnCard.positionId))
  ) {
    return Response.json(
      { error: "drawnCards 包含不属于当前牌阵的位置。" },
      { status: 400 },
    );
  }

  return Response.json({
    interpretation: formatInterpretation(question, spread, drawnCards),
  });
}
