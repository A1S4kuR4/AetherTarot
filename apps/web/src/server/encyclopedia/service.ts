import "server-only";

import type { EncyclopediaQueryResponse } from "@aethertarot/shared-types";
import { findCardById } from "@aethertarot/domain-tarot";
import {
  deriveRelatedItems,
  retrieveEncyclopediaSources,
} from "@/server/encyclopedia/retrieval";
import { encyclopediaQueryResponseSchema } from "@/server/encyclopedia/schemas";
import { loadEncyclopediaWikiPages } from "@/server/encyclopedia/wiki";
import {
  getEncyclopediaProvider,
  type EncyclopediaProvider,
} from "@/server/encyclopedia/provider";
import {
  assertSafetyAllowsGeneration,
  assessSafetyText,
} from "@/server/safety/policy";
import {
  applyEncyclopediaGeneratedContentAction,
  mergeGeneratedContentAction,
  reviewEncyclopediaGeneratedAnswer,
} from "@/server/safety/output-validator";
import {
  getLLMSafetyReviewer,
  mergeInputSafetyAssessment,
  type SafetyInputReviewVerdict,
  type SafetyReviewExecution,
  type SafetyReviewer,
} from "@/server/safety/llm-reviewer";

export interface GenerateEncyclopediaAnswerOptions {
  provider?: EncyclopediaProvider;
  loadPages?: typeof loadEncyclopediaWikiPages;
  safetyReviewer?: SafetyReviewer;
  inputSafetyReview?: SafetyReviewExecution<SafetyInputReviewVerdict>;
  signal?: AbortSignal;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function buildNoSourceResponse(
  boundaryNote: string | null,
): EncyclopediaQueryResponse {
  return {
    answer:
      "我暂时没有在当前塔罗百科资料中找到足够可靠的对应条目。你可以换成更具体的牌名、概念或牌阵来问，例如“愚者逆位怎么理解”或“赛尔特十字的结果位是什么意思”。",
    sources: [],
    related_cards: [],
    related_concepts: [],
    related_spreads: [],
    boundary_note: boundaryNote,
  };
}

export async function generateEncyclopediaAnswer({
  query,
  cardId,
}: {
  query: string;
  cardId?: string;
}, options: GenerateEncyclopediaAnswerOptions = {}) {
  const deterministicSafety = assessSafetyText(query);
  assertSafetyAllowsGeneration(deterministicSafety);
  const reviewer = options.safetyReviewer ?? getLLMSafetyReviewer();
  const inputReview = options.inputSafetyReview ?? await reviewer.reviewInput({
    question: query,
    followupAnswers: [],
    deterministic: deterministicSafety,
    signal: options.signal,
  });
  const safetyAssessment = inputReview.applied
    ? mergeInputSafetyAssessment(deterministicSafety, inputReview.verdict)
    : deterministicSafety;
  assertSafetyAllowsGeneration(safetyAssessment);
  const boundaryNote = safetyAssessment.safetyNote;
  const pages = await (options.loadPages ?? loadEncyclopediaWikiPages)();
  const sources = retrieveEncyclopediaSources({ pages, query, cardId });

  if (sources.length === 0) {
    return encyclopediaQueryResponseSchema.parse(
      buildNoSourceResponse(boundaryNote),
    );
  }

  const provider = options.provider ?? getEncyclopediaProvider();
  const cardName = cardId
    ? (() => {
        const card = findCardById(cardId);
        return card ? `${card.name} (${card.englishName})` : null;
      })()
    : null;
  const draft = await provider.generateAnswer({
    query,
    sources,
    boundaryNote,
    cardName,
  });
  const related = deriveRelatedItems(sources);
  const generatedContentReview = reviewEncyclopediaGeneratedAnswer({
    answer: draft.answer,
    boundaryNote,
  });
  const outputReview = await reviewer.reviewEncyclopediaOutput({
    answer: draft.answer,
    boundaryNote,
    deterministicAction: generatedContentReview.action,
    deterministicViolations: generatedContentReview.violations,
    signal: options.signal,
  });
  const outputAction = outputReview.applied
    ? mergeGeneratedContentAction(
      generatedContentReview.action,
      outputReview.verdict.action,
    )
    : generatedContentReview.action;
  const reviewedOutput = applyEncyclopediaGeneratedContentAction({
    answer: draft.answer,
    boundaryNote,
    action: outputAction,
  });

  return encyclopediaQueryResponseSchema.parse({
    answer: reviewedOutput.answer,
    sources: sources.map((source) => ({
      title: source.title,
      path: source.path,
      type: source.type,
      source_ids: source.source_ids,
      excerpt: source.excerpt,
    })),
    related_cards: uniqueStrings([
      ...draft.related_cards,
      ...related.related_cards,
    ]).slice(0, 5),
    related_concepts: uniqueStrings([
      ...draft.related_concepts,
      ...related.related_concepts,
    ]).slice(0, 5),
    related_spreads: uniqueStrings([
      ...draft.related_spreads,
      ...related.related_spreads,
    ]).slice(0, 5),
    boundary_note: reviewedOutput.boundaryNote,
  });
}
