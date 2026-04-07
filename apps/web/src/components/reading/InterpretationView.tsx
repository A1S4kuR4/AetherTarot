"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import { useRouter } from "next/navigation";
import { useReading } from "@/context/ReadingContext";
import { cn } from "@/lib/utils";

export default function InterpretationView() {
  const router = useRouter();
  const {
    question,
    selectedSpread,
    drawnCards,
    interpretation,
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

    if (!interpretation && !isLoading) {
      void interpretReading();
    }
  }, [
    drawnCards.length,
    interpretReading,
    interpretation,
    isLoading,
    router,
    selectedSpread,
  ]);

  if (!selectedSpread || drawnCards.length === 0) {
    return null;
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-12 px-6 pt-32 pb-24 lg:flex-row lg:px-24">
      <div className="flex-1 space-y-20">
        <header className="space-y-4">
          <div className="flex items-center gap-3 text-sm uppercase tracking-widest text-secondary-fixed-dim">
            <span className="material-symbols-outlined text-xs">
              auto_fix_high
            </span>
            深度见解 Deep Insight
          </div>
          <h1 className="font-serif text-5xl leading-tight text-secondary md:text-7xl">
            灵魂的宏伟图景
          </h1>
          <p className="max-w-2xl border-l-2 border-primary/30 pl-6 py-2 text-lg italic text-on-surface-variant">
            “在繁星交汇的时刻，寻求真理的人会从沉默的符号中听见更清晰的自己。”
          </p>
          <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/60 p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-secondary-fixed/70">
              The Inquiry
            </p>
            <p className="mt-2 text-base italic text-on-surface">
              “{question}”
            </p>
          </div>
        </header>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-6 py-20">
            <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <p className="font-serif text-xl italic text-primary animate-pulse">
              正在连接阿卡西记录...
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="markdown-body max-w-none"
          >
            <ReactMarkdown>{interpretation}</ReactMarkdown>
          </motion.div>
        )}
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
                  className={cn(
                    "flex items-center gap-3",
                    index < 3 && "opacity-40",
                  )}
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
