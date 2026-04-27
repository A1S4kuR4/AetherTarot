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

export type AgentProfile = "lite" | "standard" | "sober";

export type ReadingPhase = "initial" | "final";

export type DrawSource = "digital_random" | "offline_manual";

export interface ReadingRequestCardInput {
  positionId: string;
  cardId: string;
  isReversed: boolean;
}

export interface FollowupAnswer {
  question: string;
  answer: string;
}

export interface ReadingRequestPayload {
  question: string;
  spreadId: string;
  drawnCards: ReadingRequestCardInput[];
  agent_profile?: AgentProfile;
  phase?: ReadingPhase;
  draw_source?: DrawSource;
  prior_session_capsule?: string | null;
  initial_reading?: StructuredReading;
  followup_answers?: FollowupAnswer[];
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

export type PresentationMode = "standard" | "void_narrative" | "sober_anchor";

export interface StructuredReading {
  reading_id: string;
  locale: string;
  question: string;
  question_type: QuestionType;
  agent_profile: AgentProfile;
  reading_phase: ReadingPhase;
  requires_followup: boolean;
  initial_reading_id: string | null;
  followup_answers: FollowupAnswer[] | null;
  spread: Spread;
  cards: ReadingCardResult[];
  themes: string[];
  synthesis: string;
  reflective_guidance: string[];
  follow_up_questions: string[];
  safety_note: string | null;
  confidence_note: string | null;
  session_capsule: string | null;
  sober_check?: string | null;
  presentation_mode?: PresentationMode;
}

export interface ReadingHistoryEntry {
  id: string;
  createdAt: string;
  spreadId: string;
  drawSource?: DrawSource;
  drawnCards: ReadingRequestCardInput[];
  reading: StructuredReading;
  user_notes?: string;
}

export type ReadingErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "cost_limit_exceeded"
  | "provider_unavailable"
  | "generation_failed"
  | "safety_intercept";

export interface ReadingErrorPayload {
  error: {
    code: ReadingErrorCode;
    message: string;
    details?: any;
    intercept_reason?: string;
    referral_links?: string[];
  };
}
