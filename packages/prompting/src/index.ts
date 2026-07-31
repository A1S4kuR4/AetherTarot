import type {
  AgentProfile,
  DrawnCard,
  FollowupAnswer,
  QuestionType,
  SessionMemory,
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
> & {
  grounding_claims?: Array<{
    path: `cards.${number}.interpretation` | "synthesis";
    source_refs: string[];
  }>;
};

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
    "如果把这次牌面当作一面镜子，你最先看见了自己哪一部分状态？",
  ],
};

export type ReaderModeDetailLevel = "low" | "medium" | "high";
export type ReaderModeTerminologyLevel = "low" | "medium";
export type ReaderModeClarificationDepth = "minimal" | "light" | "deep";
export type ReaderModeAlternativeInterpretation =
  | "optional"
  | "when_needed"
  | "required_when_plausible";
export type ReaderModeUncertaintyStyle = "brief" | "natural" | "explicit";

export interface ReaderModeStrategy {
  displayName: string;
  goal: string;
  detailLevel: ReaderModeDetailLevel;
  terminologyLevel: ReaderModeTerminologyLevel;
  clarificationDepth: ReaderModeClarificationDepth;
  alternativeInterpretation: ReaderModeAlternativeInterpretation;
  uncertaintyStyle: ReaderModeUncertaintyStyle;
  maxFollowupQuestions: number;
  guidanceItemCount: number;
  outputLength: { singleCard: string; multiCard: string };
  structure: string[];
  focusNote: string;
}

/**
 * Reader-mode strategies keyed by the stable internal AgentProfile id.
 *
 * The internal ids (`lite` / `standard` / `sober`) are preserved for persistence
 * and backward compatibility; only the user-visible names differ
 * (快速塔罗师 / 日常塔罗师 / 深度塔罗师). The behavioral difference between
 * modes is driven by this config rather than by duplicated prompts.
 */
export const readerModeStrategies: Record<AgentProfile, ReaderModeStrategy> = {
  lite: {
    displayName: "快速塔罗师",
    goal: "快速指出当前最重要的信息，并给出一个可执行建议",
    detailLevel: "low",
    terminologyLevel: "low",
    clarificationDepth: "minimal",
    alternativeInterpretation: "optional",
    uncertaintyStyle: "brief",
    maxFollowupQuestions: 1,
    guidanceItemCount: 2,
    outputLength: { singleCard: "约 150-250 字", multiCard: "约 250-450 字" },
    structure: [
      "核心提示",
      "牌面与当前问题的联系",
      "一个行动建议",
      "必要时一句边界提醒",
    ],
    focusNote:
      "结论优先；只保留一到两个最重要洞察；避免逐张复述完整牌义与长篇铺垫；最多一个主要行动建议；最多一个简短反思问题；默认不主动发起多轮澄清；不因追求简短而给出宿命化或过度确定的答案。",
  },
  standard: {
    displayName: "日常塔罗师",
    goal: "用自然语言完成完整、易理解的现实映射",
    detailLevel: "medium",
    terminologyLevel: "low",
    clarificationDepth: "light",
    alternativeInterpretation: "when_needed",
    uncertaintyStyle: "natural",
    maxFollowupQuestions: 2,
    guidanceItemCount: 4,
    outputLength: { singleCard: "约 300-500 字", multiCard: "约 500-800 字" },
    structure: [
      "当前状态",
      "核心情绪或矛盾",
      "牌面与现实处境的联系",
      "用户可能忽略的部分",
      "一到两个可执行建议",
      "一个低负担后续问题",
    ],
    focusNote:
      "使用自然生活化中文，减少塔罗术语堆叠；出现必要术语时立即用普通语言解释；不只解释牌是什么意思，还要说明它与用户处境的关系；保持温度和共情，但不为共鸣而迎合用户预设；避免“相信自己/顺其自然/一切都会好”等空泛表达；建议必须结合问题与处境；可做一次轻量校准。",
  },
  sober: {
    displayName: "深度塔罗师",
    goal: "对复杂议题进行结构化、多视角、重边界的分析",
    detailLevel: "high",
    terminologyLevel: "medium",
    clarificationDepth: "deep",
    alternativeInterpretation: "required_when_plausible",
    uncertaintyStyle: "explicit",
    maxFollowupQuestions: 2,
    guidanceItemCount: 4,
    outputLength: { singleCard: "约 450-700 字", multiCard: "约 700-1100 字" },
    structure: [
      "问题重述与分析边界",
      "牌阵整体趋势",
      "关键牌及位置分析",
      "牌与牌之间的关系",
      "主要解释",
      "替代解释",
      "事实/推测/期待区分",
      "风险与不确定性",
      "现实验证信号",
      "行动建议或后续追问",
    ],
    focusNote:
      "不盲目迎合；不默认用户猜测成立；不把第三方心理说成确定事实；不把未来事件说成必然；主动区分用户提供的事实、根据牌面的解释、尚未验证的推测、用户自身的期待；至少考虑一个合理替代解释；分析牌间支持/冲突/递进/转折；说明牌阵位置对牌义的影响；信息不足时降低结论强度；必要时反问隐含前提；给出现实验证信号；对医疗/法律/财务/安全主动收紧边界；不为显得专业而堆砌术语或无意义增加篇幅。",
  },
};

function buildModeStrategyBlock(agentProfile: AgentProfile) {
  const strategy = readerModeStrategies[agentProfile];

  return [
    `Mode strategy: ${strategy.displayName} (internal id: ${agentProfile}).`,
    `Goal: ${strategy.goal}`,
    `Detail level: ${strategy.detailLevel}; terminology: ${strategy.terminologyLevel}; clarification depth: ${strategy.clarificationDepth}.`,
    `Alternative interpretation: ${strategy.alternativeInterpretation}; uncertainty style: ${strategy.uncertaintyStyle}.`,
    `Target visible-prose length (JSON metadata excluded): single card ${strategy.outputLength.singleCard}; multi-card ${strategy.outputLength.multiCard}.`,
    `Recommended structure: ${strategy.structure.join(" -> ")}.`,
    `Mode focus: ${strategy.focusNote}`,
  ].join("\n");
}

export interface ReadingPrompt {
  system: string;
  user: string;
}

export interface StagedCardInsight {
  index: number;
  interpretation: string;
  evidence_refs?: string[];
}

interface KnowledgeGroundingChunk {
  id: string;
  ref: string;
  kind: "wiki" | "authority_card";
  title: string;
  content: string;
  source: string;
  source_ids: string[];
  card: string;
  orientation: "upright" | "reversed" | "unknown";
  spread?: string;
  score: number;
  confidence: "low" | "medium" | "high";
}

interface KnowledgeGroundingContext {
  status: "retrieved" | "degraded" | "none";
  chunks: KnowledgeGroundingChunk[];
}

type SessionMemoryContext = SessionMemory | null | undefined;

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

function buildSessionMemoryBridge(sessionMemory: SessionMemoryContext) {
  if (!sessionMemory) {
    return null;
  }

  const topics = sessionMemory.topics.slice(0, 3).join("、");
  const cards = sessionMemory.cards
    .slice(0, 3)
    .map((card) =>
      `${card.name ?? card.id}${card.orientation === "reversed" ? "逆位" : card.orientation === "upright" ? "正位" : ""}`,
    )
    .join("、");
  const advice = sessionMemory.last_advice_summary
    ? `上一轮建议可概括为：${sessionMemory.last_advice_summary}`
    : null;

  return [
    topics ? `同一 thread 的短期记忆显示，上一轮主题包括 ${topics}。` : null,
    cards ? `上一轮牌面线索包括 ${cards}。` : null,
    advice,
    "这些只能作为本 thread 的延续背景，不能覆盖当前问题、当前牌阵或本轮抽牌。",
  ].filter(Boolean).join(" ");
}

function formatSessionMemoryForPrompt(sessionMemory: SessionMemoryContext) {
  if (!sessionMemory) {
    return null;
  }

  return [
    "Thread session memory (low priority, same thread only):",
    `- thread_id: ${sessionMemory.thread_id}`,
    `- summary: ${sessionMemory.summary ?? "none"}`,
    `- topics: ${sessionMemory.topics.slice(0, 5).join(" | ") || "none"}`,
    `- cards: ${
      sessionMemory.cards
        .slice(0, 5)
        .map((card) => `${card.name ?? card.id}:${card.orientation ?? "unknown"}`)
        .join(" | ") || "none"
    }`,
    `- stated_constraints: ${sessionMemory.stated_constraints.slice(0, 5).join(" | ") || "none"}`,
    `- open_questions: ${sessionMemory.open_questions.slice(0, 3).join(" | ") || "none"}`,
    `- last_advice_summary: ${sessionMemory.last_advice_summary ?? "none"}`,
    "Use this only to answer follow-ups without asking the user to repeat context. Do not infer long-term profile or cross-session personalization.",
  ].join("\n");
}

function formatKnowledgeGroundingForPrompt(
  knowledgeGrounding: KnowledgeGroundingContext | undefined,
) {
  if (!knowledgeGrounding || knowledgeGrounding.status === "none") {
    return [
      "Knowledge grounding status: none",
      "The local AetherTarot knowledge wiki did not return reliable chunks for this retrieval step.",
      "Do not write phrases such as '根据知识库明确表明' or pretend that a missing source was retrieved.",
      "You may still use the authority cards, spread positions, and safety/interpretation rules, but preserve uncertainty.",
    ].join("\n");
  }

  return [
    `Knowledge grounding status: ${knowledgeGrounding.status}`,
    "Use these server-controlled grounding claims as the card-meaning grounding. Do not invent refs or sources.",
    ...knowledgeGrounding.chunks.slice(0, 12).map((chunk, index) =>
      [
        `Chunk ${index + 1}:`,
        `- ref: ${chunk.ref}`,
        `- id: ${chunk.id}`,
        `- title: ${chunk.title}`,
        `- kind: ${chunk.kind}`,
        `- card_id: ${chunk.card}`,
        `- orientation: ${chunk.orientation}`,
        `- source_ids: ${chunk.source_ids.join(", ") || "none"}`,
        `- confidence: ${chunk.confidence}`,
        `- content: ${chunk.content}`,
      ].join("\n"),
    ),
  ].join("\n\n");
}

function findGroundingChunkForCard(
  knowledgeGrounding: KnowledgeGroundingContext | undefined,
  drawnCard: DrawnCard,
) {
  if (!knowledgeGrounding || knowledgeGrounding.status === "none") {
    return null;
  }

  const orientation = drawnCard.isReversed ? "逆位" : "正位";

  return knowledgeGrounding.chunks.find(
    (chunk) =>
      chunk.card === drawnCard.card.id
      && (
        chunk.orientation === (drawnCard.isReversed ? "reversed" : "upright")
        || chunk.orientation === "unknown"
      ),
  ) ?? knowledgeGrounding.chunks.find((chunk) =>
    chunk.card === drawnCard.card.id,
  ) ?? null;
}

function stripSentenceEnding(value: string) {
  return value.trim().replace(/[。！？.!?；;，,:：]+$/u, "");
}

function formatCompactRefCatalog(
  knowledgeGrounding: KnowledgeGroundingContext | undefined,
) {
  if (!knowledgeGrounding || knowledgeGrounding.status === "none") {
    return "Allowed ref catalog: none";
  }
  return [
    `Grounding status: ${knowledgeGrounding.status}`,
    "Allowed ref catalog:",
    ...knowledgeGrounding.chunks.slice(0, 12).map((chunk) =>
      `- ${chunk.ref}: card_id=${chunk.card}; orientation=${chunk.orientation}`
    ),
  ].join("\n");
}

function formatStagedCardInsights(cardInsights: StagedCardInsight[]) {
  return cardInsights.map((insight) =>
    [
      `- index: ${insight.index}`,
      `  interpretation: ${insight.interpretation}`,
      `  evidence_refs: ${insight.evidence_refs?.join(", ") || "none"}`,
    ].join("\n")
  ).join("\n");
}

function buildStagedVisibleProseRules() {
  return [
    "Return JSON only. Do not wrap in markdown fences.",
    "All user-visible prose must be fluent natural Simplified Chinese (zh-CN).",
    "Never expose provider, prompt, model, generation stages, internal orchestration, local knowledge wiki, chunk titles, source_id, or citation mechanics in user-visible prose.",
    "Never claim certainty about future events or a third party's hidden feelings, thoughts, motives, or intent.",
    "Do not give medical, legal, financial, manipulative, or deterministic major-decision advice.",
    "Evidence refs are optional machine-only fields. Omit them in normal generation unless a stage-specific instruction requires them; never mention refs in prose.",
  ].join("\n");
}

function buildSynthesisStageContract({
  phase,
  agentProfile,
}: {
  phase: "initial" | "final";
  agentProfile: AgentProfile;
}) {
  const guidance = agentProfile === "lite"
    ? "reflective_guidance must contain exactly 2 distinct items."
    : "reflective_guidance must contain 3-4 distinct items.";
  const followup = phase === "final"
    ? "follow_up_questions must contain 0-1 extension question."
    : agentProfile === "lite"
      ? "follow_up_questions must contain 0-1 question."
      : "follow_up_questions must contain 1-2 distinct questions.";
  return [
    "Allowed keys only: themes, synthesis, reflective_guidance, follow_up_questions, confidence_note, evidence_refs.",
    "themes must contain 2-4 short, concrete, everyday-language labels.",
    guidance,
    followup,
    "confidence_note must be one short reader-facing uncertainty boundary.",
    "Synthesize the verified insights into a spread-level argument. Do not enumerate or retell cards one by one.",
    "Include one constructive resistance point anchored to the verified insights or an unverified reality condition.",
  ].join("\n");
}

function buildRepairStageContract({
  stage,
  agentProfile,
  allowedIndices,
  requiredThemes,
}: {
  stage: string;
  agentProfile: AgentProfile;
  allowedIndices: number[];
  requiredThemes: string[];
}) {
  const cardInsights = allowedIndices.map((index) => ({
    index,
    interpretation: `完整非空解读 ${index + 1}`,
  }));
  const guidanceCount = agentProfile === "lite" ? 2 : 3;
  const followupCount = stage === "final_synthesis"
    ? 0
    : agentProfile === "lite"
      ? 0
      : 1;
  const synthesis = {
    themes: ["具体主题一", "具体主题二"],
    synthesis: "完整的牌阵级综合解读。",
    reflective_guidance: Array.from(
      { length: guidanceCount },
      (_, index) => `互不重复的反思建议 ${index + 1}`,
    ),
    follow_up_questions: Array.from(
      { length: followupCount },
      (_, index) => `互不重复的追问 ${index + 1}？`,
    ),
    confidence_note: "结合现实信息继续核实。",
  };

  if (stage === "card_insights") {
    return [
      `Complete required JSON shape: ${JSON.stringify({ card_insights: cardInsights })}`,
      `card_insights must contain exactly ${allowedIndices.length} complete items in the shown order.`,
    ].join("\n");
  }
  if (stage === "compact") {
    return [
      `Complete required JSON shape: ${JSON.stringify({ card_insights: cardInsights, synthesis })}`,
      "The top level must contain both card_insights and synthesis. synthesis must remain an object.",
      buildSynthesisStageContract({ phase: "initial", agentProfile }),
    ].join("\n");
  }
  if (stage === "synthesis") {
    return [
      `Complete required JSON shape: ${JSON.stringify(synthesis)}`,
      buildSynthesisStageContract({ phase: "initial", agentProfile }),
    ].join("\n");
  }
  if (stage === "final_synthesis") {
    return [
      `Complete required JSON shape: ${JSON.stringify(synthesis)}`,
      buildSynthesisStageContract({ phase: "final", agentProfile }),
      `Required Initial themes: ${JSON.stringify(requiredThemes)}`,
      "At least one Required Initial theme must appear verbatim in themes or synthesis.",
      "card_refinements is optional. If present, it must be a sparse array of complete {index, interpretation, evidence_refs?} objects.",
    ].join("\n");
  }
  return "Return the complete repaired JSON object for the failed stage.";
}

function toChineseSentence(value: string) {
  const normalized = stripSentenceEnding(value.replace(/\s+/g, " "));
  return normalized ? `${normalized}。` : "";
}

function extractGroundingInsight(content: string, maxLength = 120) {
  const normalized = content
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:因此|所以|由此)[，,\s]*/u, "");
  const sentences = normalized.match(/[^。！？!?]+[。！？!?]?/gu) ?? [];
  let excerpt = "";

  for (const sentence of sentences) {
    const candidate = `${excerpt}${sentence}`.trim();
    if (candidate.length > maxLength) {
      break;
    }
    excerpt = candidate;
  }

  if (!excerpt) {
    excerpt = normalized.length > maxLength
      ? `${normalized.slice(0, maxLength - 1).trimEnd()}…`
      : normalized;
  }

  return stripSentenceEnding(excerpt);
}

function buildDraftGroundingClaims(
  drawnCards: Array<{ card: { id: string } }>,
  knowledgeGrounding: KnowledgeGroundingContext | undefined,
) {
  if (!knowledgeGrounding || knowledgeGrounding.status === "none") {
    return [];
  }
  const cardClaims = drawnCards.flatMap((drawnCard, index) => {
    const refs = knowledgeGrounding.chunks
      .filter((chunk) => chunk.card === drawnCard.card.id)
      .map((chunk) => chunk.ref)
      .slice(0, 2);
    return refs.length > 0
      ? [{ path: `cards.${index}.interpretation` as const, source_refs: refs }]
      : [];
  });
  const synthesisRefs = [...new Set(cardClaims.flatMap((claim) => claim.source_refs))];
  return synthesisRefs.length > 0
    ? [...cardClaims, { path: "synthesis" as const, source_refs: synthesisRefs }]
    : cardClaims;
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
  knowledgeGrounding?: KnowledgeGroundingContext,
) {
  const position = spread.positions.find((item) => item.id === drawnCard.positionId);
  const keywords = getKeywords(drawnCard);
  const keywordSummary = keywords.join("、") || "正在成形的线索";
  const orientation = drawnCard.isReversed ? "逆位" : "正位";
  const lens = QUESTION_TYPE_LENSES[questionType];
  const groundingChunk = findGroundingChunkForCard(knowledgeGrounding, drawnCard);
  const groundingInsight = groundingChunk
    ? extractGroundingInsight(groundingChunk.content)
    : null;
  const positionDescription = stripSentenceEnding(
    position?.description ?? "此位置提示你留意当下的关键层面。",
  );

  return [
    toChineseSentence(
      `${position?.name ?? "未知位置"}出现${drawnCard.card.name}（${orientation}），把注意力带向${keywordSummary}`,
    ),
    toChineseSentence(
      `结合“${positionDescription}”，这张牌提醒你从${lens}的角度重新看见${drawnCard.card.description}`,
    ),
    groundingInsight
      ? toChineseSentence(`更具体地说，${groundingInsight}`)
      : "",
  ].join("");
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

function buildSpreadStory(spread: Spread, drawnCards: DrawnCard[]) {
  const firstCard = drawnCards[0];
  const lastCard = drawnCards.at(-1);
  const firstPosition = spread.positions.find(
    (position) => position.id === firstCard.positionId,
  );
  const lastPosition = lastCard
    ? spread.positions.find((position) => position.id === lastCard.positionId)
    : null;

  if (!lastCard || drawnCards.length === 1) {
    const keywords = getKeywords(firstCard).join("、") || "此刻最重要的线索";
    return `${firstCard.card.name}把${firstPosition?.name ?? "核心位置"}的重点放在${keywords}上。`;
  }

  const openingKeywords = getKeywords(firstCard).join("、") || "当前起点";
  const closingKeywords = getKeywords(lastCard).join("、") || "接下来的方向";
  return `${firstPosition?.name ?? "开端"}的${firstCard.card.name}先呈现${openingKeywords}，`
    + `${lastPosition?.name ?? "收束"}的${lastCard.card.name}则把故事带向${closingKeywords}；`
    + "其余位置帮助说明这股变化如何形成。";
}

function buildSpreadSpecificGuidance(spread: Spread, phase: "initial" | "final") {
  switch (spread.id) {
    case "single":
      return phase === "initial"
        ? "记录这张牌最贴近现实的一个信号，并观察它是否持续出现。"
        : "回看这张牌最稳定的提醒，再选择一个现实信号温和验证。";
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
      return `这组牌留下的阻力很现实：${anchor} 显示目前仍缺少足够依据，先核实${condition}。`;
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
      return `${anchor}仍提醒你：关系图像可以变得更清楚，但对方的真实想法与未来走向仍需要现实互动来验证。`;
    case "career":
      return `${anchor}让现实反馈、资源约束和行动成本继续成为不可跳过的条件。`;
    case "self_growth":
      return `${anchor}帮助解释当前状态，但这份理解不需要变成新的自我苛责。`;
    case "decision":
      return `${anchor}可以帮助缩小选择范围，但关键条件与代价仍要由现实信息来确认。`;
    case "other":
      return `${anchor}让模糊之处有所收束，同时也保留了仍待验证的部分。`;
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
  questionType: QuestionType,
  spread: Spread,
  themes: string[],
  drawnCards: DrawnCard[],
  priorSessionCapsule: string | null,
  sessionMemory: SessionMemoryContext,
) {
  const reversedCount = drawnCards.filter((drawnCard) => drawnCard.isReversed).length;
  const isSingleCard = drawnCards.length === 1;
  const energyTone = isSingleCard
    ? drawnCards[0]?.isReversed
      ? "这股能量暂时更像向内收拢，适合先辨认卡住它的感受或表达方式。"
      : "这股能量已经提供了一处可以被调用的内在资源。"
    : reversedCount === 0
      ? "整组牌的能量相对顺流，说明你已经拥有一部分可被调用的资源。"
      : reversedCount >= Math.ceil(drawnCards.length / 2)
        ? "逆位出现得更集中，真正需要处理的也许不是外部事件本身，而是内在节奏与表达方式。"
        : "这组牌里既有推进也有迟疑，提醒你在行动前先厘清真正的优先级。";

  const continuityBridge = buildPriorSessionCapsuleBridge(priorSessionCapsule);
  const memoryBridge = buildSessionMemoryBridge(sessionMemory);
  const spreadStory = buildSpreadStory(spread, drawnCards);
  const constructiveTension = buildConstructiveTension({
    questionType,
    spread,
    drawnCards,
  });

  return `${spreadStory}${energyTone}更值得关注的共同主轴是${themes.join("、")}。`
    + constructiveTension
    + `${memoryBridge ?? continuityBridge ?? "先以这次牌面和此刻的真实感受为准。"}`
    + "与其急着确认单一答案，不如先看清哪些线索已经足够清楚，哪些部分还需要现实语境来收束。";
}

function buildFinalSynthesis({
  questionType,
  initialReading,
  followupAnswers,
  priorSessionCapsule,
  sessionMemory,
}: {
  questionType: QuestionType;
  initialReading: StructuredReading;
  followupAnswers: FollowupAnswer[];
  priorSessionCapsule: string | null;
  sessionMemory: SessionMemoryContext;
}) {
  const answerSummary = followupAnswers
    .map((item) => `“${summarizeFollowupAnswer(item.answer)}”`)
    .join("；");
  const primaryTheme = initialReading.themes[0] ?? "当前主轴";
  const firstCard = initialReading.cards[0];
  const lastCard = initialReading.cards.at(-1);
  const cardStory = initialReading.cards.length === 1 || !lastCard
    ? `${firstCard.name}仍把注意力放在${firstCard.position}所对应的现实层面。`
    : `${firstCard.position}的${firstCard.name}与${lastCard.position}的${lastCard.name}`
      + "共同说明了这条线索从何处开始，又会在哪个现实层面得到检验。";

  const continuityBridge = buildPriorSessionCapsuleBridge(priorSessionCapsule);
  const memoryBridge = buildSessionMemoryBridge(sessionMemory);
  const constructiveTension = buildFinalConstructiveTension(
    initialReading,
    questionType,
  );

  return `你补充的${answerSummary}让“${primaryTheme}”这条线索更具体。${cardStory}`
    + `把这些信息放回${primaryTheme}里，更容易分辨哪些已经是可观察事实，哪些仍是感受、担心或待验证条件。`
    + `${constructiveTension}${memoryBridge ?? continuityBridge ?? "仍以当前牌面与现实信息为主要参照。"}`
    + "真正的重点不是立刻得到绝对结论，而是在已经显露的主题里，为下一步保留可验证的行动空间。";
}

function buildCards(
  questionType: QuestionType,
  spread: Spread,
  drawnCards: DrawnCard[],
  knowledgeGrounding?: KnowledgeGroundingContext,
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
      interpretation: buildCardInterpretation(
        questionType,
        spread,
        drawnCard,
        knowledgeGrounding,
      ),
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

  const guidanceRule =
    agentProfile === "lite"
      ? "reflective_guidance: return 2 concise items."
      : agentProfile === "sober"
        ? "reflective_guidance: return 3-4 items; at least one item must offer an alternative interpretation or a reality-verification signal, and at least one must separate fact from speculation or expectation."
        : "reflective_guidance: return 3-4 items that connect the cards to the user's real-life situation.";

  const synthesisRule =
    agentProfile === "lite"
      ? "synthesis: lead with the single most important point in the first sentence; keep it short and direct; do not retell each card's full meaning."
      : agentProfile === "sober"
        ? "synthesis: distinguish facts the user provided, card-based interpretation, unverified speculation, and the user's own expectations; include at least one plausible alternative interpretation; keep conclusions appropriately hedged."
        : "synthesis: connect the card meanings to the user's real-life situation in natural everyday language; be complete but not overlong.";

  return [
    "Return JSON only. Do not wrap in markdown fences.",
    "All user-visible prose must be fluent natural Simplified Chinese (zh-CN).",
    "Never output pseudo-Chinese fragments, transliterated garbage tokens, or placeholder text.",
    "Never expose chain-of-thought, hidden reasoning, thinking preambles, analysis traces, or model self-identification.",
    "Never mention provider, prompt, model, generation stages, initial/final phase mechanics, or internal orchestration in user-visible prose.",
    "Never mention the local knowledge wiki, chunk titles, source_id, citation mechanics, or grounding_claims in user-visible prose; provenance belongs only in grounding_claims.",
    "Express uncertainty as a natural reader-facing boundary, not as an explanation of internal policy or why the system cannot decide for the user.",
    "Do not fabricate hidden motives, private thoughts, or unverified feelings for any third party.",
    "If relationship tension is inferred, frame it as observable relational dynamics, communication patterns, or unmet needs, not as certainty about what the other person feels or intends.",
    "Allowed top-level keys only:",
    "- cards",
    "- themes",
    "- synthesis",
    "- reflective_guidance",
    "- follow_up_questions",
    "- confidence_note",
    "- grounding_claims",
    "Do not return metadata such as reading_id, locale, question_type, reading_phase, requires_followup, spread, safety_note, session_capsule, sober_check, or presentation_mode.",
    "cards must be an array aligned with the authority drawn card order.",
    "Each card item must include: card_id, name, english_name, orientation, position_id, position, position_meaning, interpretation.",
    "Every card interpretation must be a non-empty Chinese string under the exact key interpretation; never leave it blank, null, an object, or an array.",
    "For card metadata fields (card_id, name, english_name, orientation, position_id, position, position_meaning), copy the authority values exactly and do not rewrite, translate, paraphrase, or invent replacements.",
    "themes: 2-4 short, concrete thematic labels in plain everyday language; avoid professional tarot jargon (e.g. elements, suits, major/minor arcana) and abstract psychological terms, so beginners can easily understand.",
    guidanceRule,
    synthesisRule,
    followupRule,
    "Include at least one constructive tension point in synthesis or reflective_guidance: an observation that does not simply affirm the user's expected answer.",
    "The constructive tension point must be anchored to a card, orientation, position meaning, spread relationship, or unverified reality condition.",
    "Constructive tension must not become deterministic prophecy, third-party mind-reading, professional advice, or a command to make a major decision.",
    "If you return more than one follow_up_questions item, each question must be materially distinct.",
    "confidence_note: one short reader-facing sentence that preserves uncertainty and avoids certainty claims; never put source or retrieval metadata here.",
    "grounding_claims: cite server-provided refs for every cards[i].interpretation and for synthesis.",
    "Each grounding_claims item must be { path, source_refs }; path is exactly cards.<zero-based-index>.interpretation or synthesis.",
    "A card interpretation may cite only refs whose card_id matches that card. Never invent a ref.",
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
  questionType,
  agentProfile,
  spread,
  drawnCards,
  priorSessionCapsule,
  sessionMemory,
  knowledgeGrounding,
}: {
  question: string;
  questionType: QuestionType;
  agentProfile: AgentProfile;
  spread: Spread;
  drawnCards: DrawnCard[];
  priorSessionCapsule: string | null;
  sessionMemory?: SessionMemoryContext;
  knowledgeGrounding?: KnowledgeGroundingContext;
}): PlaceholderReadingDraft {
  const cards = buildCards(questionType, spread, drawnCards, knowledgeGrounding);
  const themes = deriveThemes(questionType, drawnCards);
  const baseGuidance = uniqueStrings([
    `先观察“${themes[0] ?? QUESTION_TYPE_LENSES[questionType]}”在现实里最常出现在哪些情境。`,
    ...(priorSessionCapsule
      ? ["若上一轮的线索仍在回响，把它当作背景参照，不要让它盖过这一次真正的新问题。"] 
      : []),
    ...(sessionMemory?.last_advice_summary
      ? [`延续上一轮建议“${sessionMemory.last_advice_summary}”，但先把它转成当前问题下的低风险验证。`]
      : []),
    ...(buildSpreadSpecificGuidance(spread, "initial")
      ? [buildSpreadSpecificGuidance(spread, "initial") as string]
      : []),
    buildConstructiveGuidance(questionType),
    ...QUESTION_TYPE_GUIDANCE[questionType],
  ]);
  const reflectiveGuidance =
    agentProfile === "lite"
      ? uniqueStrings([
          `核心提示：眼下最值得留意的是${themes[0] ?? QUESTION_TYPE_LENSES[questionType]}。`,
          buildConstructiveGuidance(questionType),
        ]).slice(0, readerModeStrategies.lite.guidanceItemCount)
      : agentProfile === "sober"
        ? uniqueStrings([
            `替代解释：${themes[0] ?? QUESTION_TYPE_LENSES[questionType]}也可能对应另一种现实走向，先不把它读成唯一结论。`,
            `把牌面启发、你已提供的事实、尚未验证的推测与你自己的期待分开放置，不要把推测说成事实。`,
            buildConstructiveGuidance(questionType),
            ...(buildSpreadSpecificGuidance(spread, "initial")
              ? [buildSpreadSpecificGuidance(spread, "initial") as string]
              : []),
          ]).slice(0, readerModeStrategies.sober.guidanceItemCount)
        : baseGuidance.slice(0, readerModeStrategies.standard.guidanceItemCount);

  return {
    cards,
    themes,
    synthesis: buildInitialSynthesis(
      questionType,
      spread,
      themes,
      drawnCards,
      priorSessionCapsule,
      sessionMemory,
    ),
    reflective_guidance: reflectiveGuidance,
    follow_up_questions: selectFollowUpQuestions(questionType, agentProfile, spread),
    confidence_note:
      "牌面提供的是当下的观察方向，仍需要结合你的现实感受与可验证信息来理解。",
    grounding_claims: buildDraftGroundingClaims(drawnCards, knowledgeGrounding),
  };
}

export function buildPlaceholderFinalReadingDraft({
  questionType,
  agentProfile,
  initialReading,
  followupAnswers,
  priorSessionCapsule,
  sessionMemory,
  knowledgeGrounding,
}: {
  question: string;
  questionType: QuestionType;
  agentProfile: AgentProfile;
  initialReading: StructuredReading;
  followupAnswers: FollowupAnswer[];
  priorSessionCapsule: string | null;
  sessionMemory?: SessionMemoryContext;
  knowledgeGrounding?: KnowledgeGroundingContext;
}): PlaceholderReadingDraft {
  const constructiveTension = buildFinalConstructiveTension(
    initialReading,
    questionType,
  );
  const primaryThemeLabel = initialReading.themes[0] ?? QUESTION_TYPE_LENSES[questionType];
  const preserveTheme = `继续把“${primaryThemeLabel}”作为主要观察线索。`;
  const factSplit = "把你补充的信息拆成事实、感受和推测三类，再决定下一步行动。";
  const lowRiskAction = "先选择一个低风险的小动作，验证牌面提示是否真的对应现实反馈。";
  const spreadFinalGuidance = buildSpreadSpecificGuidance(initialReading.spread, "final");

  const finalGuidance =
    agentProfile === "lite"
      ? uniqueStrings([
          `核心提示仍落在${primaryThemeLabel}，先看一个可执行的小动作。`,
          lowRiskAction,
        ]).slice(0, readerModeStrategies.lite.guidanceItemCount)
      : agentProfile === "sober"
        ? uniqueStrings([
            preserveTheme,
            "给出至少一个与主解释并存的替代解释，并说明在什么现实信号下你会倾向其中之一。",
            "区分你已确认的事实、根据牌面的推测、与你自己的期待；不要把推测说成事实。",
            "在做重大决定前，先确认现实资源、风险承受边界和可咨询的专业对象。",
            ...(spreadFinalGuidance ? [spreadFinalGuidance as string] : []),
          ]).slice(0, readerModeStrategies.sober.guidanceItemCount)
        : uniqueStrings([
            preserveTheme,
            ...(sessionMemory?.last_advice_summary
              ? [`也保留同一 thread 上一轮的建议：${sessionMemory.last_advice_summary}`]
              : []),
            ...buildFollowupAnswerGuidance(followupAnswers),
            factSplit,
            ...(spreadFinalGuidance ? [spreadFinalGuidance as string] : []),
            buildConstructiveGuidance(questionType),
            lowRiskAction,
            ...initialReading.reflective_guidance.slice(0, 1),
          ]).slice(0, readerModeStrategies.standard.guidanceItemCount);

  return {
    cards: initialReading.cards,
    themes: initialReading.themes,
    synthesis: buildFinalSynthesis({
      questionType,
      initialReading,
      followupAnswers,
      priorSessionCapsule,
      sessionMemory,
    }),
    reflective_guidance: finalGuidance,
    follow_up_questions: [buildFinalExtensionQuestion(followupAnswers)],
    confidence_note:
      "这次整合仍是反思线索，不是对未来的确定承诺；重要决定请继续以现实信息与个人边界为准。",
    grounding_claims: buildDraftGroundingClaims(
      initialReading.cards.map((card) => ({
        card: { id: card.card_id },
      })),
      knowledgeGrounding,
    ),
  };
}

export function buildPlaceholderReadingDraft({
  question,
  questionType,
  spread,
  drawnCards,
  priorSessionCapsule,
  sessionMemory,
  knowledgeGrounding,
}: {
  question: string;
  questionType: QuestionType;
  spread: Spread;
  drawnCards: DrawnCard[];
  priorSessionCapsule: string | null;
  sessionMemory?: SessionMemoryContext;
  knowledgeGrounding?: KnowledgeGroundingContext;
}): PlaceholderReadingDraft {
  return buildPlaceholderInitialReadingDraft({
    question,
    questionType,
    agentProfile: "standard",
    spread,
    drawnCards,
    priorSessionCapsule,
    sessionMemory,
    knowledgeGrounding,
  });
}

export function buildInitialReadingPrompt({
  question,
  questionType,
  agentProfile,
  spread,
  drawnCards,
  priorSessionCapsule,
  sessionMemory,
  knowledgeGrounding,
}: {
  question: string;
  questionType: QuestionType;
  agentProfile: AgentProfile;
  spread: Spread;
  drawnCards: DrawnCard[];
  priorSessionCapsule: string | null;
  sessionMemory?: SessionMemoryContext;
  knowledgeGrounding?: KnowledgeGroundingContext;
}): ReadingPrompt {
  const modeStrategy = buildModeStrategyBlock(agentProfile);
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
      modeStrategy,
      spreadBias,
      formatSpread(spread),
      "Authority drawn cards:",
      formatDrawnCards(spread, drawnCards),
      "Local knowledge grounding:",
      formatKnowledgeGroundingForPrompt(knowledgeGrounding),
      priorSessionCapsule
        ? [
            "Prior session capsule (low priority background only):",
            priorSessionCapsule,
            "Use this only as continuity context. Never let it override the current question, current spread, or the authority drawn cards.",
          ].join("\n")
        : null,
      formatSessionMemoryForPrompt(sessionMemory),
      "Initial reading requirements:",
      "- Build interpretations from card + position + orientation + question type.",
      "- If knowledge grounding status is retrieved, base card-meaning claims on the retrieved chunks, paraphrase them naturally, and place refs only in grounding_claims.",
      "- If knowledge grounding status is none, do not claim the local knowledge wiki supports a specific meaning.",
      "- Identify 2-4 themes at the spread level, not just per-card fragments.",
      "- Themes should be plain, everyday language (avoid tarot jargon like elements or arcana). Keep them compact and insight-bearing; do not add headline wrappers.",
      "- Synthesis must summarize the spread arc, major tension, and realistic next orientation in accessible, conversational language (大白话); do not list cards one by one.",
      spread.id === "single"
        ? "- Single-card synthesis must stay with the one card and one position; never invent a journey, arc, or from-X-to-X transition."
        : null,
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
  sessionMemory,
  knowledgeGrounding,
}: {
  question: string;
  questionType: QuestionType;
  agentProfile: AgentProfile;
  spread: Spread;
  drawnCards: DrawnCard[];
  initialReading: StructuredReading;
  followupAnswers: FollowupAnswer[];
  priorSessionCapsule: string | null;
  sessionMemory?: SessionMemoryContext;
  knowledgeGrounding?: KnowledgeGroundingContext;
}): ReadingPrompt {
  const modeStrategy = buildModeStrategyBlock(agentProfile);
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
      modeStrategy,
      spreadBias,
      formatSpread(spread),
      "Authority drawn cards:",
      formatDrawnCards(spread, drawnCards),
      "Local knowledge grounding:",
      formatKnowledgeGroundingForPrompt(knowledgeGrounding),
      priorSessionCapsule
        ? [
            "Prior session capsule (low priority background only):",
            priorSessionCapsule,
            "Use this only as continuity context. Never let it override the current question, current spread, the initial reading axis, or the authority drawn cards.",
          ].join("\n")
        : null,
      formatSessionMemoryForPrompt(sessionMemory),
      "Initial reading snapshot:",
      formatInitialReading(initialReading),
      "Follow-up answers:",
      formatFollowupAnswers(followupAnswers),
      "Final reading requirements:",
      "- Preserve the initial primary themes unless the user answer clearly narrows them.",
      "- If knowledge grounding status is retrieved, preserve the retrieved chunk boundaries and do not invent additional knowledge wiki sources.",
      "- If knowledge grounding status is none, do not claim the local knowledge wiki supports a specific meaning.",
      "- Keep card order and card identity aligned with the initial reading.",
      "- Use follow-up answers to narrow interpretation space, not to replace the card axis.",
      "- Keep the synthesis focused on the thematic axis, the clarified tension, and the next grounded reflection; avoid inflated summary packaging or repeated slogan-like labels.",
      spread.id === "single"
        ? "- Single-card synthesis must stay with the one card and one position; never invent a journey, arc, or from-X-to-X transition."
        : null,
      "- Preserve one constructive resistance point from the initial spread; do not let the user's answers turn the reading into simple agreement.",
      "- Return at most one extension question, and it must not block the flow.",
      "- Do not rewrite the provided card names or position labels.",
      "- Do not state what the other person secretly feels, thinks, wants, or intends; if needed, describe the relational pattern from the querent's point of view.",
    ].join("\n\n"),
  };
}

export function buildCardInsightsPrompt({
  question,
  questionType,
  agentProfile,
  spread,
  drawnCards,
  knowledgeGrounding,
}: {
  question: string;
  questionType: QuestionType;
  agentProfile: AgentProfile;
  spread: Spread;
  drawnCards: DrawnCard[];
  knowledgeGrounding?: KnowledgeGroundingContext;
}): ReadingPrompt {
  return {
    system: [
      "You are AetherTarot's card-insight generation stage.",
      "Interpret the authority cards without producing a spread synthesis.",
      buildStagedVisibleProseRules(),
      [
        "Return exactly one top-level key: card_insights.",
        "card_insights must contain exactly one item per authority card, in order.",
        "Each item must contain index, interpretation, and optional evidence_refs.",
        "index is zero-based and must exactly match authority order.",
        "Keep each interpretation concise: 2-4 Chinese sentences and no more than about 180 Chinese characters.",
        "Omit evidence_refs in normal generation. If included anyway, every evidence_ref must come from a chunk whose card_id exactly matches that authority card; never use a spread/concept/other-card ref.",
        "Do not return card names, ids, position labels, orientation metadata, themes, guidance, questions, or confidence.",
      ].join("\n"),
    ].join("\n\n"),
    user: [
      `Question: ${question}`,
      `Question type: ${questionType}`,
      `Agent profile: ${agentProfile}`,
      buildModeStrategyBlock(agentProfile),
      buildSpreadPromptBias(spread, "initial"),
      formatSpread(spread),
      "Authority drawn cards:",
      formatDrawnCards(spread, drawnCards),
      "Card-meaning knowledge:",
      formatKnowledgeGroundingForPrompt(knowledgeGrounding),
      "For each card, connect card + position + orientation + question. Keep each interpretation self-contained and non-deterministic.",
    ].join("\n\n"),
  };
}

export function buildSynthesisPrompt({
  question,
  questionType,
  agentProfile,
  spread,
  cardInsights,
  priorSessionCapsule,
  sessionMemory,
  knowledgeGrounding,
}: {
  question: string;
  questionType: QuestionType;
  agentProfile: AgentProfile;
  spread: Spread;
  cardInsights: StagedCardInsight[];
  priorSessionCapsule: string | null;
  sessionMemory?: SessionMemoryContext;
  knowledgeGrounding?: KnowledgeGroundingContext;
}): ReadingPrompt {
  return {
    system: [
      "You are AetherTarot's synthesis generation stage.",
      "Use only the verified card insights and authority spread axes below. Do not regenerate cards.",
      buildStagedVisibleProseRules(),
      buildSynthesisStageContract({ phase: "initial", agentProfile }),
    ].join("\n\n"),
    user: [
      `Question: ${question}`,
      `Question type: ${questionType}`,
      `Agent profile: ${agentProfile}`,
      buildModeStrategyBlock(agentProfile),
      buildSpreadPromptBias(spread, "initial"),
      formatSpread(spread),
      "Verified card insights:",
      formatStagedCardInsights(cardInsights),
      formatCompactRefCatalog(knowledgeGrounding),
      priorSessionCapsule
        ? `Prior session capsule (low priority only):\n${priorSessionCapsule}`
        : null,
      formatSessionMemoryForPrompt(sessionMemory),
      spread.id === "single"
        ? "Single-card synthesis must stay with one card and one position; never invent a journey or transition."
        : "Explain the spread relationship without sequentially listing the cards.",
    ].filter((item): item is string => Boolean(item)).join("\n\n"),
  };
}

export function buildCompactReadingPrompt(input: {
  question: string;
  questionType: QuestionType;
  agentProfile: AgentProfile;
  spread: Spread;
  drawnCards: DrawnCard[];
  priorSessionCapsule: string | null;
  sessionMemory?: SessionMemoryContext;
  knowledgeGrounding?: KnowledgeGroundingContext;
}): ReadingPrompt {
  return {
    system: [
      "You are AetherTarot's compact reading generation stage for a Lite initial reading.",
      buildStagedVisibleProseRules(),
      [
        "Return exactly two top-level keys: card_insights and synthesis.",
        "card_insights follows the card-insight contract: exact zero-based indices, interpretation, optional evidence_refs; never copy card metadata.",
        "Omit evidence_refs from card_insights in normal generation. If included anyway, use only refs whose card_id matches that authority card; never use a spread/concept/other-card ref.",
        "synthesis is an object following the synthesis contract below.",
        buildSynthesisStageContract({
          phase: "initial",
          agentProfile: input.agentProfile,
        }),
      ].join("\n"),
    ].join("\n\n"),
    user: [
      `Question: ${input.question}`,
      `Question type: ${input.questionType}`,
      `Agent profile: ${input.agentProfile}`,
      buildModeStrategyBlock(input.agentProfile),
      buildSpreadPromptBias(input.spread, "initial"),
      formatSpread(input.spread),
      "Authority drawn cards:",
      formatDrawnCards(input.spread, input.drawnCards),
      "Card-meaning knowledge:",
      formatKnowledgeGroundingForPrompt(input.knowledgeGrounding),
      input.priorSessionCapsule
        ? `Prior session capsule (low priority only):\n${input.priorSessionCapsule}`
        : null,
      formatSessionMemoryForPrompt(input.sessionMemory),
      input.spread.id === "single"
        ? "Keep the synthesis on the single card and its one position; do not invent an arc."
        : "Keep the synthesis concise and spread-level; do not retell every card.",
    ].filter((item): item is string => Boolean(item)).join("\n\n"),
  };
}

export function buildFinalSynthesisRefinementPrompt({
  question,
  questionType,
  agentProfile,
  spread,
  drawnCards,
  initialReading,
  followupAnswers,
  priorSessionCapsule,
  sessionMemory,
  knowledgeGrounding,
}: {
  question: string;
  questionType: QuestionType;
  agentProfile: AgentProfile;
  spread: Spread;
  drawnCards: DrawnCard[];
  initialReading: StructuredReading;
  followupAnswers: FollowupAnswer[];
  priorSessionCapsule: string | null;
  sessionMemory?: SessionMemoryContext;
  knowledgeGrounding?: KnowledgeGroundingContext;
}): ReadingPrompt {
  return {
    system: [
      "You are AetherTarot's final synthesis refinement stage.",
      "Preserve the server-owned Initial reading axis and integrate the follow-up answers.",
      buildStagedVisibleProseRules(),
      buildSynthesisStageContract({ phase: "final", agentProfile }),
      "You may optionally return card_refinements as a sparse list of only the locally changed cards. Each item is {index, interpretation, evidence_refs?}; indices must be unique and belong to the authority cards. Omit it unless follow-up answers materially change local card understanding.",
      "Omit evidence_refs in normal generation. If included in a card_refinement anyway, every ref must belong to that same authority card.",
    ].join("\n\n"),
    user: [
      `Question: ${question}`,
      `Question type: ${questionType}`,
      `Agent profile: ${agentProfile}`,
      buildModeStrategyBlock(agentProfile),
      buildSpreadPromptBias(spread, "final"),
      formatSpread(spread),
      `Allowed zero-based card_refinement indices: ${
        drawnCards.map((_, index) => index).join(", ") || "none"
      }. Never use one-based position numbers.`,
      "Server-owned Initial reading:",
      formatInitialReading(initialReading),
      "Follow-up answers:",
      formatFollowupAnswers(followupAnswers),
      formatCompactRefCatalog(knowledgeGrounding),
      priorSessionCapsule
        ? `Prior session capsule (low priority only):\n${priorSessionCapsule}`
        : null,
      formatSessionMemoryForPrompt(sessionMemory),
      "Keep at least one Initial core theme verbatim in themes or synthesis. Use answers to narrow, not replace, the Initial axis.",
    ].filter((item): item is string => Boolean(item)).join("\n\n"),
  };
}

export function buildReadingStageRepairPrompt({
  stage,
  invalidPayload,
  issues,
  allowedIndices,
  allowedRefs,
  allowedRefsByIndex,
  agentProfile,
  requiredThemes = [],
  cardInsights,
}: {
  stage: string;
  invalidPayload: unknown;
  issues: string[];
  allowedIndices: number[];
  allowedRefs: string[];
  allowedRefsByIndex: Array<{ index: number; refs: string[] }>;
  agentProfile: AgentProfile;
  requiredThemes?: string[];
  cardInsights?: StagedCardInsight[];
}): ReadingPrompt {
  const refBoundary = allowedRefsByIndex
    .map(({ index, refs }) => `- index ${index}: ${refs.join(", ") || "none"}`)
    .join("\n");
  return {
    system: [
      "You are a constrained JSON contract repair step.",
      "Repair only the supplied invalid payload. Do not perform a new open-ended tarot reading.",
      buildStagedVisibleProseRules(),
      `Failed stage: ${stage}`,
      `Allowed indices: ${allowedIndices.join(", ") || "none"}`,
      `Allowed refs: ${allowedRefs.join(", ") || "none"}`,
      `Allowed card refs by index:\n${refBoundary || "- none"}`,
      "For card_insights or card_refinements, refs are valid only for the same index. Omit evidence_refs when no valid same-card ref is available.",
      "If a final_synthesis validation issue names card_refinements, omit card_refinements entirely and copy themes, synthesis, reflective_guidance, follow_up_questions, and confidence_note exactly from the supplied invalid payload.",
      buildRepairStageContract({
        stage,
        agentProfile,
        allowedIndices,
        requiredThemes,
      }),
      "Return the complete repaired object including every required sibling field. Never return only the field named by a validation issue.",
      "Preserve every already-valid value from the supplied payload, remove disallowed keys, and change only what the issues require.",
    ].join("\n\n"),
    user: [
      "Validation issues:",
      ...issues.slice(0, 8).map((issue, index) => `${index + 1}. ${issue}`),
      cardInsights?.length
        ? `Verified card insights (immutable):\n${formatStagedCardInsights(cardInsights)}`
        : null,
      "Invalid payload:",
      JSON.stringify(invalidPayload ?? null),
    ].filter((item): item is string => Boolean(item)).join("\n"),
  };
}
