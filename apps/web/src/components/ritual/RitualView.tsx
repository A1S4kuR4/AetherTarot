"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { getAllCards } from "@aethertarot/domain-tarot";
import type { DrawnCard, TarotCard } from "@aethertarot/shared-types";
import { CARD_BACK_IMAGE } from "@/constants";
import { useReading } from "@/context/ReadingContext";
import { cn } from "@/lib/utils";

export default function RitualView() {
  const router = useRouter();
  const { question, selectedSpread, completeRitual } = useReading();
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [isShuffling, setIsShuffling] = useState(false);
  const [deck, setDeck] = useState<TarotCard[]>([]);

  useEffect(() => {
    setDeck([...getAllCards()].sort(() => Math.random() - 0.5));
  }, []);

  useEffect(() => {
    if (!question.trim() || !selectedSpread) {
      router.replace("/");
    }
  }, [question, router, selectedSpread]);

  if (!selectedSpread || !question.trim()) {
    return null;
  }

  const handleShuffle = () => {
    setIsShuffling(true);

    window.setTimeout(() => {
      setDeck((currentDeck) => [...currentDeck].sort(() => Math.random() - 0.5));
      setIsShuffling(false);
    }, 1000);
  };

  const handleDraw = () => {
    if (isShuffling || drawnCards.length >= selectedSpread.positions.length) {
      return;
    }

    const nextPosition = selectedSpread.positions[drawnCards.length];
    const randomIndex = Math.floor(Math.random() * deck.length);
    const card = deck[randomIndex];

    if (!card) {
      return;
    }

    const nextDrawnCards = [
      ...drawnCards,
      {
        positionId: nextPosition.id,
        card,
        isReversed: Math.random() > 0.8,
      },
    ];

    setDrawnCards(nextDrawnCards);

    if (nextDrawnCards.length === selectedSpread.positions.length) {
      window.setTimeout(() => {
        completeRitual(nextDrawnCards);
        router.push("/reveal");
      }, 1500);
    }
  };

  return (
    <section className="relative flex min-h-screen flex-col items-center px-6 py-12">
      <div className="relative z-10 mb-12 flex w-full max-w-6xl flex-col items-center text-center">
        <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-outline-variant/20 bg-surface-container-low px-4 py-1.5">
          <span className="h-2 w-2 rounded-full bg-secondary-fixed shadow-[0_0_8px_#ffe16d]" />
          <span className="font-label text-[10px] uppercase tracking-[0.3em] text-on-surface-variant">
            Active Ritual
          </span>
        </div>
        <h1 className="mb-4 font-serif text-4xl text-secondary md:text-6xl">
          洗牌与抽牌 (The Ritual)
        </h1>
        <p className="max-w-xl text-lg italic text-on-surface-variant opacity-80">
          静下心来，专注于你的问题，感受卡牌中的能量。
        </p>
      </div>

      <div className="relative z-10 flex w-full flex-grow flex-col items-center justify-start pb-32">
        <div className="mt-8 mb-16 flex flex-wrap items-end justify-center gap-8 md:gap-16">
          {selectedSpread.positions.map((position) => {
            const drawn = drawnCards.find(
              (card) => card.positionId === position.id,
            );

            return (
              <div key={position.id} className="flex flex-col items-center gap-4">
                <div
                  className={cn(
                    "relative flex h-40 w-24 items-center justify-center overflow-hidden rounded-xl border bg-surface-container-lowest transition-all duration-500 md:h-52 md:w-32",
                    drawn
                      ? "border-primary shadow-[0_0_20px_rgba(203,190,255,0.2)]"
                      : "border-dashed border-outline-variant/40",
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
                    <span className="font-label text-[10px] uppercase tracking-tighter text-outline-variant opacity-40">
                      {position.name}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "font-label text-[10px] uppercase tracking-[0.2em]",
                    drawn ? "text-secondary-fixed" : "text-on-surface-variant/60",
                  )}
                >
                  {position.name}
                </span>
              </div>
            );
          })}
        </div>

        <div className="relative flex h-[300px] w-full max-w-5xl items-center justify-center">
          <div className="absolute top-[-60px] z-50 flex gap-4">
            <button
              type="button"
              onClick={handleShuffle}
              disabled={
                isShuffling || drawnCards.length === selectedSpread.positions.length
              }
              className="group relative flex items-center gap-3 rounded-full bg-gradient-to-r from-primary to-primary-container px-10 py-4 font-label text-sm font-bold uppercase tracking-[0.15em] text-on-primary shadow-lg transition-all duration-500 hover:scale-105 disabled:opacity-50"
            >
              <span
                className={cn(
                  "material-symbols-outlined",
                  isShuffling && "animate-spin",
                )}
              >
                refresh
              </span>
              <span>Shuffle Deck</span>
            </button>
          </div>

          <div className="relative flex h-full w-full items-center justify-center">
            {Array.from({ length: 15 }).map((_, index) => (
              <motion.button
                key={index}
                type="button"
                animate={
                  isShuffling
                    ? {
                        x: [0, (index - 7) * 20, 0],
                        rotate: [index * 5 - 35, 0, index * 5 - 35],
                      }
                    : {}
                }
                transition={{ duration: 0.5, repeat: isShuffling ? Infinity : 0 }}
                className="absolute h-52 w-32 cursor-pointer rounded-xl border border-outline-variant/30 bg-surface-container p-1.5 shadow-2xl md:h-64 md:w-40"
                style={{
                  transform: `rotate(${(index - 7) * 5}deg) translateX(${(index - 7) * 30}px)`,
                  zIndex: 10 + index,
                }}
                onClick={handleDraw}
                disabled={
                  isShuffling || drawnCards.length === selectedSpread.positions.length
                }
              >
                <div className="h-full w-full overflow-hidden rounded-lg border border-primary/20 bg-surface-container-lowest">
                  <img
                    src={CARD_BACK_IMAGE}
                    alt="Tarot Back"
                    className="h-full w-full object-cover opacity-80"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        <div className="mt-24 mx-auto w-full max-w-lg">
          <div className="glass-panel rounded-xl border-t-2 border-secondary-fixed/40 p-8 text-center">
            <h3 className="mb-2 font-serif text-xl text-secondary">
              Aether Insight
            </h3>
            <p className="text-sm leading-relaxed italic text-on-surface-variant">
              灵性已与你的提问对齐。你已选择 {drawnCards.length} /{" "}
              {selectedSpread.positions.length} 张牌。{selectedSpread.name}
              将揭示你的问题在过去、当下与潜在线索中的走向。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
