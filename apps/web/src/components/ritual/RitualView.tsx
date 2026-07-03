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
import CardImage from "@/components/ui/CardImage";

const DRAW_ANIMATION_MS = 1050;
const VISIBLE_DECK_CARD_COUNT = 22;

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
  initialRotate: number;
}

export default function RitualView() {
  const router = useRouter();
  const { question, selectedSpread, completeRitual, isHydrated } = useReading();
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [deck, setDeck] = useState<TarotCard[]>(() => shuffleTarotDeck());
  const [isRevealing, setIsRevealing] = useState(false);
  const [isNavigatingToReveal, setIsNavigatingToReveal] = useState(false);
  const [drawOverlay, setDrawOverlay] = useState<DrawOverlayState | null>(null);
  const [hoveredDeckIndex, setHoveredDeckIndex] = useState<number | null>(null);
  const [extractingDeckIndex, setExtractingDeckIndex] = useState<number | null>(null);
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
    if (!isHydrated) {
      return;
    }

    if (!question.trim() || !selectedSpread) {
      router.replace("/");
    }
  }, [isHydrated, question, router, selectedSpread]);

  if (!isHydrated || !selectedSpread || !question.trim()) {
    return null;
  }

  const isComplete = drawnCards.length === selectedSpread.positions.length;
  const canDraw = !isShuffling && !isDrawing && !isComplete && deck.length > 0;
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

  const handleDraw = async (params?: { cardIndex?: number; rect?: RectSnapshot; rotate?: number; targetElement?: HTMLElement }) => {
    const currentDrawnCards = drawnCardsRef.current;
    const currentDeck = deckRef.current;

    if (
      isShuffling ||
      isDrawing ||
      currentDrawnCards.length >= selectedSpread.positions.length ||
      currentDeck.length === 0
    ) {
      return;
    }

    setIsDrawing(true);

    const nextPosition = selectedSpread.positions[currentDrawnCards.length];
    const { drawnCard, remainingDeck } = drawRandomCardForPosition(
      currentDeck,
      nextPosition?.id ?? "",
    );

    if (!drawnCard || !nextPosition) {
      setIsDrawing(false);
      return;
    }

    const cardIndex = params?.cardIndex ?? 0;
    
    // Phase 1: Radial Pop-Out (200ms)
    setExtractingDeckIndex(cardIndex);

    await new Promise((resolve) => window.setTimeout(resolve, 200));

    const isMajorArcana = drawnCard.card.arcana.toLowerCase().startsWith("major");
    const slotRect = slotRefs.current[nextPosition.id]?.getBoundingClientRect();
    const deckRect = deckOriginRef.current?.getBoundingClientRect();

    if (!slotRect) {
      setExtractingDeckIndex(null);
      setIsDrawing(false);
      return;
    }

    // Get exact rect of popped-out element if available
    let startRect: RectSnapshot;
    if (params?.targetElement) {
      const rect = params.targetElement.getBoundingClientRect();
      startRect = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    } else if (params?.rect) {
      startRect = params.rect;
    } else {
      const defaultWidth = slotRect.width;
      const defaultHeight = slotRect.height;
      startRect = {
        left: (deckRect?.left ?? window.innerWidth / 2) + (deckRect?.width ?? 0) / 2 - defaultWidth / 2,
        top: (deckRect?.top ?? window.innerHeight / 2) + (deckRect?.height ?? 0) / 2 - defaultHeight / 2,
        width: defaultWidth,
        height: defaultHeight,
      };
    }

    // Phase 2: Fly to Slot (750ms)
    setDrawOverlay({
      key: Date.now(),
      drawnCard,
      remainingDeck,
      isMajorArcana,
      positionName: nextPosition.name,
      from: startRect,
      to: {
        left: slotRect.left,
        top: slotRect.top,
        width: slotRect.width,
        height: slotRect.height,
      },
      initialRotate: params?.rotate ?? 0,
    });

    await new Promise((resolve) => window.setTimeout(resolve, DRAW_ANIMATION_MS));

    // Phase 3: Settle & Re-balance Deck
    const nextDrawnCards = [...currentDrawnCards, drawnCard];

    deckRef.current = remainingDeck;
    drawnCardsRef.current = nextDrawnCards;
    setDeck(remainingDeck);
    setDrawnCards(nextDrawnCards);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setDrawOverlay(null);
        setExtractingDeckIndex(null);
        setIsDrawing(false);
      });
    });

    if (nextDrawnCards.length === selectedSpread.positions.length) {
      setIsRevealing(true);
    }
  };

  const handleReveal = () => {
    if (isNavigatingToReveal) {
      return;
    }

    setIsNavigatingToReveal(true);
    router.push("/reveal");
  };

  return (
    <section className="ritual-view-stage relative flex h-[calc(100dvh-4rem)] w-full flex-col items-center justify-between overflow-hidden px-4 py-2 md:px-6 md:py-3">
      {drawOverlay ? (
        <motion.div
          key={drawOverlay.key}
          initial={{
            left: drawOverlay.from.left,
            top: drawOverlay.from.top,
            width: drawOverlay.from.width,
            height: drawOverlay.from.height,
            rotate: drawOverlay.initialRotate,
            scale: 1,
            opacity: 0.96,
          }}
          animate={{
            left: [drawOverlay.from.left, (drawOverlay.from.left + drawOverlay.to.left) / 2, drawOverlay.to.left],
            top: [drawOverlay.from.top, drawOverlay.to.top - 84, drawOverlay.to.top],
            width: drawOverlay.to.width,
            height: drawOverlay.to.height,
            rotate: [drawOverlay.initialRotate, drawOverlay.initialRotate * 0.4, 0],
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
            <CardImage
              src={CARD_BACK_IMAGE}
              alt={`${drawOverlay.positionName} card back`}
              sizes={`${Math.ceil(drawOverlay.to.width)}px`}
              quality={50}
              priority
            />
          </div>
        </motion.div>
      ) : null}
            <div className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center pt-3 md:pt-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-midnight-border/60 bg-midnight-panel/80 px-4 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.2)] backdrop-blur-md">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full animate-pulse",
              isComplete ? "bg-success" : "bg-indigo",
            )}
          />
          <span className="font-serif text-sm font-medium tracking-wide text-text-inverse">
            仪式 · {selectedSpread.name}
          </span>
          <span className="font-sans text-xs font-medium text-text-inverse-muted/70">
            ({drawnCards.length}/{selectedSpread.positions.length})
          </span>
        </div>
      </div>

      <div
        data-testid="ritual-position-track"
        className="relative z-60 w-full snap-x snap-mandatory overflow-x-auto px-1 pb-1 hide-scrollbar md:snap-none md:overflow-visible mt-2 mb-4 md:mt-3 md:mb-6"
      >
        <div className="mx-auto flex w-max min-w-full flex-nowrap items-end justify-start gap-6 md:w-full md:flex-wrap md:justify-center md:gap-16">
          {selectedSpread.positions.map((position) => {
            const drawn = drawnCards.find((card) => card.positionId === position.id);

            return (
              <div key={position.id} className="flex w-[76px] shrink-0 scroll-mx-4 snap-center flex-col items-center gap-3 md:w-[108px]">
                <div
                  ref={(node) => {
                    slotRefs.current[position.id] = node;
                  }}
                  className={cn(
                    "relative flex w-full aspect-[1/1.7] items-center justify-center overflow-hidden rounded-card-md border transition-all duration-300",
                    drawn
                      ? "border-indigo/30 shadow-[0_0_24px_rgba(113,112,255,0.12)]"
                      : "border-dashed border-midnight-border",
                  )}
                >
                  {drawn ? (
                    <CardImage
                      src={CARD_BACK_IMAGE}
                      alt="Tarot Back"
                      sizes="(min-width: 768px) 108px, 76px"
                      quality={50}
                    />
                  ) : (
                    <span className="px-2 text-center font-sans text-[10px] uppercase tracking-wide text-text-inverse-muted/40">
                      {position.name}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "max-w-full truncate font-sans text-[10px] font-medium uppercase tracking-[0.12em]",
                    drawn ? "text-indigo" : "text-text-inverse-muted/50",
                  )}
                >
                  {position.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative z-50 mb-6 md:mb-8 flex flex-wrap justify-center gap-4">
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
          onClick={() => void handleDraw()}
          disabled={!canDraw}
          className="btn-secondary-dark"
        >
          <LegacyIcon name="style" className="text-lg" />
          <span>抽取一张牌</span>
        </button>
        {isComplete ? (
          <button
            type="button"
            onClick={handleReveal}
            disabled={isNavigatingToReveal}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-70"
          >
            <LegacyIcon name="visibility" className="text-lg" />
            <span>{isNavigatingToReveal ? "正在揭示..." : "揭示牌阵"}</span>
          </button>
        ) : null}
      </div>

      <div className="ritual-deck-field relative z-30 flex w-full max-w-4xl items-center justify-center pb-6 md:pb-8">
        <div
          ref={deckOriginRef}
          className="pointer-events-none absolute top-0 aspect-[1/1.7] w-[90px] md:w-[120px]"
        />
        {Array.from({ length: Math.min(deck.length, VISIBLE_DECK_CARD_COUNT) }).map((_, index) => {
          const baseAngle = (index / VISIBLE_DECK_CARD_COUNT) * 360;
          const cutDirection = index % 2 === 0 ? 1 : -1;
          const packetOffset = index % 4;
          const shuffleX = cutDirection * (42 + packetOffset * 12);
          const shuffleY = -24 + packetOffset * 14;
          
          const isExtracting = extractingDeckIndex === index;
          const isBeingFlown = drawOverlay !== null && extractingDeckIndex === index;
          const isHovered = hoveredDeckIndex === index;

          // Radial offsets
          const popOffset = isExtracting ? 36 : isHovered ? 20 : 0;
          const scaleVal = isExtracting ? 1.12 : isHovered ? 1.04 : 1;

          return (
            <motion.button
              key={index}
              type="button"
              aria-label="从牌堆抽牌"
              data-testid="deck-card"
              data-deck-index={index}
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
                      opacity: 1,
                    }
                  : { 
                      rotate: baseAngle, 
                      x: popOffset ? Math.sin(baseAngle * (Math.PI / 180)) * popOffset : 0,
                      y: popOffset ? -Math.cos(baseAngle * (Math.PI / 180)) * popOffset : 0,
                      scale: scaleVal,
                      opacity: isBeingFlown ? 0 : 1,
                    }
              }
              transition={{
                duration: isShuffling ? 1.15 : isExtracting ? 0.2 : 0.8,
                delay: isShuffling ? (index % 7) * 0.018 : 0,
                ease: isShuffling ? "easeInOut" : "easeOut",
                type: isShuffling ? "tween" : "spring",
              }}
              className="deck-card absolute w-[90px] aspect-[1/1.7] cursor-pointer rounded-card-md border border-midnight-border bg-midnight-panel p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.28)] will-change-transform md:w-[120px]"
              style={{
                transformOrigin: "center 150px",
                transform: `rotate(${baseAngle}deg)`,
                top: "0px",
                zIndex: isExtracting ? 90 : isHovered ? 80 : isShuffling ? 10 : 10 + index,
              }}
              onPointerEnter={() => setHoveredDeckIndex(index)}
              onPointerLeave={() => {
                setHoveredDeckIndex((currentIndex) =>
                  currentIndex === index ? null : currentIndex,
                );
              }}
              onFocus={() => setHoveredDeckIndex(index)}
              onBlur={() => {
                setHoveredDeckIndex((currentIndex) =>
                  currentIndex === index ? null : currentIndex,
                );
              }}
              onClick={(event) => {
                const targetElem = event.currentTarget;
                const rect = targetElem.getBoundingClientRect();
                handleDraw({
                  cardIndex: index,
                  targetElement: targetElem,
                  rect: {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                  },
                  rotate: baseAngle,
                });
              }}
              disabled={!canDraw}
            >
              <div className="h-full w-full overflow-hidden rounded-[12px] border border-midnight-border-subtle bg-midnight-elevated">
                <CardImage
                  src={CARD_BACK_IMAGE}
                  alt="Tarot Back"
                  sizes="(min-width: 768px) 120px, 90px"
                  quality={50}
                  className={cn(
                    "transition-all duration-300",
                    isShuffling ? "opacity-90" : 
                    isExtracting ? "opacity-100 brightness-125" :
                    isHovered ? "opacity-100 brightness-110" : 
                    hoveredDeckIndex !== null || extractingDeckIndex !== null ? "opacity-40" : "opacity-80"
                  )}
                />
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="relative z-40 mx-auto w-full max-w-xl text-center pb-1">
        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-midnight-border/50 bg-midnight-panel/60 px-4 py-1 text-xs text-text-inverse-muted shadow-sm backdrop-blur-sm">
          <LegacyIcon name="info" className="text-xs text-indigo-light shrink-0" />
          <span className="truncate">
            {nextPosition
              ? `当前槽位「${nextPosition.name}」：${nextPosition.description}`
              : "全部位置已归位，准备揭示牌阵。"}
          </span>
        </div>
      </div>
    </section>
  );
}
