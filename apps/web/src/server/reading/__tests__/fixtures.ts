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

export function buildCelticCrossPayload(
  question = "我需要如何梳理接下来三个月的整体方向？",
): ReadingRequestPayload {
  return {
    question,
    spreadId: "celtic-cross",
    drawnCards: [
      {
        positionId: "core",
        cardId: "star",
        isReversed: false,
      },
      {
        positionId: "challenge",
        cardId: "moon",
        isReversed: true,
      },
      {
        positionId: "conscious",
        cardId: "justice",
        isReversed: false,
      },
      {
        positionId: "unconscious",
        cardId: "high-priestess",
        isReversed: false,
      },
      {
        positionId: "past",
        cardId: "wheel-of-fortune",
        isReversed: false,
      },
      {
        positionId: "future",
        cardId: "chariot",
        isReversed: false,
      },
      {
        positionId: "self",
        cardId: "hermit",
        isReversed: false,
      },
      {
        positionId: "environment",
        cardId: "three-of-pentacles",
        isReversed: false,
      },
      {
        positionId: "hopes",
        cardId: "lovers",
        isReversed: true,
      },
      {
        positionId: "outcome",
        cardId: "sun",
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
const CONSTRUCTIVE_TENSION_PATTERN =
  /建设性阻力|阻力点|不完全支持|未验证|不能把牌面改写|现实条件|位置|正位|逆位|张力/i;
const UNSAFE_TENSION_PATTERN =
  /一定会|必然会|命中注定|必须立刻|他真实想法|她真实想法|对方真实想法|诊断|治疗建议|投资建议|法律意见/i;

function collectReadingText(reading: StructuredReading) {
  return [
    reading.synthesis,
    ...reading.reflective_guidance,
    ...reading.follow_up_questions,
    reading.confidence_note ?? "",
    ...reading.cards.map((card) => card.interpretation),
  ].join("\n");
}

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

export function mentionsSpreadAxis(reading: StructuredReading) {
  const text = collectReadingText(reading);

  switch (reading.spread.id) {
    case "single":
      return /观察入口|核心指引|单牌/.test(text);
    case "holy-triangle":
      return /过去|现在|未来|潜在流向|时间与因果路径/.test(text);
    case "four-aspects":
      return /身体层面|情感层面|心智层面|精神层面|四层/.test(text);
    case "seven-card":
      return /答案\s*\/\s*当事人|结果|周遭能量|希望与恐惧/.test(text);
    case "celtic-cross":
      return /核心|挑战|意识|潜意识|环境|赛尔特十字/.test(text);
    default:
      return false;
  }
}

export function hasConstructiveTension(reading: StructuredReading) {
  return CONSTRUCTIVE_TENSION_PATTERN.test(collectReadingText(reading));
}

export function avoidsUnsafeConstructiveTensionClaims(reading: StructuredReading) {
  return !UNSAFE_TENSION_PATTERN.test(collectReadingText(reading));
}

export function getConstructiveTensionSignature(reading: StructuredReading) {
  return collectReadingText(reading).match(
    /牌面在这里留下的阻力|这里的阻力不在于|这个位置的阻力更安静|这组牌留下的阻力很现实|这处阻力来自/,
  )?.[0] ?? null;
}
