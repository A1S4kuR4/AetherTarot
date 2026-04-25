"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { getAllCards } from "@aethertarot/domain-tarot";
import type { DrawnCard, TarotCard } from "@aethertarot/shared-types";
import { CARD_BACK_IMAGE } from "@/constants";
import { useReading } from "@/context/ReadingContext";
import { cn } from "@/lib/utils";
import LegacyIcon from "@/components/ui/LegacyIcon";

function shuffleDeck() {
  return [...getAllCards()].sort(() => Math.random() - 0.5);
}

export default function RitualView() {
  const router = useRouter();
  const { question, selectedSpread, completeRitual } = useReading();
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [isShuffling, setIsShuffling] = useState(false);
  const [deck, setDeck] = useState<TarotCard[]>(() => shuffleDeck());
  const [isRevealing, setIsRevealing] = useState(false);
  const drawnCardsRef = useRef<DrawnCard[]>([]);
  const deckRef = useRef<TarotCard[]>(deck);
  const revealScheduledRef = useRef(false);

  useEffect(() => {
    drawnCardsRef.current = drawnCards;
  }, [drawnCards]);

  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  useEffect(() => {
    if (!selectedSpread) {
      return;
    }

    if (drawnCards.length !== selectedSpread.positions.length) {
      revealScheduledRef.current = false;
      return;
    }

    if (revealScheduledRef.current) {
      return;
    }

    revealScheduledRef.current = true;
    completeRitual(drawnCards);
  }, [completeRitual, drawnCards, selectedSpread]);

  useEffect(() => {
    if (!question.trim() || !selectedSpread) {
      router.replace("/");
    }
  }, [question, router, selectedSpread]);

  if (!selectedSpread || !question.trim()) {
    return null;
  }

  const isComplete = drawnCards.length === selectedSpread.positions.length;
  const canDraw = !isShuffling && !isComplete && deck.length > 0;
  const nextPosition = selectedSpread.positions[drawnCards.length] ?? null;

  const handleShuffle = () => {
    setIsShuffling(true);
    revealScheduledRef.current = false;
    setIsRevealing(false);

    window.setTimeout(() => {
      setDeck(() => {
        const nextDeck = shuffleDeck();
        deckRef.current = nextDeck;
        return nextDeck;
      });
      setIsShuffling(false);
    }, 1000);
  };

  const handleDraw = () => {
    const currentDrawnCards = drawnCardsRef.current;
    const currentDeck = deckRef.current;

    if (
      isShuffling ||
      currentDrawnCards.length >= selectedSpread.positions.length ||
      currentDeck.length === 0
    ) {
      return;
    }

    const nextPosition = selectedSpread.positions[currentDrawnCards.length];
    const randomIndex = Math.floor(Math.random() * currentDeck.length);
    const card = currentDeck[randomIndex];

    if (!card || !nextPosition) {
      return;
    }

    const remainingDeck = currentDeck.filter((_, index) => index !== randomIndex);
    const nextDrawnCards = [
      ...currentDrawnCards,
      {
        positionId: nextPosition.id,
        card,
        isReversed: Math.random() > 0.8,
      },
    ];

    deckRef.current = remainingDeck;
    drawnCardsRef.current = nextDrawnCards;
    setDeck(remainingDeck);
    setDrawnCards(nextDrawnCards);

    if (nextDrawnCards.length === selectedSpread.positions.length) {
      setIsRevealing(true);
    }
  };

  return (
    <section className="relative flex min-h-screen flex-col items-center px-6 pt-4 pb-4">
      <div className="relative z-10 mb-1 flex w-full max-w-3xl flex-col items-center text-center">
        <div className="mb-2 inline-flex items-center gap-2.5 rounded-full border border-midnight-border bg-midnight-panel px-4 py-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isComplete ? "bg-success" : "bg-indigo",
            )}
          />
          <span className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-inverse-muted">
            {drawnCards.length} / {selectedSpread.positions.length} 张牌
          </span>
        </div>

        <h1 className="mb-1 font-serif text-3xl font-semibold text-text-inverse md:text-5xl">
          仪式
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-text-inverse-muted">
          静下心来，专注于你的问题。随机会决定哪张牌出现，{selectedSpread.name} 会决定我们如何理解它。
        </p>
      </div>

      <div className="relative z-10 mb-4 flex flex-wrap items-end justify-center gap-6 md:gap-10">
        {selectedSpread.positions.map((position) => {
          const drawn = drawnCards.find((card) => card.positionId === position.id);

          return (
            <div key={position.id} className="flex flex-col items-center gap-3">
              <div
                className={cn(
                  "relative flex w-[90px] aspect-[1/1.7] items-center justify-center overflow-hidden rounded-card-md border transition-all duration-300 md:w-[120px]",
                  drawn
                    ? "border-indigo/30 shadow-[0_0_24px_rgba(113,112,255,0.12)]"
                    : "border-dashed border-midnight-border",
                )}
              >
                {drawn ? (
                  <img
                    src={CARD_BACK_IMAGE}
                    alt="Tarot Back"
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="font-sans text-[10px] uppercase tracking-wide text-text-inverse-muted/40">
                    {position.name}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "font-sans text-[10px] font-medium uppercase tracking-[0.12em]",
                  drawn ? "text-indigo" : "text-text-inverse-muted/50",
                )}
              >
                {position.name}
              </span>
            </div>
          );
        })}
      </div>

      <div className="relative z-50 mb-2 flex flex-wrap justify-center gap-4">
        <button
          type="button"
          onClick={handleShuffle}
          disabled={isShuffling || isComplete}
          className="btn-ritual"
        >
          <LegacyIcon
            name="refresh"
            className={cn("text-lg", isShuffling && "animate-spin")}
          />
          <span>洗牌</span>
        </button>
        <button
          type="button"
          onClick={handleDraw}
          disabled={!canDraw}
          className="btn-secondary-dark"
        >
          <LegacyIcon name="style" className="text-lg" />
          <span>抽取一张牌</span>
        </button>
        {isComplete ? (
          <button
            type="button"
            onClick={() => router.push("/reveal")}
            className="btn-primary"
          >
            <LegacyIcon name="visibility" className="text-lg" />
            <span>揭示牌阵</span>
          </button>
        ) : null}
      </div>

      <div className="relative flex h-[350px] w-full max-w-4xl items-center justify-center md:h-[300px]">
        {Array.from({ length: 22 }).map((_, index) => {
          const baseAngle = (index / 22) * 360;
          return (
            <motion.button
              key={index}
              type="button"
              aria-label="从牌堆抽牌"
              initial={{ rotate: baseAngle }}
              animate={
                isShuffling
                  ? {
                      rotate: [baseAngle, baseAngle + 360],
                    }
                  : { rotate: baseAngle }
              }
              transition={{
                rotate: isShuffling
                  ? { duration: 12, repeat: Infinity, ease: "linear" }
                  : { duration: 0.8, type: "spring" },
              }}
              className="absolute w-[90px] aspect-[1/1.7] cursor-pointer rounded-card-md border border-midnight-border bg-midnight-panel p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.28)] will-change-transform md:w-[120px]"
              style={{
                transformOrigin: "center 150px",
                transform: `rotate(${baseAngle}deg)`,
                top: "0px",
                zIndex: isShuffling ? 10 : 10 + index,
              }}
              onClick={handleDraw}
              disabled={!canDraw}
            >
              <div className="h-full w-full overflow-hidden rounded-[12px] border border-midnight-border-subtle bg-midnight-elevated">
                <img
                  src={CARD_BACK_IMAGE}
                  alt="Tarot Back"
                  className={cn(
                    "h-full w-full object-cover opacity-70 transition-opacity duration-300",
                    isShuffling ? "opacity-90" : "hover:opacity-100",
                  )}
                  referrerPolicy="no-referrer"
                />
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="relative z-10 mx-auto mt-2 w-full max-w-md">
        <div className="midnight-panel text-center">
          <p className="text-sm leading-relaxed text-text-inverse-muted">
            你已选择 {drawnCards.length} / {selectedSpread.positions.length} 张牌。
            {selectedSpread.name} 将揭示你的问题在不同维度中的走向。
          </p>
          <p className="mt-2 text-xs leading-relaxed text-text-inverse-muted/80">
            {nextPosition
              ? `下一张会落在「${nextPosition.name}」：${nextPosition.description}`
              : "全部位置已归位。接下来先看整组牌面的气候与张力，再进入完整解读。"}
          </p>
        </div>
      </div>
    </section>
  );
}
