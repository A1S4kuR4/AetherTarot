import "server-only";

import type { StructuredReading } from "@aethertarot/shared-types";
import type { FollowupAnswer } from "@aethertarot/shared-types";
import {
  assessSafetyFields,
  assessSafetyText,
  type SafetyCategory,
} from "@/server/safety/policy";
import {
  normalizeSafetyRiskView,
  normalizeSafetyText,
} from "@/server/safety/text-normalization";

const USER_DETAIL_LINE_PATTERN = /^(用户补充|现实补充|followup|follow-up answers?)[:：]/i;
const CAPSULE_REDACTED_CATEGORIES: SafetyCategory[] = [
  "self_harm",
  "immediate_danger",
  "urgent_health",
  "manipulation",
  "abuse_support",
  "self_harm_support",
  "third_party_certainty",
];

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function isCapsuleRedFlag(value: string) {
  return [value, normalizeSafetyRiskView(value)].some((candidate) => {
    const assessment = assessSafetyText(candidate);
    return assessment.categories.some((category) =>
      CAPSULE_REDACTED_CATEGORIES.includes(category)
    );
  });
}

export function sanitizeSessionCapsuleFragment(
  value: string,
  maxLength: number,
  redactedReplacement: string | null = null,
) {
  const displayValue = value
    .replace(/\p{Cf}/gu, "")
    .replace(/[\p{Z}\s]+/gu, " ")
    .trim();
  const normalized = normalizeSafetyText(displayValue);

  if (!normalized || USER_DETAIL_LINE_PATTERN.test(normalized)) {
    return redactedReplacement;
  }

  if (isCapsuleRedFlag(normalized)) {
    return redactedReplacement;
  }

  return truncateText(displayValue, maxLength);
}

export function sanitizeIncomingSessionCapsule(
  priorSessionCapsule: string | null,
  maxLength = 280,
) {
  if (!priorSessionCapsule) {
    return null;
  }

  const normalizedWholeCapsule = normalizeSafetyText(priorSessionCapsule);
  if (!normalizedWholeCapsule || isCapsuleRedFlag(normalizedWholeCapsule)) {
    return null;
  }

  const sanitizedLines = [...new Set(
    priorSessionCapsule
      .split(/\r?\n/)
      .map((line) => sanitizeSessionCapsuleFragment(line, maxLength))
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
  | { type: "hard_stop"; reason: string; referral_links?: string[]; policy_version: string; rule_ids: string[] }
  | { type: "sober_check"; sober_check: string; presentation_mode: "sober_anchor"; policy_version: string; rule_ids: string[] }
  | { type: "pass"; policy_version: string; rule_ids: string[] };

export function buildSafetySubjects(
  question: string,
  followupAnswers: FollowupAnswer[] | undefined,
) {
  const answers = followupAnswers
    ?.map((item) => item.answer.trim())
    .filter(Boolean) ?? [];
  return [question.trim(), ...answers].filter(Boolean);
}

export function analyzeIntentFriction(subjects: readonly string[]): IntentFrictionResult {
  const assessment = assessSafetyFields(subjects);
  const diagnostics = {
    policy_version: "safety-rules-v1",
    rule_ids: assessment.categories.map((category) => `input.${category}`),
  };

  if (assessment.level === "hard_stop") {
    return {
      type: "hard_stop",
      reason: assessment.userMessage ?? "这次请求无法继续生成。",
      referral_links: assessment.referralLinks,
      ...diagnostics,
    };
  }

  if (assessment.level === "sober_check" && assessment.soberCheck) {
    return {
      type: "sober_check",
      sober_check: assessment.soberCheck,
      presentation_mode: "sober_anchor",
      ...diagnostics,
    };
  }

  return { type: "pass", ...diagnostics };
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
  subjects,
  reading,
}: {
  subjects: readonly string[];
  reading: StructuredReading;
}) {
  const assessment = assessSafetyFields(subjects);

  if (assessment.level === "hard_stop" || !assessment.safetyNote) {
    return reading;
  }

  if (assessment.primaryCategory === "abuse_support") {
    return withSafetyOverride(
      reading,
      assessment.safetyNote,
      [
        "先确认你此刻是否安全，以及是否有可信任的人知道正在发生什么。",
        "把注意力放在可执行的安全计划、现实支持和个人边界上，避免独自承担或贸然对抗。",
        ...reading.reflective_guidance.slice(0, 1),
      ].slice(0, 4),
      [
        "为了让自己更安全，你现在最需要联系谁或确认哪项现实支持？",
      ],
    );
  }

  if (assessment.primaryCategory === "self_harm_support") {
    return withSafetyOverride(
      reading,
      assessment.safetyNote,
      [
        "把重点放在当下是否安全、可获得的支持，以及需要由合格专业人士判断的现实信息上。",
        ...reading.reflective_guidance.slice(0, 1),
      ],
      ["现在有哪些可信任的人或现实支持可以一起确认安全与下一步？"],
    );
  }

  if (assessment.categories.includes("health")) {
    return withSafetyOverride(
      reading,
      assessment.safetyNote,
      [
        "先把你最担心的症状、变化或疑问整理成具体问题，再交给合格专业人士判断。",
        ...reading.reflective_guidance.slice(0, 2),
      ].slice(0, 4),
      [
        "在现实层面，你最需要尽快确认的健康信息是什么？",
      ],
    );
  }

  if (assessment.categories.includes("legal")) {
    return withSafetyOverride(
      reading,
      assessment.safetyNote,
      [
        "先把你已经确认的事实、证据和仍不确定的部分分开整理。",
        ...reading.reflective_guidance.slice(0, 2),
      ].slice(0, 4),
      [
        "在进入下一步前，你最需要补齐的现实信息或专业意见是什么？",
      ],
    );
  }

  if (assessment.categories.includes("financial")) {
    return withSafetyOverride(
      reading,
      assessment.safetyNote,
      [
        "先确认这笔决定里最关键的风险、期限与承受边界是什么。",
        ...reading.reflective_guidance.slice(0, 2),
      ].slice(0, 4),
      [
        "如果只看现实数据与风险，你最需要先核实哪一项信息？",
      ],
    );
  }

  if (assessment.primaryCategory === "third_party_certainty") {
    return withSafetyOverride(
      reading,
      assessment.safetyNote,
      [
        "把判断依据放回可观察行为、现实沟通与你自己的感受和边界。",
        ...reading.reflective_guidance.slice(0, 1),
      ],
      ["哪些现实行为能帮助你校正对对方想法的推测？"],
    );
  }

  return withSafetyOverride(
    reading,
    assessment.safetyNote,
    [
      "先区分已经确认的事实、风险和仍待验证的推测。",
      ...reading.reflective_guidance.slice(0, 2),
    ].slice(0, 4),
    ["在做决定前，你最需要核实哪项现实信息或底线？"],
  );
}
