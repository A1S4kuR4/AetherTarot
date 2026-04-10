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

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
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

  return `围绕“${question}”，这是第一阶段的独立初读。${spread.name}把焦点从 ${opening} 一路带到 ${ending}。${energyTone} 这次更值得关注的主轴是 ${themes.join("、")}。${PROFILE_GUIDANCE[agentProfile]} 与其急着确认单一答案，不如先看清哪些线索已经足够清楚，哪些部分还需要现实语境来收束。`;
}

function buildFinalSynthesis({
  question,
  initialReading,
  followupAnswers,
}: {
  question: string;
  initialReading: StructuredReading;
  followupAnswers: FollowupAnswer[];
}) {
  const answerSummary = followupAnswers
    .map((item) => `“${item.question}”你的回应是：${item.answer}`)
    .join("；");
  const primaryTheme = initialReading.themes[0] ?? "当前主轴";

  return `围绕“${question}”，第二阶段不会推翻第一阶段的主轴，而是把它收束得更贴近现实。初读里最稳定的线索仍是 ${primaryTheme}。结合你的补充：${answerSummary}。这组牌现在更像是在说：真正的重点不是立刻得到一个绝对结论，而是在已经显露的主题里，看见哪些担心来自事实，哪些来自惯性反应，并为下一步保留可验证的行动空间。`;
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

  const count = agentProfile === "sober" ? 2 : 2;
  return QUESTION_TYPE_FOLLOW_UP[questionType].slice(0, count);
}

export function buildPlaceholderInitialReadingDraft({
  question,
  questionType,
  agentProfile,
  spread,
  drawnCards,
}: {
  question: string;
  questionType: QuestionType;
  agentProfile: AgentProfile;
  spread: Spread;
  drawnCards: DrawnCard[];
}): PlaceholderReadingDraft {
  const cards = buildCards(questionType, spread, drawnCards);
  const themes = deriveThemes(questionType, drawnCards);
  const baseGuidance = uniqueStrings([
    `先观察“${themes[0] ?? QUESTION_TYPE_LENSES[questionType]}”在现实里最常出现在哪些情境。`,
    ...QUESTION_TYPE_GUIDANCE[questionType],
  ]);
  const reflectiveGuidance = agentProfile === "lite"
    ? baseGuidance.slice(0, 2)
    : baseGuidance.slice(0, 4);

  return {
    cards,
    themes,
    synthesis: buildInitialSynthesis(question, agentProfile, spread, themes, drawnCards),
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
}: {
  question: string;
  questionType: QuestionType;
  agentProfile: AgentProfile;
  initialReading: StructuredReading;
  followupAnswers: FollowupAnswer[];
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
    synthesis: buildFinalSynthesis({ question, initialReading, followupAnswers }),
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
}: {
  question: string;
  questionType: QuestionType;
  spread: Spread;
  drawnCards: DrawnCard[];
}): PlaceholderReadingDraft {
  return buildPlaceholderInitialReadingDraft({
    question,
    questionType,
    agentProfile: "standard",
    spread,
    drawnCards,
  });
}