import type { StructuredReading } from "@aethertarot/shared-types";
import {
  hasSafetyMatch,
  hasUncoveredSafetyMatch,
  segmentSafetyText,
  segmentSafetyRiskText,
  type SafetyPattern,
} from "@/server/safety/text-normalization";
import { findSafetySemanticFamilies } from "@/server/safety/semantic-rules";

export type GeneratedContentAction = "pass" | "restrict" | "replace";

export type GeneratedContentViolation =
  | "self_harm_or_violence_encouragement"
  | "manipulation_instruction"
  | "treatment_discontinuation"
  | "medical_diagnosis"
  | "abuse_minimization"
  | "deterministic_claim"
  | "third_party_certainty"
  | "professional_directive";

export interface GeneratedContentReview<T> {
  action: GeneratedContentAction;
  violations: GeneratedContentViolation[];
  output: T;
}

const REPLACEMENT_VIOLATIONS = new Set<GeneratedContentViolation>([
  "self_harm_or_violence_encouragement",
  "manipulation_instruction",
  "treatment_discontinuation",
  "medical_diagnosis",
  "abuse_minimization",
]);

const patterns = (
  normalized: RegExp,
  compact: RegExp,
): SafetyPattern[] => [
  { form: "normalized", pattern: normalized },
  { form: "compact", pattern: compact },
];

const SAFE_CERTAINTY_BOUNDARY: SafetyPattern[] = [
  { form: "normalized", pattern: /(?:不能|无法|不应|不可|不代表|并非).{0,12}?(?:一定会|必然会|绝对会|肯定会|百分之百|命中注定|已经注定|真实想法)|(?:一定会|必然会|绝对会|肯定会|百分之百|命中注定|已经注定|真实想法).{0,12}?(?:无法确认|不能确定|不应断定)/i },
  { form: "normalized", pattern: /(?:不能|无法|不应|不可|不代表|并非).{0,12}?(?:他|她|对方).{0,8}?(?:一定|肯定|真实).{0,10}?(?:爱|想|打算|回来|离开|喜欢|讨厌)/i },
  { form: "compact", pattern: /(?:cannot|cant|shouldnot)(?:knowforsure|guarantee|predict)/i },
];
const SAFE_PROFESSIONAL_BOUNDARY = patterns(
  /(?:不要|不能|不应|不应该|不可|不建议|避免|不宜).{0,12}?(?:买入|卖出|投资|贷款|借钱|起诉|签署|认罪|做手术|服用|用药|辞职|离婚)|你应该(?:不要|避免|谨慎).{0,10}?(?:买入|卖出|投资|贷款|借钱|起诉|签署|认罪|做手术|服用|用药|辞职|离婚)/i,
  /(?:donot|dont|shouldnot|shouldnt|cannot|youshouldnot|youshouldavoid)(?:buy|sell|invest|borrow|sue|sign|takemedication|havesurgery|quityourjob|divorce)/i,
);

const ABUSE_MINIMIZATION = patterns(
  /(?:家暴|暴力|被打).{0,12}(?:很正常|应该忍|需要忍|接受就好|是爱你的表现)|(?:被家暴|被打).{0,8}(?:活该|是你的错|你造成)|你.{0,8}(?:招来|导致).{0,6}(?:家暴|暴力)/i,
  /abuse(?:isnormal|isyourfault|meanstheyloveyou)/i,
);
const DETERMINISTIC_CLAIM = patterns(
  /一定会|必然会|绝对会|肯定会|百分之百|命中注定|已经注定/i,
  /definitelywill|guaranteedto|destinedto/i,
);
const THIRD_PARTY_CERTAINTY = patterns(
  /(?:他|她|对方).{0,8}?(?:一定|肯定|真实).{0,10}?(?:爱|想|打算|回来|离开|喜欢|讨厌)|(?:他|她|对方)的真实想法是/i,
  /theydefinitely(?:love|want|willreturn)/i,
);
const PROFESSIONAL_DIRECTIVE = patterns(
  /你(?:必须|应该|需要).{0,10}?(?:买入|卖出|投资|贷款|借钱|起诉|签署|认罪|做手术|服用|用药|辞职|离婚)/i,
  /(?:youmust|youshould)(?:buy|sell|invest|borrow|sue|sign|takemedication|havesurgery|quityourjob|divorce)/i,
);

const RESTRICTED_SAFETY_NOTE =
  "系统已移除生成内容中的绝对化或越界表述。请把保留内容仅作为反思线索，并以现实信息、可观察行为和合格专业意见为准。";
const REPLACED_SAFETY_NOTE =
  "原始生成内容触及了不可提供的危险或伤害性指引，系统已将其替换为现实安全与边界优先的受限内容。";
const ENCYCLOPEDIA_RESTRICTED_NOTE =
  "百科不能把塔罗语义转化为确定性预言、第三方读心或医疗、法律、财务指令。";
const ENCYCLOPEDIA_REPLACED_NOTE =
  "百科不会提供伤害、操控、停止治疗、直接诊断或合理化暴力的内容。";

function appendUnique<T>(values: T[], value: T) {
  if (!values.includes(value)) {
    values.push(value);
  }
}

function inspectGeneratedText(text: string) {
  const violations: GeneratedContentViolation[] = [];

  const segments = segmentSafetyText(text);
  const semanticSegments = [...segments, ...segmentSafetyRiskText(text)];

  for (const segment of semanticSegments) {
    for (const family of findSafetySemanticFamilies([segment], "output")) {
      switch (family.id) {
        case "self_harm_state":
        case "violence_toward_others":
          appendUnique(violations, "self_harm_or_violence_encouragement");
          break;
        case "stalking_monitoring_control":
          appendUnique(violations, "manipulation_instruction");
          break;
        case "treatment_discontinuation":
          appendUnique(violations, "treatment_discontinuation");
          break;
        case "direct_diagnosis":
          appendUnique(violations, "medical_diagnosis");
          break;
        case "urgent_medical_danger":
          break;
      }
    }
  }

  for (const segment of semanticSegments) {
    if (hasSafetyMatch(segment, ABUSE_MINIMIZATION)) {
      appendUnique(violations, "abuse_minimization");
    }
  }

  for (const segment of segments) {
    if (hasUncoveredSafetyMatch(segment, DETERMINISTIC_CLAIM, SAFE_CERTAINTY_BOUNDARY)) {
      appendUnique(violations, "deterministic_claim");
    }
    if (hasUncoveredSafetyMatch(segment, THIRD_PARTY_CERTAINTY, SAFE_CERTAINTY_BOUNDARY)) {
      appendUnique(violations, "third_party_certainty");
    }
    if (
      hasUncoveredSafetyMatch(segment, PROFESSIONAL_DIRECTIVE, SAFE_PROFESSIONAL_BOUNDARY)
    ) {
      appendUnique(violations, "professional_directive");
    }
  }

  return violations;
}

function isReplacementViolation(violation: GeneratedContentViolation) {
  return REPLACEMENT_VIOLATIONS.has(violation);
}

function mergeSafetyNote(existing: string | null, added: string) {
  if (!existing) {
    return added;
  }

  return existing.includes(added) ? existing : `${existing}\n\n${added}`;
}

function collectReadingViolations(reading: StructuredReading) {
  const violations: GeneratedContentViolation[] = [];
  const texts = [
    ...reading.cards.map((card) => card.interpretation),
    ...reading.themes,
    reading.synthesis,
    ...reading.reflective_guidance,
    ...reading.follow_up_questions,
    reading.confidence_note ?? "",
  ];

  for (const text of texts) {
    for (const violation of inspectGeneratedText(text)) {
      appendUnique(violations, violation);
    }
  }

  return violations;
}

function replaceUnsafeReading(reading: StructuredReading): StructuredReading {
  return {
    ...reading,
    cards: reading.cards.map((card) => ({
      ...card,
      interpretation:
        "这张牌不能被用来为危险、伤害或控制性行动背书。此处只保留一个现实导向的提醒：先确认安全、事实与可获得的支持。",
    })),
    themes: ["现实安全与边界", "暂停确定性结论"],
    synthesis:
      "这次生成内容无法作为安全的塔罗解读继续展示。比牌面结论更重要的是先回到现实安全、可核实事实、个人边界与合格支持。",
    reflective_guidance: [
      "暂停依据塔罗采取不可逆或可能伤害自己、他人的行动。",
      "把当前风险和需要整理成具体事实，并联系可信任的人或合格专业支持。",
    ],
    follow_up_questions: [
      "此刻最需要优先确认的现实安全、事实或支持是什么？",
    ],
    safety_note: REPLACED_SAFETY_NOTE,
    confidence_note:
      "系统没有保留触及安全边界的生成结论；当前内容不构成预测、诊断或现实行动许可。",
    session_capsule: null,
  };
}

export function mergeGeneratedContentAction(
  deterministic: GeneratedContentAction,
  reviewer: GeneratedContentAction,
): GeneratedContentAction {
  const rank: Record<GeneratedContentAction, number> = {
    pass: 0,
    restrict: 1,
    replace: 2,
  };
  return rank[reviewer] > rank[deterministic] ? reviewer : deterministic;
}

export function minimumGeneratedContentAction(
  violations: readonly GeneratedContentViolation[],
): GeneratedContentAction {
  return violations.some(isReplacementViolation) ? "replace" : "restrict";
}

export function applyReadingGeneratedContentAction(
  reading: StructuredReading,
  action: GeneratedContentAction,
  flaggedPaths: readonly string[] = [],
) {
  if (action === "replace") return replaceUnsafeReading(reading);
  if (action === "restrict") return restrictUnsafeReading(reading, flaggedPaths);
  return reading;
}

function replaceRestrictedText(text: string, replacement: string) {
  return inspectGeneratedText(text).length > 0 ? replacement : text;
}

function restrictUnsafeReading(
  reading: StructuredReading,
  flaggedPaths: readonly string[] = [],
): StructuredReading {
  const safeThemes = ["现实信息核验", "保留多种可能", "自主边界", "谨慎行动"];
  const flagged = new Set(flaggedPaths);
  const restrictText = (path: string, text: string, replacement: string) =>
    flagged.has(path) ? replacement : replaceRestrictedText(text, replacement);

  return {
    ...reading,
    cards: reading.cards.map((card, index) => ({
      ...card,
      interpretation: restrictText(
        `cards.${index}.interpretation`,
        card.interpretation,
        "这张牌只能作为反思线索，不能证明必然结果、第三方真实想法或专业结论。",
      ),
    })),
    themes: reading.themes.map((theme, index) =>
      restrictText(`themes.${index}`, theme, safeThemes[index] ?? "现实边界")
    ),
    synthesis: restrictText(
      "synthesis",
      reading.synthesis,
      "这组牌更适合用来整理当前模式与待核实条件，而不能给出必然结果或替代现实专业判断。",
    ),
    reflective_guidance: reading.reflective_guidance.map((item, index) =>
      restrictText(
        `reflective_guidance.${index}`,
        item,
        index === 0
          ? "先区分已经确认的事实、个人感受与仍待验证的推测。"
          : "在行动前核实现实信息，并保留调整与寻求专业意见的空间。",
      )
    ),
    follow_up_questions: reading.follow_up_questions.map((item, index) =>
      restrictText(
        `follow_up_questions.${index}`,
        item,
        "哪些可观察事实能帮助你校正当前的推测？",
      )
    ),
    safety_note: mergeSafetyNote(
      flagged.has("safety_note") ? null : reading.safety_note,
      RESTRICTED_SAFETY_NOTE,
    ),
    confidence_note: reading.confidence_note
      ? restrictText(
          "confidence_note",
          reading.confidence_note,
          "塔罗只能提供有限的反思角度，不能确认必然结果或专业结论。",
        )
      : "塔罗只能提供有限的反思角度，不能确认必然结果或专业结论。",
  };
}

export function reviewReadingGeneratedContent(
  reading: StructuredReading,
): GeneratedContentReview<StructuredReading> {
  const violations = collectReadingViolations(reading);

  if (violations.length === 0) {
    return { action: "pass", violations, output: reading };
  }

  if (violations.some(isReplacementViolation)) {
    return {
      action: "replace",
      violations,
      output: replaceUnsafeReading(reading),
    };
  }

  return {
    action: "restrict",
    violations,
    output: restrictUnsafeReading(reading),
  };
}

export function applyEncyclopediaGeneratedContentAction({
  answer,
  boundaryNote,
  action,
}: {
  answer: string;
  boundaryNote: string | null;
  action: GeneratedContentAction;
}) {
  if (action === "pass") {
    return {
      answer: boundaryNote ? `${answer}\n\n边界提醒：${boundaryNote}` : answer,
      boundaryNote,
    };
  }

  const note = action === "replace"
    ? boundaryNote
      ? `${boundaryNote} ${ENCYCLOPEDIA_REPLACED_NOTE}`
      : ENCYCLOPEDIA_REPLACED_NOTE
    : boundaryNote
      ? `${boundaryNote} ${ENCYCLOPEDIA_RESTRICTED_NOTE}`
      : ENCYCLOPEDIA_RESTRICTED_NOTE;
  const safeAnswer = action === "replace"
    ? "原始回答触及安全边界，未予展示。这里仅保留百科范围内的原则：牌义不能授权伤害、操控或替代现实专业判断。"
    : "这个问题更适合回到百科层面的牌义理解，而不是把塔罗语义当成现实结论。";
  return {
    answer: `${safeAnswer}\n\n边界提醒：${note}`,
    boundaryNote: note,
  };
}

export function reviewEncyclopediaGeneratedAnswer({
  answer,
  boundaryNote,
}: {
  answer: string;
  boundaryNote: string | null;
}): GeneratedContentReview<{ answer: string; boundaryNote: string | null }> {
  const violations = inspectGeneratedText(answer);
  const appendBoundary = (safeAnswer: string, note: string | null) => ({
    answer: note ? `${safeAnswer}\n\n边界提醒：${note}` : safeAnswer,
    boundaryNote: note,
  });

  if (violations.length === 0) {
    return {
      action: "pass",
      violations,
      output: appendBoundary(answer, boundaryNote),
    };
  }

  if (violations.some(isReplacementViolation)) {
    const note = boundaryNote
      ? `${boundaryNote} ${ENCYCLOPEDIA_REPLACED_NOTE}`
      : ENCYCLOPEDIA_REPLACED_NOTE;

    return {
      action: "replace",
      violations,
      output: appendBoundary(
        "原始回答触及安全边界，未予展示。这里仅保留百科范围内的原则：牌义不能授权伤害、操控或替代现实专业判断。",
        note,
      ),
    };
  }

  const note = boundaryNote
    ? `${boundaryNote} ${ENCYCLOPEDIA_RESTRICTED_NOTE}`
    : ENCYCLOPEDIA_RESTRICTED_NOTE;

  return {
    action: "restrict",
    violations,
    output: appendBoundary(
      "这个问题更适合回到百科层面的牌义理解，而不是把塔罗语义当成现实结论。",
      note,
    ),
  };
}
