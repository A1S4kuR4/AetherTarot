import type {
  AgentProfile,
  DrawnCard,
  FollowupAnswer,
  QuestionType,
  Spread,
  SessionMemory,
  StructuredReading,
} from "@aethertarot/shared-types";

export type ReadingDraft = Pick<
  StructuredReading,
  | "cards"
  | "themes"
  | "synthesis"
  | "reflective_guidance"
  | "follow_up_questions"
  | "confidence_note"
> & {
  grounding_claims?: Array<{
    path: `cards.${number}.interpretation` | "synthesis";
    source_refs: string[];
  }>;
};

export interface ReadingKnowledgeGroundingChunk {
  id: string;
  title: string;
  content: string;
  source: string;
  source_ids: string[];
  ref: string;
  kind: "wiki" | "authority_card";
  card: string;
  orientation: "upright" | "reversed" | "unknown";
  spread?: string;
  score: number;
  confidence: "low" | "medium" | "high";
}

export interface ReadingKnowledgeGrounding {
  status: "retrieved" | "degraded" | "none";
  chunks: ReadingKnowledgeGroundingChunk[];
}

export interface HydratedReadingContext {
  question: string;
  questionType: QuestionType;
  agentProfile: AgentProfile;
  spread: Spread;
  drawnCards: DrawnCard[];
  priorSessionCapsule: string | null;
  sessionMemory: SessionMemory | null;
  knowledgeGrounding: ReadingKnowledgeGrounding;
}

export interface FinalReadingContext extends HydratedReadingContext {
  initialReading: StructuredReading;
  followupAnswers: FollowupAnswer[];
}

export interface ReadingProvider {
  generateInitialRead(context: HydratedReadingContext): Promise<ReadingDraft>;
  generateFinalRead(context: FinalReadingContext): Promise<ReadingDraft>;
}
