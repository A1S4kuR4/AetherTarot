import "server-only";

import type { StructuredReading } from "@aethertarot/shared-types";

const SELF_HARM_PATTERN =
  /自杀|自残|不想活|活不下去|不该活下去|不该活着|不想继续活|结束生命|伤害自己|suicide|kill myself/i;
const URGENT_HEALTH_PATTERN =
  /急救|急诊|胸痛|无法呼吸|呼吸困难|大量出血|昏迷|服药过量|overdose|emergency|can't breathe/i;
const HEALTH_PATTERN =
  /健康|疾病|生病|诊断|怀孕|治疗|症状|medical|doctor/i;
const LEGAL_PATTERN = /法律|官司|起诉|诉讼|律师|合同|legal/i;
const FINANCIAL_PATTERN = /财务|投资|股票|理财|借贷|贷款|赔偿|finance|money/i;
const MANIPULATION_PATTERN =
  /跟踪|监控|报复|试探|操控|控制他|控制她|pua|勒索|偷窥|家暴|胁迫/i;
const THIRD_PARTY_INTENT_PATTERN =
  /(他|她|对方)(到底|会不会|是不是|真实).{0,8}(爱|想|打算|回|喜欢|讨厌)|secretly feels|come back/i;
const USER_DETAIL_LINE_PATTERN = /^(用户补充|现实补充|followup|follow-up answers?)[:：]/i;

const MAJOR_DECISION_PATTERN =
  /离婚|辞职|分手|退学|堕胎|卖房|买房|投资|炒股|决裂/i;
const MAINLAND_CRISIS_REFERRAL_LINKS = [
  "https://english.beijing.gov.cn/travellinginbeijing/quickguideontravelservices/traveltips/202108/t20210811_2466839.html",
  "https://en.nhc.gov.cn/2025-02/14/c_86392.htm",
  "https://wjw.beijing.gov.cn/English/HealthServices/HealthIndications/201912/t20191216_1236363.html",
];

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function isCapsuleRedFlag(value: string) {
  return (
    SELF_HARM_PATTERN.test(value)
    || URGENT_HEALTH_PATTERN.test(value)
    || MANIPULATION_PATTERN.test(value)
    || THIRD_PARTY_INTENT_PATTERN.test(value)
  );
}

function sanitizeCapsuleLine(line: string) {
  const normalized = line.replace(/\s+/g, " ").trim();

  if (!normalized || USER_DETAIL_LINE_PATTERN.test(normalized)) {
    return null;
  }

  if (isCapsuleRedFlag(normalized)) {
    return null;
  }

  return normalized;
}

export function sanitizeIncomingSessionCapsule(
  priorSessionCapsule: string | null,
  maxLength = 280,
) {
  if (!priorSessionCapsule) {
    return null;
  }

  const sanitizedLines = [...new Set(
    priorSessionCapsule
      .split(/\r?\n/)
      .map((line) => sanitizeCapsuleLine(line))
      .filter((line): line is string => Boolean(line)),
  )].filter((line, _, lines) => {
    if (line !== "延续主轴：") {
      return true;
    }

    return lines.some((candidate) => /^\d+\.\s/.test(candidate));
  });

  const meaningfulLines = sanitizedLines.filter(
    (line) => !/^边界提醒[:：]/.test(line),
  );

  if (meaningfulLines.length === 0) {
    return null;
  }

  return truncateText(sanitizedLines.join("\n"), maxLength);
}

export type IntentFrictionResult =
  | { type: "hard_stop"; reason: string; referral_links?: string[] }
  | { type: "sober_check"; sober_check: string; presentation_mode: "sober_anchor" }
  | { type: "pass" };

export function analyzeIntentFriction(question: string): IntentFrictionResult {
  if (SELF_HARM_PATTERN.test(question) || URGENT_HEALTH_PATTERN.test(question)) {
    return {
      type: "hard_stop",
      reason:
        "系统检测到这次提问可能已经触及现实中的身体安全、紧急健康或心理危机风险。塔罗不能承担这类判断。请先按这个顺序寻求现实支持：如有急性医疗风险先拨打 120；如有人身威胁、暴力或现实危险先拨打 110；如你处在强烈绝望、崩溃或需要立即心理支持的状态，请尽快拨打 12356 心理援助热线。",
      referral_links: MAINLAND_CRISIS_REFERRAL_LINKS,
    };
  }

  if (MANIPULATION_PATTERN.test(question)) {
    return {
      type: "hard_stop",
      reason: "AetherTarot 不提供对第三方行为的监控、控制或操控推演。我们需要尊重他人的隐私与边界。",
    };
  }

  if (LEGAL_PATTERN.test(question) || FINANCIAL_PATTERN.test(question) || MAJOR_DECISION_PATTERN.test(question)) {
    return {
      type: "sober_check",
      sober_check: "你的问题似乎涉及重大的财务、法律或人生的关键转折（如分开、转行、诉讼）。在抽取塔罗牌前，请你先写下：如果不管塔罗怎么说，你目前心里最真实的顾虑或底线计划是什么？",
      presentation_mode: "sober_anchor",
    };
  }

  return { type: "pass" };
}

function withSafetyOverride(
  reading: StructuredReading,
  safetyNote: string,
  reflectiveGuidance?: string[],
  followUpQuestions?: string[],
) {
  return {
    ...reading,
    safety_note: safetyNote,
    reflective_guidance:
      reflectiveGuidance ?? reading.reflective_guidance,
    follow_up_questions:
      followUpQuestions ?? reading.follow_up_questions,
  };
}

export function applySafetyReview({
  question,
  reading,
}: {
  question: string;
  reading: StructuredReading;
}) {
  if (SELF_HARM_PATTERN.test(question) || URGENT_HEALTH_PATTERN.test(question)) {
    return withSafetyOverride(
      reading,
      "如果你现在正处在想要伤害自己、无法确保自身安全，或强烈绝望的状态，这次塔罗解读不能替代现实支持。请优先联系你信任的人、当地紧急服务或危机干预热线，先把安全放在第一位。",
      [
        "先把注意力放回现实支持：急性医疗风险优先拨打 120，现实危险或暴力风险优先拨打 110。",
        "如果你感到自己可能会立刻伤害自己，请不要独自承受，优先拨打 12356 心理援助热线或联系身边可信任的人。",
        "等安全感稍微恢复后，再回头整理这次问题真正牵动你的核心是什么。",
      ],
      [
        "现在谁是你可以立刻联系、并明确告诉对方你需要陪伴的人？",
      ],
    );
  }

  if (MANIPULATION_PATTERN.test(question)) {
    return withSafetyOverride(
      reading,
      "AetherTarot 不会帮助你确认第三方的绝对想法，也不鼓励跟踪、操控、报复、试探或其他会伤害他人边界的做法。更值得关注的是这段关系里你自己的安全、需求与界限。",
      [
        "先确认这件事是否已经影响到你或他人的现实安全与边界。",
        "把关注点从控制对方的反应，转向你能怎样保护自己、表达需求与设定界限。",
        ...reading.reflective_guidance.slice(0, 1),
      ].slice(0, 4),
      [
        "如果不再试图控制对方，你最需要为自己守住的底线是什么？",
      ],
    );
  }

  if (HEALTH_PATTERN.test(question)) {
    return withSafetyOverride(
      reading,
      "这次解读可以帮助你整理焦虑与关注点，但不能替代医疗判断、诊断或治疗建议。若问题已经涉及身体症状、怀孕、用药或疾病风险，请尽快咨询合格专业人士。",
      [
        "先把你最担心的症状、变化或疑问整理成具体问题，再交给合格专业人士判断。",
        ...reading.reflective_guidance.slice(0, 2),
      ].slice(0, 4),
      [
        "在现实层面，你最需要尽快确认的健康信息是什么？",
      ],
    );
  }

  if (LEGAL_PATTERN.test(question)) {
    return withSafetyOverride(
      reading,
      "这次解读更适合作为整理顾虑与决策维度的线索，不能替代法律意见。若你正面临合同、诉讼、权益或责任判断，请结合真实资料咨询合格法律专业人士。",
      [
        "先把你已经确认的事实、证据和仍不确定的部分分开整理。",
        ...reading.reflective_guidance.slice(0, 2),
      ].slice(0, 4),
      [
        "在进入下一步前，你最需要补齐的现实信息或专业意见是什么？",
      ],
    );
  }

  if (FINANCIAL_PATTERN.test(question)) {
    return withSafetyOverride(
      reading,
      "塔罗不能替代财务、投资或风险管理建议。若问题涉及借贷、投资、赔偿或重大金钱决策，请把这次解读当作整理顾虑的辅助线索，并结合现实数据与专业意见判断。",
      [
        "先确认这笔决定里最关键的风险、期限与承受边界是什么。",
        ...reading.reflective_guidance.slice(0, 2),
      ].slice(0, 4),
      [
        "如果只看现实数据与风险，你最需要先核实哪一项信息？",
      ],
    );
  }

  return reading;
}
