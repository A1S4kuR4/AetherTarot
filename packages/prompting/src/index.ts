import type {
  AgentProfile,
  DrawnCard,
  FollowupAnswer,
  QuestionType,
  Spread,
  StructuredReading,
} from "@aethertarot/shared-types";

type PlaceholderReadingDraft = Pick<
  StructuredReading,
  | "cards"
  | "themes"
  | "synthesis"
  | "reflective_guidance"
  | "follow_up_questions"
  | "confidence_note"
>;

const QUESTION_TYPE_LENSES: Record<QuestionType, string> = {
  relationship: "关系节奏与边界",
  career: "行动方向与职业节奏",
  self_growth: "内在状态与成长课题",
  decision: "选择依据与现实权衡",
  other: "当下主题与能量走向",
};

const QUESTION_TYPE_GUIDANCE: Record<QuestionType, string[]> = {
  relationship: [
    "先观察你真正想确认的是关系结果，还是关系里自己的需求与边界。",
    "把最强烈的情绪和最稳定的事实分开看，会更容易看清这段关系的真实张力。",
    "如果需要行动，优先选择让沟通更清楚而不是让关系更紧绷的方式。",
  ],
  career: [
    "先梳理哪些任务让你更有能量，哪些任务只是让你更焦虑。",
    "比起立刻决定去留，更值得先确认你下一步最需要补齐的能力或信息是什么。",
    "给自己一个短周期观察点，看看现实反馈是否支持你当前的方向感。",
  ],
  self_growth: [
    "先记录最近最反复出现的情绪或念头，它们往往比表面问题更接近核心。",
    "允许自己先看见真实状态，再决定要不要马上做出改变。",
    "把这次解读转成一个具体的小观察，而不是对自己的新一轮苛责。",
  ],
  decision: [
    "先确认你现在最怕失去的是什么，再看这个担心是否正在放大判断。",
    "把选择拆成可验证的小步骤，比一次性逼自己得出结论更稳。",
    "若仍然犹豫，可以先为两个方向各设一个现实检验点。",
  ],
  other: [
    "先把最牵动你的那一层写下来，避免问题被更大的情绪雾气盖住。",
    "这次解读更适合帮你整理模式，而不是替你抢先宣布结论。",
    "如果要采取行动，优先选择那个能带来更多清晰度的步骤。",
  ],
};

const QUESTION_TYPE_FOLLOW_UP: Record<QuestionType, string[]> = {
  relationship: [
    "这张牌所指向的关系张力里，你更像是在担心失去连接，还是担心失去自己的边界？",
    "如果把注意力从对方反应移回自己，哪张牌的位置最贴近你现在最需要守住的底线？",
  ],
  career: [
    "这组牌里最卡住行动的位置，对应到现实工作中是哪一类任务、关系或选择？",
    "接下来两周里，什么现实反馈最能验证这组牌提示的职业节奏？",
  ],
  self_growth: [
    "这组牌里最反复出现的情绪线索，最近在你的生活里通常什么时候被触发？",
    "如果先不急着改变，你最想从哪张牌的位置开始重新理解自己？",
  ],
  decision: [
    "这次牌阵里最提醒你放慢的位置，对应到现实里是哪一个还没有被确认的条件？",
    "如果暂时不让塔罗替你定答案，你最需要先验证哪一个小判断？",
  ],
  other: [
    "眼下最值得你继续追问的那条牌面线索，和现实中的哪件事最有关？",
    "如果把这次初读当作一面镜子，你最先看见了自己哪一部分状态？",
  ],
};

const PROFILE_GUIDANCE: Record<AgentProfile, string> = {
  lite: "这次先保留轻量判断，不急着展开过多分支。",
  standard: "这次适合先让牌面建立主轴，再用你的补充来校准解释空间。",
  sober: "这次需要把牌面启发和现实条件并排放置，避免把决定完全交给解读。",
};

export interface ReadingPrompt {
  system: string;
  user: string;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function summarizePriorSessionCapsule(priorSessionCapsule: string | null) {
  if (!priorSessionCapsule) {
    return null;
  }

  const condensed = priorSessionCapsule.replace(/\s+/g, " ").trim();

  if (!condensed) {
    return null;
  }

  if (condensed.length <= 110) {
    return condensed;
  }

  return `${condensed.slice(0, 109)}…`;
}

function extractPriorSessionThemes(priorSessionCapsule: string | null) {
  if (!priorSessionCapsule) {
    return [];
  }

  const match = priorSessionCapsule.match(/核心主题：([^\n]+)/);

  if (!match?.[1]) {
    return [];
  }

  return match[1]
    .split(/[、,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function buildPriorSessionCapsuleBridge(priorSessionCapsule: string | null) {
  const themes = extractPriorSessionThemes(priorSessionCapsule);

  if (themes.length > 0) {
    return `上一轮延续线索提示你此前反复围绕 ${themes.join("、")} 这类主题展开，但这次仍以你当前的问题、当前牌阵与本轮抽牌为主轴。`;
  }

  if (!summarizePriorSessionCapsule(priorSessionCapsule)) {
    return null;
  }

  return "上一轮延续线索会作为低优先级背景保留，但这次仍以你当前的问题、当前牌阵与本轮抽牌为主轴。";
}

function getKeywords(drawnCard: DrawnCard) {
  return drawnCard.isReversed
    ? drawnCard.card.reversedKeywords.slice(0, 2)
    : drawnCard.card.uprightKeywords.slice(0, 2);
}

function buildCardInterpretation(
  questionType: QuestionType,
  spread: Spread,
  drawnCard: DrawnCard,
) {
  const position = spread.positions.find((item) => item.id === drawnCard.positionId);
  const keywords = getKeywords(drawnCard);
  const keywordSummary = keywords.join("、") || "正在成形的线索";
  const orientation = drawnCard.isReversed ? "逆位" : "正位";
  const lens = QUESTION_TYPE_LENSES[questionType];

  return `${position?.name ?? "未知位置"} 出现 ${drawnCard.card.name}（${orientation}），把这个位置的关注点拉向 ${keywordSummary}。结合“${position?.description ?? "此位置提示你留意当下的关键层面。"}”，这张牌更像是在提醒你从 ${lens} 的角度，重新看见 ${drawnCard.card.description}`;
}

function deriveThemes(questionType: QuestionType, drawnCards: DrawnCard[]) {
  const keywordThemes = uniqueStrings(
    drawnCards.flatMap((drawnCard) => getKeywords(drawnCard)),
  ).slice(0, 3);

  return uniqueStrings([
    QUESTION_TYPE_LENSES[questionType],
    ...keywordThemes,
  ]).slice(0, 4);
}

function buildInitialSynthesis(
  question: string,
  agentProfile: AgentProfile,
  spread: Spread,
  themes: string[],
  drawnCards: DrawnCard[],
  priorSessionCapsule: string | null,
) {
  const reversedCount = drawnCards.filter((drawnCard) => drawnCard.isReversed).length;
  const opening = spread.positions[0]?.name ?? "开端";
  const ending = spread.positions.at(-1)?.name ?? "收束";
  const energyTone =
    reversedCount === 0
      ? "整组牌的能量相对顺流，说明你已经拥有一部分可被调用的资源。"
      : reversedCount >= Math.ceil(drawnCards.length / 2)
        ? "逆位出现得更集中，说明真正需要处理的也许不是外部事件本身，而是内在节奏与表达方式。"
        : "这组牌里既有推进也有迟疑，提醒你在行动前先厘清真正的优先级。";

  const continuityBridge = buildPriorSessionCapsuleBridge(priorSessionCapsule);

  return `围绕“${question}”，这是第一阶段的独立初读。${spread.name}把焦点从 ${opening} 一路带到 ${ending}。${energyTone} 这次更值得关注的主轴是 ${themes.join("、")}。${PROFILE_GUIDANCE[agentProfile]} ${continuityBridge ?? "当前问题仍然比任何旧线索更重要。"} 与其急着确认单一答案，不如先看清哪些线索已经足够清楚，哪些部分还需要现实语境来收束。`;
}

function buildFinalSynthesis({
  question,
  initialReading,
  followupAnswers,
  priorSessionCapsule,
}: {
  question: string;
  initialReading: StructuredReading;
  followupAnswers: FollowupAnswer[];
  priorSessionCapsule: string | null;
}) {
  const answerSummary = followupAnswers
    .map((item) => `“${item.question}”你的回应是：${item.answer}`)
    .join("；");
  const primaryTheme = initialReading.themes[0] ?? "当前主轴";

  const continuityBridge = buildPriorSessionCapsuleBridge(priorSessionCapsule);

  return `围绕“${question}”，第二阶段不会推翻第一阶段的主轴，而是把它收束得更贴近现实。初读里最稳定的线索仍是 ${primaryTheme}。结合你的补充：${answerSummary}。${continuityBridge ?? "上一轮线索若有存在，也只作为背景参照。"} 这组牌现在更像是在说：真正的重点不是立刻得到一个绝对结论，而是在已经显露的主题里，看见哪些担心来自事实，哪些来自惯性反应，并为下一步保留可验证的行动空间。`;
}

function buildCards(
  questionType: QuestionType,
  spread: Spread,
  drawnCards: DrawnCard[],
) {
  return drawnCards.map((drawnCard) => {
    const position = spread.positions.find((item) => item.id === drawnCard.positionId);

    return {
      card_id: drawnCard.card.id,
      name: drawnCard.card.name,
      english_name: drawnCard.card.englishName,
      orientation: drawnCard.isReversed ? "reversed" as const : "upright" as const,
      position_id: drawnCard.positionId,
      position: position?.name ?? "未知位置",
      position_meaning:
        position?.description ?? "这个位置提醒你留意问题的关键层面。",
      interpretation: buildCardInterpretation(questionType, spread, drawnCard),
    };
  });
}

function selectFollowUpQuestions(
  questionType: QuestionType,
  agentProfile: AgentProfile,
) {
  if (agentProfile === "lite") {
    return [];
  }

  return QUESTION_TYPE_FOLLOW_UP[questionType].slice(0, 2);
}

function formatSpread(spread: Spread) {
  return [
    `牌阵：${spread.name} (${spread.englishName})`,
    `牌阵说明：${spread.description}`,
    "位置语义：",
    ...spread.positions.map(
      (position, index) =>
        `${index + 1}. ${position.name} [${position.id}] - ${position.description}`,
    ),
  ].join("\n");
}

function formatDrawnCards(spread: Spread, drawnCards: DrawnCard[]) {
  return drawnCards
    .map((drawnCard, index) => {
      const position = spread.positions.find((item) => item.id === drawnCard.positionId);
      const orientation = drawnCard.isReversed ? "reversed" : "upright";
      const keywords = getKeywords(drawnCard).join(" / ") || "无";

      return [
        `Card ${index + 1}:`,
        `- position_id: ${drawnCard.positionId}`,
        `- position: ${position?.name ?? "未知位置"}`,
        `- position_meaning: ${position?.description ?? "未知位置含义"}`,
        `- card_id: ${drawnCard.card.id}`,
        `- name: ${drawnCard.card.name}`,
        `- english_name: ${drawnCard.card.englishName}`,
        `- orientation: ${orientation}`,
        `- keywords: ${keywords}`,
        `- description: ${drawnCard.card.description}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatInitialReading(initialReading: StructuredReading) {
  return [
    `reading_id: ${initialReading.reading_id}`,
    `themes: ${initialReading.themes.join(" | ")}`,
    `synthesis: ${initialReading.synthesis}`,
    "cards:",
    ...initialReading.cards.map((card, index) =>
      `${index + 1}. ${card.position} / ${card.name} / ${card.orientation} / ${card.interpretation}`,
    ),
    "reflective_guidance:",
    ...initialReading.reflective_guidance.map((item, index) => `${index + 1}. ${item}`),
    "follow_up_questions:",
    ...initialReading.follow_up_questions.map((item, index) => `${index + 1}. ${item}`),
    `confidence_note: ${initialReading.confidence_note ?? "无"}`,
  ].join("\n");
}

function formatFollowupAnswers(followupAnswers: FollowupAnswer[]) {
  return followupAnswers
    .map(
      (item, index) =>
        `${index + 1}. question: ${item.question}\n   answer: ${item.answer}`,
    )
    .join("\n");
}

function buildOutputContract({
  phase,
  agentProfile,
}: {
  phase: "initial" | "final";
  agentProfile: AgentProfile;
}) {
  const followupRule =
    phase === "final"
      ? "follow_up_questions: return 0-1 extension question only."
      : agentProfile === "lite"
        ? "follow_up_questions: return 0-1 question."
        : agentProfile === "sober"
          ? "follow_up_questions: return 1-2 reality-check questions anchored to card tension, boundary, risk, or missing condition."
          : "follow_up_questions: return 1-2 questions anchored to card tension, position semantics, or missing reality context.";

  return [
    "Return JSON only. Do not wrap in markdown fences.",
    "All user-visible prose must be fluent natural Simplified Chinese (zh-CN).",
    "Never output pseudo-Chinese fragments, transliterated garbage tokens, or placeholder text.",
    "Never expose chain-of-thought, hidden reasoning, thinking preambles, analysis traces, or model self-identification.",
    "Do not fabricate hidden motives, private thoughts, or unverified feelings for any third party.",
    "If relationship tension is inferred, frame it as observable relational dynamics, communication patterns, or unmet needs, not as certainty about what the other person feels or intends.",
    "Allowed top-level keys only:",
    "- cards",
    "- themes",
    "- synthesis",
    "- reflective_guidance",
    "- follow_up_questions",
    "- confidence_note",
    "Do not return metadata such as reading_id, locale, question_type, reading_phase, requires_followup, spread, safety_note, session_capsule, sober_check, or presentation_mode.",
    "cards must be an array aligned with the authority drawn card order.",
    "Each card item must include: card_id, name, english_name, orientation, position_id, position, position_meaning, interpretation.",
    "For card metadata fields (card_id, name, english_name, orientation, position_id, position, position_meaning), copy the authority values exactly and do not rewrite, translate, paraphrase, or invent replacements.",
    "themes: 2-4 short, concrete thematic labels only; avoid headline packaging, stacked metaphors, or decorative category names.",
    "reflective_guidance: 2-4 items.",
    followupRule,
    "If you return more than one follow_up_questions item, each question must be materially distinct.",
    "confidence_note: one short sentence that preserves uncertainty and avoids certainty claims.",
  ].join("\n");
}

function buildSafetyBoundarySummary() {
  return [
    "Safety and expression boundaries:",
    "- Tarot is reflective, not deterministic prophecy.",
    "- Do not claim certainty about future events or third-party intent.",
    "- Do not assign inner motives, secret thoughts, or emotional certainty to another person unless the user has already stated them as their own observation.",
    "- Do not give medical, legal, financial, or manipulative advice.",
    "- Do not generate safety_note, sober_check, or presentation_mode.",
    "- Let cards speak first; do not ask for broad background that the cards should already illuminate.",
    "- Keep every visible sentence readable and natural in Simplified Chinese.",
  ].join("\n");
}

export function buildPlaceholderInitialReadingDraft({
  question,
  questionType,
  agentProfile,
  spread,
  drawnCards,
  priorSessionCapsule,
}: {
  question: string;
  questionType: QuestionType;
  agentProfile: AgentProfile;
  spread: Spread;
  drawnCards: DrawnCard[];
  priorSessionCapsule: string | null;
}): PlaceholderReadingDraft {
  const cards = buildCards(questionType, spread, drawnCards);
  const themes = deriveThemes(questionType, drawnCards);
  const baseGuidance = uniqueStrings([
    `先观察“${themes[0] ?? QUESTION_TYPE_LENSES[questionType]}”在现实里最常出现在哪些情境。`,
    ...(priorSessionCapsule
      ? ["若上一轮的线索仍在回响，把它当作背景参照，不要让它盖过这一次真正的新问题。"] 
      : []),
    ...QUESTION_TYPE_GUIDANCE[questionType],
  ]);
  const reflectiveGuidance = agentProfile === "lite"
    ? baseGuidance.slice(0, 2)
    : baseGuidance.slice(0, 4);

  return {
    cards,
    themes,
    synthesis: buildInitialSynthesis(
      question,
      agentProfile,
      spread,
      themes,
      drawnCards,
      priorSessionCapsule,
    ),
    reflective_guidance: reflectiveGuidance,
    follow_up_questions: selectFollowUpQuestions(questionType, agentProfile),
    confidence_note:
      "这是第一阶段初读，更适合作为牌面主轴与解释方向；用户补充只能帮助收束，不应把它改写成绝对结论。",
  };
}

export function buildPlaceholderFinalReadingDraft({
  question,
  questionType,
  agentProfile,
  initialReading,
  followupAnswers,
  priorSessionCapsule,
}: {
  question: string;
  questionType: QuestionType;
  agentProfile: AgentProfile;
  initialReading: StructuredReading;
  followupAnswers: FollowupAnswer[];
  priorSessionCapsule: string | null;
}): PlaceholderReadingDraft {
  const finalGuidance = uniqueStrings([
    `保留初读里的“${initialReading.themes[0] ?? QUESTION_TYPE_LENSES[questionType]}”作为观察主轴。`,
    "把你补充的信息拆成事实、感受和推测三类，再决定下一步行动。",
    agentProfile === "sober"
      ? "在做重大决定前，先确认现实资源、风险承受边界和可咨询的专业对象。"
      : "先选择一个低风险的小动作，验证牌面提示是否真的对应现实反馈。",
    ...initialReading.reflective_guidance.slice(0, 1),
  ]).slice(0, 4);

  return {
    cards: initialReading.cards,
    themes: initialReading.themes,
    synthesis: buildFinalSynthesis({
      question,
      initialReading,
      followupAnswers,
      priorSessionCapsule,
    }),
    reflective_guidance: finalGuidance,
    follow_up_questions: [
      "经过这次补充后，你最愿意在现实中先验证哪一个小信号？",
    ],
    confidence_note:
      "这是第二阶段整合深读。它延续第一阶段的牌面主轴，并结合你的补充信息做校正；它仍然不是对未来的确定承诺。",
  };
}

export function buildPlaceholderReadingDraft({
  question,
  questionType,
  spread,
  drawnCards,
  priorSessionCapsule,
}: {
  question: string;
  questionType: QuestionType;
  spread: Spread;
  drawnCards: DrawnCard[];
  priorSessionCapsule: string | null;
}): PlaceholderReadingDraft {
  return buildPlaceholderInitialReadingDraft({
    question,
    questionType,
    agentProfile: "standard",
    spread,
    drawnCards,
    priorSessionCapsule,
  });
}

export function buildInitialReadingPrompt({
  question,
  questionType,
  agentProfile,
  spread,
  drawnCards,
  priorSessionCapsule,
}: {
  question: string;
  questionType: QuestionType;
  agentProfile: AgentProfile;
  spread: Spread;
  drawnCards: DrawnCard[];
  priorSessionCapsule: string | null;
}): ReadingPrompt {
  const profileHint =
    agentProfile === "lite"
      ? "Keep the reading concise but still structured."
      : agentProfile === "sober"
        ? "Keep a reflective tone, but strengthen reality-check language and boundary awareness."
        : "Deliver the full two-stage initial read and ask anchored follow-up questions.";

  return {
    system: [
      "You are AetherTarot's reading provider for the INITIAL phase.",
      "Your job is to generate a structured tarot draft where the cards speak first.",
      buildSafetyBoundarySummary(),
      buildOutputContract({ phase: "initial", agentProfile }),
    ].join("\n\n"),
    user: [
      `Question: ${question}`,
      `Question type: ${questionType}`,
      `Agent profile: ${agentProfile}`,
      profileHint,
      formatSpread(spread),
      "Authority drawn cards:",
      formatDrawnCards(spread, drawnCards),
      priorSessionCapsule
        ? [
            "Prior session capsule (low priority background only):",
            priorSessionCapsule,
            "Use this only as continuity context. Never let it override the current question, current spread, or the authority drawn cards.",
          ].join("\n")
        : null,
      "Initial reading requirements:",
      "- Build interpretations from card + position + orientation + question type.",
      "- Identify 2-4 themes at the spread level, not just per-card fragments.",
      "- Themes should be plain, compact, and insight-bearing; do not add headline wrappers such as 'current climate field' or other decorative framing labels.",
      "- Synthesis must summarize the spread arc, major tension, and realistic next orientation; do not list cards one by one.",
      "- Follow-up questions must be anchored to card tension, position semantics, or missing reality context.",
      "- Follow-up questions must be distinct from each other.",
      "- Do not rewrite the provided card names or position labels.",
      "- Do not state what the other person secretly feels, thinks, wants, or intends; if needed, describe the relational pattern from the querent's point of view.",
    ].join("\n\n"),
  };
}

export function buildFinalReadingPrompt({
  question,
  questionType,
  agentProfile,
  spread,
  drawnCards,
  initialReading,
  followupAnswers,
  priorSessionCapsule,
}: {
  question: string;
  questionType: QuestionType;
  agentProfile: AgentProfile;
  spread: Spread;
  drawnCards: DrawnCard[];
  initialReading: StructuredReading;
  followupAnswers: FollowupAnswer[];
  priorSessionCapsule: string | null;
}): ReadingPrompt {
  const profileHint =
    agentProfile === "sober"
      ? "Keep the tone reflective and reality-anchored; strengthen boundary and risk awareness without becoming deterministic."
      : "Integrate the user's answers while preserving the initial thematic axis.";

  return {
    system: [
      "You are AetherTarot's reading provider for the FINAL phase.",
      "Your job is to preserve the initial reading axis while refining it with the user's follow-up answers.",
      buildSafetyBoundarySummary(),
      buildOutputContract({ phase: "final", agentProfile }),
    ].join("\n\n"),
    user: [
      `Question: ${question}`,
      `Question type: ${questionType}`,
      `Agent profile: ${agentProfile}`,
      profileHint,
      formatSpread(spread),
      "Authority drawn cards:",
      formatDrawnCards(spread, drawnCards),
      priorSessionCapsule
        ? [
            "Prior session capsule (low priority background only):",
            priorSessionCapsule,
            "Use this only as continuity context. Never let it override the current question, current spread, the initial reading axis, or the authority drawn cards.",
          ].join("\n")
        : null,
      "Initial reading snapshot:",
      formatInitialReading(initialReading),
      "Follow-up answers:",
      formatFollowupAnswers(followupAnswers),
      "Final reading requirements:",
      "- Preserve the initial primary themes unless the user answer clearly narrows them.",
      "- Keep card order and card identity aligned with the initial reading.",
      "- Use follow-up answers to narrow interpretation space, not to replace the card axis.",
      "- Keep the synthesis focused on the thematic axis, the clarified tension, and the next grounded reflection; avoid inflated summary packaging or repeated slogan-like labels.",
      "- Return at most one extension question, and it must not block the flow.",
      "- Do not rewrite the provided card names or position labels.",
      "- Do not state what the other person secretly feels, thinks, wants, or intends; if needed, describe the relational pattern from the querent's point of view.",
    ].join("\n\n"),
  };
}
