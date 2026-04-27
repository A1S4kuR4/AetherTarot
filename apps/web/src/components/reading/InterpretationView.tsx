"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import type { FollowupAnswer, QuestionType } from "@aethertarot/shared-types";
import { useReading } from "@/context/ReadingContext";
import { cn } from "@/lib/utils";
import { getSpreadExperience } from "@/lib/spreadExperience";
import LegacyIcon from "@/components/ui/LegacyIcon";
import RadarChart from "./RadarChart";

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  relationship: "关系议题",
  career: "职业议题",
  self_growth: "自我成长",
  decision: "行动选择",
  other: "综合议题",
};

const FEEDBACK_OPTIONS = [
  { label: "准确", value: "accurate" },
  { label: "有帮助", value: "helpful" },
  { label: "像模板", value: "template_like" },
  { label: "有点迎合", value: "too_agreeable" },
] as const;

type FeedbackLabel = (typeof FEEDBACK_OPTIONS)[number]["value"];

function getLeadSentence(value: string, fallbackKeywords: string[]) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return `这次重点落在：${fallbackKeywords.join("、")}。`;
  }

  const match = normalized.match(/^.+?[。！？!?]/);
  const sentence = match?.[0] ?? normalized;

  if (sentence.length <= 44) {
    return sentence;
  }

  return `这次重点落在：${fallbackKeywords.join("、")}。`;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export default function InterpretationView() {
  const router = useRouter();
  const {
    question,
    selectedSpread,
    drawSource,
    drawnCards,
    reading,
    errorMessage,
    isLoading,
    safetyIntercept,
    soberGate,
    setSoberGate,
    interpretReading,
    submitFollowupAnswers,
    history,
    continuitySource,
    updateHistoryNotes,
  } = useReading();

  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [followupDraftsByReadingId, setFollowupDraftsByReadingId] = useState<Record<string, Record<number, string>>>({});
  const [feedbackLabelsByReadingId, setFeedbackLabelsByReadingId] = useState<Record<string, FeedbackLabel[]>>({});
  const [feedbackNotesByReadingId, setFeedbackNotesByReadingId] = useState<Record<string, string>>({});
  const [submittedFeedbackByReadingId, setSubmittedFeedbackByReadingId] = useState<Record<string, boolean>>({});
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const activeReadingId = reading?.reading_id ?? null;
  const isSoberGateCurrent = soberGate.readingId === activeReadingId;
  const soberInput = isSoberGateCurrent ? soberGate.input : "";
  const isSoberCheckPassed = isSoberGateCurrent ? soberGate.isPassed : false;

  const currentHistoryEntry = reading
    ? history.find((entry) => entry.id === reading.reading_id) ?? null
    : null;
  const currentHistoryEntryId = currentHistoryEntry?.id ?? null;
  const savedNotes = currentHistoryEntry?.user_notes ?? "";
  const notes = currentHistoryEntryId
    ? noteDrafts[currentHistoryEntryId] ?? savedNotes
    : "";
  const isSoberInputValid = soberInput.trim().length >= 5;
  const isInitialAwaitingFollowup = reading?.reading_phase === "initial" && reading.requires_followup;
  const followupQuestions = reading?.follow_up_questions ?? [];
  const activeFollowupDrafts = activeReadingId
    ? followupDraftsByReadingId[activeReadingId] ?? {}
    : {};
  const areFollowupAnswersValid =
    followupQuestions.length > 0 &&
    followupQuestions.every((_, index) => (activeFollowupDrafts[index] ?? "").trim().length >= 2);
  const spreadExperience = selectedSpread
    ? getSpreadExperience(
      selectedSpread.id,
      selectedSpread.name,
      selectedSpread.positions.map((position) => position.name),
    )
    : null;
  const followupSectionTitle =
    reading?.reading_phase === "final" ? "延伸自省" : "延伸追问";
  const followupSectionKicker =
    reading?.reading_phase === "final" ? "自省" : "延伸";
  const isCompletedReading = Boolean(reading && !reading.requires_followup);
  const activeFeedbackLabels = activeReadingId
    ? feedbackLabelsByReadingId[activeReadingId] ?? []
    : [];
  const activeFeedbackNote = activeReadingId
    ? feedbackNotesByReadingId[activeReadingId] ?? ""
    : "";
  const hasSubmittedFeedback = activeReadingId
    ? submittedFeedbackByReadingId[activeReadingId] === true
    : false;

  const radarValues = useMemo(() => {
    let fire = 0, water = 0, air = 0, earth = 0, spirit = 0, chaos = 0;
    const total = drawnCards.length || 1;
    drawnCards.forEach(({ card, isReversed }) => {
      const arcana = card.arcana?.toLowerCase() || "";
      const element = card.element?.toLowerCase() || "";
      if (arcana.startsWith("major")) spirit += 1;
      else {
        if (element.includes("fire") || element.includes("wands")) fire += 1;
        if (element.includes("water") || element.includes("cups")) water += 1;
        if (element.includes("air") || element.includes("swords")) air += 1;
        if (element.includes("earth") || element.includes("pentacles")) earth += 1;
      }
      if (isReversed) chaos += 1;
    });
    const counts = { fire, water, air, earth, spirit, chaos };
    const peakCount = Math.max(...Object.values(counts), 1);

    return {
      fire: { count: fire, total, score: fire / peakCount },
      water: { count: water, total, score: water / peakCount },
      air: { count: air, total, score: air / peakCount },
      earth: { count: earth, total, score: earth / peakCount },
      spirit: { count: spirit, total, score: spirit / peakCount },
      chaos: { count: chaos, total, score: chaos / peakCount },
    };
  }, [drawnCards]);

  const trustPathCards = useMemo(() => {
    if (!reading) {
      return [];
    }

    return reading.cards.slice(0, 3).map((card) => {
      const drawnCard = drawnCards.find(
        (item) => item.positionId === card.position_id,
      );
      const keywords = drawnCard
        ? (
          drawnCard.isReversed
            ? drawnCard.card.reversedKeywords
            : drawnCard.card.uprightKeywords
        ).slice(0, 3)
        : [];

      return {
        ...card,
        keywords,
      };
    });
  }, [drawnCards, reading]);

  const coreQuickRead = useMemo(() => {
    if (!reading) {
      return null;
    }

    const keywordCandidates = uniqueStrings([
      ...reading.themes,
      ...trustPathCards.flatMap((card) => card.keywords),
      QUESTION_TYPE_LABELS[reading.question_type],
      selectedSpread?.name ?? "",
    ]);
    const keywords = keywordCandidates.slice(0, 3);

    for (const fallback of ["留意边界", "观察现实", "保留弹性"]) {
      if (keywords.length >= 3) {
        break;
      }

      if (!keywords.includes(fallback)) {
        keywords.push(fallback);
      }
    }

    return {
      core:
        getLeadSentence(reading.synthesis, keywords)
        || `这次解读的核心落在${keywords.join("、")}。`,
      keywords,
      action:
        reading.reflective_guidance[0]
        ?? "先把这次解读转成一个现实中可以观察的小信号。",
      boundary:
        reading.confidence_note
        ?? "不要把综合推断当成唯一答案；它只是把牌面和你的问题暂时连接起来。",
    };
  }, [reading, selectedSpread?.name, trustPathCards]);

  const handleSaveNotes = () => {
    if (!currentHistoryEntryId) {
      return;
    }

    setIsSavingNote(true);
    updateHistoryNotes(currentHistoryEntryId, notes);

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      setIsSavingNote(false);
      saveTimerRef.current = null;
    }, 1200);
  };

  const handleFollowupChange = (index: number, value: string) => {
    if (!activeReadingId) {
      return;
    }

    setFollowupDraftsByReadingId((currentDrafts) => ({
      ...currentDrafts,
      [activeReadingId]: {
        ...(currentDrafts[activeReadingId] ?? {}),
        [index]: value,
      },
    }));
  };

  const handleSubmitFollowup = () => {
    if (!reading || !areFollowupAnswersValid) {
      return;
    }

    const answers: FollowupAnswer[] = followupQuestions.map((prompt, index) => ({
      question: prompt,
      answer: (activeFollowupDrafts[index] ?? "").trim(),
    }));

    void submitFollowupAnswers(answers);
  };
  const handleNotesChange = (value: string) => {
    if (!currentHistoryEntryId) {
      return;
    }

    setNoteDrafts((currentDrafts) => ({
      ...currentDrafts,
      [currentHistoryEntryId]: value,
    }));
  };

  const toggleFeedbackLabel = (value: FeedbackLabel) => {
    if (!activeReadingId || hasSubmittedFeedback) {
      return;
    }

    setFeedbackError(null);
    setFeedbackLabelsByReadingId((current) => {
      const existing = current[activeReadingId] ?? [];
      const next = existing.includes(value)
        ? existing.filter((item) => item !== value)
        : [...existing, value];

      return {
        ...current,
        [activeReadingId]: next,
      };
    });
  };

  const handleFeedbackNoteChange = (value: string) => {
    if (!activeReadingId || hasSubmittedFeedback) {
      return;
    }

    setFeedbackNotesByReadingId((current) => ({
      ...current,
      [activeReadingId]: value,
    }));
  };

  const handleSubmitFeedback = async () => {
    if (!activeReadingId || activeFeedbackLabels.length === 0) {
      return;
    }

    setFeedbackError(null);

    try {
      const response = await fetch("/api/reading-feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reading_id: activeReadingId,
          labels: activeFeedbackLabels,
          note: activeFeedbackNote.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("反馈提交失败，请稍后再试。");
      }

      setSubmittedFeedbackByReadingId((current) => ({
        ...current,
        [activeReadingId]: true,
      }));
    } catch (error) {
      setFeedbackError(
        error instanceof Error ? error.message : "反馈提交失败，请稍后再试。",
      );
    }
  };

  useEffect(() => {
    if (!selectedSpread) {
      router.replace("/");
      return;
    }

    if (drawnCards.length === 0) {
      router.replace(drawSource === "offline_manual" ? "/offline-draw" : "/ritual");
      return;
    }

    if (!reading && !errorMessage && !isLoading && !safetyIntercept) {
      void interpretReading();
    }
  }, [
    drawnCards.length,
    drawSource,
    errorMessage,
    interpretReading,
    isLoading,
    reading,
    router,
    safetyIntercept,
    selectedSpread,
  ]);
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);


  if (!selectedSpread || drawnCards.length === 0) {
    return null;
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-12 px-6 pb-20 pt-24 lg:flex-row lg:px-16">
      <div className="flex-1 space-y-10" style={{ maxWidth: "760px" }}>
        <header className="space-y-5">
          <h1 className="font-serif text-4xl font-semibold text-ink md:text-5xl">
            {reading?.reading_phase === "initial" ? "初步解读" : "解读结果"}
          </h1>
          <blockquote className="border-l-2 border-terracotta/30 py-2 pl-5 text-base italic leading-relaxed text-text-muted">
            这次解读不是替你宣布结果，而是帮助你更清楚地看见正在成形的主题、张力与可选择的动作。
          </blockquote>

          <div className="reading-card">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                  你的提问
                </p>
                <p className="mt-1.5 text-base leading-relaxed text-ink">
                  {`"${question}"`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {reading ? (
                  <span className="chip-accent text-[11px]">
                    {QUESTION_TYPE_LABELS[reading.question_type]}
                  </span>
                ) : null}
                <span className="chip-warm text-[11px]">{selectedSpread.name}</span>
                {drawSource === "offline_manual" ? (
                  <span className="chip-accent text-[11px]">线下录入</span>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-5 py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-paper-border border-t-terracotta" />
            <p className="font-serif text-lg text-text-muted">正在生成解读...</p>
          </div>
        ) : safetyIntercept ? (
          <div className="reading-card border-red-900/30 bg-red-950/10 ring-1 ring-inset ring-red-900/20">
            <div className="flex items-center gap-3 border-b border-red-900/20 pb-4">
              <LegacyIcon name="gavel" className="text-3xl text-red-500" />
              <h2 className="font-serif text-2xl text-red-400">界限阻断</h2>
            </div>
            <p className="mt-5 text-base leading-relaxed text-red-200">
              {safetyIntercept.reason}
            </p>
            {safetyIntercept.referral_links && safetyIntercept.referral_links.length > 0 && (
              <div className="mt-6 space-y-2">
                <p className="font-sans text-xs uppercase tracking-wider text-red-400/80">
                  现实支持资源：
                </p>
                <div className="flex flex-col gap-2">
                  {safetyIntercept.referral_links.map((link) => (
                    <a
                      key={link}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-red-300 underline hover:text-red-200"
                    >
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-8">
              <button
                type="button"
                onClick={() => router.replace("/")}
                className="rounded-full border border-paper-border bg-paper px-6 py-2.5 text-sm font-medium text-ink transition hover:bg-paper-raised"
              >
                离开并返回首页
              </button>
            </div>
          </div>
        ) : errorMessage ? (
          <div className="reading-card">
            <h2 className="font-serif text-2xl text-ink">连接受阻</h2>
            <p className="mt-3 leading-relaxed text-text-body">{errorMessage}</p>
            <button
              type="button"
              onClick={() => void interpretReading()}
              className="btn-primary mt-5"
            >
              重新尝试
            </button>
          </div>
        ) : reading ? (
          reading.sober_check && !isSoberCheckPassed ? (
            <div className="reading-card my-16 flex flex-col items-center justify-center border-terracotta/40 bg-paper-raised/80 px-8 py-12 text-center shadow-sm">
              <LegacyIcon name="psychiatry" className="mb-6 text-4xl text-terracotta" />
              <h2 className="mb-4 font-serif text-2xl text-ink">
                降温与检视 (Sober Check)
              </h2>
              <p className="mb-8 max-w-lg text-base leading-[1.8] text-text-body">
                {reading.sober_check}
              </p>
              <textarea
                value={soberInput}
                onChange={(e) => setSoberGate({ readingId: activeReadingId, input: e.target.value, isPassed: false })}
                placeholder="我的真实顾虑 / 底线计划是..."
                className="h-32 w-full max-w-xl resize-none rounded-xl border border-paper-border bg-paper p-4 font-serif text-base text-ink outline-none focus:border-terracotta/50 focus:ring-1 focus:ring-terracotta/50"
              />
              <button
                type="button"
                disabled={!isSoberInputValid}
                onClick={() => setSoberGate({ readingId: activeReadingId, input: soberInput, isPassed: true })}
                className="btn-primary mt-8 w-full max-w-xs transition-all disabled:cursor-not-allowed disabled:opacity-50"
              >
                确认并解开牌面
              </button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className={cn(
                "space-y-8",
                reading.presentation_mode === "void_narrative" && "space-y-16 lg:px-4",
                reading.presentation_mode === "sober_anchor" && "opacity-90 grayscale-[20%]",
              )}
            >
              {coreQuickRead ? (
                <section
                  className={cn(
                    "relative my-16 rounded-3xl border p-8 shadow-sm",
                    reading.presentation_mode === "sober_anchor"
                      ? "border-paper-border bg-paper"
                      : "border-terracotta/15 bg-gradient-to-b from-paper-raised to-paper",
                  )}
                >
                  <div className="absolute left-8 top-0 flex -translate-y-1/2 items-center gap-2 rounded-full border border-paper-border bg-paper px-3 py-1 shadow-sm">
                    <LegacyIcon
                      name="auto_awesome"
                      className="text-[14px] text-terracotta/70"
                    />
                    <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-terracotta/80">
                      核心速读
                    </span>
                  </div>
                  <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
                    <div className="min-w-0 space-y-6">
                      <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                        一句话先看重点
                      </p>
                      <div className="max-w-[34rem]">
                        <h2 className="font-serif text-[28px] leading-[1.45] text-ink">
                          {coreQuickRead.core}
                        </h2>
                      </div>
                      <div className="flex max-w-[34rem] flex-wrap gap-2.5">
                        {coreQuickRead.keywords.map((keyword) => (
                          <span
                            key={`quick-keyword-${keyword}`}
                            className="chip-accent border-terracotta/20 bg-terracotta/5 px-3.5 py-1.5 text-xs shadow-sm"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-paper-border bg-paper px-5 py-4">
                          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-terracotta/80">
                            现在可以怎么做
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-text-body">
                            {coreQuickRead.action}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-paper-border bg-paper px-5 py-4">
                          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                            不要过度相信
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-text-body">
                            {coreQuickRead.boundary}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0 justify-self-center lg:w-[260px] lg:justify-self-end">
                      <RadarChart
                        values={radarValues}
                        size={210}
                        layout="stacked"
                      />
                    </div>
                  </div>
                </section>
              ) : null}

              <section className="reading-card border-terracotta/20 bg-paper-raised/70">
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                  可信路径
                </p>
                <h2 className="mt-1 font-serif text-2xl text-ink">
                  这不是神谕，是可检查的解释路径
                </h2>
                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-paper-border bg-paper px-5 py-4">
                    <div className="mb-3 flex items-center gap-2 text-terracotta">
                      <LegacyIcon name="edit_note" className="text-[18px]" />
                      <h3 className="font-serif text-lg text-ink">你说了什么</h3>
                    </div>
                    <p className="text-sm leading-relaxed text-text-body">
                      {question}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="chip-accent text-[10px]">
                        {QUESTION_TYPE_LABELS[reading.question_type]}
                      </span>
                      <span className="chip-warm text-[10px]">
                        {continuitySource ? "带延续线索" : "无延续线索"}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-paper-border bg-paper px-5 py-4">
                    <div className="mb-3 flex items-center gap-2 text-terracotta">
                      <LegacyIcon name="style" className="text-[18px]" />
                      <h3 className="font-serif text-lg text-ink">牌本身说了什么</h3>
                    </div>
                    <div className="space-y-3">
                      {trustPathCards.map((card) => (
                        <div key={`trust-${card.position_id}`} className="border-l-2 border-paper-border pl-3">
                          <p className="text-sm font-medium text-ink">
                            {card.position}：{card.name}（{card.orientation === "reversed" ? "逆位" : "正位"}）
                          </p>
                          {card.keywords.length > 0 ? (
                            <p className="mt-1 text-xs leading-relaxed text-text-muted">
                              {card.keywords.join(" / ")}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-paper-border bg-paper px-5 py-4">
                    <div className="mb-3 flex items-center gap-2 text-terracotta">
                      <LegacyIcon name="account_tree" className="text-[18px]" />
                      <h3 className="font-serif text-lg text-ink">如何连接二者</h3>
                    </div>
                    <p className="text-sm leading-relaxed text-text-body">
                      {spreadExperience?.readingMechanism}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-text-muted">
                      {spreadExperience?.evidencePath}
                    </p>
                    <p className="mt-3 text-xs leading-relaxed text-text-muted">
                      逐牌顺序来自权威位置；牌面线索和位置语义先行，综合推断后置。
                    </p>
                  </div>
                </div>
              </section>

              <section className="reading-card space-y-5">
                <div>
                  <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                    逐牌
                  </p>
                  <h2 className="mt-1 font-serif text-2xl text-ink">逐牌展开</h2>
                </div>
                <div className="space-y-5">
                  {reading.cards.map((card) => {
                    const drawnCard = drawnCards.find(
                      (item) => item.positionId === card.position_id,
                    );
                    const evidenceKeywords = drawnCard
                      ? (
                        drawnCard.isReversed
                          ? drawnCard.card.reversedKeywords
                          : drawnCard.card.uprightKeywords
                      ).slice(0, 3)
                      : [];

                    return (
                      <motion.article
                        key={`${card.position_id}-${card.card_id}`}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="rounded-2xl border border-paper-border bg-paper p-5"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start">
                          <div className="min-w-0 flex-1 space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="chip-warm text-[10px]">{card.position}</span>
                              <span className="font-sans text-[11px] font-medium text-text-muted">
                                {card.orientation === "reversed" ? "逆位" : "正位"}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-serif text-xl text-ink">{card.name}</h3>
                              <p className="text-sm text-text-muted">{card.english_name}</p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="border-l-2 border-paper-border pl-4">
                                <h4 className="font-sans text-[10px] font-medium uppercase tracking-wider text-text-muted opacity-80">
                                  牌面线索
                                </h4>
                                <p className="mt-2 font-sans text-sm leading-relaxed text-text-body">
                                  {card.name}（{card.orientation === "reversed" ? "逆位" : "正位"}）
                                </p>
                                {evidenceKeywords.length > 0 ? (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {evidenceKeywords.map((keyword) => (
                                      <span
                                        key={`${card.position_id}-${keyword}`}
                                        className="rounded-full border border-paper-border bg-paper px-2 py-1 font-sans text-[11px] text-text-muted"
                                      >
                                        {keyword}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              <div className="border-l-2 border-terracotta/20 pl-4">
                                <h4 className="font-sans text-[10px] font-medium uppercase tracking-wider text-text-muted opacity-80">
                                  位置语义
                                </h4>
                                <p className="mt-2 font-sans text-sm leading-relaxed text-text-body">
                                  {card.position_meaning}
                                </p>
                              </div>
                            </div>
                            <div className="border-l-2 border-terracotta/40 bg-terracotta/5 py-3 pl-4 pr-3">
                              <h4 className="mb-2 font-sans text-[10px] font-medium uppercase tracking-wider text-terracotta opacity-80">
                                综合推断
                              </h4>
                              <p className="font-serif text-base italic leading-[1.8] text-ink">
                                {card.interpretation}
                              </p>
                            </div>
                          </div>
                          {drawnCard ? (
                            <div className="w-full max-w-[130px] shrink-0 overflow-hidden rounded-card-sm border border-paper-border md:ml-4">
                              <img
                                src={drawnCard.card.imageUrl}
                                alt={drawnCard.card.name}
                                className={cn(
                                  "aspect-[1/1.7] w-full object-cover",
                                  drawnCard.isReversed && "rotate-180",
                                )}
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : null}
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              </section>

              <section
                className={cn(
                  "reading-card",
                  reading.presentation_mode === "sober_anchor" && "border-paper-border bg-paper",
                )}
              >
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                  综合
                </p>
                <h2 className="mt-1 font-serif text-2xl text-ink">综合解读</h2>
                <p className="mt-3 font-sans text-xs leading-relaxed text-text-muted">
                  综合推断层会把牌面线索与位置语义收束成整体判断，但它仍然不是替你宣布唯一答案。
                </p>
                <p className="mt-4 text-base leading-[1.85] text-text-body">
                  {reading.synthesis}
                </p>
              </section>

              <section
                className={cn(
                  "reading-card",
                  reading.presentation_mode === "void_narrative" && "border-none bg-transparent px-0 shadow-none",
                  reading.presentation_mode === "sober_anchor" && "border-paper-border bg-paper",
                )}
              >
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                  指引
                </p>
                <h2 className="mt-1 font-serif text-2xl text-ink">反思指引</h2>
                <ul className="mt-4 space-y-3">
                  {reading.reflective_guidance.map((guidance) => (
                    <li
                      key={guidance}
                      className={cn(
                        "flex gap-3 text-base leading-relaxed text-text-body",
                        reading.presentation_mode === "void_narrative"
                          ? "border-l-0 pl-0"
                          : "border-l-2 border-terracotta/20 pl-4",
                      )}
                    >
                      {!reading.presentation_mode || reading.presentation_mode !== "void_narrative" ? (
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta/50" />
                      ) : null}
                      <span>{guidance}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section
                className={cn(
                  "reading-card",
                  reading.presentation_mode === "void_narrative" && "border-none bg-transparent px-0 shadow-none",
                  reading.presentation_mode === "sober_anchor" && "border-paper-border bg-paper",
                )}
              >
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                  {followupSectionKicker}
                </p>
                <h2 className="mt-1 font-serif text-2xl text-ink">{followupSectionTitle}</h2>
                <ul className="mt-4 space-y-3">
                  {reading.follow_up_questions.map((prompt, index) => (
                    <li
                      key={`${reading.reading_id}-followup-${index}`}
                      className="rounded-xl border border-paper-border bg-paper px-5 py-3.5 text-base leading-relaxed text-text-body"
                    >
                      {prompt}
                    </li>
                  ))}
                </ul>
              </section>


              {isInitialAwaitingFollowup ? (
                <section className="reading-card border-terracotta/30 bg-terracotta/5">
                  <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                    校准
                  </p>
                  <h2 className="mt-1 font-serif text-2xl text-ink">回答后进入整合深读</h2>
                  <p className="mt-3 text-sm leading-relaxed text-text-body">
                    这些问题来自牌面里的矛盾点。你的回答不会推翻初读，只会帮助系统把解释空间收束得更贴近现实。
                  </p>
                  <div className="mt-5 space-y-4">
                    {followupQuestions.map((prompt, index) => (
                      <label key={`${reading.reading_id}-answer-${index}`} className="block space-y-2">
                        <span className="block font-serif text-sm text-ink">
                          {index + 1}. {prompt}
                        </span>
                        <textarea
                          value={activeFollowupDrafts[index] ?? ""}
                          onChange={(event) => handleFollowupChange(index, event.target.value)}
                          placeholder="写下你的现实补充..."
                          className="h-24 w-full resize-none rounded-xl border border-paper-border bg-paper p-4 font-serif text-base text-ink outline-none focus:border-terracotta/50 focus:ring-1 focus:ring-terracotta/50"
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={!areFollowupAnswersValid || isLoading}
                    onClick={handleSubmitFollowup}
                    className="btn-primary mt-6 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    生成整合深读
                  </button>
                </section>
              ) : null}
              {reading.safety_note ? (
                <section className="rounded-2xl border border-red-900/40 bg-red-950/20 p-6 shadow-inner ring-1 ring-inset ring-red-900/20">
                  <div className="flex items-center gap-3 border-b border-red-900/30 pb-3">
                    <LegacyIcon name="warning" className="text-red-500/80" />
                    <div>
                      <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-red-500/80">
                        边界强制声明
                      </p>
                      <h2 className="mt-0.5 font-serif text-lg text-red-300">必读提示</h2>
                    </div>
                  </div>
                  <p className="mt-4 font-medium text-base leading-[1.85] text-red-200/90">
                    {reading.safety_note}
                  </p>
                </section>
              ) : null}

              {reading.confidence_note ? (
                <section className="reading-card">
                  <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                    说明
                  </p>
                  <h2 className="mt-1 font-serif text-2xl text-ink">解读说明</h2>
                  <p className="mt-4 text-base leading-[1.85] text-text-body">
                    {reading.confidence_note}
                  </p>
                </section>
              ) : null}

              {isCompletedReading ? (
                <section className="reading-card bg-paper-raised">
                  <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                    反馈
                  </p>
                  <h2 className="mt-1 font-serif text-2xl text-ink">这次解读给你的感觉</h2>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {FEEDBACK_OPTIONS.map((option) => {
                      const isSelected = activeFeedbackLabels.includes(option.value);

                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={hasSubmittedFeedback}
                          onClick={() => toggleFeedbackLabel(option.value)}
                          className={cn(
                            "rounded-full border px-4 py-2 text-sm font-medium transition",
                            isSelected
                              ? "border-terracotta/40 bg-terracotta/10 text-terracotta"
                              : "border-paper-border bg-paper text-text-body hover:bg-paper-muted",
                            hasSubmittedFeedback && "cursor-not-allowed opacity-70",
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <textarea
                    value={activeFeedbackNote}
                    onChange={(event) => handleFeedbackNoteChange(event.target.value)}
                    disabled={hasSubmittedFeedback}
                    placeholder="可选：哪里准确、哪里模板、哪里太迎合？"
                    className="mt-4 h-24 w-full resize-none rounded-xl border border-paper-border bg-paper p-4 font-serif text-base text-ink outline-none focus:border-terracotta/50 focus:ring-1 focus:ring-terracotta/50 disabled:opacity-70"
                  />
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-sm text-text-muted">
                      {hasSubmittedFeedback ? "反馈已记录，谢谢。" : feedbackError}
                    </p>
                    <button
                      type="button"
                      disabled={hasSubmittedFeedback || activeFeedbackLabels.length === 0}
                      onClick={() => void handleSubmitFeedback()}
                      className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      提交反馈
                    </button>
                  </div>
                </section>
              ) : null}

              {currentHistoryEntry ? (
                <section className="reading-card bg-paper-raised">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                        反思手记
                      </p>
                      <h2 className="mt-1 font-serif text-2xl text-ink">你的回望与觉察</h2>
                    </div>
                    {isSavingNote && (
                      <span className="flex items-center gap-1 font-sans text-xs text-terracotta opacity-80">
                        <LegacyIcon name="check_circle" className="text-[14px]" />
                        已保存
                      </span>
                    )}
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    placeholder="随着时间推移，牌意在现实中是如何展开的？写下你的感悟..."
                    className="h-32 w-full resize-none rounded-xl border border-paper-border bg-paper p-4 font-serif text-base leading-relaxed text-ink outline-none focus:border-terracotta/50 focus:ring-1 focus:ring-terracotta/50"
                  />
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      disabled={isSavingNote || !notes.trim()}
                      className="rounded-full border border-paper-border bg-paper px-5 py-2 text-sm font-medium text-ink transition-all hover:bg-paper-raised disabled:opacity-50"
                    >
                      更新手记
                    </button>
                  </div>
                </section>
              ) : null}
            </motion.div>
          )
        ) : null}
      </div>

      <aside className="sticky top-24 w-full space-y-6 self-start lg:w-72">
        <div className="reading-card">
          <h4 className="mb-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
            解读流程
          </h4>
          <div className="space-y-3">
            {[
              "提问",
              drawSource === "offline_manual" ? "录入" : "仪式",
              "揭示",
              "解读",
            ].map((step, index) => (
              <div
                key={step}
                className={cn("flex items-center gap-2.5", index < 3 && "opacity-40")}
              >
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    index === 3 ? "bg-terracotta" : "bg-paper-border",
                  )}
                />
                <span
                  className={cn(
                    "font-sans text-xs",
                    index === 3 && "font-medium text-terracotta",
                  )}
                >
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="reading-card">
          <h4 className="mb-3 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
            {selectedSpread.name}
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {drawnCards.map((drawnCard) => (
              <div
                key={drawnCard.positionId}
                className="group aspect-[1/1.7] overflow-hidden rounded-card-sm border border-paper-border transition-shadow hover:shadow-sm"
              >
                <img
                  src={drawnCard.card.imageUrl}
                  alt={drawnCard.card.name}
                  className={cn(
                    "h-full w-full object-cover transition-all duration-500 group-hover:scale-[1.02]",
                    drawnCard.isReversed && "rotate-180",
                  )}
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border-l-2 border-terracotta/25 bg-terracotta/5 p-5">
          <p className="font-serif text-sm italic leading-relaxed text-text-muted">
            真理并不是被强行规定的结论，而是从你的处境中慢慢浮现的方向感。
          </p>
        </div>
      </aside>
    </main>
  );
}
