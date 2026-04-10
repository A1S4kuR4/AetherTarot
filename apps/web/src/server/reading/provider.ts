import "server-only";

import {
  buildPlaceholderFinalReadingDraft,
  buildPlaceholderInitialReadingDraft,
} from "@aethertarot/prompting";
import type {
  AgentProfile,
  DrawnCard,
  FollowupAnswer,
  QuestionType,
  Spread,
  StructuredReading,
} from "@aethertarot/shared-types";
import { ReadingServiceError } from "@/server/reading/errors";

type PlaceholderReadingDraft = Pick<
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

interface ReadingProvider {
  generateInitialRead(context: HydratedReadingContext): Promise<PlaceholderReadingDraft>;
  generateFinalRead(context: FinalReadingContext): Promise<PlaceholderReadingDraft>;
}

class PlaceholderReadingProvider implements ReadingProvider {
  async generateInitialRead(context: HydratedReadingContext) {
    return buildPlaceholderInitialReadingDraft({
      question: context.question,
      questionType: context.questionType,
      agentProfile: context.agentProfile,
      spread: context.spread,
      drawnCards: context.drawnCards,
    });
  }

  async generateFinalRead(context: FinalReadingContext) {
    return buildPlaceholderFinalReadingDraft({
      question: context.question,
      questionType: context.questionType,
      agentProfile: context.agentProfile,
      initialReading: context.initialReading,
      followupAnswers: context.followupAnswers,
    });
  }
}

export function getReadingProvider(): ReadingProvider {
  const configuredProvider =
    process.env.AETHERTAROT_READING_PROVIDER ?? "placeholder";

  if (configuredProvider !== "placeholder") {
    throw new ReadingServiceError(
      "provider_unavailable",
      `当前未配置可用的 reading provider：${configuredProvider}。`,
      503,
    );
  }

  return new PlaceholderReadingProvider();
}