import type {
  AgentProfile,
  DrawnCard,
  FollowupAnswer,
  QuestionType,
  Spread,
  SessionMemory,
  StructuredReading,
} from "@aethertarot/shared-types";
import type {
  CardInsightDraft,
  CompactReadingDraft,
  FinalSynthesisDraft,
  ReadingStageDraft,
  SynthesisDraft,
} from "@/server/reading/generation-contracts";
import type {
  ReadingGenerationStage,
} from "@/server/reading/errors";

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

export interface ReadingGenerationCallOptions {
  runId: string;
  stageId: string;
  attemptId: string;
  stage: ReadingGenerationStage;
  attempt: number;
  kind: "generate" | "retry" | "repair";
  signal?: AbortSignal;
}

export interface RepairStageRequest {
  stage: ReadingGenerationStage;
  context: HydratedReadingContext | FinalReadingContext;
  invalidPayload?: unknown;
  issues: string[];
  cardInsights?: CardInsightDraft[];
}

export interface ReadingProvider {
  generateInitialRead(
    context: HydratedReadingContext,
    options?: ReadingGenerationCallOptions,
  ): Promise<ReadingDraft>;
  generateFinalRead(
    context: FinalReadingContext,
    options?: ReadingGenerationCallOptions,
  ): Promise<ReadingDraft>;
  generateCompactRead(
    context: HydratedReadingContext,
    options: ReadingGenerationCallOptions,
  ): Promise<CompactReadingDraft>;
  generateCardInsights(
    context: HydratedReadingContext,
    options: ReadingGenerationCallOptions,
  ): Promise<CardInsightDraft[]>;
  generateSynthesis(
    context: HydratedReadingContext,
    cardInsights: CardInsightDraft[],
    options: ReadingGenerationCallOptions,
  ): Promise<SynthesisDraft>;
  refineFinalSynthesis(
    context: FinalReadingContext,
    options: ReadingGenerationCallOptions,
  ): Promise<FinalSynthesisDraft>;
  repairStage(
    request: RepairStageRequest,
    options: ReadingGenerationCallOptions,
  ): Promise<ReadingStageDraft>;
}
