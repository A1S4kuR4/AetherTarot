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
    <section className="mx-auto w-full max-w-7xl px-6 pt-24 pb-16">
      {/* Header */}
      <div className="mb-14 flex flex-col items-center text-center">
        <span className="mb-3 font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-text-inverse-muted">
          牌阵揭示
        </span>
        <h1 className="font-serif text-3xl font-semibold text-text-inverse md:text-5xl">
          {selectedSpread.name}
        </h1>
      </div>

      <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
        {/* Card Spread Area */}
        <div className="relative flex min-h-[550px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-midnight-border bg-midnight-panel/50 p-8 lg:col-span-8">
          {/* Spread Cards */}
          <div className="relative z-10 grid w-full max-w-3xl grid-cols-1 gap-10 md:grid-cols-3">
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
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: index * 0.35,
                    duration: 0.45,
                    ease: "easeOut",
                  }}
                  className={cn(
                    "group flex flex-col items-center",
                    index === 1 && "md:-mt-12",
                  )}
                >
                  {/* Position label */}
                  <div className="mb-3">
                    <span className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-text-inverse-muted/50">
                      {position.name}
                    </span>
                  </div>

                  {/* Card */}
                  <div
                    className={cn(
                      "relative aspect-[1/1.7] w-full overflow-hidden rounded-2xl border shadow-[0_12px_32px_rgba(0,0,0,0.28)] transition-transform duration-500 hover:scale-[1.02]",
                      index === 1
                        ? "border-indigo/20"
                        : "border-midnight-border",
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
                  </div>

                  {/* Card info */}
                  <div className="mt-5 text-center">
                    <h3 className="font-serif text-lg text-text-inverse">
                      {drawn.card.name}
                    </h3>
                    <span className="block text-xs text-text-inverse-muted">
                      {drawn.card.englishName}
                    </span>
                    <div className="mt-2 flex justify-center gap-1.5">
                      {(drawn.isReversed
                        ? drawn.card.reversedKeywords
                        : drawn.card.uprightKeywords
                      )
                        .slice(0, 2)
                        .map((keyword) => (
                          <span key={keyword} className="chip-dark text-[10px]">
                            {keyword}
                          </span>
                        ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={() => router.push("/reading")}
            className="btn-primary mt-14"
          >
            <span className="text-sm font-medium">开始深入解读</span>
            <span className="material-symbols-outlined text-lg">
              arrow_right_alt
            </span>
          </button>
        </div>

        {/* Side Panel — Position Meanings */}
        <div className="space-y-6 lg:col-span-4">
          <div className="midnight-panel">
            <div className="mb-5 flex items-center gap-2.5">
              <span className="material-symbols-outlined text-lg text-indigo">
                auto_awesome
              </span>
              <h2 className="font-serif text-lg text-text-inverse">
                牌阵解析
              </h2>
            </div>
            <div className="space-y-6">
              {selectedSpread.positions.map((position, index) => (
                <div
                  key={position.id}
                  className="relative border-l border-midnight-border pl-5"
                >
                  <div
                    className={cn(
                      "absolute top-0.5 -left-[4px] h-2 w-2 rounded-full",
                      index === 1 ? "bg-indigo/50" : "bg-text-inverse-muted/30",
                    )}
                  />
                  <h4
                    className={cn(
                      "mb-1 font-sans text-[11px] font-medium uppercase tracking-[0.12em]",
                      index === 1 ? "text-indigo" : "text-text-inverse-muted",
                    )}
                  >
                    位置 {index + 1}: {position.name}
                  </h4>
                  <p className="text-sm leading-relaxed text-text-inverse-muted/70">
                    {position.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-midnight-border-subtle p-5">
            <p className="text-center font-serif text-sm leading-relaxed italic text-text-inverse-muted/60">
              在星辰的指引下，所有的偶然都像是更深层线索的显影。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
