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
  allowBareImperative?: boolean;
  cuePosition?: "before" | "either";
  maxCueDistance?: number;
};

export type SafetySpeechActRule = {
  patterns: readonly SafetyPattern[];
  placement: "before" | "after" | "either";
  maxDistance?: number;
  trailingOnlyWhenAfter?: boolean;
};

export type SafetyCompositionRule = {
  actionPatterns: readonly SafetyPattern[];
  targetPatterns?: readonly SafetyPattern[];
  speechActs?: readonly SafetySpeechActRule[];
  safeContextPatterns?: readonly SafetyPattern[];
  requireTarget?: boolean;
  requireSpeechAct?: boolean;
  allowBareDirective?: boolean;
  maxTargetDistance?: number;
  targetPlacement?: "after" | "either";
  bridgePattern?: RegExp;
};

const CONTRAST_BOUNDARY = /\b(?:but|however|yet)\b|(?:但是|但|然而|不过|却)/giu;
const SENTENCE_BOUNDARY = /[。！？!?；;]+|(?<=[A-Za-z])\.(?=\s|$)/gu;
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

export function normalizeSafetyRiskView(text: string) {
  return normalizeSafetyText(text)
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .toLocaleLowerCase();
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

function compactSyntax(value: string) {
  return value.replace(/[\s\p{P}\p{S}]/gu, "").toLocaleLowerCase();
}

function isBareDirectiveSpeechAct(
  segment: SafetyTextSegment,
  action: SafetyMatchSpan,
) {
  const rawPrefix = segment.normalized.slice(0, action.start);
  const clausePrefix = rawPrefix.slice(
    Math.max(
      rawPrefix.lastIndexOf(","),
      rawPrefix.lastIndexOf("，"),
      rawPrefix.lastIndexOf(":"),
      rawPrefix.lastIndexOf("："),
      rawPrefix.lastIndexOf("—"),
    ) + 1,
  );
  const prefix = compactSyntax(clausePrefix);
  const directPrefixes = [
    "",
    "please",
    "pleaseyou",
    "then",
    "andthen",
    "请",
    "请你",
    "然后",
    "接着",
    "再",
    "本轮问题",
    "问题",
    "question",
  ];
  return directPrefixes.includes(prefix)
    || ["andthen", "then", "然后", "接着", "再"].some((marker) =>
      prefix.endsWith(marker)
    );
}

function isTrailingSpeechAct(
  segment: SafetyTextSegment,
  cue: SafetyMatchSpan,
) {
  const suffix = compactSyntax(segment.normalized.slice(cue.end));
  return ["", "please", "thanks", "thankyou", "请", "谢谢"].includes(suffix);
}

function speechActMatchesCore({
  segment,
  cue,
  core,
  placement,
  maxDistance,
  trailingOnlyWhenAfter,
}: {
  segment: SafetyTextSegment;
  cue: SafetyMatchSpan;
  core: SafetyMatchSpan;
  placement: "before" | "after" | "either";
  maxDistance: number;
  trailingOnlyWhenAfter: boolean;
}) {
  if (spanDistance(cue, core) > maxDistance) return false;
  if (cue.end <= core.start) return placement !== "after";
  if (cue.start >= core.end) {
    return placement !== "before"
      && (!trailingOnlyWhenAfter || isTrailingSpeechAct(segment, cue));
  }
  return placement === "either";
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
    const nearbyCues = cues.filter((cue) => speechActMatchesCore({
      segment,
      cue,
      core,
      placement: rule.cuePosition === "either" ? "either" : "before",
      maxDistance: maxCueDistance,
      trailingOnlyWhenAfter: true,
    }));
    const hasUncoveredDangerCue = nearbyCues.some((cue) =>
      !coveringSafeContexts.some((safe) => spanContains(safe, cue))
    );
    const isBareImperative = rule.allowBareImperative === true
      && isBareDirectiveSpeechAct(segment, core);

    if (hasUncoveredDangerCue) return true;
    if (coveringSafeContexts.length > 0) return false;
    return rule.requireDangerCue !== true || nearbyCues.length > 0 || isBareImperative;
  });
}

function mergeSpans(left: SafetyMatchSpan, right: SafetyMatchSpan) {
  return {
    start: Math.min(left.start, right.start),
    end: Math.max(left.end, right.end),
  };
}

function matchesCompositionBridge(
  segment: SafetyTextSegment,
  action: SafetyMatchSpan,
  target: SafetyMatchSpan,
  bridgePattern: RegExp | undefined,
) {
  if (!bridgePattern) return true;
  const bridgeStart = Math.min(action.end, target.end);
  const bridgeEnd = Math.max(action.start, target.start);
  const bridge = bridgeStart < bridgeEnd
    ? compactSyntax(segment.normalized.slice(bridgeStart, bridgeEnd))
    : "";
  return new RegExp(
    bridgePattern.source,
    bridgePattern.flags.replace(/[gy]/g, ""),
  ).test(bridge);
}

export function hasUnsafeSafetyComposition(
  segment: SafetyTextSegment,
  rule: SafetyCompositionRule,
) {
  const actions = findSafetyMatchSpans(segment, rule.actionPatterns);
  const targets = findSafetyMatchSpans(segment, rule.targetPatterns ?? []);
  const safeContexts = findSafetyMatchSpans(
    segment,
    rule.safeContextPatterns ?? [],
  );
  const maxTargetDistance = rule.maxTargetDistance ?? 64;

  return actions.some((action) => {
    const matchingTargets = targets.filter((target) =>
      spanDistance(action, target) <= maxTargetDistance
      && (rule.targetPlacement !== "after" || target.start >= action.end)
      && matchesCompositionBridge(
        segment,
        action,
        target,
        rule.bridgePattern,
      )
    );
    if (rule.requireTarget !== false && rule.targetPatterns && matchingTargets.length === 0) {
      return false;
    }

    const cores = matchingTargets.length > 0
      ? matchingTargets.map((target) => mergeSpans(action, target))
      : [action];

    return cores.some((core) => {
      const coveringSafeContexts = safeContexts.filter((safe) =>
        spanContains(safe, core)
      );
      const matchingCues = (rule.speechActs ?? []).flatMap((speechAct) =>
        findSafetyMatchSpans(segment, speechAct.patterns).filter((cue) =>
          speechActMatchesCore({
            segment,
            cue,
            core,
            placement: speechAct.placement,
            maxDistance: speechAct.maxDistance ?? 48,
            trailingOnlyWhenAfter: speechAct.trailingOnlyWhenAfter ?? false,
          })
        )
      );
      const hasUncoveredSpeechAct = matchingCues.some((cue) =>
        !coveringSafeContexts.some((safe) => spanContains(safe, cue))
      );
      const hasBareDirective = rule.allowBareDirective === true
        && isBareDirectiveSpeechAct(segment, action);

      if (hasUncoveredSpeechAct) return true;
      if (coveringSafeContexts.length > 0) return false;
      return rule.requireSpeechAct !== true || hasBareDirective;
    });
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
