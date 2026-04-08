"use client";

import { useEffect } from "react";
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
    interpretReading,
  } = useReading();

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
    <main className="mx-auto flex max-w-7xl flex-col gap-12 px-6 pt-32 pb-24 lg:flex-row lg:px-24">
      <div className="flex-1 space-y-14">
        <header className="space-y-4">
          <div className="flex items-center gap-3 text-sm uppercase tracking-widest text-secondary-fixed-dim">
            <span className="material-symbols-outlined text-xs">
              auto_fix_high
            </span>
            深度见解 Deep Insight
          </div>
          <h1 className="font-serif text-5xl leading-tight text-secondary md:text-7xl">
            灵魂的结构化映照
          </h1>
          <p className="max-w-2xl border-l-2 border-primary/30 py-2 pl-6 text-lg italic text-on-surface-variant">
            “这次解读不是替你宣布结果，而是帮助你更清楚地看见正在成形的主题、张力与可选择的动作。”
          </p>
          <div className="grid gap-4 rounded-2xl border border-outline-variant/10 bg-surface-container-low/60 p-5 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-secondary-fixed/70">
                The Inquiry
              </p>
              <p className="mt-2 text-base italic text-on-surface">“{question}”</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {reading ? (
                <span className="rounded-full border border-secondary-fixed/20 bg-secondary-fixed/10 px-3 py-1 text-xs uppercase tracking-widest text-secondary-fixed">
                  {QUESTION_TYPE_LABELS[reading.question_type]}
                </span>
              ) : null}
              <span className="rounded-full border border-outline-variant/20 px-3 py-1 text-xs uppercase tracking-widest text-on-surface-variant">
                {selectedSpread.name}
              </span>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-6 py-20">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            <p className="animate-pulse font-serif text-xl italic text-primary">
              正在连接阿卡西记录...
            </p>
          </div>
        ) : errorMessage ? (
          <div className="rounded-3xl border border-primary/20 bg-surface-container-low p-8">
            <h2 className="font-serif text-3xl text-secondary">连接受阻</h2>
            <p className="mt-4 leading-relaxed text-on-surface-variant">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => void interpretReading()}
              className="mt-6 rounded-full bg-gradient-to-r from-primary to-primary-container px-6 py-3 font-label text-sm uppercase tracking-[0.18em] text-on-primary transition-transform duration-300 hover:scale-[1.02]"
            >
              重新尝试
            </button>
          </div>
        ) : reading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-12"
          >
            <section className="rounded-3xl border border-outline-variant/10 bg-surface-container-low/70 p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-secondary-fixed/70">
                    Themes
                  </p>
                  <h2 className="mt-2 font-serif text-3xl text-secondary">主题聚焦</h2>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                {reading.themes.map((theme) => (
                  <span
                    key={theme}
                    className="rounded-full border border-secondary-fixed/20 bg-secondary-fixed/10 px-4 py-2 text-sm text-secondary-fixed"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </section>

            <section className="space-y-6 rounded-3xl border border-outline-variant/10 bg-surface-container-low/70 p-8">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-secondary-fixed/70">
                  Cards
                </p>
                <h2 className="mt-2 font-serif text-3xl text-secondary">逐牌展开</h2>
              </div>
              <div className="space-y-5">
                {reading.cards.map((card) => {
                  const drawnCard = drawnCards.find(
                    (item) => item.positionId === card.position_id,
                  );

                  return (
                    <article
                      key={`${card.position_id}-${card.card_id}`}
                      className="rounded-2xl border border-outline-variant/10 bg-surface-container p-6"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="rounded-full bg-surface-variant px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
                              {card.position}
                            </span>
                            <span className="text-xs uppercase tracking-[0.2em] text-secondary-fixed/70">
                              {card.orientation === "reversed" ? "逆位" : "正位"}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-serif text-2xl text-secondary">
                              {card.name}
                            </h3>
                            <p className="text-sm italic text-on-surface-variant">
                              {card.english_name}
                            </p>
                          </div>
                          <p className="text-sm italic text-on-surface-variant/80">
                            {card.position_meaning}
                          </p>
                          <p className="leading-relaxed text-on-surface-variant">
                            {card.interpretation}
                          </p>
                        </div>
                        {drawnCard ? (
                          <div className="w-full max-w-[140px] shrink-0 overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-low md:ml-4">
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
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-outline-variant/10 bg-surface-container-low/70 p-8">
              <p className="text-xs uppercase tracking-[0.25em] text-secondary-fixed/70">
                Synthesis
              </p>
              <h2 className="mt-2 font-serif text-3xl text-secondary">综合解读</h2>
              <p className="mt-6 leading-8 text-on-surface-variant">
                {reading.synthesis}
              </p>
            </section>

            <section className="rounded-3xl border border-outline-variant/10 bg-surface-container-low/70 p-8">
              <p className="text-xs uppercase tracking-[0.25em] text-secondary-fixed/70">
                Guidance
              </p>
              <h2 className="mt-2 font-serif text-3xl text-secondary">反思指引</h2>
              <ul className="mt-6 space-y-4">
                {reading.reflective_guidance.map((guidance) => (
                  <li
                    key={guidance}
                    className="flex gap-3 border-l border-secondary-fixed/20 pl-4 leading-relaxed text-on-surface-variant"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary-fixed" />
                    <span>{guidance}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-3xl border border-outline-variant/10 bg-surface-container-low/70 p-8">
              <p className="text-xs uppercase tracking-[0.25em] text-secondary-fixed/70">
                Follow-up
              </p>
              <h2 className="mt-2 font-serif text-3xl text-secondary">延伸追问</h2>
              <ul className="mt-6 space-y-4">
                {reading.follow_up_questions.map((prompt) => (
                  <li
                    key={prompt}
                    className="rounded-2xl border border-outline-variant/10 bg-surface-container px-5 py-4 leading-relaxed text-on-surface-variant"
                  >
                    {prompt}
                  </li>
                ))}
              </ul>
            </section>

            {reading.safety_note ? (
              <section className="rounded-3xl border border-primary/20 bg-primary/5 p-8">
                <p className="text-xs uppercase tracking-[0.25em] text-primary/70">
                  Safety
                </p>
                <h2 className="mt-2 font-serif text-3xl text-secondary">边界提醒</h2>
                <p className="mt-6 leading-8 text-on-surface-variant">
                  {reading.safety_note}
                </p>
              </section>
            ) : null}

            {reading.confidence_note ? (
              <section className="rounded-3xl border border-outline-variant/10 bg-surface-container-low/70 p-8">
                <p className="text-xs uppercase tracking-[0.25em] text-secondary-fixed/70">
                  Confidence
                </p>
                <h2 className="mt-2 font-serif text-3xl text-secondary">解读说明</h2>
                <p className="mt-6 leading-8 text-on-surface-variant">
                  {reading.confidence_note}
                </p>
              </section>
            ) : null}
          </motion.div>
        ) : null}
      </div>

      <aside className="w-full space-y-8 lg:w-80">
        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6">
          <h4 className="mb-6 font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
            Ceremony Progress
          </h4>
          <div className="space-y-4">
            {["The Inquiry", "The Ritual", "The Reveal", "Deep Insight"].map(
              (step, index) => (
                <div
                  key={step}
                  className={cn("flex items-center gap-3", index < 3 && "opacity-40")}
                >
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full",
                      index === 3
                        ? "bg-secondary-fixed shadow-[0_0_8px_#ffe16d]"
                        : "bg-primary",
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs font-label",
                      index === 3 && "font-bold text-secondary-fixed",
                    )}
                  >
                    {step}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6">
          <h4 className="mb-2 font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
            The Active Spread
          </h4>
          <p className="mb-4 text-sm text-secondary-fixed">{selectedSpread.name}</p>
          <div className="grid grid-cols-2 gap-3">
            {drawnCards.map((drawnCard) => (
              <div
                key={drawnCard.positionId}
                className="group aspect-[2/3] overflow-hidden rounded-lg border border-outline-variant/20 bg-surface-container transition-colors hover:border-primary/50"
              >
                <img
                  src={drawnCard.card.imageUrl}
                  alt={drawnCard.card.name}
                  className={cn(
                    "h-full w-full object-cover grayscale transition-all duration-700 group-hover:grayscale-0",
                    drawnCard.isReversed && "rotate-180",
                  )}
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-r-xl border-l border-secondary-fixed/30 bg-secondary-fixed/5 p-6">
          <p className="font-serif text-sm leading-relaxed italic text-secondary-fixed/80">
            真理并不是被强行规定的结论，而是从你的处境中慢慢浮现的方向感。
          </p>
        </div>
      </aside>
    </main>
  );
}
