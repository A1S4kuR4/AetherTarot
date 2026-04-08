import "server-only";

import { buildPlaceholderReadingDraft } from "@aethertarot/prompting";
import type {
  DrawnCard,
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
  spread: Spread;
  drawnCards: DrawnCard[];
}

interface ReadingProvider {
  generate(context: HydratedReadingContext): Promise<PlaceholderReadingDraft>;
}

class PlaceholderReadingProvider implements ReadingProvider {
  async generate(context: HydratedReadingContext) {
    return buildPlaceholderReadingDraft({
      question: context.question,
      questionType: context.questionType,
      spread: context.spread,
      drawnCards: context.drawnCards,
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
