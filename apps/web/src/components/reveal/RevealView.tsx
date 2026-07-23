"use client";

import { motion, useAnimate } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useReading } from "@/context/ReadingContext";
import { getRevealCardImageUrl } from "@/lib/card-assets";
import { cn } from "@/lib/utils";
import { getSpreadExperience } from "@/lib/spreadExperience";
import LegacyIcon from "@/components/ui/LegacyIcon";
import CardImage from "@/components/ui/CardImage";

export default function RevealView() {
  const router = useRouter();
  const { question, selectedSpread, drawSource, drawnCards, isHydrated } = useReading();
  const [scope, animate] = useAnimate();
  const [isEnteringReading, setIsEnteringReading] = useState(false);

  useEffect(() => {
    if (drawnCards.length > 0 && selectedSpread) {
      animate(
        ".reveal-card-container",
        { opacity: [0, 1], y: [40, 0] },
        { duration: 0.6, ease: "easeOut", delay: (el, i) => i * 0.3 }
      );
      animate(
        ".reveal-card-inner",
        { rotateY: [180, 0] },
        { duration: 0.8, type: "spring", delay: (el, i) => i * 0.3 + 0.15 }
      );
    }
  }, [animate, drawnCards.length, selectedSpread]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!selectedSpread || !question.trim()) {
      router.replace("/");
      return;
    }

    if (drawnCards.length === 0) {
      router.replace(drawSource === "offline_manual" ? "/offline-draw" : "/ritual");
    }
  }, [drawSource, drawnCards.length, isHydrated, question, router, selectedSpread]);

  if (!isHydrated || !selectedSpread || drawnCards.length === 0) {
    return null;
  }

  const spreadCardGridClass =
    selectedSpread.positions.length === 1
      ? "max-w-[200px] grid-cols-1"
      : selectedSpread.positions.length === 3
        ? "max-w-2xl md:grid-cols-3"
      : selectedSpread.positions.length === 4
          ? "max-w-3xl md:grid-cols-4"
          : selectedSpread.positions.length === 7
            ? "max-w-3xl md:grid-cols-4 xl:max-w-4xl"
          : "max-w-4xl md:grid-cols-5";
  const cardImageWidth =
    selectedSpread.positions.length === 1
      ? 200
      : selectedSpread.positions.length === 3
        ? 220
        : 180;
  const spreadExperience = getSpreadExperience(
    selectedSpread.id,
    selectedSpread.name,
    selectedSpread.positions.map((position) => position.name),
  );
  const handleEnterReading = () => {
    if (isEnteringReading) {
      return;
    }

    setIsEnteringReading(true);
    router.push("/reading");
  };

  const enterReadingButtonClass = "btn-primary min-h-12 disabled:cursor-not-allowed disabled:opacity-70";
  const enterReadingButtonLabel = isEnteringReading
    ? "正在进入深读..."
    : "带着整组气候进入深读";

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-24 pt-5 sm:px-6 sm:pt-6 lg:pb-8 lg:pt-6">
      {/* Header */}
      <div className="mb-4 flex flex-col items-center text-center lg:mb-5">
        <span className="mb-1.5 font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-text-inverse-muted">
          牌阵揭示
        </span>
        <h1 className="font-serif text-2xl font-semibold text-text-inverse sm:text-3xl lg:text-4xl">
          {selectedSpread.name}
        </h1>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12 lg:gap-6">
        {/* Card Spread Area */}
        <div className="relative flex min-h-[340px] flex-col items-center justify-center rounded-3xl border border-midnight-border bg-midnight-panel/50 px-3 pb-4 pt-5 sm:min-h-[380px] sm:px-5 sm:pt-7 lg:col-span-8 lg:min-h-[300px]">
          {/* Spread Cards */}
          <div
            ref={scope}
            data-testid="reveal-card-track"
            className={cn(
              "relative z-10 grid w-full grid-cols-1 gap-4 sm:gap-5 lg:gap-6",
              spreadCardGridClass,
              selectedSpread.positions.length > 1
                && "hide-scrollbar max-md:flex max-md:snap-x max-md:snap-mandatory max-md:overflow-x-auto max-md:pb-2",
            )}
          >
            {selectedSpread.positions.map((position, index) => {
              const drawn = drawnCards.find(
                (card) => card.positionId === position.id,
              );

              if (!drawn) {
                return null;
              }

              return (
                <div
                  key={position.id}
                  className={cn(
                    "reveal-card-container group flex flex-col items-center opacity-0 max-md:w-[58vw] max-md:max-w-[180px] max-md:shrink-0 max-md:snap-center",
                    selectedSpread.id === "holy-triangle" && index === 1 && "md:-mt-10",
                  )}
                >
                  {/* Position label */}
                  <div className="mb-2">
                    <span className="font-sans text-[9px] font-medium uppercase tracking-[0.2em] text-text-inverse-muted/50">
                      {position.name}
                    </span>
                  </div>

                  {/* Card 3D Container */}
                  <div className="w-full" style={{ perspective: 1000 }}>
                    <motion.div
                      className={cn(
                        "reveal-card-inner relative aspect-[1/1.7] w-full overflow-hidden rounded-card-lg border shadow-[0_0_30px_rgba(113,112,255,0.15)] transition-transform duration-500 hover:scale-[1.02]",
                        index === 1
                          ? "border-indigo/20 shadow-[0_0_40px_rgba(113,112,255,0.25)]"
                          : "border-midnight-border",
                      )}
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      <CardImage
                        src={getRevealCardImageUrl(drawn.card.imageUrl)}
                        alt={drawn.card.name}
                        intrinsicWidth={cardImageWidth}
                        sizes={`${cardImageWidth}px`}
                        quality={75}
                        priority={index === 0}
                        loading="eager"
                        isReversed={drawn.isReversed}
                        className="transition-transform duration-500"
                      />
                    </motion.div>
                  </div>

                  {/* Card info */}
                  <div className="mt-3 text-center">
                    <h3 className="font-serif text-base text-text-inverse">
                      {drawn.card.name}
                    </h3>
                    <span className="block text-[10px] text-text-inverse-muted">
                      {drawn.card.englishName}
                    </span>
                    {drawn.isReversed && (
                      <span className="mt-0.5 block font-sans text-[8px] font-bold uppercase tracking-[0.15em] text-indigo/60">
                        逆位 · REVERSED
                      </span>
                    )}
                    <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                      {(drawn.isReversed
                        ? drawn.card.reversedKeywords
                        : drawn.card.uprightKeywords
                      )
                        .slice(0, 2)
                        .map((keyword) => (
                          <span key={keyword} className="chip-dark text-[9px]">
                            {keyword}
                          </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom spacer — CTA moved to persistent action surfaces */}
          <div className="mt-5 sm:mt-7" />
        </div>

        {/* Side Panel — Position Meanings */}
        <div className="space-y-4 lg:col-span-4">
          {/* Desktop primary CTA: visible without scrolling on every spread */}
          <div className="midnight-panel hidden p-5 lg:block">
            <button
              type="button"
              onClick={handleEnterReading}
              disabled={isEnteringReading}
              className={cn(enterReadingButtonClass, "w-full")}
            >
              <span className="text-sm font-medium">{enterReadingButtonLabel}</span>
              <LegacyIcon name="arrow_right_alt" className="text-lg" />
            </button>
          </div>

          {/* Reading path: focus + organization, merged into one card */}
          <div className="midnight-panel p-5" data-testid="reveal-reading-path">
            <div className="mb-2 flex items-center gap-2">
              <LegacyIcon name="account_tree" className="text-base text-indigo" />
              <h2 className="font-serif text-base text-text-inverse">
                阅读路径
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-text-inverse-muted">
              {spreadExperience.revealFocus}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {spreadExperience.organizationModel.map((item, index) => (
                <span
                  key={`${selectedSpread.id}-organization-${item}`}
                  className="rounded-full border border-midnight-border bg-midnight-elevated/60 px-2.5 py-1 font-sans text-[10px] text-text-inverse-muted"
                >
                  {index + 1}. {item}
                </span>
              ))}
            </div>
          </div>

          <div className="midnight-panel p-5">
            <div className="mb-3 flex items-center gap-2">
              <LegacyIcon name="auto_awesome" className="text-base text-indigo" />
              <h2 className="font-serif text-base text-text-inverse">
                牌阵解析
              </h2>
            </div>
            <div className="space-y-4">
              {selectedSpread.positions.map((position, index) => (
                <div
                  key={position.id}
                  className="relative border-l border-midnight-border pl-4"
                >
                  <div
                    className={cn(
                      "absolute top-0.5 -left-[4px] h-1.5 w-1.5 rounded-full",
                      selectedSpread.id === "holy-triangle" && index === 1
                        ? "bg-indigo/50"
                        : "bg-text-inverse-muted/30",
                    )}
                  />
                  <h4
                    className={cn(
                      "mb-0.5 font-sans text-[10px] font-medium uppercase tracking-[0.12em]",
                      "text-text-inverse-muted",
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

          <div className="rounded-xl border border-midnight-border-subtle p-4">
            <p className="text-center font-serif text-sm leading-relaxed italic text-text-inverse-muted/60">
              在星辰的指引下，所有的偶然都像是更深层线索的显影。
            </p>
          </div>
        </div>
      </div>

      {/* Mobile sticky CTA: reachable without scrolling on every spread */}
      <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-night via-night/90 to-transparent px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-5 lg:hidden">
        <button
          type="button"
          onClick={handleEnterReading}
          disabled={isEnteringReading}
          className={cn(
            enterReadingButtonClass,
            "w-full shadow-[0_8px_32px_rgba(0,0,0,0.32)]",
          )}
        >
          <span className="text-sm font-medium">{enterReadingButtonLabel}</span>
          <LegacyIcon name="arrow_right_alt" className="text-lg" />
        </button>
      </div>
    </section>
  );
}
