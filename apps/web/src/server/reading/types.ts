import type {
  AgentProfile,
  DrawnCard,
  FollowupAnswer,
  QuestionType,
  Spread,
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
>;

export interface HydratedReadingContext {
  question: string;
  questionType: QuestionType;
  agentProfile: AgentProfile;
  spread: Spread;
  drawnCards: DrawnCard[];
}

export interface FinalReadingContext extends HydratedReadingContext {
  initialReading: StructuredReading;
  followupAnswers: FollowupAnswer[];
}

export interface ReadingProvider {
  generateInitialRead(context: HydratedReadingContext): Promise<ReadingDraft>;
  generateFinalRead(context: FinalReadingContext): Promise<ReadingDraft>;
}
