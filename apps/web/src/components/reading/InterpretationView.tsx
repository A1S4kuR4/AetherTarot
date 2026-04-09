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
          /* Reading Result */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="space-y-8"
          >
            {/* Themes */}
            <section className="reading-card">
              <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                主题
              </p>
              <h2 className="mt-1 font-serif text-2xl text-ink">主题聚焦</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {reading.themes.map((theme) => (
                  <span key={theme} className="chip-accent">
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
                    <article
                      key={`${card.position_id}-${card.card_id}`}
                      className="rounded-2xl border border-paper-border bg-paper p-5"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start">
                        <div className="min-w-0 flex-1 space-y-3">
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
                          <p className="text-sm italic text-text-muted">
                            {card.position_meaning}
                          </p>
                          <p className="text-base leading-[1.8] text-text-body">
                            {card.interpretation}
                          </p>
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
                    </article>
                  );
                })}
              </div>
            </section>

            {/* Synthesis */}
            <section className="reading-card">
              <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                综合
              </p>
              <h2 className="mt-1 font-serif text-2xl text-ink">综合解读</h2>
              <p className="mt-4 text-base leading-[1.85] text-text-body">
                {reading.synthesis}
              </p>
            </section>

            {/* Guidance */}
            <section className="reading-card">
              <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                指引
              </p>
              <h2 className="mt-1 font-serif text-2xl text-ink">反思指引</h2>
              <ul className="mt-4 space-y-3">
                {reading.reflective_guidance.map((guidance) => (
                  <li
                    key={guidance}
                    className="flex gap-3 border-l-2 border-terracotta/20 pl-4 text-base leading-relaxed text-text-body"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta/50" />
                    <span>{guidance}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Follow-up Questions */}
            <section className="reading-card">
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
              <section className="safety-note">
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-safety">
                  边界提醒
                </p>
                <h2 className="mt-1 font-serif text-2xl text-ink">
                  温馨提示
                </h2>
                <p className="mt-4 text-base leading-[1.85] text-text-body">
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
          </motion.div>
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
