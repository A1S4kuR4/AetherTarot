"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import type { DrawnCard, TarotCard } from "@aethertarot/shared-types";
import { CARD_BACK_IMAGE } from "@/constants";
import { useReading } from "@/context/ReadingContext";
import { cn } from "@/lib/utils";
import {
  drawRandomCardForPosition,
  shuffleTarotDeck,
} from "@/lib/tarotDraw";
import LegacyIcon from "@/components/ui/LegacyIcon";

const DRAW_ANIMATION_MS = 1050;

interface RectSnapshot {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface DrawOverlayState {
  key: number;
  drawnCard: DrawnCard;
  remainingDeck: TarotCard[];
  isMajorArcana: boolean;
  positionName: string;
  from: RectSnapshot;
  to: RectSnapshot;
}

export default function RitualView() {
  const router = useRouter();
  const { question, selectedSpread, completeRitual } = useReading();
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [isShuffling, setIsShuffling] = useState(false);
  const [deck, setDeck] = useState<TarotCard[]>(() => shuffleTarotDeck());
  const [isRevealing, setIsRevealing] = useState(false);
  const [drawOverlay, setDrawOverlay] = useState<DrawOverlayState | null>(null);
  const drawnCardsRef = useRef<DrawnCard[]>([]);
  const deckRef = useRef<TarotCard[]>(deck);
  const revealScheduledRef = useRef(false);
  const deckOriginRef = useRef<HTMLDivElement | null>(null);
  const slotRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  const handleShuffle = async () => {
    if (isShuffling || isRevealing) return;
    setIsShuffling(true);
    revealScheduledRef.current = false;
    setIsRevealing(false);

    await new Promise((resolve) => {
      window.setTimeout(resolve, 1250);
    });

    setDeck(() => {
      const nextDeck = shuffleTarotDeck();
      deckRef.current = nextDeck;
      return nextDeck;
    });
    setIsShuffling(false);
  };

  const handleDraw = async () => {
    const currentDrawnCards = drawnCardsRef.current;
    const currentDeck = deckRef.current;

    if (
      isShuffling ||
      currentDrawnCards.length >= selectedSpread.positions.length ||
      currentDeck.length === 0
    ) {
      return;
    }

    setIsShuffling(true);

    const nextPosition = selectedSpread.positions[currentDrawnCards.length];
    const { drawnCard, remainingDeck } = drawRandomCardForPosition(
      currentDeck,
      nextPosition?.id ?? "",
    );

    if (!drawnCard || !nextPosition) {
      setIsShuffling(false);
      return;
    }

    const isMajorArcana = drawnCard.card.arcana.toLowerCase().startsWith("major");
    const slotRect = slotRefs.current[nextPosition.id]?.getBoundingClientRect();
    const deckRect = deckOriginRef.current?.getBoundingClientRect();

    if (!slotRect || !deckRect) {
      setIsShuffling(false);
      return;
    }

    const startWidth = slotRect.width;
    const startHeight = slotRect.height;

    setDrawOverlay({
      key: Date.now(),
      drawnCard,
      remainingDeck,
      isMajorArcana,
      positionName: nextPosition.name,
      from: {
        left: deckRect.left + deckRect.width / 2 - startWidth / 2,
        top: deckRect.top + deckRect.height / 2 - startHeight / 2,
        width: startWidth,
        height: startHeight,
      },
      to: {
        left: slotRect.left,
        top: slotRect.top,
        width: slotRect.width,
        height: slotRect.height,
      },
    });

    await new Promise((resolve) => {
      window.setTimeout(resolve, DRAW_ANIMATION_MS);
    });

    const nextDrawnCards = [
      ...currentDrawnCards,
      drawnCard,
    ];

    deckRef.current = remainingDeck;
    drawnCardsRef.current = nextDrawnCards;
    setDeck(remainingDeck);
    setDrawnCards(nextDrawnCards);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setDrawOverlay(null);
        setIsShuffling(false);
      });
    });

    if (nextDrawnCards.length === selectedSpread.positions.length) {
      setIsRevealing(true);
    }
  };

  return (
    <section className="relative flex min-h-screen flex-col items-center px-6 pt-4 pb-4">
      {drawOverlay ? (
        <motion.div
          key={drawOverlay.key}
          initial={{
            left: drawOverlay.from.left,
            top: drawOverlay.from.top,
            width: drawOverlay.from.width,
            height: drawOverlay.from.height,
            rotate: -10,
            scale: 1,
            opacity: 0.96,
          }}
          animate={{
            left: [drawOverlay.from.left, (drawOverlay.from.left + drawOverlay.to.left) / 2, drawOverlay.to.left],
            top: [drawOverlay.from.top, drawOverlay.to.top - 84, drawOverlay.to.top],
            width: drawOverlay.to.width,
            height: drawOverlay.to.height,
            rotate: [-10, 6, 0],
            scale: [1, drawOverlay.isMajorArcana ? 1.16 : 1.1, 1],
            opacity: 1,
          }}
          transition={{
            duration: DRAW_ANIMATION_MS / 1000,
            ease: [0.16, 1, 0.3, 1],
            times: [0, 0.62, 1],
          }}
          className="pointer-events-none fixed z-[100] will-change-transform"
          style={{
            filter: drawOverlay.isMajorArcana
              ? "drop-shadow(0 0 38px rgba(214,107,61,0.66))"
              : "drop-shadow(0 16px 30px rgba(0,0,0,0.32))",
          }}
        >
          {drawOverlay.isMajorArcana ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.72 }}
              animate={{ opacity: [0, 0.9, 0.62], scale: [0.72, 1.35, 1.05] }}
              transition={{ duration: DRAW_ANIMATION_MS / 1000, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-[-28px] rounded-full bg-[radial-gradient(circle,rgba(214,107,61,0.34),transparent_68%)]"
            />
          ) : null}
          <div
            className={cn(
              "relative h-full w-full overflow-hidden rounded-card-md border bg-midnight-elevated",
              drawOverlay.isMajorArcana ? "border-terracotta/80" : "border-indigo/40",
            )}
          >
            <img
              src={CARD_BACK_IMAGE}
              alt={`${drawOverlay.positionName} card back`}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </motion.div>
      ) : null}
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
                ref={(node) => {
                  slotRefs.current[position.id] = node;
                }}
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
        <div
          ref={deckOriginRef}
          className="pointer-events-none absolute top-0 aspect-[1/1.7] w-[90px] md:w-[120px]"
        />
        {Array.from({ length: 22 }).map((_, index) => {
          const baseAngle = (index / 22) * 360;
          const cutDirection = index % 2 === 0 ? 1 : -1;
          const packetOffset = index % 4;
          const shuffleX = cutDirection * (42 + packetOffset * 12);
          const shuffleY = -24 + packetOffset * 14;
          return (
            <motion.button
              key={index}
              type="button"
              aria-label="从牌堆抽牌"
              initial={{ rotate: baseAngle }}
              animate={
                isShuffling
                  ? {
                      rotate: [
                        baseAngle,
                        baseAngle + cutDirection * (18 + packetOffset * 4),
                        baseAngle - cutDirection * (34 + packetOffset * 7),
                        baseAngle + 360,
                      ],
                      x: [0, shuffleX, -shuffleX * 0.72, 0],
                      y: [0, shuffleY, 26 - packetOffset * 5, 0],
                      scale: [1, 1.08, 0.94, 1],
                    }
                  : { rotate: baseAngle, x: 0, y: 0, scale: 1 }
              }
              transition={{
                duration: isShuffling ? 1.15 : 0.8,
                delay: isShuffling ? (index % 7) * 0.018 : 0,
                ease: isShuffling ? "easeInOut" : undefined,
                type: isShuffling ? "tween" : "spring",
              }}
              className="deck-card absolute w-[90px] aspect-[1/1.7] cursor-pointer rounded-card-md border border-midnight-border bg-midnight-panel p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.28)] will-change-transform md:w-[120px]"
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
