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
import { drawCardsForSpread } from "@/lib/tarotDraw";
import LegacyIcon from "@/components/ui/LegacyIcon";

const SENSITIVE_TERM_REGEX = /(离|辞|投资|买|卖|生病|死|分手|必须|一定|到底|决定|怎么)/;
const MAJOR_DECISION_TERM_REGEX =
  /离婚|辞职|分手|退学|堕胎|卖房|买房|投资|炒股|决裂|起诉|诉讼|官司|借贷|贷款|法律|财务|理财/i;

const spreads = getAllSpreads();
const QUICK_DEFAULT_SPREAD = spreads.find((spread) => spread.id === "single") ?? spreads[0];

const AGENT_PROFILES: Array<{ id: AgentProfile; name: string; description: string }> = [
  {
    id: "lite",
    name: "快速塔罗师",
    description: "轻量初读，适合先看一个清晰倾向。",
  },
  {
    id: "standard",
    name: "标准塔罗师",
    description: "两阶段校准，先让牌面说话，再结合你的回应。",
  },
  {
    id: "sober",
    name: "清醒塔罗师",
    description: "更强调现实边界，适合重大决定或高压力议题。",
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

  if (!questionType) {
    return null;
  }

  if (questionType === "other") {
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

function getFocusCalibrationCopy(question: string) {
  const trimmedQuestion = question.trim();

  if (!trimmedQuestion) {
    return "试着把问题收束成“我需要看清什么”，而不是让牌替你宣布命运或替你做决定。";
  }

  if (SENSITIVE_TERM_REGEX.test(trimmedQuestion)) {
    return "这个问题带有明显的现实决策重量。更适合询问“我忽略了什么”或“我该看清哪种张力”，而不是“我必须怎么做”。";
  }

  if (trimmedQuestion.length < 10) {
    return "可以再具体一点：你最想看清的是哪段关系、哪种张力，或哪个反复出现的模式？";
  }

  return "问题已经具备开放性。接下来请让牌阵决定观察角度，而不是试图操纵结果。";
}

export default function RitualInitializer() {
  const router = useRouter();
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
    completeRitual,
    startRitual,
  } = useReading();

  const [isPressing, setIsPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showDecisionBoundaryModal, setShowDecisionBoundaryModal] = useState(false);
  const [decisionBoundaryAcknowledged, setDecisionBoundaryAcknowledged] = useState(false);
  const [pendingStartMode, setPendingStartMode] = useState<"ritual" | "quick" | null>(null);
  const trimmedQuestion = question.trim();
  const isMajorDecisionQuestion = MAJOR_DECISION_TERM_REGEX.test(trimmedQuestion);
  const focusCalibrationCopy = getFocusCalibrationCopy(trimmedQuestion);
  const repeatedThemeNotice = findRecentRepeatedTheme(history, trimmedQuestion);
  const spreadGuide =
    selectedSpread
      ? `${selectedSpread.name} 会用 ${selectedSpread.positions.length} 个位置来组织这次随机。`
      : "先选择一个牌阵，让阅读容器决定我们从哪些角度观看你的问题。";

  const startPress = () => {
    if (!question.trim() || !selectedSpread) return;
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

  const handleDecisionBoundaryConfirm = () => {
    if (!decisionBoundaryAcknowledged) {
      return;
    }

    const mode = pendingStartMode ?? "ritual";
    setShowDecisionBoundaryModal(false);
    setPendingStartMode(null);

    if (mode === "quick") {
      handleQuickStart();
      return;
    }

    handleStart();
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

    router.push(drawSource === "offline_manual" ? "/offline-draw" : "/ritual");
  };

  const handleQuickStart = () => {
    const targetSpread = selectedSpread ?? QUICK_DEFAULT_SPREAD;

    if (!trimmedQuestion || !targetSpread) {
      return;
    }

    const quickDrawnCards = drawCardsForSpread(targetSpread.positions);

    if (quickDrawnCards.length !== targetSpread.positions.length) {
      return;
    }

    setAgentProfile("lite");
    setDrawSource("digital_random");
    setSelectedSpread(targetSpread);
    completeRitual(quickDrawnCards);
    router.push("/reading");
  };

  const requestStart = (mode: "ritual" | "quick") => {
    if (isMajorDecisionQuestion) {
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
  const startButtonDisabled = !trimmedQuestion || !selectedSpread;
  const startButtonLabel = isPressing
    ? "正在收束意图..."
    : drawSource === "offline_manual"
      ? "长按开始录入"
      : "长按开始仪式";
  const ctaDescription = `跳过仪式会使用${selectedSpread?.name ?? QUICK_DEFAULT_SPREAD?.name ?? "单牌启示"}生成轻量初读；安全边界与完整流程一致。`;

  return (
    <div className="flex w-full max-w-[1500px] flex-col gap-2 pb-28 text-left lg:h-full lg:min-h-0 lg:pb-0">
      {(continuitySource || repeatedThemeNotice) ? (
        <div className="grid shrink-0 gap-2 lg:max-h-[106px] lg:grid-cols-2 lg:overflow-y-auto">
          {continuitySource ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="rounded-2xl border border-terracotta/25 bg-terracotta/8 px-4 py-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-terracotta">
                    <LegacyIcon name="history" className="text-[18px]" />
                    <p className="font-sans text-[11px] font-medium uppercase tracking-[0.18em]">
                      延续中的线索
                    </p>
                  </div>
                  <p className="line-clamp-2 text-sm leading-relaxed text-text-inverse">
                    你正在延续「{continuitySource.spreadName}」中的一条线索。它只会作为背景参照，不会替你决定这次的问题或牌阵。
                  </p>
                  <p className="truncate text-xs text-text-inverse-muted">
                    来自：{continuitySource.question}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearContinuitySource}
                  className="shrink-0 rounded-full border border-midnight-border bg-midnight-panel px-3 py-2 text-xs font-medium text-text-inverse-muted transition hover:border-terracotta/25 hover:text-text-inverse"
                >
                  清除这条延续线
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
              className="rounded-2xl border border-indigo/25 bg-indigo/10 px-4 py-3 shadow-sm"
            >
              <div className="flex items-center gap-2 text-indigo">
                <LegacyIcon name="history_edu" className="text-[18px]" />
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.18em]">
                  重复主题提醒
                </p>
              </div>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-text-inverse">
                你最近已经问过相近的{repeatedThemeNotice.label}。开始新一轮前，可以先回看上一条线索，确认这次真正新增的问题是什么。
              </p>
              <p className="mt-1 truncate text-xs text-text-inverse-muted">
                上一次：{repeatedThemeNotice.question}
              </p>
            </motion.div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(300px,0.95fr)_minmax(420px,1.35fr)_minmax(250px,0.78fr)] xl:grid-cols-[minmax(330px,0.95fr)_minmax(520px,1.45fr)_minmax(280px,0.8fr)]">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex min-h-0 flex-col gap-3 rounded-2xl border border-midnight-border bg-midnight-panel/80 p-3.5 shadow-sm lg:p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-text-inverse-muted/60">
                Intent
              </p>
              <h2 className="mt-1 font-serif text-lg text-text-inverse">
                意图与行动
              </h2>
            </div>
            <span className="rounded-full border border-midnight-border bg-black/10 px-3 py-1 text-[10px] text-text-inverse-muted">
              先收束问题
            </span>
          </div>

          <textarea
            className="min-h-[104px] w-full resize-none rounded-2xl border border-midnight-border bg-night/45 px-4 py-3 font-sans text-base leading-relaxed text-text-inverse shadow-sm transition-all duration-200 placeholder:text-text-inverse-muted focus:border-terracotta/40 focus:outline-none focus:ring-2 focus:ring-terracotta/10 lg:min-h-[96px]"
            placeholder="今天，你想向内心询问什么？"
            rows={4}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />

          <div className="rounded-2xl border border-midnight-border-subtle bg-black/10 p-3">
            <div className="mb-2 flex items-center gap-2 text-text-inverse">
              <LegacyIcon name="center_focus_strong" className="text-[18px] text-indigo" />
              <h3 className="font-sans text-[11px] font-medium uppercase tracking-[0.18em] text-text-inverse-muted">
                焦点校准
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-text-inverse-muted">
              {focusCalibrationCopy}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="rounded-xl border border-midnight-border-subtle bg-white/[0.03] px-3 py-2.5">
                <p className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-indigo/80">
                  更适合问
                </p>
                <p className="mt-1 text-xs leading-relaxed text-text-inverse-muted">
                  我正在忽略什么？真实张力在哪？
                </p>
              </div>
              <div className="rounded-xl border border-midnight-border-subtle bg-white/[0.03] px-3 py-2.5">
                <p className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-terracotta/80">
                  尽量别问
                </p>
                <p className="mt-1 text-xs leading-relaxed text-text-inverse-muted">
                  他一定会怎样？塔罗能否替我确认答案？
                </p>
              </div>
            </div>
          </div>

          <div className="mt-auto hidden rounded-2xl border border-midnight-border bg-night/35 px-3 py-3 text-center lg:block">
            <div className="flex flex-col items-stretch justify-center gap-2 sm:flex-row lg:flex-col xl:flex-row">
              <motion.button
                type="button"
                onMouseDown={startPress}
                onMouseUp={() => stopPress()}
                onMouseLeave={() => stopPress()}
                onTouchStart={startPress}
                onTouchEnd={() => stopPress()}
                disabled={startButtonDisabled}
                className={cn(
                  "btn-primary relative min-h-12 select-none overflow-hidden px-6 py-3 text-sm transition-all",
                  isPressing && "shadow-inner",
                )}
                animate={{
                  scale: isPressing ? 0.95 : 1,
                }}
              >
                <div
                  className="absolute inset-0 origin-left bg-ink/10"
                  style={{ width: `${progress}%`, transition: "width 0.1s linear" }}
                />
                <span className="relative z-10 font-serif tracking-wide">
                  {startButtonLabel}
                </span>
              </motion.button>
              <button
                type="button"
                onClick={() => requestStart("quick")}
                disabled={!trimmedQuestion}
                className="min-h-12 rounded-xl border border-midnight-border bg-midnight-panel px-5 py-3 text-sm font-medium text-text-inverse-muted transition hover:border-terracotta/30 hover:text-text-inverse disabled:cursor-not-allowed disabled:opacity-45"
              >
                快速解读
              </button>
            </div>
            <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-text-inverse-muted/70">
              {ctaDescription}
            </p>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.08, ease: "easeOut" }}
          className="flex min-h-0 flex-col gap-3 rounded-2xl border border-midnight-border bg-midnight-panel/70 p-3.5 shadow-sm lg:p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-text-inverse-muted/60">
                Choose Your Spread
              </p>
              <h2 className="mt-1 font-serif text-lg text-text-inverse">
                选择牌阵
              </h2>
            </div>
            <span className="rounded-full border border-midnight-border bg-black/10 px-3 py-1 text-[10px] text-text-inverse-muted">
              {selectedSpreadPositionCount} 个位置
            </span>
          </div>

          <div className="grid gap-2 lg:min-h-0 lg:flex-1 lg:content-start lg:overflow-y-auto lg:pr-1 hide-scrollbar">
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
                    "group flex min-h-[76px] items-start gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all duration-200",
                    isSelected
                      ? "border-terracotta/55 bg-midnight-elevated shadow-sm"
                      : "border-midnight-border bg-night/25 hover:border-midnight-border-subtle hover:bg-midnight-panel",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
                      isSelected
                        ? "bg-terracotta/20 text-terracotta"
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
                          isSelected ? "text-text-inverse" : "text-text-inverse-muted",
                        )}
                      >
                        {spread.name}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-[10px]",
                          isSelected
                            ? "border-terracotta/30 text-terracotta/90"
                            : "border-midnight-border-subtle text-text-inverse-muted/60",
                        )}
                      >
                        {spread.positions.length} 位
                      </span>
                    </span>
                    <span
                      className={cn(
                        "mt-1 line-clamp-2 text-xs leading-relaxed transition-colors",
                        isSelected ? "text-text-inverse-muted" : "text-text-inverse-muted/60",
                      )}
                    >
                      {spread.description}
                    </span>
                  </span>
                  {badge ? (
                    <span
                      className={cn(
                        "hidden shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium xl:inline-flex",
                        badge.tone === "indigo"
                          ? "border-indigo/25 text-indigo/80"
                          : "border-terracotta/25 text-terracotta/80",
                      )}
                    >
                      {badge.label}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <p className="rounded-2xl border border-midnight-border bg-night/35 px-4 py-3 text-xs leading-relaxed text-text-inverse-muted">
            {isPressing
              ? "你选择的是阅读容器，不是结果。让随机先发生，再让牌阵组织意义。"
              : drawSource === "offline_manual"
                ? `${spreadGuide} 你在线下完成抽取，系统只负责按牌阵与牌面进行反思式解读。`
                : `${spreadGuide} 解读用于反思与启发，不替代专业建议。`}
          </p>
        </motion.section>

        <motion.aside
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.16, ease: "easeOut" }}
          className="flex min-h-0 flex-col gap-3 rounded-2xl border border-midnight-border bg-midnight-panel/60 p-3.5 shadow-sm lg:overflow-y-auto lg:p-4 lg:pr-3 hide-scrollbar"
        >
          <div>
            <p className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-text-inverse-muted/60">
              Settings
            </p>
            <h2 className="mt-1 font-serif text-lg text-text-inverse">
              阅读设置
            </h2>
          </div>

          <div className="space-y-2">
            <h3 className="font-sans text-[10px] font-medium uppercase tracking-[0.18em] text-text-inverse-muted/60">
              塔罗师
            </h3>
            <div className="grid gap-2">
              {AGENT_PROFILES.map((profile) => {
                const isSelected = agentProfile === profile.id;

                return (
                  <button
                    key={profile.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setAgentProfile(profile.id)}
                    className={cn(
                      "rounded-2xl border px-3 py-2.5 text-left transition-all duration-200",
                      isSelected
                        ? "border-terracotta/50 bg-midnight-elevated shadow-sm"
                        : "border-midnight-border bg-night/25 hover:border-midnight-border-subtle hover:bg-midnight-panel",
                    )}
                  >
                    <span
                      className={cn(
                        "block font-serif text-base leading-tight transition-colors",
                        isSelected ? "text-text-inverse" : "text-text-inverse-muted",
                      )}
                    >
                      {profile.name}
                    </span>
                    <span
                      className={cn(
                        "mt-1 line-clamp-2 block text-xs leading-relaxed transition-colors",
                        isSelected ? "text-text-inverse-muted" : "text-text-inverse-muted/60",
                      )}
                    >
                      {profile.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-sans text-[10px] font-medium uppercase tracking-[0.18em] text-text-inverse-muted/60">
              抽牌方式
            </h3>
            <div className="grid gap-2">
              {DRAW_SOURCES.map((source) => {
                const isSelected = drawSource === source.id;

                return (
                  <button
                    key={source.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setDrawSource(source.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all duration-200",
                      isSelected
                        ? "border-terracotta/50 bg-midnight-elevated shadow-sm"
                        : "border-midnight-border bg-night/25 hover:border-midnight-border-subtle hover:bg-midnight-panel",
                    )}
                  >
                    <LegacyIcon
                      name={source.icon}
                      className={cn(
                        "mt-0.5 text-xl",
                        isSelected ? "text-terracotta" : "text-text-inverse-muted",
                      )}
                    />
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block font-serif text-base leading-tight",
                          isSelected ? "text-text-inverse" : "text-text-inverse-muted",
                        )}
                      >
                        {source.name}
                      </span>
                      <span
                        className={cn(
                          "mt-1 line-clamp-2 block text-xs leading-relaxed",
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

      <div className="ritual-cta-bar lg:hidden">
        <p className="order-first w-full text-center text-[11px] leading-relaxed text-text-inverse-muted/75">
          {ctaDescription}
        </p>
        <motion.button
          type="button"
          onMouseDown={startPress}
          onMouseUp={() => stopPress()}
          onMouseLeave={() => stopPress()}
          onTouchStart={startPress}
          onTouchEnd={() => stopPress()}
          disabled={startButtonDisabled}
          className={cn(
            "btn-primary relative min-h-12 flex-1 select-none overflow-hidden px-4 py-3 text-sm transition-all",
            isPressing && "shadow-inner",
          )}
          animate={{
            scale: isPressing ? 0.97 : 1,
          }}
        >
          <div
            className="absolute inset-0 origin-left bg-ink/10"
            style={{ width: `${progress}%`, transition: "width 0.1s linear" }}
          />
          <span className="relative z-10 font-serif tracking-wide">
            {startButtonLabel}
          </span>
        </motion.button>
        <button
          type="button"
          onClick={() => requestStart("quick")}
          disabled={!trimmedQuestion}
          className="min-h-12 flex-1 rounded-xl border border-midnight-border bg-midnight-panel px-4 py-3 text-sm font-medium text-text-inverse-muted transition hover:border-terracotta/30 hover:text-text-inverse disabled:cursor-not-allowed disabled:opacity-45"
        >
          快速解读
        </button>
      </div>

      {showDecisionBoundaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
            onClick={closeDecisionBoundaryModal}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-paper-border bg-paper p-8 shadow-2xl"
          >
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-red-100 bg-red-50/50 text-red-500">
              <LegacyIcon name="warning" className="text-3xl" />
            </div>
            <h3 className="mb-3 text-center font-serif text-2xl text-ink">
              重大现实决定前的校准
            </h3>
            <p className="text-center text-sm leading-relaxed text-text-body">
              系统察觉到你的意图涉及重大的现实变动或决策。
              <br />
              <br />
              请牢记：塔罗无法为你承担生命的重量，它只是一面映照能量场现状的镜子。真正的选择权与结果始终握在你的手中。
            </p>
            <label className="my-6 flex items-start gap-3 rounded-2xl border border-paper-border bg-paper-raised px-4 py-3 text-left">
              <input
                type="checkbox"
                checked={decisionBoundaryAcknowledged}
                onChange={(event) => setDecisionBoundaryAcknowledged(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-terracotta"
              />
              <span className="text-sm leading-relaxed text-text-body">
                我确认这次阅读只用于整理线索；现实信息、专业意见和我的底线计划仍优先于塔罗结果。
              </span>
            </label>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleDecisionBoundaryConfirm}
                disabled={!decisionBoundaryAcknowledged}
                className="w-full rounded-2xl bg-red-900/80 px-6 py-4 text-sm font-medium text-paper transition-all hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                确认现实边界并继续
              </button>
              <button
                type="button"
                onClick={closeDecisionBoundaryModal}
                className="w-full rounded-2xl border border-paper-border bg-transparent px-6 py-4 text-sm font-medium text-text-muted transition-all hover:bg-paper-raised"
              >
                返回修改问题
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
