import "server-only";

import type {
  CardOrientation,
  StructuredReading,
} from "@aethertarot/shared-types";

const DEFAULT_ADVICE_MAX_LENGTH = 120;
const GUIDANCE_ITEM_MAX_LENGTH = 72;
const SENTENCE_BOUNDARY_PATTERN = /[。！？!?；;]/;

export const GENERIC_LAST_ADVICE_FALLBACK =
  "本轮建议围绕当前主题保持观察、澄清问题，并避免过早下结论。";

export interface ExtractLastAdviceSummaryInput {
  reading: StructuredReading;
  topic?: string;
  cards?: Array<{
    id: string;
    name?: string;
    orientation?: CardOrientation;
  }>;
}

function normalizeAdviceText(value: string, maxLength = DEFAULT_ADVICE_MAX_LENGTH) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return undefined;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function extractFirstSentence(value: string, maxLength = DEFAULT_ADVICE_MAX_LENGTH) {
  const normalized = normalizeAdviceText(value, maxLength * 2);

  if (!normalized) {
    return undefined;
  }

  const boundaryIndex = normalized.search(SENTENCE_BOUNDARY_PATTERN);
  const firstSentence = boundaryIndex >= 0
    ? normalized.slice(0, boundaryIndex + 1)
    : normalized;

  return normalizeAdviceText(firstSentence, maxLength);
}

function extractGuidanceSummary(reading: StructuredReading) {
  const guidance = reading.reflective_guidance
    .map((item) => extractFirstSentence(item, GUIDANCE_ITEM_MAX_LENGTH))
    .filter((item): item is string => Boolean(item))
    .slice(0, 2);

  return normalizeAdviceText(guidance.join(" "), DEFAULT_ADVICE_MAX_LENGTH);
}

export function extractLastAdviceSummary({
  reading,
}: ExtractLastAdviceSummaryInput): string | undefined {
  const guidanceSummary = extractGuidanceSummary(reading);

  if (guidanceSummary) {
    return guidanceSummary;
  }

  return extractFirstSentence(reading.synthesis, DEFAULT_ADVICE_MAX_LENGTH);
}
