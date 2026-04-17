import "server-only";

import {
  buildPlaceholderFinalReadingDraft,
  buildPlaceholderInitialReadingDraft,
} from "@aethertarot/prompting";
import { ReadingServiceError } from "@/server/reading/errors";
import { createLlmReadingProviderFromEnv } from "@/server/reading/llm-provider";
import type {
  FinalReadingContext,
  HydratedReadingContext,
  ReadingProvider,
} from "@/server/reading/types";

class PlaceholderReadingProvider implements ReadingProvider {
  async generateInitialRead(context: HydratedReadingContext) {
    return buildPlaceholderInitialReadingDraft({
      question: context.question,
      questionType: context.questionType,
      agentProfile: context.agentProfile,
      spread: context.spread,
      drawnCards: context.drawnCards,
      priorSessionCapsule: context.priorSessionCapsule,
    });
  }

  async generateFinalRead(context: FinalReadingContext) {
    return buildPlaceholderFinalReadingDraft({
      question: context.question,
      questionType: context.questionType,
      agentProfile: context.agentProfile,
      initialReading: context.initialReading,
      followupAnswers: context.followupAnswers,
      priorSessionCapsule: context.priorSessionCapsule,
    });
  }
}

export function getReadingProvider(): ReadingProvider {
  const configuredProvider =
    process.env.AETHERTAROT_READING_PROVIDER ?? "placeholder";

  if (configuredProvider === "placeholder") {
    return new PlaceholderReadingProvider();
  }

  if (configuredProvider === "llm") {
    return createLlmReadingProviderFromEnv();
  }

  throw new ReadingServiceError(
    "provider_unavailable",
    `当前未配置可用的 reading provider：${configuredProvider}。`,
    503,
  );
}
