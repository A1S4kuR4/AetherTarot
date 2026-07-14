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
  thumbnailUrl?: string;
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

export const AGENT_PROFILE_CANONICAL_VALUES = [
  "lite",
  "standard",
  "sober",
] as const;

export const AGENT_PROFILE_LEGACY_ALIASES: Record<string, AgentProfile> = {
  quick: "lite",
  default: "standard",
  daily: "standard",
  clear: "sober",
  rational: "sober",
  professional: "sober",
};

/**
 * Strictly normalize an agent profile value.
 *
 * Returns a canonical `AgentProfile` for canonical IDs and known legacy aliases.
 * Returns `null` for unknown values, non-strings, empty/whitespace strings, `null`
 * or `undefined`.
 *
 * Use this for external API input validation where silent fallback would hide
 * client bugs or version drift.
 */
export function normalizeAgentProfile(profile: unknown): AgentProfile | null {
  if (typeof profile !== "string") {
    return null;
  }

  const trimmed = profile.trim();

  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();

  if (AGENT_PROFILE_CANONICAL_VALUES.includes(lower as AgentProfile)) {
    return lower as AgentProfile;
  }

  const mapped = AGENT_PROFILE_LEGACY_ALIASES[lower];

  if (mapped) {
    return mapped;
  }

  return null;
}

/**
 * Restore an agent profile value from stored data, drafts, or history.
 *
 * Maps canonical IDs and known legacy aliases. For unknown or malformed values,
 * safely falls back to `"standard"` (日常塔罗师) so that drafts and history remain
 * openable. The optional `onFallback` callback receives the original value and the
 * fallback canonical ID for observability/logging.
 */
export function restoreAgentProfile(
  profile: unknown,
  onFallback?: (original: unknown, fallback: AgentProfile) => void,
): AgentProfile {
  const canonical = normalizeAgentProfile(profile);

  if (canonical) {
    return canonical;
  }

  onFallback?.(profile, "standard");
  return "standard";
}

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
  thread_id?: string;
  agent_profile?: AgentProfile;
  phase?: ReadingPhase;
  draw_source?: DrawSource;
  prior_session_capsule?: string | null;
  initial_reading?: StructuredReading;
  followup_answers?: FollowupAnswer[];
}

export interface SessionMemoryCard {
  id: string;
  name?: string;
  orientation?: CardOrientation;
}

export interface SessionMemory {
  thread_id: string;
  summary?: string;
  topics: string[];
  cards: SessionMemoryCard[];
  stated_constraints: string[];
  open_questions: string[];
  last_advice_summary?: string;
  updated_at: string;
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
  | "token_limit_exceeded"
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

export type EncyclopediaSourceType = "card" | "concept" | "spread";

export interface EncyclopediaQueryRequest {
  query: string;
  cardId?: string;
}

export interface EncyclopediaSource {
  title: string;
  path: string;
  type: EncyclopediaSourceType;
  source_ids: string[];
  excerpt: string;
}

export interface EncyclopediaQueryResponse {
  answer: string;
  sources: EncyclopediaSource[];
  related_cards: string[];
  related_concepts: string[];
  related_spreads: string[];
  boundary_note: string | null;
}
