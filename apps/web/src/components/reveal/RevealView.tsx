"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useReading } from "@/context/ReadingContext";
import { cn } from "@/lib/utils";

export default function RevealView() {
  const router = useRouter();
  const { selectedSpread, drawnCards } = useReading();

  useEffect(() => {
    if (!selectedSpread) {
      router.replace("/");
      return;
    }

    if (drawnCards.length === 0) {
      router.replace("/ritual");
    }
  }, [drawnCards.length, router, selectedSpread]);

  if (!selectedSpread || drawnCards.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-6 pt-28 pb-12">
      <div className="mb-12 flex items-center justify-center gap-4">
        <div className="h-[1px] w-12 bg-outline-variant/30" />
        <div className="flex items-center gap-2">
          <span className="font-label text-xs text-on-surface-variant/50">
            Step 02
          </span>
          <h1 className="font-serif text-3xl text-secondary">
            牌阵解读{" "}
            <span className="ml-2 text-xl font-normal italic text-primary/60">
              The Spread
            </span>
          </h1>
        </div>
        <div className="h-[1px] w-12 bg-outline-variant/30" />
      </div>

      <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
        <div className="relative flex min-h-[600px] flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-outline-variant/10 bg-surface-container-low/30 p-8 lg:col-span-8">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-10">
            <svg
              className="fill-current text-primary"
              height="500"
              viewBox="0 0 100 100"
              width="500"
            >
              <path
                d="M50 5 L95 85 L5 85 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
              />
              <circle
                cx="50"
                cy="50"
                fill="none"
                r="40"
                stroke="currentColor"
                strokeWidth="0.2"
              />
            </svg>
          </div>

          <div className="relative z-10 grid w-full max-w-4xl grid-cols-1 gap-12 md:grid-cols-3">
            {selectedSpread.positions.map((position, index) => {
              const drawn = drawnCards.find(
                (card) => card.positionId === position.id,
              );

              if (!drawn) {
                return null;
              }

              return (
                <motion.div
                  key={position.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.3 }}
                  className={cn(
                    "group flex flex-col items-center",
                    index === 1 && "md:-mt-16",
                  )}
                >
                  <div className="mb-4">
                    <span className="font-label text-[10px] uppercase tracking-[0.3em] text-secondary-fixed/40">
                      {position.name}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "relative aspect-[2/3.5] w-full overflow-hidden rounded-xl border bg-surface-container shadow-2xl transition-transform duration-700 hover:scale-[1.03]",
                      index === 1
                        ? "border-secondary-fixed/30"
                        : "border-primary/20",
                    )}
                  >
                    <img
                      src={drawn.card.imageUrl}
                      alt={drawn.card.name}
                      className={cn(
                        "h-full w-full object-cover",
                        drawn.isReversed && "rotate-180",
                      )}
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
                  </div>
                  <div className="mt-6 text-center">
                    <h3 className="font-serif text-xl text-secondary-fixed">
                      {drawn.card.name}
                      <span className="block text-sm font-normal italic text-on-surface-variant">
                        {drawn.card.englishName}
                      </span>
                    </h3>
                    <div className="mt-2 flex justify-center gap-2">
                      {(drawn.isReversed
                        ? drawn.card.reversedKeywords
                        : drawn.card.uprightKeywords
                      )
                        .slice(0, 2)
                        .map((keyword) => (
                          <span
                            key={keyword}
                            className="rounded-full bg-surface-variant px-2 py-0.5 text-[10px] uppercase tracking-tighter text-on-surface-variant"
                          >
                            {keyword}
                          </span>
                        ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => router.push("/reading")}
            className="group mt-16 flex items-center gap-3 rounded-full bg-gradient-to-r from-primary to-primary-container px-8 py-4 font-label text-on-primary shadow-lg transition-all duration-500 hover:scale-105 hover:shadow-primary/20 active:scale-95"
          >
            <span className="text-xs font-bold uppercase tracking-widest">
              开始深入解读
            </span>
            <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">
              arrow_right_alt
            </span>
          </button>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-[1.5rem] border-t border-secondary-fixed/20 bg-surface-container-high p-8 shadow-inner">
            <div className="mb-6 flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary-fixed">
                auto_awesome
              </span>
              <h2 className="font-serif text-xl text-secondary">
                牌阵解析
                <span className="mt-1 block text-xs font-label uppercase tracking-widest text-on-surface-variant/50">
                  Position Meanings
                </span>
              </h2>
            </div>
            <div className="space-y-8">
              {selectedSpread.positions.map((position, index) => (
                <div
                  key={position.id}
                  className="relative border-l border-outline-variant/30 pl-6"
                >
                  <div
                    className={cn(
                      "absolute top-0 -left-[5px] h-2 w-2 rounded-full",
                      index === 1 ? "bg-secondary-fixed/40" : "bg-primary/40",
                    )}
                  />
                  <h4
                    className={cn(
                      "mb-1 font-label text-xs uppercase tracking-widest",
                      index === 1 ? "text-secondary-fixed" : "text-primary",
                    )}
                  >
                    Position {index + 1}: {position.name}
                  </h4>
                  <p className="text-sm leading-relaxed text-on-surface-variant">
                    {position.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6">
            <p className="text-center font-serif text-sm leading-relaxed italic text-on-surface-variant/80">
              在星辰的指引下，所有的偶然都像是更深层线索的显影。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
