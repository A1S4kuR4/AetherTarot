export type SafetyTextSegment = {
  normalized: string;
  compact: string;
  searchable: string;
  compactOffsets: Array<{ start: number; end: number }>;
};

export type SafetyPattern =
  | { form: "normalized"; pattern: RegExp }
  | { form: "compact"; pattern: RegExp };

export type SafetyMatchSpan = {
  start: number;
  end: number;
};

export type SafetyCoreRule = {
  corePatterns: readonly SafetyPattern[];
  dangerCuePatterns?: readonly SafetyPattern[];
  safeContextPatterns?: readonly SafetyPattern[];
  requireDangerCue?: boolean;
  maxCueDistance?: number;
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

function compactSafetyText(normalized: string) {
  let compact = "";
  const compactOffsets: Array<{ start: number; end: number }> = [];

  for (let index = 0; index < normalized.length;) {
    const codePoint = normalized.codePointAt(index);
    if (codePoint === undefined) break;
    const character = String.fromCodePoint(codePoint);
    const end = index + character.length;
    if (!/[\s\p{P}\p{S}]/u.test(character)) {
      compact += character;
      for (let offset = 0; offset < character.length; offset += 1) {
        compactOffsets.push({ start: index, end });
      }
    }
    index = end;
  }

  return { compact, compactOffsets };
}

function matchAll(pattern: RegExp, text: string) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return text.matchAll(new RegExp(pattern.source, flags));
}

export function findSafetyMatchSpans(
  segment: SafetyTextSegment,
  patterns: readonly SafetyPattern[],
): SafetyMatchSpan[] {
  const spans: SafetyMatchSpan[] = [];

  for (const rule of patterns) {
    const target = rule.form === "normalized" ? segment.normalized : segment.compact;
    for (const match of matchAll(rule.pattern, target)) {
      if (match.index === undefined || !match[0]) continue;
      if (rule.form === "normalized") {
        spans.push({ start: match.index, end: match.index + match[0].length });
        continue;
      }
      const first = segment.compactOffsets[match.index];
      const last = segment.compactOffsets[match.index + match[0].length - 1];
      if (first && last) spans.push({ start: first.start, end: last.end });
    }
  }

  return spans;
}

export function hasSafetyMatch(
  segment: SafetyTextSegment,
  patterns: readonly SafetyPattern[],
) {
  return findSafetyMatchSpans(segment, patterns).length > 0;
}

export function hasUncoveredSafetyMatch(
  segment: SafetyTextSegment,
  dangerousPatterns: readonly SafetyPattern[],
  safeContextPatterns: readonly SafetyPattern[],
) {
  const safeSpans = findSafetyMatchSpans(segment, safeContextPatterns);
  return findSafetyMatchSpans(segment, dangerousPatterns).some((danger) =>
    !safeSpans.some((safe) => safe.start <= danger.start && safe.end >= danger.end)
  );
}

function spanContains(container: SafetyMatchSpan, target: SafetyMatchSpan) {
  return container.start <= target.start && container.end >= target.end;
}

function spanDistance(left: SafetyMatchSpan, right: SafetyMatchSpan) {
  if (left.end < right.start) return right.start - left.end;
  if (right.end < left.start) return left.start - right.end;
  return 0;
}

export function hasUnsafeSafetyCore(
  segment: SafetyTextSegment,
  rule: SafetyCoreRule,
) {
  const cores = findSafetyMatchSpans(segment, rule.corePatterns);
  const cues = findSafetyMatchSpans(segment, rule.dangerCuePatterns ?? []);
  const safeContexts = findSafetyMatchSpans(segment, rule.safeContextPatterns ?? []);
  const maxCueDistance = rule.maxCueDistance ?? 24;

  return cores.some((core) => {
    const coveringSafeContexts = safeContexts.filter((safe) =>
      spanContains(safe, core)
    );
    const nearbyCues = cues.filter((cue) =>
      cue.start <= core.start && spanDistance(cue, core) <= maxCueDistance
    );
    const hasUncoveredDangerCue = nearbyCues.some((cue) =>
      !coveringSafeContexts.some((safe) => spanContains(safe, cue))
    );

    if (hasUncoveredDangerCue) return true;
    if (coveringSafeContexts.length > 0) return false;
    return rule.requireDangerCue !== true || nearbyCues.length > 0;
  });
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
      const { compact, compactOffsets } = compactSafetyText(segment);
      return {
        normalized: segment,
        compact,
        searchable: `${segment}\n${compact}`,
        compactOffsets,
      };
    });
}
