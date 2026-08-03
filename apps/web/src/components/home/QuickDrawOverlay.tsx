"use client";

import { type SyntheticEvent, useCallback, useEffect, useState } from "react";
import { m, AnimatePresence } from "motion/react";
import Image from "next/image";
import type { DrawnCard } from "@aethertarot/shared-types";
import LegacyIcon from "@/components/ui/LegacyIcon";
import { getRevealCardImageUrl } from "@/lib/card-assets";
import type { QuickAnalysis } from "@/lib/quickAnalysis";

type Phase = "entering" | "card-back" | "flipping" | "revealed";

type QuickDrawOverlayProps = {
  isOpen: boolean;
  drawnCard: DrawnCard | null;
  quickAnalysis: QuickAnalysis | null;
  onClose: () => void;
  onDeepReading: () => void;
};

export default function QuickDrawOverlay({
  isOpen,
  drawnCard,
  quickAnalysis,
  onClose,
  onDeepReading,
}: QuickDrawOverlayProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <QuickDrawOverlayContent
          drawnCard={drawnCard}
          quickAnalysis={quickAnalysis}
          onClose={onClose}
          onDeepReading={onDeepReading}
        />
      )}
    </AnimatePresence>
  );
}

function QuickDrawOverlayContent({
  drawnCard,
  quickAnalysis,
  onClose,
  onDeepReading,
}: Omit<QuickDrawOverlayProps, "isOpen">) {
  const [phase, setPhase] = useState<Phase>("entering");

  useEffect(() => {
    const timer = setTimeout(() => setPhase("card-back"), 600);
    return () => clearTimeout(timer);
  }, []);

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Lock body scroll when overlay is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleCardClick = useCallback(() => {
    if (phase !== "card-back" || !drawnCard) return;

    setPhase("flipping");
    // After flip animation completes, transition to revealed
    setTimeout(() => setPhase("revealed"), 850);
  }, [phase, drawnCard]);

  const card = drawnCard?.card;
  const isReversed = drawnCard?.isReversed ?? false;
  const keywords = isReversed
    ? card?.reversedKeywords
    : card?.uprightKeywords;

  const isFlipped = phase === "flipping" || phase === "revealed";
  const isRevealed = phase === "revealed";

  return (
    <m.div
      key="quick-draw-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/60 p-0 [scrollbar-width:none] backdrop-blur-[3px] [&::-webkit-scrollbar]:hidden md:p-9"
    >
      <div className="relative min-h-[100dvh] w-full bg-paper-raised shadow-[0_24px_58px_rgba(24,23,19,0.28)] md:h-[min(760px,calc(100dvh-72px))] md:min-h-0 md:max-w-[1120px] md:overflow-hidden">
        <div className="absolute inset-x-0 top-0 z-10 h-1 bg-terracotta" />
        <m.button
          type="button"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center text-text-muted transition-colors hover:text-terracotta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo md:right-7 md:top-6"
          aria-label="关闭当下之镜"
        >
          <LegacyIcon name="close" className="text-2xl" />
        </m.button>

        <div className={`min-h-[100dvh] md:h-full md:min-h-0 ${isRevealed ? "md:grid md:grid-cols-[minmax(300px,0.86fr)_minmax(0,1.14fr)]" : "flex items-center justify-center"}`}>
          <section
            className={`relative flex min-h-[54dvh] flex-col items-center justify-center bg-paper-muted px-7 pb-9 pt-20 md:min-h-0 md:px-11 md:pb-12 md:pt-20 ${isRevealed ? "md:h-full" : "h-full w-full"}`}
            aria-label="抽到的塔罗牌"
          >
            <span className="absolute left-6 top-7 font-mono text-[11px] font-semibold tracking-[0.16em] text-terracotta md:left-8 md:top-8">
              PRESENT STATE · 01
            </span>
            <m.div
              initial={{ scale: 0.92, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
              className="perspective-card shrink-0"
            >
              <button
                type="button"
                onClick={handleCardClick}
                disabled={phase !== "card-back"}
                className="block cursor-pointer rounded-[12px] disabled:cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo"
                aria-label={phase === "card-back" ? "翻开牌面" : "塔罗牌"}
              >
                <div
                  className={`card-flip-inner relative aspect-[1/1.7] h-[44dvh] max-h-[486px] w-auto rounded-[12px] ${
                    isFlipped ? "[transform:rotateY(180deg)]" : ""
                  }`}
                >
                  <div className="card-flip-face overflow-hidden rounded-[12px] shadow-[0_15px_30px_rgba(24,23,19,0.22)]">
                    <Image
                      src="/cardsV2/back.png"
                      alt="塔罗牌背面"
                      width={500}
                      height={850}
                      unoptimized
                      className="h-full w-full rounded-[12px] object-cover"
                    />
                  </div>
                  <div className="card-flip-face card-flip-front overflow-hidden rounded-[12px] shadow-[0_15px_30px_rgba(24,23,19,0.22)]">
                    {card && (
                      <Image
                        src={getRevealCardImageUrl(card.imageUrl)}
                        alt={card.name}
                        width={500}
                        height={850}
                        unoptimized
                        onError={(event: SyntheticEvent<HTMLImageElement>) => {
                          event.currentTarget.src = card.imageUrl;
                        }}
                        className={`h-full w-full rounded-[12px] object-cover ${isReversed ? "rotate-180" : ""}`}
                      />
                    )}
                  </div>
                </div>
              </button>
            </m.div>
            {phase === "card-back" && (
              <div className="absolute inset-x-7 bottom-[clamp(2.75rem,7.5dvh,6.5rem)] flex flex-col items-center md:inset-x-11">
                <p className="max-w-[18rem] text-center font-serif text-sm italic leading-relaxed text-text-muted">
                  请在安静里停留片刻。
                </p>
                <button
                  type="button"
                  onClick={handleCardClick}
                  className="relative mt-3 font-mono text-[10px] font-medium tracking-[0.1em] text-terracotta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo before:absolute before:inset-[-0.75rem]"
                >
                  点击卡牌，翻开牌面
                </button>
              </div>
            )}
          </section>

          <AnimatePresence>
            {isRevealed && card && (
              <m.section
                key="card-info"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, delay: 0.08, ease: "easeOut" }}
                className="px-6 pb-12 pt-10 sm:px-10 md:overflow-y-auto md:px-[clamp(2rem,5vw,4.625rem)] md:pb-8 md:pt-16 md:[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                aria-labelledby="quick-draw-card-title"
              >
                <div className="mx-auto max-w-[34rem]">
                  <p className="mb-3 font-mono text-[11px] font-semibold tracking-[0.14em] text-terracotta">THE DRAWN IMAGE</p>
                  <h2 id="quick-draw-card-title" className="mb-1 font-serif text-[clamp(2.1rem,4vw,3.1rem)] font-semibold leading-tight tracking-[-0.03em] text-ink">
                    {card.name}
                  </h2>
                  <p className="mb-5 text-sm tracking-[0.06em] text-text-muted">{card.englishName}</p>
                  <span className={`inline-block font-serif text-sm text-terracotta ${isReversed ? "border-t-2 border-terracotta pt-2" : "border-b-2 border-terracotta pb-2"}`}>
                    {isReversed ? "逆位 · REVERSED" : "正位 · UPRIGHT"}
                  </span>

                  {keywords && keywords.length > 0 && (
                    <div className="my-5 flex flex-wrap gap-x-4 gap-y-1 border-y border-paper-border py-3 font-serif text-sm text-text-muted">
                      {keywords.slice(0, 4).map((keyword) => (
                        <span key={keyword} className="before:mr-2 before:text-terracotta before:content-['·']">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}

                  {quickAnalysis && (
                    <div className="font-serif text-[1.0625rem] leading-[1.8] text-text-body">
                      <p className="mb-4 font-semibold text-ink">{quickAnalysis.core}</p>
                      <aside className="mt-6 border-l border-terracotta pl-4 text-terracotta">
                        <span className="mb-1 block font-mono text-[10px] font-semibold tracking-[0.11em]">ONE SMALL STEP</span>
                        <p className="italic">{quickAnalysis.action}</p>
                      </aside>
                    </div>
                  )}

                  <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
                    <m.button
                      type="button"
                      onClick={onDeepReading}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.3 }}
                      className="inline-flex min-h-12 items-center gap-3 bg-terracotta px-5 py-3 font-serif text-base text-paper transition-colors hover:bg-terracotta-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
                    >
                      <span>开启深度解读</span>
                      <LegacyIcon name="arrow_forward" className="text-base" />
                    </m.button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="text-sm text-text-muted underline decoration-paper-border underline-offset-4 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo"
                    >
                      先停在这里
                    </button>
                  </div>
                </div>
              </m.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </m.div>
  );
}
