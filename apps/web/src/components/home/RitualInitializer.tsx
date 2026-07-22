"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { getAllSpreads } from "@aethertarot/domain-tarot";
import type {
  AgentProfile,
  DrawSource,
  QuestionType,
  ReadingHistoryEntry,
} from "@aethertarot/shared-types";
import { useReading } from "@/context/ReadingContext";
import { cn } from "@/lib/utils";
import LegacyIcon from "@/components/ui/LegacyIcon";
import { useQuickDraw } from "@/hooks/useQuickDraw";

const MAJOR_DECISION_TERM_REGEX =
  /离婚|辞职|分手|退学|堕胎|卖房|买房|投资|炒股|决裂|起诉|诉讼|官司|借贷|贷款|法律|财务|理财/i;

const spreads = getAllSpreads();
const QUICK_DEFAULT_SPREAD = spreads.find((spread) => spread.id === "single") ?? spreads[0];

const CATEGORIZED_PROMPT_POOL: Record<string, string[]> = {
  all: [
    "我最近在潜意识中抵触什么？",
    "我现在真正需要看清的情绪是什么？",
    "这段关系里，我忽略了什么真实张力？",
    "面对这个选择，我最需要补齐哪类现实信息？",
    "接下来的工作重心，我适合先聚焦在哪里？",
    "我最近反复卡住的模式是什么？",
    "对于眼前的卡顿，我能主动做出的微小改变是什么？",
    "在这份焦虑背后，我内心真正的渴望是什么？",
    "如果放下对结果的执念，当下最自然的下一步是什么？",
    "关于目前的职业方向，我内心的直觉在提示什么？",
    "在与他人的沟通中，我有哪些尚未表达的真实边界？",
    "为了获得内心的平静，我现在最需要放下什么？",
    "对于这段合作关系，未来的真实走向存在哪些变数？",
    "在当下的环境里，有哪些潜在的资源是我尚未利用的？",
    "面对未知与不确定，我该如何安顿当下的不安？",
    "关于自我提升，我目前最大的认知盲区是什么？",
    "在追求目标的路上，我是否过度消耗了自己的能量？",
    "对于当下的困局，牌面能给我带来什么意想不到的新视角？",
  ],
  relationship: [
    "这段关系里，我忽略了什么真实张力？",
    "在与他人的沟通中，我有哪些尚未表达的真实边界？",
    "对于这段合作或陪伴关系，我内心的依赖来源于哪里？",
    "面对当前的关系卡顿，我该如何平衡关怀与独立？",
    "在这段对峙中，对方真正想要表达却未说出口的是什么？",
    "关于沟通中的误解，我自身有哪些潜意识防卫机制？",
    "为了让关系更加健康，我现在最适合调整什么心态？",
    "在这份感情牵挂背后，我内心最真实的底线是什么？",
    "面对关系中的冷淡，我是否在用回避来保护自己？",
    "如果想要重建信任，我们需要共同面对的现实课题是什么？",
    "在这段时间的相处中，我们彼此给对方带来了什么正面启发？",
    "面对未来的不确定，我们是否在逃避某个具体的现实沟通？",
    "我是否把过多的期待寄托在对方身上，而忽略了自己的成长？",
    "在这段关系的拉扯中，哪些部分是可以接纳的，哪些需要明确拒绝？",
    "为了停止无休止的情绪内耗，我今天可以做出什么微小改善？",
    "关于当下的亲密关系，我内心的真实感受与表面态度有何不同？",
  ],
  career: [
    "接下来的工作重心，我适合先聚焦在哪里？",
    "关于目前的职业方向，我内心的直觉在提示什么？",
    "面对这个职业抉择，我最需要补齐哪类现实信息？",
    "在当下的职场环境里，有哪些潜在资源是我尚未利用的？",
    "在追求目标的路上，我是否过度消耗了自己的能量？",
    "面对职场瓶颈，我能主动做出的微小突破是什么？",
    "关于团队或合作中的分歧，我忽略了哪些客观因素？",
    "如果跳出现有框架，我的核心优势能在哪里最大化？",
    "面对职业发展的焦虑，我现在最需要稳住的核心能力是什么？",
    "关于这次跳槽或晋升机会，背后的隐性风险与真实收益是什么？",
    "在处理复杂的职场人际时，我如何保持专业同时守住界限？",
    "如果目前的任务进展不顺，有哪些替代方案可以降低损失？",
    "我是否在用战术上的勤奋，掩盖战略上的迷茫？",
    "对于未来的项目规划，我最需要防范的认知盲点是什么？",
    "在当下的工作平台，我真正想要积累的核心资本是什么？",
    "面对突如其来的职场变动，我该如何迅速调整节奏与预期？",
  ],
  self_growth: [
    "我最近在潜意识中抵触什么？",
    "我现在真正需要看清的情绪是什么？",
    "我最近反复卡住的模式是什么？",
    "在这份焦虑背后，我内心真正的渴望是什么？",
    "关于自我提升，我目前最大的认知盲区是什么？",
    "面对未知与不确定，我该如何安顿当下的不安？",
    "为了获得内心的平静，我现在最需要放下什么？",
    "在内心的冲突中，我如何建立更温和的自我认同？",
    "面对习惯性的自我否定，我该如何重新积累内在自信？",
    "我是否在无意间苛求完美，从而阻碍了行动的开始？",
    "对于过去遗留的精神负担，我准备好在今天释放哪一部分？",
    "在日常的能量消耗中，哪些事情最值得我投入关注？",
    "关于当下的生活节奏，我的身体与心灵给出了什么信号？",
    "如果允许自己偶尔不那么坚强，我最想对自己说什么？",
    "在建立个人边界的过程中，我最难克服的罪恶感是什么？",
    "对于未来的自我期许，我需要从现在开始培养什么新习惯？",
  ],
  decision: [
    "面对这个选择，我最需要补齐哪类现实信息？",
    "如果放下对结果的执念，当下最自然的下一步是什么？",
    "在两个选项之间，我潜意识里真正害怕承担的代价是什么？",
    "对于当下的困局，牌面能给我带来什么意想不到的新视角？",
    "对于眼前的卡顿，我能主动做出的微小改变是什么？",
    "在做出最终决定前，我需要看清哪些现实边界？",
    "面对冲动与焦虑，我该如何维持决策时的清醒？",
    "如果从更长远的时间尺度看，这个决定对我的核心意义是什么？",
    "在现实条件受限的情况下，最符合我长远利益的折中方案是什么？",
    "对于这次重大转变，我是否做好了应对最坏情况的准备？",
    "在外部声音复杂的干扰下，我内心的真实声音到底倾向于哪边？",
    "如果选择维持现状，我需要承担的隐性成本是什么？",
    "在做出决定之后，第一步最具建设性的具体行动是什么？",
    "对于眼前看似迫切的时限，我是否被焦虑催促着仓促落子？",
    "在这个决定中，哪些是可以通过后期努力弥补的，哪些是不可逆的？",
    "面对利益与内心的冲突，我最看重的核心价值到底是什么？",
  ],
};

const PROMPT_CATEGORIES = [
  { id: "all", label: "全部" },
  { id: "relationship", label: "感情关系" },
  { id: "career", label: "事业职场" },
  { id: "self_growth", label: "自我探索" },
  { id: "decision", label: "抉择困局" },
];

const AGENT_PROFILES: Array<{
  id: AgentProfile;
  name: string;
  subtitle: string;
  description: string;
  badge?: string;
}> = [
  {
    id: "lite",
    name: "快速塔罗师",
    subtitle: "快速看懂当前最值得关注的一点",
    description: "适合简单问题或快速抽牌。",
    badge: "快速体验",
  },
  {
    id: "standard",
    name: "日常塔罗师",
    subtitle: "用自然语言理解牌面与你的处境",
    description: "适合大多数感情、事业和自我探索问题。",
    badge: "推荐",
  },
  {
    id: "sober",
    name: "深度塔罗师",
    subtitle: "从多角度深入分析复杂问题",
    description: "适合多牌阵、需要梳理多重因素或验证假设的议题。",
    badge: "深度分析",
  },
];

const DRAW_SOURCES: Array<{ id: DrawSource; name: string; description: string; icon: string }> = [
  {
    id: "digital_random",
    name: "线上抽牌",
    description: "由系统洗牌并随机抽取，适合快速完成完整仪式。",
    icon: "style",
  },
  {
    id: "offline_manual",
    name: "线下录入",
    description: "使用你的实体牌抽取，再按牌阵位置录入牌面。",
    icon: "edit_square",
  },
];

const SPREAD_BADGES: Record<string, { label: string; tone: "terracotta" | "indigo" }> = {
  "holy-triangle": { label: "最受青睐", tone: "terracotta" },
  "four-aspects": { label: "多层拆解", tone: "indigo" },
  "seven-card": { label: "通用主力", tone: "terracotta" },
};

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  relationship: "关系议题",
  career: "职业议题",
  self_growth: "自我成长",
  decision: "行动选择",
  other: "综合议题",
};

function inferQuestionType(question: string): QuestionType | null {
  if (!question.trim()) {
    return null;
  }

  if (/关系|感情|伴侣|喜欢|爱|分手|复合|他|她|对方/.test(question)) {
    return "relationship";
  }

  if (/工作|职业|事业|职场|项目|升职|跳槽|辞职|创业/.test(question)) {
    return "career";
  }

  if (/成长|模式|内心|自我|状态|课题|情绪/.test(question)) {
    return "self_growth";
  }

  if (/离婚|辞职|退学|堕胎|卖房|买房|投资|炒股|决裂|决定|选择|必须|要不要/.test(question)) {
    return "decision";
  }

  return "other";
}

function findRecentRepeatedTheme(
  history: ReadingHistoryEntry[],
  question: string,
) {
  const questionType = inferQuestionType(question);

  if (!questionType || questionType === "other") {
    return null;
  }

  const recentMatch = history
    .slice(0, 6)
    .find((entry) => entry.reading.question_type === questionType);

  if (!recentMatch) {
    return null;
  }

  return {
    label: QUESTION_TYPE_LABELS[questionType],
    question: recentMatch.reading.question,
    themes: recentMatch.reading.themes.slice(0, 3),
  };
}

export default function RitualInitializer() {
  const router = useRouter();
  const { performQuickDraw, isNavigating: isQuickDrawing } = useQuickDraw();
  const {
    question,
    selectedSpread,
    agentProfile,
    drawSource,
    continuitySource,
    history,
    setQuestion,
    setSelectedSpread,
    setAgentProfile,
    setDrawSource,
    clearContinuitySource,
    startRitual,
  } = useReading();

  const [isPressing, setIsPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const [activeCategory, setActiveCategory] = useState("all");
  const [promptBatchIndex, setPromptBatchIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);

  const [showDecisionBoundaryModal, setShowDecisionBoundaryModal] = useState(false);
  const [decisionBoundaryAcknowledged, setDecisionBoundaryAcknowledged] = useState(false);
  const [pendingStartMode, setPendingStartMode] = useState<"ritual" | "quick" | null>(null);
  const [navigationMode, setNavigationMode] = useState<"ritual" | "quick" | null>(null);

  const trimmedQuestion = question.trim();
  const isNavigationPending = navigationMode !== null || isQuickDrawing;
  const isMajorDecisionQuestion = MAJOR_DECISION_TERM_REGEX.test(trimmedQuestion);
  const repeatedThemeNotice = findRecentRepeatedTheme(history, trimmedQuestion);

  const spreadGuide = selectedSpread
    ? `${selectedSpread.name} 会用 ${selectedSpread.positions.length} 个位置来组织这次随机。`
    : "先选择一个牌阵，让阅读容器决定我们从哪些角度观看你的问题。";

  // Compute current 8 visible prompt chips based on active category
  const currentPool = CATEGORIZED_PROMPT_POOL[activeCategory] ?? CATEGORIZED_PROMPT_POOL.all;
  const currentPrompts = Array.from({ length: 8 }).map((_, i) => {
    const idx = (promptBatchIndex * 8 + i) % currentPool.length;
    return currentPool[idx];
  });

  const handleRefreshPrompts = () => {
    setIsSpinning(true);
    setPromptBatchIndex((prev) => prev + 1);
    setTimeout(() => setIsSpinning(false), 500);
  };

  const startPress = () => {
    if (!question.trim() || !selectedSpread || isNavigationPending) return;
    setIsPressing(true);
    setProgress(0);

    pressInterval.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + 100 / 15;
      });
    }, 100);

    pressTimer.current = setTimeout(() => {
      stopPress(true);
    }, 1500);
  };

  const stopPress = (completed = false) => {
    if (pressInterval.current) clearInterval(pressInterval.current);
    if (pressTimer.current) clearTimeout(pressTimer.current);

    if (completed) {
      setProgress(100);
      requestStart("ritual");
    } else {
      setIsPressing(false);
      setProgress(0);
    }
  };

  const closeDecisionBoundaryModal = () => {
    setShowDecisionBoundaryModal(false);
    setDecisionBoundaryAcknowledged(false);
    setPendingStartMode(null);
  };

  const confirmDecisionBoundary = () => {
    if (!pendingStartMode) return;
    setShowDecisionBoundaryModal(false);
    setDecisionBoundaryAcknowledged(true);

    const mode = pendingStartMode;
    setPendingStartMode(null);

    if (mode === "quick") {
      handleQuickStart();
    } else {
      handleStart();
    }
  };

  useEffect(() => {
    return () => {
      if (pressInterval.current) clearInterval(pressInterval.current);
      if (pressTimer.current) clearTimeout(pressTimer.current);
    };
  }, []);

  const handleStart = () => {
    if (!startRitual()) {
      return;
    }

    setNavigationMode("ritual");
    router.push(drawSource === "offline_manual" ? "/offline-draw" : "/ritual/draw");
  };

  const handleQuickStart = () => {
    setNavigationMode("quick");
    performQuickDraw();
  };

  const requestStart = (mode: "ritual" | "quick") => {
    if (isNavigationPending) {
      return;
    }

    if (isMajorDecisionQuestion && !decisionBoundaryAcknowledged) {
      setPendingStartMode(mode);
      setShowDecisionBoundaryModal(true);
      setDecisionBoundaryAcknowledged(false);
      setIsPressing(false);
      setProgress(0);
      return;
    }

    if (mode === "quick") {
      handleQuickStart();
      return;
    }

    handleStart();
  };

  const selectedSpreadPositionCount =
    selectedSpread?.positions.length ?? QUICK_DEFAULT_SPREAD?.positions.length ?? 1;
  const startButtonDisabled = !trimmedQuestion || !selectedSpread || isNavigationPending;
  const quickButtonDisabled = !trimmedQuestion || isNavigationPending;
  const startButtonLabel = navigationMode === "ritual"
    ? drawSource === "offline_manual"
      ? "正在进入录入..."
      : "正在进入仪式..."
    : isPressing
    ? "正在聚焦能量..."
    : drawSource === "offline_manual"
      ? "长按开始录入"
      : "长按开始仪式";
  const quickButtonLabel =
    navigationMode === "quick" || isQuickDrawing ? "正在生成轻量解读..." : "快速解读";

  const renderActionButtons = () => (
    <div className="flex w-full flex-row items-stretch gap-2.5">
      <div className="relative flex-1">
        <div
          className="pointer-events-none absolute inset-0 rounded-xl transition-all duration-300"
          style={{
            boxShadow: isPressing
              ? `0 0 ${28 + progress * 0.45}px rgba(214, 107, 61, ${0.4 + progress * 0.005})`
              : "0 0 16px rgba(214, 107, 61, 0.22)",
          }}
        />

        <motion.button
          type="button"
          onMouseDown={startPress}
          onMouseUp={() => stopPress()}
          onMouseLeave={() => stopPress()}
          onTouchStart={startPress}
          onTouchEnd={() => stopPress()}
          disabled={startButtonDisabled}
          className={cn(
            "btn-primary relative w-full min-h-11 select-none overflow-hidden px-6 py-2.5 text-sm transition-all",
            isPressing && "shadow-inner border-terracotta/90",
          )}
          animate={{
            scale: isPressing ? [0.97, 0.985, 0.97] : 1,
          }}
          transition={{
            repeat: isPressing ? Infinity : 0,
            duration: 0.4,
          }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-l-xl bg-gradient-to-r from-terracotta via-amber-500 to-amber-300 opacity-95 transition-all duration-100 ease-linear"
            style={{
              width: `${progress}%`,
            }}
          />

          {isPressing && progress > 2 && progress < 98 ? (
            <div
              className="pointer-events-none absolute top-0 bottom-0 transition-all duration-100 ease-linear"
              style={{ left: `calc(${progress}% - 24px)` }}
            >
              <div className="absolute top-1 -right-2 h-2 w-2 rounded-full bg-amber-200/90 blur-[1px] animate-ping" />
              <div className="absolute top-3 -right-4 h-3 w-3 rounded-full bg-amber-300/80 blur-sm" />
              <div className="absolute top-1/2 -right-1 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white/95 blur-sm" />
              <div className="absolute bottom-3 -right-5 h-2.5 w-2.5 rounded-full bg-terracotta-light/90 blur-sm" />
              <div className="absolute bottom-1 -right-3 h-2 w-2 rounded-full bg-amber-200/80 blur-[1px] animate-pulse" />
            </div>
          ) : null}

          {isPressing ? (
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.25),transparent_60%)] animate-pulse" />
          ) : null}

          <span
            className={cn(
              "relative z-10 font-serif tracking-wide transition-all duration-200",
              isPressing && "text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.9)] font-medium",
            )}
          >
            {startButtonLabel}
          </span>
        </motion.button>
      </div>

      <button
        type="button"
        onClick={() => requestStart("quick")}
        disabled={quickButtonDisabled}
        className="min-h-11 rounded-xl border border-midnight-border bg-midnight-panel px-4 py-2.5 text-sm font-medium text-text-inverse-muted transition hover:border-terracotta/30 hover:text-text-inverse disabled:cursor-not-allowed disabled:opacity-45"
      >
        {quickButtonLabel}
      </button>
    </div>
  );

  return (
    <div className="flex w-full max-w-[1500px] flex-col gap-3 text-left lg:h-full lg:overflow-hidden">
      {/* Hidden SVG Filter for Stippled Edge Turbulence */}
      <svg className="absolute h-0 w-0 pointer-events-none">
        <defs>
          <filter id="stippled-edge-filter" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.09 0.18" numOctaves="3" result="noise" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 16 -6" />
          </filter>
        </defs>
      </svg>

      {(continuitySource || repeatedThemeNotice) ? (
        <div className="grid shrink-0 gap-2 lg:max-h-[120px] lg:grid-cols-2 lg:overflow-y-auto">
          {continuitySource ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="rounded-2xl border border-terracotta/25 bg-terracotta/8 px-4 py-2.5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 text-terracotta">
                    <LegacyIcon name="history" className="text-[16px]" />
                    <p className="font-sans text-[11px] font-medium uppercase tracking-[0.18em]">
                      延续中的线索
                    </p>
                  </div>
                  <p className="line-clamp-1 text-xs leading-relaxed text-text-inverse">
                    你正在延续「{continuitySource.spreadName}」中的一条线索。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearContinuitySource}
                  className="shrink-0 rounded-full border border-midnight-border bg-midnight-panel px-2.5 py-1 text-[11px] font-medium text-text-inverse-muted transition hover:border-terracotta/25 hover:text-text-inverse"
                >
                  清除
                </button>
              </div>
            </motion.div>
          ) : null}

          {repeatedThemeNotice ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="rounded-2xl border border-indigo/25 bg-indigo/10 px-4 py-2.5 shadow-sm"
            >
              <div className="flex items-center gap-2 text-indigo">
                <LegacyIcon name="history_edu" className="text-[16px]" />
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.18em]">
                  重复主题提醒
                </p>
              </div>
              <p className="mt-0.5 line-clamp-1 text-xs leading-relaxed text-text-inverse">
                最近问过相近的{repeatedThemeNotice.label}：{repeatedThemeNotice.question}
              </p>
            </motion.div>
          ) : null}
        </div>
      ) : null}

      {/* 3-Column Grid with Surface Hierarchy */}
      <div className="grid min-w-0 gap-3 lg:h-full lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(280px,0.85fr)_minmax(460px,1.45fr)_minmax(250px,0.78fr)] lg:grid-rows-1 xl:grid-cols-[minmax(300px,0.9fr)_minmax(520px,1.5fr)_minmax(270px,0.8fr)]">
        
        {/* COLUMN 1: CHOOSE YOUR SPREAD (选择牌阵) - Enlarged Cards */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="order-2 flex min-h-0 min-w-0 flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#0D1017]/80 p-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:order-1 lg:p-4"
        >
          <div className="flex items-center justify-between gap-3 shrink-0">
            <div>
              <p className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-indigo-light/70">
                Choose Your Spread
              </p>
              <h2 className="mt-0.5 font-serif text-lg text-text-inverse">
                选择牌阵
              </h2>
            </div>
            <span className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1 text-[10px] text-text-inverse-muted">
              {selectedSpreadPositionCount} 个位置
            </span>
          </div>

          <div className="grid gap-2.5 lg:min-h-0 lg:flex-1 lg:content-start lg:overflow-y-auto lg:pr-1 hide-scrollbar">
            {spreads.map((spread) => {
              const isSelected = selectedSpread?.id === spread.id;
              const badge = SPREAD_BADGES[spread.id];

              return (
                <button
                  key={spread.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedSpread(spread)}
                  className={cn(
                    "group flex min-h-[82px] items-start gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-all duration-200",
                    isSelected
                      ? "border-terracotta/70 bg-gradient-to-r from-terracotta/25 via-midnight-elevated/90 to-midnight-elevated/90 shadow-[0_0_24px_rgba(214,107,61,0.22)]"
                      : "border-white/[0.06] bg-night/30 hover:border-white/15 hover:bg-midnight-panel/80",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors mt-0.5",
                      isSelected
                        ? "bg-terracotta/30 text-terracotta shadow-[0_0_14px_rgba(214,107,61,0.4)]"
                        : "bg-white/5 text-text-inverse-muted group-hover:text-text-inverse",
                    )}
                  >
                    <LegacyIcon name={spread.icon} className="text-xl" />
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "font-serif text-base leading-tight transition-colors",
                          isSelected ? "text-text-inverse font-medium" : "text-text-inverse-muted",
                        )}
                      >
                        {spread.name}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px]",
                          isSelected
                            ? "border-terracotta/40 bg-terracotta/15 text-terracotta"
                            : "border-midnight-border-subtle text-text-inverse-muted/60",
                        )}
                      >
                        {spread.positions.length} 张
                      </span>
                    </span>
                    <span
                      className={cn(
                        "mt-1.5 line-clamp-2 text-xs leading-relaxed transition-colors",
                        isSelected ? "text-text-inverse-muted" : "text-text-inverse-muted/60",
                      )}
                    >
                      {spread.description}
                    </span>
                  </span>
                  {badge ? (
                    <span
                      className={cn(
                        "hidden shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium xl:inline-flex",
                        badge.tone === "indigo"
                          ? "border-indigo/35 text-indigo-light"
                          : "border-terracotta/35 text-terracotta",
                      )}
                    >
                      {badge.label}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <p className="shrink-0 rounded-xl border border-white/[0.06] bg-night/40 px-3 py-2 text-[11px] leading-relaxed text-text-inverse-muted/80">
            {isPressing
              ? "让随机先发生，再让牌阵组织意义。"
              : drawSource === "offline_manual"
                ? `${spreadGuide} 在线下单录入牌面。`
                : `${spreadGuide} 解读用于反思与启发。`}
          </p>
        </motion.section>

        {/* COLUMN 2: INTENT & ACTION (意图与行动) */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.08, ease: "easeOut" }}
          className="order-1 flex min-h-0 min-w-0 flex-col justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#0D1017]/85 p-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:order-2 lg:p-4"
        >
          <div className="flex shrink-0 items-center justify-between gap-3">
            <div>
              <p className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-terracotta/80">
                Intent
              </p>
              <h2 className="mt-0.5 font-serif text-lg text-text-inverse font-medium">
                意图与行动
              </h2>
            </div>
            <span className="rounded-full border border-terracotta/30 bg-terracotta/10 px-3 py-1 text-[10px] font-medium text-terracotta">
              倾听内心的声音
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3.5 lg:overflow-y-auto hide-scrollbar">
            {/* Question Textarea (Expanded Height to 4 Rows) */}
            <textarea
              className="min-h-[110px] w-full resize-none rounded-2xl border border-midnight-border bg-night/50 px-4 py-3 font-sans text-base leading-relaxed text-text-inverse shadow-inner transition-all duration-200 placeholder:text-text-inverse-muted/50 focus:border-terracotta/60 focus:bg-night/70 focus:outline-none focus:ring-2 focus:ring-terracotta/20 lg:min-h-[110px]"
              placeholder="今天，你想向内心询问什么？"
              rows={4}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />

            {/* Prompt Categories & Refresh Controls */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="font-sans text-[11px] font-medium tracking-wide text-text-inverse-muted/70">
                  灵感参考（选择胜过输入）
                </span>
                <button
                  type="button"
                  onClick={handleRefreshPrompts}
                  className="inline-flex min-h-11 items-center gap-1 rounded-full border border-indigo/25 bg-indigo/10 px-3 py-2 text-[11px] font-medium text-indigo-light transition hover:border-indigo/40 hover:bg-indigo/20 hover:text-white"
                >
                  <LegacyIcon
                    name="refresh"
                    className={cn("text-xs transition-transform duration-500", isSpinning && "rotate-180")}
                  />
                  <span>换一批</span>
                </button>
              </div>

              {/* Category Tabs Pill Row (Horizontal Smooth Scroll Track) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar flex-nowrap shrink-0 px-0.5">
                {PROMPT_CATEGORIES.map((cat) => {
                  const isCatActive = activeCategory === cat.id;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setActiveCategory(cat.id);
                        setPromptBatchIndex(0);
                      }}
                      className={cn(
                        "min-h-11 shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition-all duration-200",
                        isCatActive
                          ? "border-terracotta/60 bg-terracotta/20 text-terracotta shadow-[0_0_12px_rgba(214,107,61,0.2)]"
                          : "border-white/[0.08] bg-white/[0.03] text-text-inverse-muted hover:border-white/20 hover:text-text-inverse",
                      )}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              {/* 8 Prompt Chips Grid (Enlarged Bubble Card & Text Size text-sm) */}
              <div
                data-testid="suggested-prompt-list"
                className="grid gap-2 sm:grid-cols-2"
              >
                {currentPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setQuestion(prompt)}
                    className="flex min-h-[52px] items-center rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-left text-sm leading-relaxed text-text-inverse-muted shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-terracotta/50 hover:bg-terracotta/15 hover:text-text-inverse active:translate-y-0"
                  >
                    <span className="line-clamp-2">{prompt}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Friendly Guidance Tip */}
            <div className="rounded-xl border border-indigo/20 bg-indigo/5 px-3.5 py-2.5">
              <div className="flex items-center gap-2 text-indigo-light">
                <LegacyIcon name="info" className="text-sm shrink-0" />
                <p className="text-xs leading-relaxed text-text-inverse-muted">
                  关注你此刻最真实的感受，看看牌面能带来什么新视角。
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons with Stippled Ember Edge Long Press Effect */}
          <div className="hidden shrink-0 pt-1 lg:block">
            {renderActionButtons()}
          </div>
        </motion.section>

        {/* COLUMN 3: SETTINGS (阅读设置) - Enlarged Cards & Matching Selected Glow */}
        <motion.aside
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.16, ease: "easeOut" }}
          className="order-3 flex min-h-0 min-w-0 flex-col gap-3.5 rounded-2xl border border-white/[0.08] bg-[#0D1017]/75 p-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:order-3 lg:overflow-y-auto lg:p-4 lg:pr-3 hide-scrollbar"
        >
          <div>
            <p className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-indigo-light/70">
              Settings
            </p>
            <h2 className="mt-0.5 font-serif text-lg text-text-inverse">
              阅读设置
            </h2>
          </div>

          <div className="space-y-2.5">
            <h3 className="font-sans text-[10px] font-medium uppercase tracking-[0.18em] text-text-inverse-muted/60">
              塔罗师
            </h3>
            <div className="grid gap-2.5">
              {AGENT_PROFILES.map((profile) => {
                const isSelected = agentProfile === profile.id;

                return (
                  <button
                    key={profile.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setAgentProfile(profile.id)}
                    className={cn(
                      "relative flex flex-col justify-between rounded-2xl border px-4 py-3 text-left transition-all duration-200 min-h-[74px]",
                      isSelected
                        ? "border-terracotta/70 bg-gradient-to-r from-terracotta/25 via-midnight-elevated/90 to-midnight-elevated/90 shadow-[0_0_20px_rgba(214,107,61,0.2)]"
                        : "border-white/[0.06] bg-night/25 hover:border-white/15 hover:bg-midnight-panel",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "truncate font-serif text-base leading-tight transition-colors",
                            isSelected ? "text-text-inverse font-medium" : "text-text-inverse-muted",
                          )}
                        >
                          {profile.name}
                        </span>
                        {profile.badge ? (
                          <span
                            className={cn(
                              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                              profile.badge === "推荐"
                                ? "border-terracotta/40 bg-terracotta/15 text-terracotta"
                                : "border-white/10 bg-white/[0.04] text-text-inverse-muted/70",
                            )}
                          >
                            {profile.badge}
                          </span>
                        ) : null}
                      </span>
                      {isSelected ? (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-terracotta/25 text-terracotta shadow-[0_0_8px_rgba(214,107,61,0.4)]">
                          <LegacyIcon name="check" className="text-xs" />
                        </span>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        "mt-1 block text-xs leading-relaxed transition-colors",
                        isSelected ? "text-text-inverse-muted" : "text-text-inverse-muted/70",
                      )}
                    >
                      {profile.subtitle}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block text-[11px] leading-relaxed transition-colors",
                        isSelected ? "text-text-inverse-muted/80" : "text-text-inverse-muted/50",
                      )}
                    >
                      {profile.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5">
            <h3 className="font-sans text-[10px] font-medium uppercase tracking-[0.18em] text-text-inverse-muted/60">
              抽牌方式
            </h3>
            <div className="grid gap-2.5">
              {DRAW_SOURCES.map((source) => {
                const isSelected = drawSource === source.id;

                return (
                  <button
                    key={source.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setDrawSource(source.id)}
                    className={cn(
                      "flex items-start gap-3.5 rounded-2xl border px-4 py-3 text-left transition-all duration-200 min-h-[76px]",
                      isSelected
                        ? "border-terracotta/70 bg-gradient-to-r from-terracotta/25 via-midnight-elevated/90 to-midnight-elevated/90 shadow-[0_0_20px_rgba(214,107,61,0.2)]"
                        : "border-white/[0.06] bg-night/25 hover:border-white/15 hover:bg-midnight-panel",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors mt-0.5",
                        isSelected
                          ? "bg-terracotta/30 text-terracotta shadow-[0_0_12px_rgba(214,107,61,0.35)]"
                          : "bg-white/5 text-text-inverse-muted group-hover:text-text-inverse",
                      )}
                    >
                      <LegacyIcon name={source.icon} className="text-lg" />
                    </div>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block font-serif text-base leading-tight",
                          isSelected ? "text-text-inverse font-medium" : "text-text-inverse-muted",
                        )}
                      >
                        {source.name}
                      </span>
                      <span
                        className={cn(
                          "mt-1 block text-xs leading-relaxed",
                          isSelected ? "text-text-inverse-muted" : "text-text-inverse-muted/60",
                        )}
                      >
                        {source.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.aside>
      </div>

      <div data-testid="mobile-ritual-cta" className="ritual-cta-bar">
        {renderActionButtons()}
      </div>

      {/* Major Decision Boundary Modal */}
      {showDecisionBoundaryModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md rounded-2xl border border-midnight-border bg-midnight-panel p-6 shadow-2xl"
          >
            <div className="flex items-center gap-3 text-terracotta">
              <LegacyIcon name="warning" className="text-2xl" />
              <h3 className="font-serif text-lg font-semibold text-text-inverse">
                重大决策风险提示
              </h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-text-inverse-muted">
              检测到你的问题涉及重大现实抉择（如离职、离婚、重大投资或法律相关）。塔罗的解读旨在提供视角启发与反思工具，不能替代专业的法律、财务或医疗建议。
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDecisionBoundaryModal}
                className="rounded-xl border border-midnight-border bg-night/30 px-4 py-2 text-xs font-medium text-text-inverse-muted transition hover:bg-midnight-panel hover:text-text-inverse"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDecisionBoundary}
                className="btn-primary px-5 py-2 text-xs font-medium"
              >
                我已了解，继续仪式
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}
