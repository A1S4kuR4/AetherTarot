export interface TarotCard {
  id: string;
  name: string;
  englishName: string;
  arcana: string;
  element: string;
  description: string;
  uprightKeywords: string[];
  reversedKeywords: string[];
  symbolism: string[];
  imageUrl: string;
}

export interface SpreadPosition {
  id: string;
  name: string;
  description: string;
}

export interface Spread {
  id: string;
  name: string;
  englishName: string;
  description: string;
  positions: SpreadPosition[];
  icon: string;
}

export interface DrawnCard {
  positionId: string;
  card: TarotCard;
  isReversed: boolean;
}

export interface Reading {
  id: string;
  date: string;
  question: string;
  spreadId: string;
  cards: { positionId: string; cardId: string; isReversed: boolean }[];
  interpretation: string;
}

export interface ReadingRequestPayload {
  question: string;
  spread: Spread;
  drawnCards: DrawnCard[];
}

export interface ReadingResponsePayload {
  interpretation: string;
}
