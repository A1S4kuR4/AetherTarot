"use client";

import { useCallback, useEffect, useState } from "react";
import { m, AnimatePresence } from "motion/react";
import Image from "next/image";
import type { DrawnCard } from "@aethertarot/shared-types";
import LegacyIcon from "@/components/ui/LegacyIcon";
import { getRevealCardImageUrl } from "@/lib/card-assets";

type Phase = "entering" | "card-back" | "flipping" | "revealed";

type QuickDrawOverlayProps = {
  isOpen: boolean;
  drawnCard: DrawnCard | null;
  onClose: () => void;
  onEnterReading: () => void;
};

export default function QuickDrawOverlay({
  isOpen,
  drawnCard,
  onClose,
  onEnterReading,
}: QuickDrawOverlayProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <QuickDrawOverlayContent
          drawnCard={drawnCard}
          onClose={onClose}
          onEnterReading={onEnterReading}
        />
      )}
    </AnimatePresence>
  );
}

function QuickDrawOverlayContent({
  drawnCard,
  onClose,
  onEnterReading,
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
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden"
          style={{ background: "rgba(11, 13, 18, 0.96)" }}
        >
          {/* Close button */}
          <m.button
            type="button"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="fixed right-4 top-4 z-[60] flex h-10 w-10 items-center justify-center rounded-full text-text-inverse-muted transition-colors hover:bg-white/10 hover:text-text-inverse md:right-8 md:top-8"
            aria-label="关闭"
          >
            <LegacyIcon name="close" className="text-xl" />
          </m.button>

          {/* Inner wrapper for centering and padding */}
          <div className="flex min-h-full w-full flex-col items-center justify-center py-20 md:py-24">
            {/* Main card display area */}
            <div
              className={`flex w-full max-w-4xl items-center justify-center gap-0 px-6 transition-all duration-700 ease-out ${
                isRevealed
                  ? "flex-col gap-8 md:flex-row md:gap-16"
                  : "flex-col"
              }`}
            >
            {/* 3D Card */}
            <m.div
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{
                scale: 1,
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.6,
                type: "spring",
                stiffness: 200,
                damping: 20,
                delay: 0.2,
              }}
              className="perspective-card shrink-0"
            >
              <button
                type="button"
                onClick={handleCardClick}
                disabled={phase !== "card-back"}
                className="block cursor-pointer disabled:cursor-default"
                aria-label={
                  phase === "card-back" ? "翻开牌面" : "塔罗牌"
                }
              >
                <div
                  className={`card-flip-inner relative aspect-[1/1.7] w-[200px] rounded-[12px] shadow-[0_20px_60px_rgba(0,0,0,0.5)] sm:w-[240px] md:w-[260px] ${
                    isFlipped ? "[transform:rotateY(180deg)]" : ""
                  }`}
                >
                  {/* Back face */}
                  <div className="card-flip-face">
                    <Image
                      src="/cardsV2/back.png"
                      alt="塔罗牌背面"
                      width={500}
                      height={850}
                      sizes="260px"
                      quality={75}
                      priority
                      className="h-full w-full rounded-[12px] object-cover"
                    />
                  </div>

                  {/* Front face */}
                  <div className="card-flip-face card-flip-front">
                    {card && (
                      <Image
                        src={getRevealCardImageUrl(card.imageUrl)}
                        alt={card.name}
                        width={500}
                        height={850}
                        sizes="260px"
                        quality={75}
                        className={`h-full w-full rounded-[12px] object-cover ${
                          isReversed ? "rotate-180" : ""
                        }`}
                      />
                    )}
                  </div>
                </div>
              </button>
            </m.div>

            {/* Card info panel — appears after reveal */}
            <AnimatePresence>
              {isRevealed && card && (
                <m.div
                  key="card-info"
                  initial={{ opacity: 0, y: 20, x: 0 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
                  className="flex max-w-sm flex-col items-center text-center md:items-start md:text-left"
                >
                  {/* Card name */}
                  <h3 className="font-serif text-2xl font-semibold tracking-wide text-text-inverse sm:text-3xl">
                    {card.name}
                  </h3>
                  <p className="mt-1 font-sans text-sm tracking-wider text-text-inverse-muted">
                    {card.englishName}
                  </p>

                  {/* Orientation badge */}
                  <span
                    className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-wide ${
                      isReversed
                        ? "bg-indigo-muted text-indigo"
                        : "bg-terracotta/15 text-terracotta"
                    }`}
                  >
                    {isReversed ? "逆位" : "正位"}
                  </span>

                  {/* Divider */}
                  <div className="my-5 flex w-48 items-center justify-center md:justify-start">
                    <span className="h-px flex-1 bg-gradient-to-r from-transparent via-text-inverse-muted/30 to-transparent" />
                    <span className="mx-3 h-1.5 w-1.5 rotate-45 bg-text-inverse-muted/40" />
                    <span className="h-px flex-1 bg-gradient-to-r from-transparent via-text-inverse-muted/30 to-transparent" />
                  </div>

                  {/* Keywords */}
                  {keywords && keywords.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 md:justify-start">
                      {keywords.slice(0, 4).map((kw) => (
                        <span
                          key={kw}
                          className="rounded-full border border-midnight-border-subtle bg-midnight-elevated px-3 py-1 text-xs text-text-inverse-muted"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Description excerpt */}
                  <p className="mt-5 text-sm leading-relaxed text-text-inverse-muted">
                    {card.description.length > 120
                      ? card.description.slice(0, 120) + "……"
                      : card.description}
                  </p>

                  {/* Enter reading button */}
                  <m.button
                    type="button"
                    onClick={onEnterReading}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.4 }}
                    className="mt-8 inline-flex items-center gap-2 rounded-xl bg-terracotta px-6 py-3 text-sm font-medium text-white shadow-lg transition-all hover:bg-terracotta-hover hover:shadow-xl active:scale-[0.98]"
                  >
                    <span>进入解读</span>
                    <LegacyIcon name="arrow_forward" className="text-base" />
                  </m.button>
                </m.div>
              )}
            </AnimatePresence>
          </div> {/* Close Main card display area */}
          </div> {/* Close Inner wrapper */}

          {/* Pulse hint — only during card-back phase */}
          <AnimatePresence>
            {phase === "card-back" && (
              <m.p
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="animate-hint-pulse fixed bottom-12 left-1/2 -translate-x-1/2 font-serif text-sm tracking-[0.2em] text-text-inverse-muted md:bottom-16 md:text-base z-10"
              >
                轻触翻开牌面
              </m.p>
            )}
          </AnimatePresence>
    </m.div>
  );
}
