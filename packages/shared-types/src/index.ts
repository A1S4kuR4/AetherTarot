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

export type CardOrientation = "upright" | "reversed";

export type QuestionType =
  | "relationship"
  | "career"
  | "self_growth"
  | "decision"
  | "other";

export interface ReadingRequestCardInput {
  positionId: string;
  cardId: string;
  isReversed: boolean;
}

export interface ReadingRequestPayload {
  question: string;
  spreadId: string;
  drawnCards: ReadingRequestCardInput[];
}

export interface ReadingCardResult {
  card_id: string;
  name: string;
  english_name: string;
  orientation: CardOrientation;
  position_id: string;
  position: string;
  position_meaning: string;
  interpretation: string;
}

export interface StructuredReading {
  reading_id: string;
  locale: string;
  question: string;
  question_type: QuestionType;
  spread: Spread;
  cards: ReadingCardResult[];
  themes: string[];
  synthesis: string;
  reflective_guidance: string[];
  follow_up_questions: string[];
  safety_note: string | null;
  confidence_note: string | null;
  session_capsule: string | null;
}

export interface ReadingHistoryEntry {
  id: string;
  createdAt: string;
  spreadId: string;
  drawnCards: ReadingRequestCardInput[];
  reading: StructuredReading;
}

export type ReadingErrorCode =
  | "invalid_request"
  | "provider_unavailable"
  | "generation_failed";

export interface ReadingErrorPayload {
  error: {
    code: ReadingErrorCode;
    message: string;
  };
}
