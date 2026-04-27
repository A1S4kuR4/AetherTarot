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

function getSpreadPositionName(spread: Spread, positionId: string, fallback: string) {
  return spread.positions.find((position) => position.id === positionId)?.name ?? fallback;
}

function buildSpreadSpecificInitialAxis(spread: Spread) {
  switch (spread.id) {
    case "single": {
      const focus = getSpreadPositionName(spread, "focus", "核心指引");

      return `${spread.name} 这次只保留「${focus}」这一处焦点，因此这张牌只能作为观察入口，不能被读成已经替用户裁定答案。`;
    }
    case "holy-triangle": {
      const past = getSpreadPositionName(spread, "past", "过去");
      const present = getSpreadPositionName(spread, "present", "现在");
      const future = getSpreadPositionName(spread, "future", "潜在流向");

      return `${spread.name} 这次应按「${past} -> ${present} -> ${future}」阅读，把牌面放回时间与因果路径中，而不是孤立挑出一张牌下结论。`;
    }
    case "four-aspects": {
      const body = getSpreadPositionName(spread, "body", "身体层面");
      const emotion = getSpreadPositionName(spread, "emotion", "情感层面");
      const mind = getSpreadPositionName(spread, "mind", "心智层面");
      const spirit = getSpreadPositionName(spread, "spirit", "精神层面");

      return `${spread.name} 这次应分开看「${body} / ${emotion} / ${mind} / ${spirit}」，先保留层次差异，再判断哪一层支持行动、哪一层形成阻力。`;
    }
    case "seven-card": {
      const answer = getSpreadPositionName(spread, "answer", "答案 / 当事人");
      const outcome = getSpreadPositionName(spread, "outcome", "结果");
      const past = getSpreadPositionName(spread, "past", "过去");
      const present = getSpreadPositionName(spread, "present", "现在");
      const nearResult = getSpreadPositionName(spread, "near-result", "最近结果");
      const environment = getSpreadPositionName(spread, "environment", "周遭能量");
      const hopesFears = getSpreadPositionName(spread, "hopes-fears", "希望与恐惧");

      return `${spread.name} 这次应先抓住「${answer} -> ${outcome}」这条答案与结果主轴，再回看「${past} -> ${present} -> ${nearResult}」怎样把它一步步推出来，并分清「${environment}」的外部气候与「${hopesFears}」的主观投射是不是混在一起。`;
    }
    case "celtic-cross": {
      const core = getSpreadPositionName(spread, "core", "核心");
      const challenge = getSpreadPositionName(spread, "challenge", "挑战");
      const conscious = getSpreadPositionName(spread, "conscious", "意识");
      const unconscious = getSpreadPositionName(spread, "unconscious", "潜意识");
      const environment = getSpreadPositionName(spread, "environment", "环境");
      const outcome = getSpreadPositionName(spread, "outcome", "结果");

      return `${spread.name} 这次应先守住「${core} / ${challenge}」，再对照「${conscious} / ${unconscious}」和「${environment} / ${outcome}」，避免把复杂牌阵压平成一句确定结论。`;
    }
    default:
      return null;
  }
}

function buildSpreadSpecificFinalAxis(spread: Spread) {
  switch (spread.id) {
    case "single": {
      const focus = getSpreadPositionName(spread, "focus", "核心指引");

      return `单牌的第二阶段仍以「${focus}」为入口；用户补充只能帮助校准这一处焦点，不能把单牌改写成确定裁决。`;
    }
    case "holy-triangle": {
      const past = getSpreadPositionName(spread, "past", "过去");
      const present = getSpreadPositionName(spread, "present", "现在");
      const future = getSpreadPositionName(spread, "future", "潜在流向");

      return `圣三角形的第二阶段仍要对照「${past} -> ${present} -> ${future}」是否连贯，避免让补充信息盖过时间与因果路径。`;
    }
    case "four-aspects": {
      const body = getSpreadPositionName(spread, "body", "身体层面");
      const emotion = getSpreadPositionName(spread, "emotion", "情感层面");
      const mind = getSpreadPositionName(spread, "mind", "心智层面");
      const spirit = getSpreadPositionName(spread, "spirit", "精神层面");

      return `四个面向的第二阶段仍要让「${body} / ${emotion} / ${mind} / ${spirit}」彼此校准，而不是把某一层的感受直接升级成总答案。`;
    }
    case "seven-card": {
      const answer = getSpreadPositionName(spread, "answer", "答案 / 当事人");
      const outcome = getSpreadPositionName(spread, "outcome", "结果");
      const environment = getSpreadPositionName(spread, "environment", "周遭能量");
      const hopesFears = getSpreadPositionName(spread, "hopes-fears", "希望与恐惧");

      return `七张牌的第二阶段仍要先对照「${answer} -> ${outcome}」是否更清楚，再用「${environment}」和「${hopesFears}」分辨外界现实与内在担心，避免把补充信息读成新的命令。`;
    }
    case "celtic-cross": {
      const core = getSpreadPositionName(spread, "core", "核心");
      const challenge = getSpreadPositionName(spread, "challenge", "挑战");
      const self = getSpreadPositionName(spread, "self", "自我");
      const environment = getSpreadPositionName(spread, "environment", "环境");
      const outcome = getSpreadPositionName(spread, "outcome", "结果");

      return `赛尔特十字的第二阶段仍要从「${core} / ${challenge}」出发，再核对「${self} / ${environment} / ${outcome}」是否互相支持，避免把复杂结构读成单一路径。`;
    }
    default:
      return null;
  }
}

function buildSpreadSpecificGuidance(spread: Spread, phase: "initial" | "final") {
  switch (spread.id) {
    case "single":
      return phase === "initial"
        ? "先把单牌当作一个观察入口，而不是把它当成已经完成的答案。"
        : "回看这张牌最稳定的提醒，再决定现实中要验证哪一个小信号。";
    case "holy-triangle":
      return phase === "initial"
        ? "先观察过去、现在与潜在流向之间是否真的连成一条线。"
        : "回看补充信息是否让时间线更清楚，而不是让其中某一点过度放大。";
    case "four-aspects":
      return phase === "initial"
        ? "先分清身体、情感、心智与精神四层里，哪一层最支持你，哪一层最有阻力。"
        : "回看四个层面是否彼此校准，再选择最容易落地的一层先行动。";
    case "seven-card":
      return phase === "initial"
        ? "先分清七张牌里真正像答案的位置，和那些只是解释这个答案为什么成立的辅助位置。"
        : "回看「答案 / 当事人」与「结果」是否仍在同一条线上，再决定你下一步要验证的是答案本身还是结果代价。";
    case "celtic-cross":
      return phase === "initial"
        ? "先守住核心与挑战，再让其他位置补充层次，不要急着把十张牌压成一句话。"
        : "回看核心、挑战、自我与环境是否形成同一组张力，再决定下一步现实观察点。";
    default:
      return null;
  }
}

function getUnverifiedCondition(questionType: QuestionType) {
  switch (questionType) {
    case "relationship":
      return "你自己的需求、边界和可观察到的互动事实";
    case "career":
      return "现实反馈、资源约束和下一步行动成本";
    case "self_growth":
      return "反复出现的情绪触发点和真实生活节奏";
    case "decision":
      return "关键条件、代价和可承受风险";
    case "other":
      return "哪些感受来自事实，哪些只是当下的惯性反应";
  }
}

function formatTensionAnchor({
  positionName,
  cardName,
  orientation,
}: {
  positionName: string;
  cardName: string;
  orientation: string;
}) {
  return `${positionName}的${cardName}（${orientation}）`;
}

function buildConstructiveTension({
  questionType,
  spread,
  drawnCards,
}: {
  questionType: QuestionType;
  spread: Spread;
  drawnCards: DrawnCard[];
}) {
  const anchorCard =
    drawnCards.find((drawnCard) => drawnCard.isReversed)
    ?? drawnCards.at(-1)
    ?? drawnCards[0];
  const position = spread.positions.find((item) => item.id === anchorCard.positionId);
  const orientation = anchorCard.isReversed ? "逆位" : "正位";
  const anchor = formatTensionAnchor({
    positionName: position?.name ?? "这个位置",
    cardName: anchorCard.card.name,
    orientation,
  });
  const condition = getUnverifiedCondition(questionType);

  switch (questionType) {
    case "relationship":
      return `牌面在这里留下的阻力是：${anchor} 并不急着替你确认关系走向，而是把注意力推回${condition}。`;
    case "career":
      return `这里的阻力不在于能不能继续前进，而是 ${anchor} 没有让这件事自动等于理想答案；先把${condition}摆上桌。`;
    case "self_growth":
      return `这个位置的阻力更安静：${anchor} 提醒你，理解自己不等于立刻给自己新的要求；先看见${condition}。`;
    case "decision":
      return `这组牌留下的阻力很现实：${anchor} 不适合被读成直接裁决；先核实${condition}。`;
    case "other":
      return `这处阻力来自 ${anchor}：它没有把问题收成单一结论，而是要求你分辨${condition}。`;
  }
}

function buildConstructiveGuidance(questionType: QuestionType) {
  switch (questionType) {
    case "relationship":
      return "把最想得到确认的那一点暂时放慢，先写下你能观察到的互动事实和自己的边界。";
    case "career":
      return "把这处阻力转成一个现实检查项：资源、时间、反馈或成本，哪一项还没有被看清？";
    case "self_growth":
      return "别急着把阻力读成自我否定，先确认它是在提醒你休整、表达，还是重新安排节奏。";
    case "decision":
      return "在做选择前，把牌面没有替你确认的条件列出来，先验证其中最关键的一项。";
    case "other":
      return "把这处阻力当作停顿点：先分辨事实、感受和推测，再决定下一步要问什么。";
  }
}

function buildFinalConstructiveTension(
  initialReading: StructuredReading,
  questionType: QuestionType,
) {
  const anchorCard =
    initialReading.cards.find((card) => card.orientation === "reversed")
    ?? initialReading.cards.at(-1)
    ?? initialReading.cards[0];
  const anchor = `${anchorCard.position}的${anchorCard.name}`;

  switch (questionType) {
    case "relationship":
      return `第二阶段仍要保留 ${anchor} 的阻力：你的补充可以让关系图像更清楚，但不能把它改写成关系答案已经被证明。`;
    case "career":
      return `第二阶段仍要保留 ${anchor} 的阻力：你的补充能校准方向，却不能替现实反馈、资源约束和行动成本提前背书。`;
    case "self_growth":
      return `第二阶段仍要保留 ${anchor} 的阻力：你的补充能解释状态，却不应该变成新的自我苛责。`;
    case "decision":
      return `第二阶段仍要保留 ${anchor} 的阻力：你的补充能缩小选择范围，但不能把牌面改写成直接裁决。`;
    case "other":
      return `第二阶段仍要保留 ${anchor} 的阻力：你的补充能减少模糊，却不能把尚未验证的部分提前说成结论。`;
  }
}

function summarizeFollowupAnswer(answer: string, maxLength = 42) {
  const normalized = answer.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function buildFollowupAnswerGuidance(followupAnswers: FollowupAnswer[]) {
  return followupAnswers.slice(0, 2).map((item, index) => {
    const answer = summarizeFollowupAnswer(item.answer);

    return `把第 ${index + 1} 个追问里你提到的“${answer}”先当作校准线索：它更像事实、感受，还是仍待验证的推测？`;
  });
}

function buildFinalExtensionQuestion(followupAnswers: FollowupAnswer[]) {
  const primaryAnswer = followupAnswers[0]?.answer
    ? summarizeFollowupAnswer(followupAnswers[0].answer, 30)
    : null;

  if (!primaryAnswer) {
    return "经过这次补充后，你最愿意在现实中先验证哪一个小信号？";
  }

  return `围绕你提到的“${primaryAnswer}”，接下来哪一个现实信号最值得先温和验证？`;
}

function buildInitialSynthesis(
  question: string,
  questionType: QuestionType,
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
  const spreadAxis = buildSpreadSpecificInitialAxis(spread);
  const constructiveTension = buildConstructiveTension({
    questionType,
    spread,
    drawnCards,
  });

  return `围绕“${question}”，这是第一阶段的独立初读。${spread.name}把焦点从 ${opening} 一路带到 ${ending}。${energyTone} ${spreadAxis ?? ""} 这次更值得关注的主轴是 ${themes.join("、")}。${constructiveTension} ${PROFILE_GUIDANCE[agentProfile]} ${continuityBridge ?? "当前问题仍然比任何旧线索更重要。"} 与其急着确认单一答案，不如先看清哪些线索已经足够清楚，哪些部分还需要现实语境来收束。`;
}

function buildFinalSynthesis({
  question,
  questionType,
  initialReading,
  followupAnswers,
  priorSessionCapsule,
}: {
  question: string;
  questionType: QuestionType;
  initialReading: StructuredReading;
  followupAnswers: FollowupAnswer[];
  priorSessionCapsule: string | null;
}) {
  const answerSummary = followupAnswers
    .map((item) => `“${item.question}”你的回应是：${item.answer}`)
    .join("；");
  const primaryTheme = initialReading.themes[0] ?? "当前主轴";

  const continuityBridge = buildPriorSessionCapsuleBridge(priorSessionCapsule);
  const spreadAxis = buildSpreadSpecificFinalAxis(initialReading.spread);
  const constructiveTension = buildFinalConstructiveTension(
    initialReading,
    questionType,
  );

  return `围绕“${question}”，第二阶段不会推翻第一阶段的主轴，而是把它收束得更贴近现实。初读里最稳定的线索仍是 ${primaryTheme}。你的回答带来的校准是：${answerSummary}。这意味着综合解读不再只停留在牌面主轴本身，而是要把这些补充放回 ${primaryTheme} 里，分辨哪些已经是可观察事实，哪些仍是感受、担心或待验证条件。${spreadAxis ?? ""} ${constructiveTension} ${continuityBridge ?? "上一轮线索若有存在，也只作为背景参照。"} 这组牌现在更像是在说：真正的重点不是立刻得到一个绝对结论，而是在已经显露的主题里，为下一步保留可验证的行动空间。`;
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
  spread: Spread,
) {
  if (agentProfile === "lite") {
    return [];
  }

  if (spread.id === "seven-card") {
    if (agentProfile === "sober") {
      return [
        "从「答案 / 当事人」到「结果」这条线看，你现在最不能跳过的现实条件到底是哪一个？",
        "如果把「周遭能量」和「希望与恐惧」分开看，你最需要先核实的外部信息是什么？",
      ];
    }

    return [
      "从「答案 / 当事人」到「结果」这条线看，你更在意眼前的答案本身，还是它往后会带来的结果与代价？",
      "把「周遭能量」和「希望与恐惧」分开看，哪一层更像现实气候，哪一层更像你自己的投射？",
    ];
  }

  return QUESTION_TYPE_FOLLOW_UP[questionType].slice(0, 2);
}

function buildSpreadPromptBias(spread: Spread, phase: "initial" | "final") {
  switch (spread.id) {
    case "single":
      return phase === "initial"
        ? "Single-card spread bias: treat the only card as a focused observation point, not as a deterministic verdict."
        : "Single-card spread bias: preserve the focused card axis; use follow-up answers only to calibrate the observation, not to turn it into a verdict.";
    case "holy-triangle":
      return phase === "initial"
        ? "Holy-triangle spread bias: read past -> present -> future/potential flow as one causal path; do not isolate one card as the whole answer."
        : "Holy-triangle spread bias: preserve the past/present/future path and use follow-up answers to clarify the path, not overwrite it.";
    case "four-aspects":
      return phase === "initial"
        ? "Four-aspects spread bias: separate body, emotion, mind, and spirit first; then synthesize where the layers support or resist each other."
        : "Four-aspects spread bias: preserve the four-layer structure and use follow-up answers to identify which layer is most actionable.";
    case "seven-card":
      return phase === "initial"
        ? "Seven-card spread bias: start from the answer/result axis (position 4 -> position 7), then use the past/present/near-result timeline (positions 1 -> 2 -> 3) and the environment vs hopes-fears tension (positions 5 and 6) to explain why that axis is forming."
        : "Seven-card spread bias: preserve the answer/result axis first, then use positions 5 and 6 to separate external conditions from the querent's projection; do not reduce the spread to isolated per-card commentary.";
    case "celtic-cross":
      return phase === "initial"
        ? "Celtic-cross spread bias: start from core/challenge, then compare conscious/unconscious, timeline, self/environment, hopes-fears, and outcome as layered evidence."
        : "Celtic-cross spread bias: preserve the core/challenge axis and use follow-up answers to clarify self/environment and outcome without flattening the ten-card structure.";
    default:
      return null;
  }
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
    "Every card interpretation must be a non-empty Chinese string under the exact key interpretation; never leave it blank, null, an object, or an array.",
    "For card metadata fields (card_id, name, english_name, orientation, position_id, position, position_meaning), copy the authority values exactly and do not rewrite, translate, paraphrase, or invent replacements.",
    "themes: 2-4 short, concrete thematic labels only; avoid headline packaging, stacked metaphors, or decorative category names.",
    "reflective_guidance: 2-4 items.",
    followupRule,
    "Include at least one constructive tension point in synthesis or reflective_guidance: an observation that does not simply affirm the user's expected answer.",
    "The constructive tension point must be anchored to a card, orientation, position meaning, spread relationship, or unverified reality condition.",
    "Constructive tension must not become deterministic prophecy, third-party mind-reading, professional advice, or a command to make a major decision.",
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
    ...(buildSpreadSpecificGuidance(spread, "initial")
      ? [buildSpreadSpecificGuidance(spread, "initial") as string]
      : []),
    buildConstructiveGuidance(questionType),
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
      questionType,
      agentProfile,
      spread,
      themes,
      drawnCards,
      priorSessionCapsule,
    ),
    reflective_guidance: reflectiveGuidance,
    follow_up_questions: selectFollowUpQuestions(questionType, agentProfile, spread),
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
  const constructiveTension = buildFinalConstructiveTension(
    initialReading,
    questionType,
  );
  const finalGuidance = uniqueStrings([
    `保留初读里的“${initialReading.themes[0] ?? QUESTION_TYPE_LENSES[questionType]}”作为观察主轴。`,
    ...buildFollowupAnswerGuidance(followupAnswers),
    "把你补充的信息拆成事实、感受和推测三类，再决定下一步行动。",
    ...(buildSpreadSpecificGuidance(initialReading.spread, "final")
      ? [buildSpreadSpecificGuidance(initialReading.spread, "final") as string]
      : []),
    buildConstructiveGuidance(questionType),
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
      questionType,
      initialReading,
      followupAnswers,
      priorSessionCapsule,
    }),
    reflective_guidance: finalGuidance,
    follow_up_questions: [buildFinalExtensionQuestion(followupAnswers)],
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
  const spreadBias = buildSpreadPromptBias(spread, "initial");

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
      spreadBias,
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
      "- Preserve one constructive resistance point: name what the spread does not fully support, or what reality condition remains unverified.",
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
  const spreadBias = buildSpreadPromptBias(spread, "final");

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
      spreadBias,
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
      "- Preserve one constructive resistance point from the initial spread; do not let the user's answers turn the reading into simple agreement.",
      "- Return at most one extension question, and it must not block the flow.",
      "- Do not rewrite the provided card names or position labels.",
      "- Do not state what the other person secretly feels, thinks, wants, or intends; if needed, describe the relational pattern from the querent's point of view.",
    ].join("\n\n"),
  };
}
