import { ReadingServiceError } from "@/server/reading/errors";
import {
  hasSafetyMatch,
  hasUnsafeSafetyCore,
  segmentSafetyText,
  type SafetyPattern,
} from "@/server/safety/text-normalization";

export type SafetyLevel = "standard" | "bounded" | "sober_check" | "hard_stop";

export type SafetyCategory =
  | "self_harm"
  | "immediate_danger"
  | "urgent_health"
  | "manipulation"
  | "abuse_support"
  | "health"
  | "legal"
  | "financial"
  | "major_decision"
  | "third_party_certainty"
  | "relationship_conflict";

export interface SafetyAssessment {
  level: SafetyLevel;
  primaryCategory: SafetyCategory | null;
  categories: SafetyCategory[];
  userMessage: string | null;
  safetyNote: string | null;
  soberCheck: string | null;
  referralLinks?: string[];
}

const patterns = (
  normalized: RegExp,
  compact: RegExp,
): SafetyPattern[] => [
  { form: "normalized", pattern: normalized },
  { form: "compact", pattern: compact },
];

const SELF_HARM_CORE_PATTERNS = patterns(
  /自杀|自残|不想活|活不下去|不该活下去|不该活着|不想继续活|伤害自己|伤害我自己/i,
  /自杀|自残|不想活|活不下去|不该活下去|不该活着|不想继续活|伤害自己|伤害我自己|selfharm|suicid(?:e|al)|killmyself|hurtmyself/i,
);
const SELF_HARM_INTENT_CORE_PATTERNS = patterns(
  /结束生命/i,
  /结束生命|die|endmylife/i,
);
const SELF_HARM_DANGER_CUES = patterns(
  /我(?:想|要|准备|打算)|感觉|计划/i,
  /我(?:想|要|准备|打算)|感觉|计划|iwantto|ifeel|iplanto|iamgoingto/i,
);
const SELF_HARM_SAFE_CONTEXTS = patterns(
  /我(?:不想|不会|拒绝)(?:自杀|自残|伤害自己|伤害我自己|结束生命)/i,
  /(?:idonotwantto|idontwantto|irefuseto)(?:selfharm|die|killmyself|hurtmyself|endmylife)/i,
);
const URGENT_HEALTH_PATTERN =
  /急救|急诊|胸痛|无法呼吸|呼吸困难|大量出血|昏迷|服药过量|overdose|medical emergency/i;
const BREATHING_CORE_PATTERNS = patterns(
  /呼吸/i,
  /呼吸|breathe|breathing/i,
);
const BREATHING_DANGER_CUES = patterns(
  /无法|不能|困难/i,
  /无法|不能|困难|icannot|icant|iamhavingtrouble/i,
);
const TREATMENT_STOP_CORE_PATTERNS = patterns(
  /停药|停止治疗|拒绝治疗/i,
  /停药|停止治疗|拒绝治疗|stop(?:taking)?(?:your)?medication|stoptreatment|discontinuemedication/i,
);
const TREATMENT_STOP_DANGER_CUES = patterns(
  /你应该|你可以|建议你|我要|我想|我准备/i,
  /你应该|你可以|建议你|我要|我想|我准备|youshould|youcan|ishould|iwantto/i,
);
const SAFE_TREATMENT_CONTEXT_PATTERNS = patterns(
  /(?:不要|不能|不应|不可|拒绝|避免)(?:自行)?(?:停药|停止治疗|拒绝治疗)/i,
  /(?:donot|dont|shouldnot|cannot|refuseto|youshouldnot)(?:stop(?:taking)?(?:your)?medication|stoptreatment|discontinuemedication)/i,
);
const IMMEDIATE_DANGER_PATTERN =
  /(?:正在|现在|此刻).{0,8}(?:打我|殴打我|伤害我|威胁我|追杀我|有危险)|(?:要|想要|准备).{0,5}(?:杀我|伤害我)|持刀|被困住|无法脱身|生命危险|immediate danger|being attacked|trying to kill me/i;
const IMMEDIATE_VIOLENCE_INTENT_PATTERN =
  /(?:正在|现在|此刻|马上).{0,10}(?:要|想|准备|打算).{0,6}(?:杀|伤害|袭击|殴打)(?:他|她|对方|别人|他们)|(?:我要|我想|我准备|我打算).{0,6}(?:杀|伤害|袭击|殴打)(?:他|她|对方|别人|他们)|i(?:'m| am)? (?:going to|about to|planning to).{0,8}(?:kill|hurt|attack)|i(?:am)?(?:goingto|aboutto|planningto)(?:kill|hurt|attack)(?:him|her|them|someone)?/i;
const HEALTH_PATTERN =
  /健康|疾病|生病|诊断|怀孕|治疗|症状|用药|medical|doctor|pregnan/i;
const LEGAL_PATTERN = /法律|官司|起诉|诉讼|律师|合同|权益|责任|legal|lawsuit/i;
const FINANCIAL_PATTERN =
  /财务|投资|股票|理财|借贷|贷款|赔偿|积蓄|finance|money|stock|loan/i;
const ABUSE_PATTERN =
  /家暴|家庭暴力|亲密关系暴力|暴力对待|我被.{0,8}(?:打|威胁|恐吓|胁迫|勒索|监控|跟踪|控制)|(?:伴侣|丈夫|妻子|老公|老婆|前任|对方|他|她).{0,8}(?:打我|威胁我|恐吓我|胁迫我|勒索我|监控我|跟踪我|控制我)|abuse|abusive|stalking me|tracking me|controlling me/i;
const MANIPULATION_CORE_PATTERNS = patterns(
  /(?:跟踪|监控|报复|操控|勒索|偷窥|试探|控制)(?:他|她|对方|前任|别人|任何人)?|让.{0,5}?(?:离不开我|听我的|服从我)/i,
  /(?:跟踪|监控|报复|操控|勒索|偷窥|试探|控制)(?:他|她|对方|前任|别人|任何人)?|(?:stalk|track|monitor|control|manipulate|blackmail|retaliate)(?:my|your|the)?(?:ex|partner|someone|anyone|him|her|them|person|people)?/i,
);
const MANIPULATION_DANGER_CUES = patterns(
  /怎么|如何|怎样|有什么办法|帮我|教我|告诉我|你应该|你可以|应该先|我(?:想|要|准备|打算)/i,
  /怎么|如何|怎样|有什么办法|帮我|教我|告诉我|你应该|你可以|应该先|我(?:想|要|准备|打算)|howcani|howdoi|iwantto|iplanto|iamgoingto|teachmehowto|tellmehowto|youshould|youcan/i,
);
const NON_PERPETRATOR_CONTEXT_PATTERNS: SafetyPattern[] = [
  { form: "normalized", pattern: /(?:不想|不会|不要|没有|没打算|拒绝|反对|阻止|担心|害怕)(?:去|继续)?(?:跟踪|监控|报复|操控|勒索|偷窥|控制)(?:他|她|对方|前任|别人|任何人)?/i },
  { form: "normalized", pattern: /(?:他|她|对方|有人|朋友)(?:问我|说|声称|威胁).{0,16}?(?:怎么|如何|要|想|应该).{0,8}?(?:跟踪|监控|报复|操控|勒索|偷窥|控制)(?:他|她|对方|前任|别人|任何人)?/i },
  { form: "normalized", pattern: /(?:被|遭到|正在被).{0,8}(?:跟踪|监控|操控|勒索|控制)/i },
  { form: "compact", pattern: /(?:afriend|friend)asked(?:me)?howto(?:stalk|track|monitor|control|manipulate|blackmail|retaliate)(?:someone|anyone|them)?/i },
  { form: "compact", pattern: /(?:donotwantto|dontwantto|donot|dont|refuseto)(?:stalk|track|monitor|control|manipulate|blackmail|retaliate)(?:someone|anyone|them|him|her|myex|yourex)?/i },
  { form: "compact", pattern: /being(?:stalked|tracked|monitored|controlled)/i },
];
const THIRD_PARTY_CERTAINTY_PATTERN =
  /(?:他|她|对方)(?:到底|会不会|是不是|一定|肯定|真实).{0,10}(?:爱|想|打算|回来|喜欢|讨厌|离开)|真实想法|心里(?:到底)?想|secretly feels|definitely loves|come back/i;
const RELATIONSHIP_CONFLICT_PATTERN =
  /争吵|吵架|冷战|沟通困难|关系紧张|关系矛盾|相处不顺|relationship conflict|keep arguing/i;
const MAJOR_DECISION_SUBJECT_PATTERN =
  /离婚|辞职|分手|退学|堕胎|卖房|买房|大额投资|全部积蓄|炒股|起诉|诉讼|决裂|all in|quit my job|quitmyjob|divorce/i;
const DECISION_OUTSOURCING_PATTERN =
  /要不要|该不该|应不应该|是否应该|我应该|帮我决定|替我决定|告诉我该|should i|shouldi|decide for me|decideforme/i;

const CRISIS_REFERRAL_LINKS = [
  "https://english.beijing.gov.cn/travellinginbeijing/quickguideontravelservices/traveltips/202108/t20210811_2466839.html",
  "https://en.nhc.gov.cn/2025-02/14/c_86392.htm",
  "https://wjw.beijing.gov.cn/English/HealthServices/HealthIndications/201912/t20191216_1236363.html",
];

const CRISIS_MESSAGE =
  "系统检测到这次提问可能已经触及现实中的身体安全、紧急健康或心理危机风险。塔罗不能承担这类判断。请先按这个顺序寻求现实支持：如有急性医疗风险先拨打 120；如有人身威胁、暴力或现实危险先拨打 110；如你处在强烈绝望、崩溃或需要立即心理支持的状态，请尽快拨打 12356 心理援助热线。";
const MANIPULATION_MESSAGE =
  "AetherTarot 不提供跟踪、监控、报复、勒索或操控第三方的方法。请把关注点转回现实安全、个人边界与不伤害他人的沟通方式。";
const SOBER_CHECK =
  "你的问题涉及重大的现实决定。在查看塔罗解读前，请先写下：如果不管塔罗怎么说，你目前最真实的顾虑、可核实事实和底线计划是什么？";

const SAFETY_NOTES: Partial<Record<SafetyCategory, string>> = {
  abuse_support:
    "如果这段关系中存在暴力、威胁、胁迫、跟踪或控制，现实安全应高于塔罗解释。请优先评估当下风险、联系可信任的人或合格支持资源，并避免独自承担或贸然对抗。",
  health:
    "这次内容只能帮助整理关注点，不能替代医疗判断、诊断或治疗建议。涉及症状、怀孕、用药或疾病风险时，请以合格专业意见为准。",
  legal:
    "这次内容只能用于整理事实与顾虑，不能替代法律意见。涉及合同、诉讼、权益或责任判断时，请结合真实资料咨询合格专业人士。",
  financial:
    "塔罗不能替代财务、投资或风险管理建议。涉及借贷、投资或重大金钱决定时，请以现实数据、风险承受能力与专业意见为准。",
  major_decision:
    "重大现实决定不应交由塔罗代替。请把这次内容仅作为反思线索，并优先核实事实、风险、可逆性与个人底线。",
  third_party_certainty:
    "塔罗不能确认第三方隐藏想法或未来必然结果。更可靠的判断来自可观察行为、现实沟通与你自己的边界。",
};

function addCategory(
  categories: SafetyCategory[],
  category: SafetyCategory,
  matched: boolean,
) {
  if (matched && !categories.includes(category)) {
    categories.push(category);
  }
}

function getPrimaryBoundedCategory(categories: SafetyCategory[]) {
  const priority: SafetyCategory[] = [
    "abuse_support",
    "health",
    "legal",
    "financial",
    "third_party_certainty",
  ];

  return priority.find((category) => categories.includes(category)) ?? null;
}

export function assessSafetyText(text: string): SafetyAssessment {
  const segments = segmentSafetyText(text);
  const matches = (pattern: RegExp) => segments.some((segment) =>
    pattern.test(segment.searchable)
  );
  const matchesPatterns = (patterns: readonly SafetyPattern[]) => segments.some((segment) =>
    hasSafetyMatch(segment, patterns)
  );
  const categories: SafetyCategory[] = [];
  const hasSelfHarm = segments.some((segment) => hasUnsafeSafetyCore(segment, {
    corePatterns: SELF_HARM_CORE_PATTERNS,
    dangerCuePatterns: SELF_HARM_DANGER_CUES,
    safeContextPatterns: SELF_HARM_SAFE_CONTEXTS,
  })) || segments.some((segment) => hasUnsafeSafetyCore(segment, {
    corePatterns: SELF_HARM_INTENT_CORE_PATTERNS,
    dangerCuePatterns: SELF_HARM_DANGER_CUES,
    safeContextPatterns: SELF_HARM_SAFE_CONTEXTS,
    requireDangerCue: true,
  }));
  const hasUrgentHealth = matches(URGENT_HEALTH_PATTERN)
    || segments.some((segment) => hasUnsafeSafetyCore(segment, {
      corePatterns: BREATHING_CORE_PATTERNS,
      dangerCuePatterns: BREATHING_DANGER_CUES,
      requireDangerCue: true,
    }))
    || segments.some((segment) => hasUnsafeSafetyCore(segment, {
      corePatterns: TREATMENT_STOP_CORE_PATTERNS,
      dangerCuePatterns: TREATMENT_STOP_DANGER_CUES,
      safeContextPatterns: SAFE_TREATMENT_CONTEXT_PATTERNS,
      requireDangerCue: true,
    }));
  const hasImmediateDanger = matches(IMMEDIATE_DANGER_PATTERN)
    || matches(IMMEDIATE_VIOLENCE_INTENT_PATTERN);
  const hasManipulationIntent = segments.some((segment) =>
    hasUnsafeSafetyCore(segment, {
      corePatterns: MANIPULATION_CORE_PATTERNS,
      dangerCuePatterns: MANIPULATION_DANGER_CUES,
      safeContextPatterns: NON_PERPETRATOR_CONTEXT_PATTERNS,
      requireDangerCue: true,
    })
  );
  const hasAbuseSupport = matches(ABUSE_PATTERN);
  const hasHealth = matches(HEALTH_PATTERN) || matchesPatterns(TREATMENT_STOP_CORE_PATTERNS);
  const hasLegal = matches(LEGAL_PATTERN);
  const hasFinancial = matches(FINANCIAL_PATTERN);
  const hasMajorDecision = segments.some((segment) =>
    MAJOR_DECISION_SUBJECT_PATTERN.test(segment.searchable)
    && DECISION_OUTSOURCING_PATTERN.test(segment.searchable)
  );
  const hasThirdPartyCertainty = matches(THIRD_PARTY_CERTAINTY_PATTERN);
  const hasRelationshipConflict = matches(RELATIONSHIP_CONFLICT_PATTERN);

  addCategory(categories, "self_harm", hasSelfHarm);
  addCategory(categories, "immediate_danger", hasImmediateDanger);
  addCategory(categories, "urgent_health", hasUrgentHealth);
  addCategory(categories, "manipulation", hasManipulationIntent);
  addCategory(categories, "abuse_support", hasAbuseSupport);
  addCategory(categories, "health", hasHealth);
  addCategory(categories, "legal", hasLegal);
  addCategory(categories, "financial", hasFinancial);
  addCategory(categories, "major_decision", hasMajorDecision);
  addCategory(categories, "third_party_certainty", hasThirdPartyCertainty);
  addCategory(categories, "relationship_conflict", hasRelationshipConflict);

  if (hasSelfHarm || hasUrgentHealth || hasImmediateDanger) {
    const primaryCategory: SafetyCategory = hasSelfHarm
      ? "self_harm"
      : hasImmediateDanger
        ? "immediate_danger"
        : "urgent_health";

    return {
      level: "hard_stop",
      primaryCategory,
      categories,
      userMessage: CRISIS_MESSAGE,
      safetyNote: null,
      soberCheck: null,
      referralLinks: CRISIS_REFERRAL_LINKS,
    };
  }

  if (hasManipulationIntent) {
    return {
      level: "hard_stop",
      primaryCategory: "manipulation",
      categories,
      userMessage: MANIPULATION_MESSAGE,
      safetyNote: null,
      soberCheck: null,
    };
  }

  if (hasAbuseSupport) {
    return {
      level: "bounded",
      primaryCategory: "abuse_support",
      categories,
      userMessage: null,
      safetyNote: SAFETY_NOTES.abuse_support ?? null,
      soberCheck: null,
    };
  }

  if (hasMajorDecision) {
    return {
      level: "sober_check",
      primaryCategory: "major_decision",
      categories,
      userMessage: null,
      safetyNote:
        categories.includes("financial")
          ? SAFETY_NOTES.financial ?? null
          : categories.includes("legal")
            ? SAFETY_NOTES.legal ?? null
            : SAFETY_NOTES.major_decision ?? null,
      soberCheck: SOBER_CHECK,
    };
  }

  const primaryBoundedCategory = getPrimaryBoundedCategory(categories);

  if (primaryBoundedCategory) {
    return {
      level: "bounded",
      primaryCategory: primaryBoundedCategory,
      categories,
      userMessage: null,
      safetyNote: SAFETY_NOTES[primaryBoundedCategory] ?? null,
      soberCheck: null,
    };
  }

  return {
    level: "standard",
    primaryCategory: hasRelationshipConflict ? "relationship_conflict" : null,
    categories,
    userMessage: null,
    safetyNote: null,
    soberCheck: null,
  };
}

export function assessSafetyFields(fields: readonly string[]): SafetyAssessment {
  const assessments = fields
    .map((field) => assessSafetyText(field))
    .filter((assessment) => assessment.categories.length > 0);
  if (assessments.length === 0) {
    return assessSafetyText("");
  }

  const selected = assessments.find((assessment) => assessment.level === "hard_stop")
    ?? assessments.find((assessment) => assessment.primaryCategory === "abuse_support")
    ?? assessments.find((assessment) => assessment.level === "sober_check")
    ?? assessments.find((assessment) => assessment.level === "bounded")
    ?? assessments[0];
  const categories = [...new Set(assessments.flatMap((assessment) => assessment.categories))];

  return { ...selected, categories };
}

export function assertSafetyAllowsGeneration(assessment: SafetyAssessment) {
  if (assessment.level !== "hard_stop") {
    return;
  }

  throw new ReadingServiceError(
    "safety_intercept",
    "问题触发了高风险安全界限保护。",
    403,
    assessment.userMessage ?? "这次请求无法继续生成。",
    assessment.referralLinks,
  );
}
