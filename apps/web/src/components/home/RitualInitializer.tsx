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

  return (
    <div className="w-full max-w-2xl space-y-4 text-center pb-4">
      {continuitySource ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="rounded-2xl border border-terracotta/25 bg-terracotta/8 p-4 text-left shadow-sm"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-terracotta">
                <LegacyIcon name="history" className="text-[18px]" />
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.18em]">
                  延续中的线索
                </p>
              </div>
              <p className="text-sm leading-relaxed text-text-inverse">
                你正在延续「{continuitySource.spreadName}」中的一条线索。它只会作为背景参照，不会替你决定这次的问题或牌阵。
              </p>
              <div className="flex flex-wrap gap-2">
                {continuitySource.themes.slice(0, 3).map((theme) => (
                  <span
                    key={`${continuitySource.readingId}-${theme}`}
                    className="rounded-full border border-terracotta/20 bg-paper/10 px-3 py-1 text-[10px] font-medium text-text-inverse-muted"
                  >
                    {theme}
                  </span>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-text-inverse-muted">
                来自：{continuitySource.question}
              </p>
            </div>
            <button
              type="button"
              onClick={clearContinuitySource}
              className="rounded-full border border-midnight-border bg-midnight-panel px-4 py-2 text-xs font-medium text-text-inverse-muted transition hover:border-terracotta/25 hover:text-text-inverse"
            >
              清除这条延续线
            </button>
          </div>
        </motion.div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="relative mx-auto max-w-xl">
          <textarea
            className="w-full resize-none rounded-2xl border border-midnight-border bg-midnight-panel px-4 py-3 font-sans text-base text-text-inverse placeholder:text-text-inverse-muted transition-all duration-200 focus:border-terracotta/40 focus:outline-none focus:ring-2 focus:ring-terracotta/10 shadow-sm"
            placeholder="今天，你想向内心询问什么？"
            rows={2}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </div>
      </motion.div>

      {repeatedThemeNotice ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="rounded-2xl border border-indigo/25 bg-indigo/10 p-4 text-left shadow-sm"
        >
          <div className="flex items-center gap-2 text-indigo">
            <LegacyIcon name="history_edu" className="text-[18px]" />
            <p className="font-sans text-[11px] font-medium uppercase tracking-[0.18em]">
              重复主题提醒
            </p>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-text-inverse">
            你最近已经问过相近的{repeatedThemeNotice.label}。开始新一轮前，可以先回看上一条线索，确认这次真正新增的问题是什么。
          </p>
          <p className="mt-2 text-xs leading-relaxed text-text-inverse-muted">
            上一次：{repeatedThemeNotice.question}
          </p>
          {repeatedThemeNotice.themes.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {repeatedThemeNotice.themes.map((theme) => (
                <span
                  key={`${repeatedThemeNotice.question}-${theme}`}
                  className="rounded-full border border-indigo/20 bg-paper/10 px-3 py-1 text-[10px] font-medium text-text-inverse-muted"
                >
                  {theme}
                </span>
              ))}
            </div>
          ) : null}
        </motion.div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.08, ease: "easeOut" }}
        className="rounded-2xl border border-midnight-border bg-midnight-panel/80 p-4 text-left shadow-sm"
      >
        <div className="mb-3 flex items-center gap-2 text-text-inverse">
          <LegacyIcon name="center_focus_strong" className="text-[18px] text-indigo" />
          <h2 className="font-sans text-[11px] font-medium uppercase tracking-[0.18em] text-text-inverse-muted">
            焦点校准
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-text-inverse-muted">
          {focusCalibrationCopy}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-midnight-border-subtle bg-black/10 px-3 py-3">
            <p className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-indigo/80">
              更适合问
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-text-inverse-muted">
              我正在忽略什么？这段关系的真实张力在哪？我此刻更该面对哪种模式？
            </p>
          </div>
          <div className="rounded-xl border border-midnight-border-subtle bg-black/10 px-3 py-3">
            <p className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-terracotta/80">
              尽量别问
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-text-inverse-muted">
              他一定会怎样？我是不是必须辞职或分手？塔罗能不能直接替我确认答案？
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        className="space-y-3"
      >
        <h2 className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-text-inverse-muted/60">
          选择塔罗师 · Choose Your Reader
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {AGENT_PROFILES.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => setAgentProfile(profile.id)}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left transition-all duration-200",
                agentProfile === profile.id
                  ? "border-terracotta/50 bg-midnight-elevated shadow-sm"
                  : "border-midnight-border bg-midnight-panel hover:border-midnight-border-subtle hover:shadow-sm",
              )}
            >
              <span className={cn(
                "block font-serif text-base transition-colors",
                agentProfile === profile.id ? "text-text-inverse" : "text-text-inverse-muted"
              )}>
                {profile.name}
              </span>
              <span className={cn(
                "mt-1.5 block text-xs leading-relaxed transition-colors",
                agentProfile === profile.id ? "text-text-inverse-muted" : "text-text-inverse-muted/60"
              )}>
                {profile.description}
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.25, ease: "easeOut" }}
        className="space-y-4"
      >
        <h2 className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-text-inverse-muted/60">
          选择牌阵 · Choose Your Spread
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {spreads.map((spread) => (
            <button
              key={spread.id}
              type="button"
              onClick={() => setSelectedSpread(spread)}
              className={cn(
                "group flex flex-col items-center rounded-2xl border p-4 text-center transition-all duration-200",
                selectedSpread?.id === spread.id
                  ? "border-terracotta/50 bg-midnight-elevated shadow-sm"
                  : "border-midnight-border bg-midnight-panel hover:border-midnight-border-subtle hover:shadow-sm",
              )}
            >
              <div
                className={cn(
                  "mb-3 flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                  selectedSpread?.id === spread.id
                    ? "bg-terracotta/20 text-terracotta"
                    : "bg-white/5 text-text-inverse-muted group-hover:text-text-inverse",
                )}
              >
                <LegacyIcon name={spread.icon} className="text-2xl" />
              </div>
              <h3 className={cn(
                "mb-1 font-serif text-base transition-colors",
                selectedSpread?.id === spread.id ? "text-text-inverse" : "text-text-inverse-muted"
              )}>
                {spread.name}
              </h3>
              <p className={cn(
                "font-sans text-xs leading-relaxed transition-colors",
                selectedSpread?.id === spread.id ? "text-text-inverse-muted" : "text-text-inverse-muted/60"
              )}>
                {spread.description}
              </p>
              {spread.id === "holy-triangle" && (
                <span className={cn(
                  "chip-dark mt-2 text-[9px]",
                  selectedSpread?.id === spread.id && "border-terracotta/30 text-terracotta/80"
                )}>
                  最受青睐
                </span>
              )}
              {spread.id === "four-aspects" && (
                <span className={cn(
                  "chip-dark mt-2 text-[9px]",
                  selectedSpread?.id === spread.id && "border-indigo/30 text-indigo/80"
                )}>
                  多层拆解
                </span>
              )}
              {spread.id === "seven-card" && (
                <span className={cn(
                  "chip-dark mt-2 text-[9px]",
                  selectedSpread?.id === spread.id && "border-terracotta/30 text-terracotta/80"
                )}>
                  通用主力
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
        className="space-y-3"
      >
        <h2 className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-text-inverse-muted/60">
          选择抽牌方式 · Choose Draw Mode
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {DRAW_SOURCES.map((source) => (
            <button
              key={source.id}
              type="button"
              onClick={() => setDrawSource(source.id)}
              className={cn(
                "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200",
                drawSource === source.id
                  ? "border-terracotta/50 bg-midnight-elevated shadow-sm"
                  : "border-midnight-border bg-midnight-panel hover:border-midnight-border-subtle hover:shadow-sm",
              )}
            >
              <LegacyIcon
                name={source.icon}
                className={cn(
                  "mt-0.5 text-xl",
                  drawSource === source.id ? "text-terracotta" : "text-text-inverse-muted",
                )}
              />
              <span>
                <span
                  className={cn(
                    "block font-serif text-base",
                    drawSource === source.id ? "text-text-inverse" : "text-text-inverse-muted",
                  )}
                >
                  {source.name}
                </span>
                <span
                  className={cn(
                    "mt-1 block text-xs leading-relaxed",
                    drawSource === source.id ? "text-text-inverse-muted" : "text-text-inverse-muted/60",
                  )}
                >
                  {source.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
        className="relative inline-block"
      >
        <motion.button
          type="button"
          onMouseDown={startPress}
          onMouseUp={() => stopPress()}
          onMouseLeave={() => stopPress()}
          onTouchStart={startPress}
          onTouchEnd={() => stopPress()}
          disabled={!question.trim() || !selectedSpread}
          className={cn(
            "btn-primary relative select-none overflow-hidden px-10 py-4 text-sm transition-all",
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
            {isPressing
              ? "正在收束意图..."
              : drawSource === "offline_manual"
                ? "长按开始录入"
                : "长按开始仪式"}
          </span>
        </motion.button>
        <div className="mt-4 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => requestStart("quick")}
            disabled={!trimmedQuestion}
            className="rounded-full border border-midnight-border bg-midnight-panel px-6 py-2.5 text-sm font-medium text-text-inverse-muted transition hover:border-terracotta/30 hover:text-text-inverse disabled:cursor-not-allowed disabled:opacity-45"
          >
            快速解读
          </button>
          <p className="max-w-lg text-xs leading-relaxed text-text-inverse-muted/70">
            跳过仪式，使用{selectedSpread?.name ?? QUICK_DEFAULT_SPREAD?.name ?? "单牌启示"}生成轻量初读；牌面仍随机，牌阵仍决定解释路径。
          </p>
        </div>
        <p className="mt-4 min-h-[20px] max-w-lg text-xs leading-relaxed text-text-inverse-muted transition-all">
          {isPressing
            ? "你选择的是阅读容器，不是结果。让随机先发生，再让牌阵组织意义。"
            : drawSource === "offline_manual"
              ? `${spreadGuide} 你在线下完成抽取，系统只负责按牌阵与牌面进行反思式解读。`
              : `${spreadGuide} 解读用于反思与启发，不替代专业建议。`}
        </p>
      </motion.div>

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
