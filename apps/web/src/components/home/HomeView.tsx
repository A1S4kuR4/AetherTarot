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
    <section className="relative flex min-h-[90vh] flex-col items-center justify-center px-6 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute right-1/4 bottom-1/4 h-[500px] w-[500px] rounded-full bg-tertiary/5 blur-[150px]" />
      </div>

      <div className="z-10 w-full max-w-4xl space-y-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-4"
        >
          <h1 className="font-serif text-5xl font-bold tracking-tight text-secondary md:text-7xl">
            灵语塔罗{" "}
            <span className="font-normal italic opacity-80">(AetherTarot)</span>
          </h1>
          <p className="font-serif text-xl italic tracking-wide text-primary md:text-2xl">
            开启你的探索之路
          </p>
        </motion.div>

        <div className="group relative mx-auto max-w-2xl">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-primary/20 via-secondary-fixed/20 to-tertiary/20 blur opacity-40 transition duration-1000 group-hover:opacity-75" />
          <div className="relative flex items-center rounded-full border border-outline-variant/20 bg-surface-container-lowest p-2 transition-all duration-500 focus-within:border-primary/50">
            <span className="material-symbols-outlined ml-6 text-on-surface-variant/50">
              search_spark
            </span>
            <input
              className="w-full border-none bg-transparent px-6 py-4 text-lg text-on-surface placeholder:text-on-surface-variant/40 focus:ring-0 focus:outline-none"
              placeholder="今天，你想向宇宙询问什么？"
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <button
              type="button"
              onClick={handleStart}
              disabled={!question.trim() || !selectedSpread}
              className="rounded-full bg-gradient-to-r from-primary to-primary-container px-8 py-4 font-label font-semibold text-on-primary shadow-lg transition-transform duration-500 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
            >
              启示
            </button>
          </div>
        </div>

        <div className="space-y-8 pt-12">
          <h2 className="font-label text-xs uppercase tracking-[0.3em] text-secondary-fixed/60">
            选择你的牌阵 • Choose Your Spread
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {spreads.map((spread) => (
              <motion.button
                key={spread.id}
                type="button"
                whileHover={{ y: -5 }}
                onClick={() => setSelectedSpread(spread)}
                className={cn(
                  "glass-panel flex cursor-pointer flex-col items-center rounded-xl border p-8 text-center transition-all duration-500",
                  selectedSpread?.id === spread.id
                    ? "border-secondary-fixed/40 bg-surface-container-low/60 ring-1 ring-secondary-fixed/20"
                    : "border-outline-variant/10 hover:border-secondary-fixed/40",
                )}
              >
                <div
                  className={cn(
                    "mb-6 flex h-16 w-16 items-center justify-center rounded-full border transition-colors",
                    selectedSpread?.id === spread.id
                      ? "border-secondary-fixed/30 bg-surface-container-highest text-secondary-fixed"
                      : "border-outline-variant/20 bg-surface-container-high group-hover:text-secondary-fixed",
                  )}
                >
                  <span className="material-symbols-outlined text-3xl">
                    {spread.icon}
                  </span>
                </div>
                <h3 className="mb-3 font-serif text-xl text-secondary">
                  {spread.name} ({spread.englishName})
                </h3>
                <p className="text-sm leading-relaxed text-on-surface-variant">
                  {spread.description}
                </p>
                {spread.id === "holy-triangle" && (
                  <span className="mt-4 inline-block rounded-full bg-secondary-fixed/10 px-3 py-1 font-label text-[10px] uppercase tracking-widest text-secondary-fixed">
                    最受青睐
                  </span>
                )}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
