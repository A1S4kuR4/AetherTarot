import { buildReadingMarkdown } from "@aethertarot/prompting";
import type {
  DrawnCard,
  ReadingRequestPayload,
  ReadingResponsePayload,
  Spread,
  TarotCard,
} from "@aethertarot/shared-types";

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

export async function POST(request: Request) {
  let payload: Partial<ReadingRequestPayload>;

  try {
    payload = (await request.json()) as Partial<ReadingRequestPayload>;
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

  const allowedPositionIds = new Set(
    spread.positions.map((position) => position.id),
  );

  if (
    drawnCards.some((drawnCard) => !allowedPositionIds.has(drawnCard.positionId))
  ) {
    return Response.json(
      { error: "drawnCards 包含不属于当前牌阵的位置。" },
      { status: 400 },
    );
  }

  const responsePayload: ReadingResponsePayload = {
    interpretation: buildReadingMarkdown(question, spread, drawnCards),
  };

  return Response.json(responsePayload);
}
