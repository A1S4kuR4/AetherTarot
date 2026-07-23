"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  type TargetAndTransition,
  type Transition,
} from "motion/react";
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

const INTRO_STAGGER_MS = 50;
const INTRO_FLIGHT_MS = 480;
const INTRO_FAN_STAGGER_MS = 12;
const INTRO_FAN_SETTLE_MS = 650;
const INTRO_FLY_TOTAL_MS =
  (VISIBLE_DECK_CARD_COUNT - 1) * INTRO_STAGGER_MS + INTRO_FLIGHT_MS + 60;
const INTRO_FAN_TOTAL_MS =
  VISIBLE_DECK_CARD_COUNT * INTRO_FAN_STAGGER_MS + INTRO_FAN_SETTLE_MS;

type IntroPhase = "flying" | "fanning" | "done";

type ShufflePhase = "idle" | "gathering" | "splitting" | "riffling" | "refanning";

const SHUFFLE_GATHER_MS = 400;
const SHUFFLE_SPLIT_MS = 200;
const SHUFFLE_RIFFLE_MS = 420;
const SHUFFLE_REFAN_MS = 650;
const RIFFLE_HALF_COUNT = VISIBLE_DECK_CARD_COUNT / 2;

const pseudoRandom = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

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
  const [shufflePhase, setShufflePhase] = useState<ShufflePhase>("idle");
  const [isDrawing, setIsDrawing] = useState(false);
  const [deck, setDeck] = useState<TarotCard[]>(() => shuffleTarotDeck());
  const [isRevealing, setIsRevealing] = useState(false);
  const [isNavigatingToReveal, setIsNavigatingToReveal] = useState(false);
  const [drawOverlay, setDrawOverlay] = useState<DrawOverlayState | null>(null);
  const [hoveredDeckIndex, setHoveredDeckIndex] = useState<number | null>(null);
  const [extractingDeckIndex, setExtractingDeckIndex] = useState<number | null>(null);
  const shouldReduceMotion = useReducedMotion() ?? false;
  const [rawIntroPhase, setIntroPhase] = useState<IntroPhase>("flying");
  const introPhase: IntroPhase = shouldReduceMotion ? "done" : rawIntroPhase;
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

  useEffect(() => {
    if (!isHydrated || !selectedSpread || !question.trim()) {
      return;
    }

    if (introPhase === "flying") {
      const timer = window.setTimeout(
        () => setIntroPhase("fanning"),
        INTRO_FLY_TOTAL_MS,
      );
      return () => window.clearTimeout(timer);
    }

    if (introPhase === "fanning") {
      const timer = window.setTimeout(
        () => setIntroPhase("done"),
        INTRO_FAN_TOTAL_MS,
      );
      return () => window.clearTimeout(timer);
    }
  }, [introPhase, isHydrated, question, selectedSpread]);

  if (!isHydrated || !selectedSpread || !question.trim()) {
    return null;
  }

  const isComplete = drawnCards.length === selectedSpread.positions.length;
  const introComplete = introPhase === "done";
  const canDraw = introComplete && !isShuffling && !isDrawing && !isComplete && deck.length > 0;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const nextPosition = selectedSpread.positions[drawnCards.length] ?? null;

  const handleShuffle = async () => {
    if (isShuffling || isRevealing || !introComplete) return;
    setIsShuffling(true);
    revealScheduledRef.current = false;
    setIsRevealing(false);

    if (shouldReduceMotion) {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    } else {
      setShufflePhase("gathering");
      await new Promise((resolve) => window.setTimeout(resolve, SHUFFLE_GATHER_MS));
      setShufflePhase("splitting");
      await new Promise((resolve) => window.setTimeout(resolve, SHUFFLE_SPLIT_MS));
      setShufflePhase("riffling");
      await new Promise((resolve) => window.setTimeout(resolve, SHUFFLE_RIFFLE_MS));
      setShufflePhase("refanning");
    }

    setDeck(() => {
      const nextDeck = shuffleTarotDeck();
      deckRef.current = nextDeck;
      return nextDeck;
    });

    if (!shouldReduceMotion) {
      await new Promise((resolve) => window.setTimeout(resolve, SHUFFLE_REFAN_MS));
      setShufflePhase("idle");
    }

    setIsShuffling(false);
  };

  const handleDraw = async (params?: { cardIndex?: number; rect?: RectSnapshot; rotate?: number; targetElement?: HTMLElement }) => {
    const currentDrawnCards = drawnCardsRef.current;
    const currentDeck = deckRef.current;

    if (
      !introComplete ||
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
    <section
      className="ritual-view-stage relative flex min-h-[calc(100dvh-4rem)] w-full flex-col items-center justify-between overflow-x-hidden px-4 py-2 md:px-6 md:py-3 lg:h-[calc(100dvh-4rem)] lg:overflow-hidden"
      onClick={() => {
        if (introPhase !== "done") {
          setIntroPhase("done");
        }
      }}
    >
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
            <div
        className={cn(
          "relative z-10 flex w-full max-w-3xl flex-col items-center text-center pt-3 md:pt-5 transition-opacity duration-700",
          introPhase === "flying" ? "opacity-0" : "opacity-100",
        )}
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-midnight-border/60 bg-midnight-panel/80 px-4 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.2)] backdrop-blur-md">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full animate-pulse",
              isComplete ? "bg-success" : "bg-indigo",
            )}
          />
          <h1 className="font-serif text-sm font-medium tracking-wide text-text-inverse">
            仪式 · {selectedSpread.name}
          </h1>
          <span className="font-sans text-xs font-medium text-text-inverse-muted/70">
            ({drawnCards.length}/{selectedSpread.positions.length})
          </span>
        </div>
      </div>

      <div
        data-testid="ritual-position-track"
        className={cn(
          "relative z-60 w-full snap-x snap-mandatory overflow-x-auto px-1 pb-1 hide-scrollbar md:snap-none md:overflow-visible mt-2 mb-4 md:mt-3 md:mb-6 transition-opacity duration-700",
          introPhase === "flying" ? "opacity-0" : "opacity-100",
        )}
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

      <div
        className={cn(
          "relative z-50 mb-6 md:mb-8 flex flex-wrap justify-center gap-4 transition-opacity duration-700",
          introPhase === "flying" ? "opacity-0" : "opacity-100",
        )}
      >
        <button
          type="button"
          onClick={handleShuffle}
          disabled={isShuffling || isComplete || !introComplete}
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

          const isExtracting = extractingDeckIndex === index;
          const isBeingFlown = drawOverlay !== null && extractingDeckIndex === index;
          const isHovered = hoveredDeckIndex === index;

          // Intro flight/pile params (deterministic per index)
          const randA = pseudoRandom(index + 1);
          const randB = pseudoRandom(index + 101);
          const randC = pseudoRandom(index + 202);
          const flyX = (randA - 0.5) * viewportWidth * 0.72;
          const flyY = -(viewportHeight * (0.9 + randB * 0.3));
          const flyRotate = baseAngle + (randC - 0.5) * 540;
          const pileX = (randC - 0.5) * 3;
          const pileY = -index * 0.5;
          const pileRotate = (randB - 0.5) * 5;

          // Radial offsets
          const popOffset = isExtracting ? 36 : isHovered ? 20 : 0;
          const scaleVal = isExtracting ? 1.12 : isHovered ? 1.04 : 1;

          // Shuffle riffle params: pile splits into halves, halves interleave back
          const isFirstHalf = index < RIFFLE_HALF_COUNT;
          const riffleOrder = isFirstHalf
            ? index * 2
            : (index - RIFFLE_HALF_COUNT) * 2 + 1;
          const splitX = (isFirstHalf ? -1 : 1) * 96;
          const splitY = pileY - 30;
          const splitRotate = pileRotate + (isFirstHalf ? -10 : 10);
          const landX = pileX + (isFirstHalf ? -8 : 8);
          const landRotate = pileRotate * 0.6;

          let motionTarget: TargetAndTransition;
          let motionTransition: Transition;

          if (introPhase === "flying") {
            motionTarget = { x: pileX, y: pileY, rotate: pileRotate, scale: 1, opacity: 1 };
            motionTransition = {
              duration: INTRO_FLIGHT_MS / 1000,
              delay: index * (INTRO_STAGGER_MS / 1000),
              ease: [0.16, 1, 0.3, 1],
            };
          } else if (introPhase === "fanning") {
            motionTarget = { x: 0, y: 0, rotate: baseAngle, scale: 1, opacity: 1 };
            motionTransition = {
              type: "spring",
              stiffness: 140,
              damping: 17,
              delay: index * (INTRO_FAN_STAGGER_MS / 1000),
            };
          } else if (shufflePhase === "gathering") {
            motionTarget = { x: pileX, y: pileY, rotate: pileRotate, scale: 1, opacity: 1 };
            motionTransition = { type: "spring", stiffness: 170, damping: 21, delay: index * 0.004 };
          } else if (shufflePhase === "splitting") {
            motionTarget = { x: splitX, y: splitY, rotate: splitRotate, scale: 1, opacity: 1 };
            motionTransition = { type: "spring", stiffness: 180, damping: 20, delay: 0 };
          } else if (shufflePhase === "riffling") {
            motionTarget = { x: landX, y: pileY, rotate: landRotate, scale: 1, opacity: 1 };
            motionTransition = { type: "spring", stiffness: 220, damping: 22, delay: riffleOrder * 0.007 };
          } else if (shufflePhase === "refanning") {
            motionTarget = { x: 0, y: 0, rotate: baseAngle, scale: 1, opacity: 1 };
            motionTransition = { type: "spring", stiffness: 140, damping: 17, delay: index * 0.01 };
          } else if (isShuffling) {
            // Reduced-motion shuffle: hold the fan still while the deck order swaps.
            motionTarget = { x: 0, y: 0, rotate: baseAngle, scale: 1, opacity: 1 };
            motionTransition = { duration: 0 };
          } else {
            motionTarget = {
              rotate: baseAngle,
              x: popOffset ? Math.sin(baseAngle * (Math.PI / 180)) * popOffset : 0,
              y: popOffset ? -Math.cos(baseAngle * (Math.PI / 180)) * popOffset : 0,
              scale: scaleVal,
              opacity: isBeingFlown ? 0 : 1,
            };
            motionTransition = {
              duration: isExtracting ? 0.2 : 0.8,
              delay: 0,
              ease: "easeOut",
              type: "spring",
            };
          }

          return (
            <motion.button
              key={index}
              type="button"
              aria-label="从牌堆抽牌"
              data-testid="deck-card"
              data-deck-index={index}
              initial={
                introPhase === "flying"
                  ? { x: flyX, y: flyY, rotate: flyRotate, scale: 1.06, opacity: 0 }
                  : false
              }
              animate={motionTarget}
              transition={motionTransition}
              className="deck-card absolute w-[90px] aspect-[1/1.7] cursor-pointer rounded-card-md border border-midnight-border bg-midnight-panel p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.28)] will-change-transform md:w-[120px]"
              style={{
                transformOrigin: "center 150px",
                transform: `rotate(${baseAngle}deg)`,
                top: "0px",
                zIndex: isExtracting
                  ? 90
                  : isHovered
                    ? 80
                    : shufflePhase === "riffling"
                      ? 10 + riffleOrder
                      : 10 + index,
              }}
              onPointerEnter={() => {
                if (!introComplete) return;
                setHoveredDeckIndex(index);
              }}
              onPointerLeave={() => {
                setHoveredDeckIndex((currentIndex) =>
                  currentIndex === index ? null : currentIndex,
                );
              }}
              onFocus={() => {
                if (!introComplete) return;
                setHoveredDeckIndex(index);
              }}
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
              disabled={introComplete && !canDraw}
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

      <div
        className={cn(
          "relative z-40 mx-auto w-full max-w-xl text-center pb-1 transition-opacity duration-700",
          introPhase === "flying" ? "opacity-0" : "opacity-100",
        )}
      >
        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-midnight-border/50 bg-midnight-panel/60 px-4 py-1 text-xs text-text-inverse-muted shadow-sm backdrop-blur-sm">
          <LegacyIcon name="info" className="text-xs text-indigo-light shrink-0" />
          <span className="truncate">
            {nextPosition
              ? `当前槽位「${nextPosition.name}」：${nextPosition.description}`
              : "全部位置已归位，准备揭示牌阵。"}
          </span>
        </div>
      </div>

      {introPhase !== "done" ? (
        <span className="pointer-events-none absolute bottom-1 right-3 z-[110] animate-pulse font-sans text-[11px] tracking-wide text-text-inverse-muted/50">
          点击任意处跳过入场
        </span>
      ) : null}
    </section>
  );
}
