import type { StructuredReading } from "@aethertarot/shared-types";
import {
  hasSafetyMatch,
  hasUncoveredSafetyMatch,
  segmentSafetyText,
  type SafetyPattern,
} from "@/server/safety/text-normalization";

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

const patterns = (
  normalized: RegExp,
  compact: RegExp,
): SafetyPattern[] => [
  { form: "normalized", pattern: normalized },
  { form: "compact", pattern: compact },
];

const SAFE_TREATMENT_BOUNDARY = patterns(
  /(?:不要|不能|不应|不可|不建议|避免|拒绝建议).{0,8}?(?:停药|停止治疗|拒绝治疗)/i,
  /(?:donot|dont|shouldnot|cannot|youshouldnot)(?:stopmedication|stoptreatment)/i,
);
const SAFE_CERTAINTY_BOUNDARY: SafetyPattern[] = [
  { form: "normalized", pattern: /(?:不能|无法|不应|不可|不代表|并非).{0,12}?(?:一定会|必然会|绝对会|肯定会|百分之百|命中注定|已经注定|真实想法)|(?:一定会|必然会|绝对会|肯定会|百分之百|命中注定|已经注定|真实想法).{0,12}?(?:无法确认|不能确定|不应断定)/i },
  { form: "normalized", pattern: /(?:不能|无法|不应|不可|不代表|并非).{0,12}?(?:他|她|对方).{0,8}?(?:一定|肯定|真实).{0,10}?(?:爱|想|打算|回来|离开|喜欢|讨厌)/i },
  { form: "compact", pattern: /(?:cannot|cant|shouldnot)(?:knowforsure|guarantee|predict)/i },
];
const SAFE_MANIPULATION_BOUNDARY: SafetyPattern[] = [
  { form: "normalized", pattern: /(?:不要|不能|不应|不可|不鼓励|拒绝|避免).{0,10}?(?:跟踪|监控|报复|操控|勒索|偷窥|试探|控制对方)/i },
  { form: "normalized", pattern: /(?:朋友|他|她|对方|有人)(?:问我|说|声称).{0,16}?(?:怎么|如何|要|想|应该).{0,8}?(?:跟踪|监控|报复|操控|勒索|偷窥|控制)/i },
  { form: "compact", pattern: /(?:donot|dont|shouldnot|cannot|youshouldnot)(?:stalk|track|monitor|control|manipulate|blackmail|retaliate)/i },
  { form: "compact", pattern: /(?:afriend|friend|he|she|they)(?:askedme|said).{0,16}?(?:howto|youshould)(?:stalk|track|monitor|control|manipulate|blackmail|retaliate)/i },
];
const SAFE_DIAGNOSIS_BOUNDARY = patterns(
  /(?:不能|无法|不应|不可|不代表).{0,10}?(?:诊断|确诊|患有|怀孕)/i,
  /(?:cannot|cant|shouldnot)(?:diagnose|confirmadiagnosis|confirmpregnancy)/i,
);
const SAFE_HARM_BOUNDARY = patterns(
  /(?:不要|不能|不应|不可|拒绝|避免).{0,10}?(?:自杀|自残|伤害自己|伤害他人|暴力)/i,
  /(?:donot|dont|shouldnot|cannot|youshouldnot)(?:selfharm|suicide|killyourself|hurtyourself|hurtsomeone)/i,
);
const SAFE_PROFESSIONAL_BOUNDARY = patterns(
  /(?:不要|不能|不应|不应该|不可|不建议|避免|不宜).{0,12}?(?:买入|卖出|投资|贷款|借钱|起诉|签署|认罪|做手术|服用|用药|辞职|离婚)|你应该(?:不要|避免|谨慎).{0,10}?(?:买入|卖出|投资|贷款|借钱|起诉|签署|认罪|做手术|服用|用药|辞职|离婚)/i,
  /(?:donot|dont|shouldnot|shouldnt|cannot|youshouldnot|youshouldavoid)(?:buy|sell|invest|borrow|sue|sign|takemedication|havesurgery|quityourjob|divorce)/i,
);

const SELF_HARM_OR_VIOLENCE_ENCOURAGEMENT = patterns(
  /(?:你可以|你应该|你必须|不如|值得|建议你|去|我要|我准备|我打算).{0,8}?(?:自杀|自残|结束生命|伤害自己|伤害他人|杀他|杀她|实施暴力)/i,
  /(?:youshould|youcan|goaheadand)(?:selfharm|killyourself|hurtyourself|hurtthem)|i(?:am)?(?:goingto|aboutto|planningto)(?:kill|hurt|attack)(?:him|her|them|someone)?/i,
);
const MANIPULATION_INSTRUCTION = patterns(
  /(?:你可以|你应该|你必须|建议|方法是|步骤是|先|然后|教我|怎么|如何).{0,14}?(?:跟踪|监控|报复|操控|勒索|偷窥|试探|控制对方)/i,
  /(?:youshould|youcan|first|then|howcani|howdoi).{0,14}(?:stalk|track|monitor|control|manipulate|blackmail|retaliate)/i,
);
const TREATMENT_DISCONTINUATION = patterns(
  /(?:你可以|你应该|你必须|建议|直接|不妨).{0,8}?(?:停药|停止治疗|拒绝治疗)|(?:停药|停止治疗|拒绝治疗).{0,8}?(?:就好|即可|更好)/i,
  /(?:youshould|youcan)(?:stopmedication|stoptreatment)/i,
);
const MEDICAL_DIAGNOSIS = patterns(
  /(?:你|他|她).{0,6}(?:已经|就是|肯定|确定)?(?:患有|得了|确诊为|怀孕了)/i,
  /(?:you|they|he|she)definitely(?:have|has)(?:cancer|adisease|thecondition)|(?:you|they|he|she)isdiagnosedwith|(?:you|they|he|she)ispregnant/i,
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

  for (const segment of segmentSafetyText(text)) {
    if (
      hasUncoveredSafetyMatch(segment, SELF_HARM_OR_VIOLENCE_ENCOURAGEMENT, SAFE_HARM_BOUNDARY)
    ) {
      appendUnique(violations, "self_harm_or_violence_encouragement");
    }
    if (
      hasUncoveredSafetyMatch(segment, MANIPULATION_INSTRUCTION, SAFE_MANIPULATION_BOUNDARY)
    ) {
      appendUnique(violations, "manipulation_instruction");
    }
    if (
      hasUncoveredSafetyMatch(segment, TREATMENT_DISCONTINUATION, SAFE_TREATMENT_BOUNDARY)
    ) {
      appendUnique(violations, "treatment_discontinuation");
    }
    if (hasUncoveredSafetyMatch(segment, MEDICAL_DIAGNOSIS, SAFE_DIAGNOSIS_BOUNDARY)) {
      appendUnique(violations, "medical_diagnosis");
    }
    if (hasSafetyMatch(segment, ABUSE_MINIMIZATION)) {
      appendUnique(violations, "abuse_minimization");
    }
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
  return (
    violation === "self_harm_or_violence_encouragement"
    || violation === "manipulation_instruction"
    || violation === "treatment_discontinuation"
    || violation === "medical_diagnosis"
    || violation === "abuse_minimization"
  );
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
    safety_note: mergeSafetyNote(reading.safety_note, REPLACED_SAFETY_NOTE),
    confidence_note:
      "系统没有保留触及安全边界的生成结论；当前内容不构成预测、诊断或现实行动许可。",
    session_capsule: null,
  };
}

function replaceRestrictedText(text: string, replacement: string) {
  return inspectGeneratedText(text).length > 0 ? replacement : text;
}

function restrictUnsafeReading(reading: StructuredReading): StructuredReading {
  const safeThemes = ["现实信息核验", "保留多种可能", "自主边界", "谨慎行动"];

  return {
    ...reading,
    cards: reading.cards.map((card) => ({
      ...card,
      interpretation: replaceRestrictedText(
        card.interpretation,
        "这张牌只能作为反思线索，不能证明必然结果、第三方真实想法或专业结论。",
      ),
    })),
    themes: reading.themes.map((theme, index) =>
      replaceRestrictedText(theme, safeThemes[index] ?? "现实边界")
    ),
    synthesis: replaceRestrictedText(
      reading.synthesis,
      "这组牌更适合用来整理当前模式与待核实条件，而不能给出必然结果或替代现实专业判断。",
    ),
    reflective_guidance: reading.reflective_guidance.map((item, index) =>
      replaceRestrictedText(
        item,
        index === 0
          ? "先区分已经确认的事实、个人感受与仍待验证的推测。"
          : "在行动前核实现实信息，并保留调整与寻求专业意见的空间。",
      )
    ),
    follow_up_questions: reading.follow_up_questions.map((item) =>
      replaceRestrictedText(
        item,
        "哪些可观察事实能帮助你校正当前的推测？",
      )
    ),
    safety_note: mergeSafetyNote(reading.safety_note, RESTRICTED_SAFETY_NOTE),
    confidence_note: reading.confidence_note
      ? replaceRestrictedText(
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
