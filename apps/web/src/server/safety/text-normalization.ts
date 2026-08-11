export type SafetyTextSegment = {
  normalized: string;
  compact: string;
  searchable: string;
};

const CONTRAST_BOUNDARY = /\b(?:but|however|yet)\b|(?:但是|但|然而|不过|却)/giu;
const SENTENCE_BOUNDARY = /[。！？!?；;\r\n]+|(?<=[A-Za-z])\.(?=\s|$)/gu;
const OBFUSCATED_ENGLISH_DOT = /(?<=[A-Za-z])\.(?=[A-Za-z])/gu;

export function normalizeSafetyText(text: string) {
  return text
    .normalize("NFKC")
    .replace(/\p{Cf}/gu, "")
    .replace(/[’‘]/gu, "'")
    .replace(OBFUSCATED_ENGLISH_DOT, " ")
    .replace(/[\p{Z}\s]+/gu, " ")
    .trim();
}

export function segmentSafetyText(text: string): SafetyTextSegment[] {
  const normalized = normalizeSafetyText(text);
  if (!normalized) return [];

  return normalized
    .split(SENTENCE_BOUNDARY)
    .flatMap((sentence) => sentence.split(CONTRAST_BOUNDARY))
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const compact = segment.replace(/[\s\p{P}\p{S}]+/gu, "");
      return {
        normalized: segment,
        compact,
        searchable: `${segment}\n${compact}`,
      };
    });
}
