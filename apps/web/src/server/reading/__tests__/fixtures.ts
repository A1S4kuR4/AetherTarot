import {
  buildPlaceholderFinalReadingDraft,
  buildPlaceholderInitialReadingDraft,
} from "@aethertarot/prompting";
import type {
  ReadingRequestPayload,
  StructuredReading,
} from "@aethertarot/shared-types";
import type {
  FinalReadingContext,
  HydratedReadingContext,
  ReadingDraft,
  ReadingProvider,
} from "@/server/reading/types";

export function buildSinglePayload(
  question = "我现在最该注意什么？",
): ReadingRequestPayload {
  return {
    question,
    spreadId: "single",
    drawnCards: [
      {
        positionId: "focus",
        cardId: "star",
        isReversed: false,
      },
    ],
  };
}

export function buildHolyTrianglePayload(
  question = "我该如何看待当前的职业选择？",
): ReadingRequestPayload {
  return {
    question,
    spreadId: "holy-triangle",
    drawnCards: [
      {
        positionId: "past",
        cardId: "high-priestess",
        isReversed: false,
      },
      {
        positionId: "present",
        cardId: "hermit",
        isReversed: false,
      },
      {
        positionId: "future",
        cardId: "star",
        isReversed: true,
      },
    ],
  };
}

export function buildFourAspectsPayload(
  question = "我该如何理解眼前这次转向？",
): ReadingRequestPayload {
  return {
    question,
    spreadId: "four-aspects",
    drawnCards: [
      {
        positionId: "spirit",
        cardId: "star",
        isReversed: false,
      },
      {
        positionId: "body",
        cardId: "chariot",
        isReversed: false,
      },
      {
        positionId: "mind",
        cardId: "justice",
        isReversed: true,
      },
      {
        positionId: "emotion",
        cardId: "lovers",
        isReversed: false,
      },
    ],
  };
}

export function buildSevenCardPayload(
  question = "这段变化接下来会怎样展开？",
): ReadingRequestPayload {
  return {
    question,
    spreadId: "seven-card",
    drawnCards: [
      {
        positionId: "hopes-fears",
        cardId: "moon",
        isReversed: true,
      },
      {
        positionId: "past",
        cardId: "wheel-of-fortune",
        isReversed: false,
      },
      {
        positionId: "outcome",
        cardId: "star",
        isReversed: false,
      },
      {
        positionId: "answer",
        cardId: "justice",
        isReversed: false,
      },
      {
        positionId: "present",
        cardId: "hermit",
        isReversed: false,
      },
      {
        positionId: "environment",
        cardId: "three-of-pentacles",
        isReversed: false,
      },
      {
        positionId: "near-result",
        cardId: "chariot",
        isReversed: false,
      },
    ],
  };
}

export function buildFollowupAnswers(initial: StructuredReading) {
  return initial.follow_up_questions.map((question) => ({
    question,
    answer: "我会先把事实和感受分开观察。",
  }));
}

export class TestReadingProvider implements ReadingProvider {
  constructor(
    private readonly overrides: {
      initial?: (draft: ReadingDraft, context: HydratedReadingContext) => ReadingDraft;
      final?: (draft: ReadingDraft, context: FinalReadingContext) => ReadingDraft;
    } = {},
  ) {}

  async generateInitialRead(context: HydratedReadingContext) {
    const draft = buildPlaceholderInitialReadingDraft(context);
    return this.overrides.initial ? this.overrides.initial(draft, context) : draft;
  }

  async generateFinalRead(context: FinalReadingContext) {
    const draft = buildPlaceholderFinalReadingDraft(context);
    return this.overrides.final ? this.overrides.final(draft, context) : draft;
  }
}

const FOLLOW_UP_ANCHOR_PATTERN =
  /牌|位置|张力|正位|逆位|现实|线索|卡住|答案|结果|周遭能量|希望与恐惧/i;
const GENERIC_FOLLOW_UP_PATTERN =
  /你最近是不是很焦虑|你是不是遇到了某个人|你是不是工作不顺/i;
const SAFETY_NARROWING_PATTERN = /现实|风险|专业|信息|确认|症状|边界/i;
const CAPSULE_UNSAFE_PATTERN =
  /自杀|自残|结束生命|kill myself|急救|急诊|无法呼吸|呼吸困难|大量出血|昏迷|跟踪|监控|报复|操控|控制他|控制她|pua|勒索|偷窥|家暴|胁迫|用户补充/i;

export function preservesPrimaryTheme(
  initialReading: StructuredReading,
  finalReading: StructuredReading,
) {
  const primaryTheme = initialReading.themes[0];

  return Boolean(primaryTheme && finalReading.themes.includes(primaryTheme));
}

export function hasAnchoredFollowupQuestion(question: string) {
  return FOLLOW_UP_ANCHOR_PATTERN.test(question) && !GENERIC_FOLLOW_UP_PATTERN.test(question);
}

export function hasSafetyNarrowedGuidance(reading: StructuredReading) {
  return reading.reflective_guidance.some((item) => SAFETY_NARROWING_PATTERN.test(item));
}

export function hasSafetyNarrowedFollowup(reading: StructuredReading) {
  return reading.follow_up_questions.every((item) => SAFETY_NARROWING_PATTERN.test(item));
}

export function hasSafeSessionCapsule(reading: StructuredReading) {
  return Boolean(reading.session_capsule && !CAPSULE_UNSAFE_PATTERN.test(reading.session_capsule));
}

export function hasCompactSessionCapsule(reading: StructuredReading, maxLength = 280) {
  return Boolean(reading.session_capsule && reading.session_capsule.length <= maxLength);
}

export function omitsUserSupplementLine(reading: StructuredReading) {
  return Boolean(reading.session_capsule && !/用户补充[:：]/.test(reading.session_capsule));
}

export function mentionsSevenCardAxis(reading: StructuredReading) {
  return /答案\s*\/\s*当事人|结果|周遭能量|希望与恐惧/.test(reading.synthesis)
    || reading.follow_up_questions.some((item) => /答案\s*\/\s*当事人|结果|周遭能量|希望与恐惧/.test(item));
}
