"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import type { QuestionType } from "@aethertarot/shared-types";
import { useReading } from "@/context/ReadingContext";
import { cn } from "@/lib/utils";

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  relationship: "关系议题",
  career: "职业议题",
  self_growth: "自我成长",
  decision: "行动选择",
  other: "综合议题",
};

export default function InterpretationView() {
  const router = useRouter();
  const {
    question,
    selectedSpread,
    drawnCards,
    reading,
    errorMessage,
    isLoading,
    safetyIntercept,
    interpretReading,
    history,
    updateHistoryNotes,
  } = useReading();

  const [soberInput, setSoberInput] = useState("");
  const [isSoberCheckPassed, setIsSoberCheckPassed] = useState(false);

  const currentHistoryEntry = reading ? history.find(h => h.id === reading.reading_id) : null;
  const [notes, setNotes] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  useEffect(() => {
    setNotes(currentHistoryEntry?.user_notes ?? "");
  }, [currentHistoryEntry?.id]);

  const handleSaveNotes = () => {
    if (currentHistoryEntry) {
      setIsSavingNote(true);
      updateHistoryNotes(currentHistoryEntry.id, notes);
      setTimeout(() => setIsSavingNote(false), 1200);
    }
  };

  useEffect(() => {
    if (!selectedSpread) {
      router.replace("/");
      return;
    }

    if (drawnCards.length === 0) {
      router.replace("/ritual");
      return;
    }

    if (!reading && !errorMessage && !isLoading) {
      void interpretReading();
    }
  }, [
    drawnCards.length,
    errorMessage,
    interpretReading,
    isLoading,
    reading,
    router,
    selectedSpread,
  ]);

  if (!selectedSpread || drawnCards.length === 0) {
    return null;
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-12 px-6 pt-24 pb-20 lg:flex-row lg:px-16">
      {/* Main Content Column */}
      <div className="flex-1 space-y-10" style={{ maxWidth: "760px" }}>
        {/* Header */}
        <header className="space-y-5">
          <h1 className="font-serif text-4xl font-semibold text-ink md:text-5xl">
            解读结果
          </h1>
          <blockquote className="border-l-2 border-terracotta/30 py-2 pl-5 text-base italic text-text-muted leading-relaxed">
            这次解读不是替你宣布结果，而是帮助你更清楚地看见正在成形的主题、张力与可选择的动作。
          </blockquote>

          {/* Question & Meta */}
          <div className="reading-card">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                  你的提问
                </p>
                <p className="mt-1.5 text-base text-ink leading-relaxed">
                  "{question}"
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {reading ? (
                  <span className="chip-accent text-[11px]">
                    {QUESTION_TYPE_LABELS[reading.question_type]}
                  </span>
                ) : null}
                <span className="chip-warm text-[11px]">
                  {selectedSpread.name}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Loading */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-5 py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-paper-border border-t-terracotta" />
            <p className="font-serif text-lg text-text-muted">
              正在生成解读...
            </p>
          </div>
        ) : safetyIntercept ? (
          /* Hard Stop / Crisis Intercept */
          <div className="reading-card border-red-900/30 bg-red-950/10 ring-1 ring-inset ring-red-900/20">
            <div className="flex items-center gap-3 border-b border-red-900/20 pb-4">
              <span className="material-symbols-outlined text-red-500 text-3xl">gavel</span>
              <h2 className="font-serif text-2xl text-red-400">界限阻断</h2>
            </div>
            <p className="mt-5 text-base leading-relaxed text-red-200">
              {safetyIntercept.reason}
            </p>
            {safetyIntercept.referral_links && safetyIntercept.referral_links.length > 0 && (
              <div className="mt-6 space-y-2">
                <p className="font-sans text-xs uppercase tracking-wider text-red-400/80">现实支持资源：</p>
                <div className="flex flex-col gap-2">
                  {safetyIntercept.referral_links.map(link => (
                    <a key={link} href={link} target="_blank" rel="noopener noreferrer" className="text-sm underline text-red-300 hover:text-red-200">
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-8">
              <button onClick={() => router.replace("/")} className="rounded-full bg-paper border border-paper-border px-6 py-2.5 text-sm font-medium text-ink transition hover:bg-paper-raised">
                离开并返回首页
              </button>
            </div>
          </div>
        ) : errorMessage ? (
          /* Error */
          <div className="reading-card">
            <h2 className="font-serif text-2xl text-ink">连接受阻</h2>
            <p className="mt-3 text-text-body leading-relaxed">
              {errorMessage}
            </p>
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
            /* Sober Check Friction Panel */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="reading-card border-terracotta/40 bg-paper-raised/80 py-12 px-8 shadow-sm flex flex-col items-center justify-center text-center my-16"
            >
              <span className="material-symbols-outlined text-terracotta text-4xl mb-6">psychiatry</span>
              <h2 className="font-serif text-2xl text-ink mb-4">降温与检视 (Sober Check)</h2>
              <p className="text-base text-text-body max-w-lg leading-[1.8] mb-8">
                {reading.sober_check}
              </p>
              <textarea
                value={soberInput}
                onChange={(e) => setSoberInput(e.target.value)}
                placeholder="我的真实顾虑 / 底线计划是..."
                className="w-full max-w-xl h-32 p-4 rounded-xl border border-paper-border bg-paper focus:border-terracotta/50 focus:ring-1 focus:ring-terracotta/50 outline-none resize-none font-serif text-base text-ink"
              />
              <button
                disabled={soberInput.length < 5}
                onClick={() => setIsSoberCheckPassed(true)}
                className="btn-primary mt-8 w-full max-w-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认并解开牌面
              </button>
            </motion.div>
          ) : (
          /* Reading Result */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className={cn("space-y-8", reading.presentation_mode === "void_narrative" && "space-y-16 lg:px-4", reading.presentation_mode === "sober_anchor" && "opacity-90 grayscale-[20%]")}
          >
            {/* Themes / Climate */}
            <section className={cn("relative rounded-3xl border shadow-sm my-16", reading.presentation_mode === "sober_anchor" ? "border-paper-border bg-paper p-8" : "border-terracotta/15 bg-gradient-to-b from-paper-raised to-paper p-8")}>
              <div className="absolute top-0 left-8 -translate-y-1/2 flex items-center gap-2 bg-paper px-3 py-1 border border-paper-border rounded-full shadow-sm">
                <span className="material-symbols-outlined text-[14px] text-terracotta/70">accolade</span>
                <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-terracotta/80">
                  当前气候场
                </span>
              </div>
              <h2 className="mt-4 font-serif text-3xl text-ink text-center">
                核心主题聚焦
              </h2>
              <p className="mt-3 text-sm text-text-body leading-relaxed text-center max-w-lg mx-auto">
                在深入每一张牌的具体启示之前，请先感受这组牌共同编织的全局氛围与核心张力。
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {reading.themes.map((theme) => (
                  <span key={theme} className="chip-accent px-4 py-2 text-[13px] bg-terracotta/5 border-terracotta/20 shadow-sm transition-all hover:bg-terracotta/10">
                    {theme}
                  </span>
                ))}
              </div>
            </section>

            {/* Card Interpretations */}
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
                            <span className="chip-warm text-[10px]">
                              {card.position}
                            </span>
                            <span className="font-sans text-[11px] font-medium text-text-muted">
                              {card.orientation === "reversed" ? "逆位" : "正位"}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-serif text-xl text-ink">
                              {card.name}
                            </h3>
                            <p className="text-sm text-text-muted">
                              {card.english_name}
                            </p>
                          </div>
                          <div className="rounded-r-lg border-l-2 border-paper-border bg-paper-raised/50 py-2.5 pl-4 pr-3">
                            <p className="font-sans text-[10px] font-medium uppercase tracking-wider text-text-muted mb-1.5 opacity-80">
                              / 原型奥义
                            </p>
                            <p className="font-sans text-sm leading-relaxed text-text-body">
                              {card.position_meaning}
                            </p>
                          </div>
                          <div className="rounded-xl border border-terracotta/10 bg-terracotta/5 p-4 shadow-sm">
                            <p className="font-sans text-[10px] font-medium uppercase tracking-wider text-terracotta mb-2 opacity-80">
                              / 当前推断
                            </p>
                            <p className="font-serif text-base italic leading-[1.8] text-ink">
                              {card.interpretation}
                            </p>
                          </div>
                        </div>
                        {drawnCard ? (
                          <div className="w-full max-w-[130px] shrink-0 overflow-hidden rounded-xl border border-paper-border md:ml-4">
                            <img
                              src={drawnCard.card.imageUrl}
                              alt={drawnCard.card.name}
                              className={cn(
                                "aspect-[2/3] w-full object-cover",
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

            {/* Synthesis */}
            <section className={cn("reading-card", reading.presentation_mode === "sober_anchor" && "bg-paper border-paper-border")}>
              <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                综合
              </p>
              <h2 className="mt-1 font-serif text-2xl text-ink">综合解读</h2>
              <p className="mt-4 text-base leading-[1.85] text-text-body">
                {reading.synthesis}
              </p>
            </section>

            {/* Guidance */}
            <section className={cn("reading-card", reading.presentation_mode === "void_narrative" && "bg-transparent border-none shadow-none px-0", reading.presentation_mode === "sober_anchor" && "bg-paper border-paper-border")}>
              <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                指引
              </p>
              <h2 className="mt-1 font-serif text-2xl text-ink">反思指引</h2>
              <ul className="mt-4 space-y-3">
                {reading.reflective_guidance.map((guidance) => (
                  <li
                    key={guidance}
                    className={cn("flex gap-3 text-base leading-relaxed text-text-body", reading.presentation_mode === "void_narrative" ? "border-l-0 pl-0" : "border-l-2 border-terracotta/20 pl-4")}
                  >
                    {!reading.presentation_mode || reading.presentation_mode !== "void_narrative" ? (
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta/50" />
                    ) : null}
                    <span>{guidance}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Follow-up Questions */}
            <section className={cn("reading-card", reading.presentation_mode === "void_narrative" && "bg-transparent border-none shadow-none px-0", reading.presentation_mode === "sober_anchor" && "bg-paper border-paper-border")}>
              <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                延伸
              </p>
              <h2 className="mt-1 font-serif text-2xl text-ink">延伸追问</h2>
              <ul className="mt-4 space-y-3">
                {reading.follow_up_questions.map((prompt) => (
                  <li
                    key={prompt}
                    className="rounded-xl border border-paper-border bg-paper px-5 py-3.5 text-base leading-relaxed text-text-body"
                  >
                    {prompt}
                  </li>
                ))}
              </ul>
            </section>

            {/* Safety Note */}
            {reading.safety_note ? (
              <section className="rounded-2xl border border-red-900/40 bg-red-950/20 p-6 shadow-inner ring-1 ring-inset ring-red-900/20">
                <div className="flex items-center gap-3 border-b border-red-900/30 pb-3">
                  <span className="material-symbols-outlined text-red-500/80">warning</span>
                  <div>
                    <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-red-500/80">
                      边界强制声明
                    </p>
                    <h2 className="mt-0.5 font-serif text-lg text-red-300">
                      必读提示
                    </h2>
                  </div>
                </div>
                <p className="mt-4 text-base leading-[1.85] text-red-200/90 font-medium">
                  {reading.safety_note}
                </p>
              </section>
            ) : null}

            {/* Confidence Note */}
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

            {/* Journal / Notes */}
            {currentHistoryEntry ? (
              <section className="reading-card bg-paper-raised">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                      反思手记
                    </p>
                    <h2 className="mt-1 font-serif text-2xl text-ink">你的回望与觉察</h2>
                  </div>
                  {isSavingNote && (
                    <span className="font-sans text-xs text-terracotta flex items-center gap-1 opacity-80">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      已保存
                    </span>
                  )}
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="随着时间推移，牌意在现实中是如何展开的？写下你的感悟..."
                  className="w-full h-32 p-4 rounded-xl border border-paper-border bg-paper focus:border-terracotta/50 focus:ring-1 focus:ring-terracotta/50 outline-none resize-none font-serif text-base text-ink leading-relaxed"
                />
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSaveNotes}
                    disabled={isSavingNote || !notes.trim()}
                    className="rounded-full bg-paper border border-paper-border px-5 py-2 text-sm font-medium text-ink transition-all hover:bg-paper-raised disabled:opacity-50"
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

      {/* Sidebar */}
      <aside className="w-full space-y-6 lg:w-72 lg:sticky lg:top-24 lg:self-start">
        {/* Step Progress */}
        <div className="reading-card">
          <h4 className="mb-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
            解读流程
          </h4>
          <div className="space-y-3">
            {["提问", "仪式", "揭示", "解读"].map(
              (step, index) => (
                <div
                  key={step}
                  className={cn(
                    "flex items-center gap-2.5",
                    index < 3 && "opacity-40",
                  )}
                >
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full",
                      index === 3
                        ? "bg-terracotta"
                        : "bg-paper-border",
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
              ),
            )}
          </div>
        </div>

        {/* Card Thumbnails */}
        <div className="reading-card">
          <h4 className="mb-3 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
            {selectedSpread.name}
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {drawnCards.map((drawnCard) => (
              <div
                key={drawnCard.positionId}
                className="group aspect-[2/3] overflow-hidden rounded-lg border border-paper-border transition-shadow hover:shadow-sm"
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

        {/* Quote */}
        <div className="rounded-xl border-l-2 border-terracotta/25 bg-terracotta/5 p-5">
          <p className="font-serif text-sm leading-relaxed italic text-text-muted">
            真理并不是被强行规定的结论，而是从你的处境中慢慢浮现的方向感。
          </p>
        </div>
      </aside>
    </main>
  );
}
