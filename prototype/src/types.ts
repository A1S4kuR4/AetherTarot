export type Phase = 'home' | 'ritual' | 'reveal' | 'interpretation' | 'history' | 'encyclopedia';

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

export interface Reading {
  id: string;
  date: string;
  question: string;
  spreadId: string;
  cards: { positionId: string; cardId: string; isReversed: boolean }[];
  interpretation: string;
}
