"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { getAllSpreads } from "@aethertarot/domain-tarot";
import { useReading } from "@/context/ReadingContext";
import { cn } from "@/lib/utils";

const spreads = getAllSpreads();

export default function HomeView() {
  const router = useRouter();
  const {
    question,
    selectedSpread,
    setQuestion,
    setSelectedSpread,
    startRitual,
  } = useReading();

  const handleStart = () => {
    if (!startRitual()) {
      return;
    }

    router.push("/ritual");
  };

  return (
    <section className="flex min-h-[92vh] flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl space-y-12 text-center">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="space-y-4"
        >
          <h1 className="font-serif text-5xl font-semibold tracking-tight text-ink md:text-6xl">
            灵语塔罗
          </h1>
          <p className="font-serif text-lg text-text-muted md:text-xl">
            开启你的反思与探索之路
          </p>
        </motion.div>

        {/* Question Input */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        >
          <div className="relative mx-auto max-w-xl">
            <textarea
              className="w-full resize-none rounded-2xl border border-paper-border bg-paper-raised px-5 py-4 font-sans text-base text-ink placeholder:text-text-placeholder focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10 focus:outline-none transition-all duration-200"
              placeholder="今天，你想向内心询问什么？"
              rows={3}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </div>
        </motion.div>

        {/* Spread Selection */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          className="space-y-6"
        >
          <h2 className="font-sans text-xs font-medium uppercase tracking-[0.2em] text-text-muted">
            选择牌阵 · Choose Your Spread
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {spreads.map((spread) => (
              <button
                key={spread.id}
                type="button"
                onClick={() => setSelectedSpread(spread)}
                className={cn(
                  "group flex flex-col items-center rounded-2xl border p-6 text-center transition-all duration-200",
                  selectedSpread?.id === spread.id
                    ? "border-terracotta/40 bg-terracotta/5 shadow-sm"
                    : "border-paper-border bg-paper-raised hover:border-paper-border hover:shadow-sm",
                )}
              >
                <div
                  className={cn(
                    "mb-4 flex h-12 w-12 items-center justify-center rounded-full transition-colors",
                    selectedSpread?.id === spread.id
                      ? "bg-terracotta/10 text-terracotta"
                      : "bg-paper-muted text-text-muted group-hover:text-text-body",
                  )}
                >
                  <span className="material-symbols-outlined text-2xl">
                    {spread.icon}
                  </span>
                </div>
                <h3 className="mb-2 font-serif text-lg text-ink">
                  {spread.name}
                </h3>
                <p className="text-sm font-sans text-text-muted leading-relaxed">
                  {spread.description}
                </p>
                {spread.id === "holy-triangle" && (
                  <span className="chip-accent mt-3 text-[10px]">
                    最受青睐
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45, ease: "easeOut" }}
        >
          <button
            type="button"
            onClick={handleStart}
            disabled={!question.trim() || !selectedSpread}
            className="btn-primary px-10 py-4 text-base"
          >
            开始仪式
          </button>
        </motion.div>

        {/* Microcopy */}
        <p className="text-xs text-text-muted leading-relaxed">
          解读用于反思与启发，不替代专业建议
        </p>
      </div>
    </section>
  );
}
