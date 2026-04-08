import type {
  DrawnCard,
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
    "这段关系里，你最想被真正理解的需求是什么？",
    "如果把注意力从对方反应移回自己，你最需要守住的边界是什么？",
  ],
  career: [
    "哪一部分工作最能暴露你真正想追求的方向？",
    "接下来两周里，什么现实反馈最值得你重点观察？",
  ],
  self_growth: [
    "最近最容易被你忽略、但又一直反复出现的感受是什么？",
    "如果给自己一个更温和的节奏，你现在最需要先放下什么？",
  ],
  decision: [
    "如果暂时不追求一步到位，你最想先验证哪一个小判断？",
    "这次选择里，哪些顾虑来自现实，哪些顾虑来自想象中的最坏结果？",
  ],
  other: [
    "眼下最值得你继续追问的那条线索是什么？",
    "如果把这次解读当作一面镜子，你最先看见了自己哪一部分状态？",
  ],
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

function buildSynthesis(
  question: string,
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

  return `围绕“${question}”，${spread.name}把焦点从 ${opening} 一路带到 ${ending}。${energyTone} 这次更值得关注的主轴是 ${themes.join("、")}。与其急着确认单一答案，不如把它当作一次有层次的观察：哪些线索已经足够清楚，哪些部分仍需要你用更诚实、更稳定的方式慢慢看见。`;
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
  const cards: StructuredReading["cards"] = drawnCards.map((drawnCard) => {
    const position = spread.positions.find((item) => item.id === drawnCard.positionId);

    return {
      card_id: drawnCard.card.id,
      name: drawnCard.card.name,
      english_name: drawnCard.card.englishName,
      orientation: drawnCard.isReversed ? "reversed" : "upright",
      position_id: drawnCard.positionId,
      position: position?.name ?? "未知位置",
      position_meaning:
        position?.description ?? "这个位置提醒你留意问题的关键层面。",
      interpretation: buildCardInterpretation(questionType, spread, drawnCard),
    };
  });

  const themes = deriveThemes(questionType, drawnCards);
  const reflectiveGuidance = uniqueStrings([
    `先观察“${themes[0] ?? QUESTION_TYPE_LENSES[questionType]}”在现实里最常出现在哪些情境。`,
    ...QUESTION_TYPE_GUIDANCE[questionType],
  ]).slice(0, 4);
  const followUpQuestions = QUESTION_TYPE_FOLLOW_UP[questionType].slice(0, 2);

  return {
    cards,
    themes,
    synthesis: buildSynthesis(question, spread, themes, drawnCards),
    reflective_guidance: reflectiveGuidance,
    follow_up_questions: followUpQuestions,
    confidence_note:
      "这次解读更适合作为观察当前模式的线索，而不是对未来结果的确定承诺。",
  };
}

