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
  ReadingDraft,
  ReadingGenerationCallOptions,
  ReadingProvider,
  RepairStageRequest,
} from "@/server/reading/types";
import type {
  CardInsightDraft,
  CompactReadingDraft,
  FinalSynthesisDraft,
  ReadingStageDraft,
  SynthesisDraft,
} from "@/server/reading/generation-contracts";

function toCardInsights(draft: ReadingDraft): CardInsightDraft[] {
  return draft.cards.map((card, index) => ({
    index,
    interpretation: card.interpretation,
    evidence_refs: draft.grounding_claims?.find(
      (claim) => claim.path === `cards.${index}.interpretation`,
    )?.source_refs,
  }));
}

function toSynthesis(draft: ReadingDraft): SynthesisDraft {
  return {
    themes: draft.themes,
    synthesis: draft.synthesis,
    reflective_guidance: draft.reflective_guidance,
    follow_up_questions: draft.follow_up_questions,
    confidence_note: draft.confidence_note ?? "牌面只提供反思线索，请结合现实信息理解。",
    evidence_refs: draft.grounding_claims?.find(
      (claim) => claim.path === "synthesis",
    )?.source_refs,
  };
}

export class PlaceholderReadingProvider implements ReadingProvider {
  async generateInitialRead(context: HydratedReadingContext) {
    return buildPlaceholderInitialReadingDraft({
      question: context.question,
      questionType: context.questionType,
      agentProfile: context.agentProfile,
      spread: context.spread,
      drawnCards: context.drawnCards,
      priorSessionCapsule: context.priorSessionCapsule,
      sessionMemory: context.sessionMemory,
      knowledgeGrounding: context.knowledgeGrounding,
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
      sessionMemory: context.sessionMemory,
      knowledgeGrounding: context.knowledgeGrounding,
    });
  }

  async generateCompactRead(
    context: HydratedReadingContext,
    _options: ReadingGenerationCallOptions,
  ): Promise<CompactReadingDraft> {
    void _options;
    const draft = await this.generateInitialRead(context);
    return {
      card_insights: toCardInsights(draft),
      synthesis: toSynthesis(draft),
    };
  }

  async generateCardInsights(
    context: HydratedReadingContext,
    _options: ReadingGenerationCallOptions,
  ) {
    void _options;
    return toCardInsights(await this.generateInitialRead(context));
  }

  async generateSynthesis(
    context: HydratedReadingContext,
    _cardInsights: CardInsightDraft[],
    _options: ReadingGenerationCallOptions,
  ) {
    void _cardInsights;
    void _options;
    return toSynthesis(await this.generateInitialRead(context));
  }

  async refineFinalSynthesis(
    context: FinalReadingContext,
    _options: ReadingGenerationCallOptions,
  ): Promise<FinalSynthesisDraft> {
    void _options;
    return toSynthesis(await this.generateFinalRead(context));
  }

  async repairStage(
    request: RepairStageRequest,
    options: ReadingGenerationCallOptions,
  ): Promise<ReadingStageDraft> {
    if (request.stage === "compact") {
      return this.generateCompactRead(request.context, options);
    }
    if (request.stage === "card_insights") {
      return this.generateCardInsights(request.context, options);
    }
    if (request.stage === "synthesis") {
      return this.generateSynthesis(
        request.context,
        request.cardInsights ?? [],
        options,
      );
    }
    if (request.stage === "final_synthesis" && "initialReading" in request.context) {
      return this.refineFinalSynthesis(request.context, options);
    }
    throw new ReadingServiceError(
      "generation_failed",
      `placeholder provider 不支持修复 stage：${request.stage}。`,
      500,
    );
  }
}

export function getReadingProvider(): ReadingProvider {
  const configuredProvider =
    (process.env.AETHERTAROT_READING_PROVIDER ?? "placeholder").trim();

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
