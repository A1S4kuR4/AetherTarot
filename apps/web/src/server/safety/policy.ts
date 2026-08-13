import { ReadingServiceError } from "@/server/reading/errors";
import {
  hasSafetyMatch,
  segmentSafetyText,
  segmentSafetyRiskText,
  type SafetyPattern,
} from "@/server/safety/text-normalization";
import {
  findSafetySemanticFamilies,
  SELF_HARM_REPORTED_CONTEXTS,
  SELF_HARM_SUPPORT_CONTEXTS,
  SUPPORT_REQUEST_CONTEXTS,
  VICTIM_REPORT_CONTEXTS,
  VICTIM_SUPPORT_CONTEXTS,
  type SafetySemanticFamilyId,
} from "@/server/safety/semantic-rules";

export type SafetyLevel = "standard" | "bounded" | "sober_check" | "hard_stop";

export type SafetyCategory =
  | "self_harm"
  | "immediate_danger"
  | "urgent_health"
  | "manipulation"
  | "abuse_support"
  | "self_harm_support"
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

const HEALTH_PATTERN =
  /健康|疾病|生病|诊断|怀孕|治疗|症状|用药|服药|药物|medical|doctor|pregnan|medicine|medication/i;
const LEGAL_PATTERN = /法律|官司|起诉|诉讼|律师|合同|权益|责任|legal|lawsuit/i;
const FINANCIAL_PATTERN =
  /财务|投资|股票|理财|借贷|贷款|赔偿|积蓄|finance|money|stock|loan|invest|saving/i;
const ABUSE_PATTERN =
  /家暴|家庭暴力|亲密关系暴力|暴力对待|我被.{0,8}(?:打|威胁|恐吓|胁迫|勒索|监控|监视|跟踪|控制)|(?:伴侣|丈夫|妻子|老公|老婆|前任|对方|他|她).{0,8}(?:打我|威胁我|恐吓我|胁迫我|勒索我|监控我|监视我|跟踪我|控制我)|abuse|abusive|stalking me|tracking me|controlling me|being stalked|being tracked|being monitored|being controlled/i;
const THIRD_PARTY_CERTAINTY_PATTERN =
  /(?:他|她|对方)(?:到底|会不会|是不是|一定|肯定|真实).{0,10}(?:爱|想|打算|回来|喜欢|讨厌|离开)|真实想法|心里(?:到底)?想|secretly feels|definitely loves|come back/i;
const RELATIONSHIP_CONFLICT_PATTERN =
  /争吵|吵架|冷战|沟通困难|关系紧张|关系矛盾|相处不顺|relationship conflict|keep arguing/i;
const MAJOR_DECISION_SUBJECT_PATTERN =
  /离婚|辞职|分手|退学|堕胎|卖房|买房|大额投资|全部积蓄|炒股|起诉|诉讼|决裂|all in|quit my job|quitmyjob|divorce|invest all my savings|investallmysavings/i;
const DECISION_OUTSOURCING_PATTERN =
  /要不要|该不该|应不应该|是否应该|我应该|帮我决定|替我决定|告诉我该|should i|shouldi|decide for me|decideforme/i;

export const CRISIS_REFERRAL_LINKS = [
  "https://english.beijing.gov.cn/travellinginbeijing/quickguideontravelservices/traveltips/202108/t20210811_2466839.html",
  "https://en.nhc.gov.cn/2025-02/14/c_86392.htm",
  "https://wjw.beijing.gov.cn/English/HealthServices/HealthIndications/201912/t20191216_1236363.html",
];

export const CRISIS_MESSAGE =
  "系统检测到这次提问可能已经触及现实中的身体安全、紧急健康或心理危机风险。塔罗不能承担这类判断。请先按这个顺序寻求现实支持：如有急性医疗风险先拨打 120；如有人身威胁、暴力或现实危险先拨打 110；如你处在强烈绝望、崩溃或需要立即心理支持的状态，请尽快拨打 12356 心理援助热线。";
export const MANIPULATION_MESSAGE =
  "AetherTarot 不提供跟踪、监控、报复、勒索或操控第三方的方法。请把关注点转回现实安全、个人边界与不伤害他人的沟通方式。";
export const SOBER_CHECK =
  "你的问题涉及重大的现实决定。在查看塔罗解读前，请先写下：如果不管塔罗怎么说，你目前最真实的顾虑、可核实事实和底线计划是什么？";

export const SAFETY_NOTES: Partial<Record<SafetyCategory, string>> = {
  abuse_support:
    "如果这段关系中存在暴力、威胁、胁迫、跟踪或控制，现实安全应高于塔罗解释。请优先评估当下风险、联系可信任的人或合格支持资源，并避免独自承担或贸然对抗。",
  self_harm_support:
    "这次内容只适合用于理解、恢复支持或帮助他人，不能替代危机评估。若你或当事人的安全状态发生变化，请优先联系可信任的人、合格专业支持或当地紧急资源。",
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
    "self_harm_support",
    "health",
    "legal",
    "financial",
    "third_party_certainty",
  ];

  return priority.find((category) => categories.includes(category)) ?? null;
}

export function assessSafetyText(text: string): SafetyAssessment {
  const segments = segmentSafetyText(text);
  const riskSegments = segmentSafetyRiskText(text);
  const matches = (pattern: RegExp) => segments.some((segment) =>
    pattern.test(segment.searchable)
  );
  const matchesPatterns = (patterns: readonly SafetyPattern[]) => segments.some((segment) =>
    hasSafetyMatch(segment, patterns)
  );
  const categories: SafetyCategory[] = [];
  const matchedFamilyIds = new Set<SafetySemanticFamilyId>(
    [...findSafetySemanticFamilies(segments, "input"),
      ...findSafetySemanticFamilies(riskSegments, "input")]
      .map((family) => family.id),
  );
  const hasCrossSegmentSelfHarmSupport = matchesPatterns(
    SELF_HARM_REPORTED_CONTEXTS,
  ) && matchesPatterns(SUPPORT_REQUEST_CONTEXTS);
  const hasSelfHarm = matchedFamilyIds.has("self_harm_state");
  const hasUrgentHealth = matchedFamilyIds.has("urgent_medical_danger")
    || matchedFamilyIds.has("treatment_discontinuation");
  const hasImmediateDanger = matchedFamilyIds.has("violence_toward_others");
  const hasManipulationIntent = matchedFamilyIds.has("stalking_monitoring_control");
  const hasCrossSegmentVictimSupport = matchesPatterns(VICTIM_REPORT_CONTEXTS)
    && matchesPatterns(SUPPORT_REQUEST_CONTEXTS);
  const hasAbuseSupport = matches(ABUSE_PATTERN)
    || matchesPatterns(VICTIM_SUPPORT_CONTEXTS)
    || hasCrossSegmentVictimSupport;
  const hasSelfHarmSupport = matchesPatterns(SELF_HARM_SUPPORT_CONTEXTS)
    || hasCrossSegmentSelfHarmSupport;
  const hasHealth = matches(HEALTH_PATTERN)
    || matchedFamilyIds.has("treatment_discontinuation");
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
  addCategory(categories, "self_harm_support", hasSelfHarmSupport);
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
