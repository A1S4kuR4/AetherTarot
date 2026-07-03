import { getAllCards } from "@aethertarot/domain-tarot";
import type { DrawnCard, TarotCard } from "@aethertarot/shared-types";

export function shuffleTarotDeck(cards: TarotCard[] = getAllCards()) {
  return [...cards].sort(() => Math.random() - 0.5);
}

export function drawRandomCardForPosition(
  deck: TarotCard[],
  positionId: string,
  options: { cardIndex?: number } = {},
): { drawnCard: DrawnCard | null; remainingDeck: TarotCard[] } {
  if (deck.length === 0) {
    return { drawnCard: null, remainingDeck: [] };
  }

  const selectedIndex = typeof options.cardIndex === "number"
    ? Math.min(Math.max(Math.trunc(options.cardIndex), 0), deck.length - 1)
    : Math.floor(Math.random() * deck.length);
  const card = deck[selectedIndex];

  if (!card) {
    return { drawnCard: null, remainingDeck: deck };
  }

  return {
    drawnCard: {
      positionId,
      card,
      isReversed: Math.random() > 0.8,
    },
    remainingDeck: deck.filter((_, index) => index !== selectedIndex),
  };
}

export function drawCardsForSpread(
  positions: Array<{ id: string }>,
): DrawnCard[] {
  let deck = shuffleTarotDeck();
  const drawnCards: DrawnCard[] = [];

  for (const position of positions) {
    const result = drawRandomCardForPosition(deck, position.id);

    if (!result.drawnCard) {
      break;
    }

    drawnCards.push(result.drawnCard);
    deck = result.remainingDeck;
  }

  return drawnCards;
}
