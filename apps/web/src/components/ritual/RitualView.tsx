"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  motion,
  useReducedMotion,
  type TargetAndTransition,
  type Transition,
} from "motion/react";
import { useRouter } from "next/navigation";
import type { DrawnCard, TarotCard } from "@aethertarot/shared-types";
import CardImage from "@/components/ui/CardImage";
import LegacyIcon from "@/components/ui/LegacyIcon";
import { CARD_BACK_IMAGE } from "@/constants";
import { useReading } from "@/context/ReadingContext";
import { cn } from "@/lib/utils";
import {
  drawRandomCardForPosition,
  shuffleTarotDeck,
} from "@/lib/tarotDraw";
import { getRitualPositionLayout } from "./ritual-layout";

const DRAW_POP_MS = 200;
const DRAW_ANIMATION_MS = 1050;
const REDUCED_DRAW_ANIMATION_MS = 200;
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
  isMajorArcana: boolean;
  positionName: string;
  from: RectSnapshot;
  to: RectSnapshot;
  initialRotate: number;
}

interface RitualSlotStyle extends CSSProperties {
  "--ritual-slot-x": string;
  "--ritual-slot-y": string;
}

const formatCount = (value: number) => String(value).padStart(2, "0");

const getFrameMetrics = (width: number) => ({
  padding: width * 0.05,
  outerRadius: width * 0.1,
  innerRadius: width * 0.0667,
});

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
  const overlayKeyRef = useRef(0);
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
  const canDraw =
    introComplete && !isShuffling && !isDrawing && !isComplete && deck.length > 0;
  const visibleDeckCardCount = Math.min(deck.length, VISIBLE_DECK_CARD_COUNT);
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const nextPosition = selectedSpread.positions[drawnCards.length] ?? null;
  const positionLayout = getRitualPositionLayout(selectedSpread.positions.length);
  const drawAnimationMs = shouldReduceMotion
    ? REDUCED_DRAW_ANIMATION_MS
    : DRAW_ANIMATION_MS;

  const handleShuffle = async () => {
    if (isShuffling || isDrawing || isRevealing || !introComplete) return;
    setIsShuffling(true);
    setHoveredDeckIndex(null);
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

  const handleDraw = async (params?: {
    cardIndex?: number;
    rotate?: number;
    targetElement?: HTMLElement;
  }) => {
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
    setHoveredDeckIndex(null);

    const nextDrawPosition = selectedSpread.positions[currentDrawnCards.length];
    const { drawnCard, remainingDeck } = drawRandomCardForPosition(
      currentDeck,
      nextDrawPosition?.id ?? "",
    );

    if (!drawnCard || !nextDrawPosition) {
      setIsDrawing(false);
      return;
    }

    const cardIndex = params?.cardIndex ?? 0;
    setExtractingDeckIndex(cardIndex);

    await new Promise((resolve) => window.setTimeout(resolve, DRAW_POP_MS));

    const isMajorArcana = drawnCard.card.arcana.toLowerCase().startsWith("major");
    const slotElement = slotRefs.current[nextDrawPosition.id];
    const slotRect = slotElement?.getBoundingClientRect();

    if (!slotElement || !slotRect) {
      setExtractingDeckIndex(null);
      setIsDrawing(false);
      return;
    }

    let startRect: RectSnapshot;
    if (params?.targetElement) {
      const boundingRect = params.targetElement.getBoundingClientRect();
      const width = params.targetElement.offsetWidth;
      const height = params.targetElement.offsetHeight;
      startRect = {
        left: boundingRect.left + boundingRect.width / 2 - width / 2,
        top: boundingRect.top + boundingRect.height / 2 - height / 2,
        width,
        height,
      };
    } else {
      const originElement = deckOriginRef.current;
      const originRect = originElement?.getBoundingClientRect();
      const width = originElement?.offsetWidth ?? slotElement.offsetWidth;
      const height = originElement?.offsetHeight ?? slotElement.offsetHeight;
      startRect = {
        left: (originRect?.left ?? window.innerWidth / 2) +
          (originRect?.width ?? 0) / 2 -
          width / 2,
        top: (originRect?.top ?? window.innerHeight / 2) +
          (originRect?.height ?? 0) / 2 -
          height / 2,
        width,
        height,
      };
    }

    overlayKeyRef.current += 1;
    setDrawOverlay({
      key: overlayKeyRef.current,
      isMajorArcana,
      positionName: nextDrawPosition.name,
      from: startRect,
      to: {
        left: slotRect.left,
        top: slotRect.top,
        width: slotElement.offsetWidth,
        height: slotElement.offsetHeight,
      },
      initialRotate: params?.rotate ?? 0,
    });

    await new Promise((resolve) => window.setTimeout(resolve, drawAnimationMs));

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

  const fromFrame = drawOverlay ? getFrameMetrics(drawOverlay.from.width) : null;
  const toFrame = drawOverlay ? getFrameMetrics(drawOverlay.to.width) : null;

  return (
    <section
      className="ritual-view-stage"
      onClick={() => {
        if (introPhase !== "done") {
          setIntroPhase("done");
        }
      }}
    >
      {drawOverlay && fromFrame && toFrame ? (
        <motion.div
          key={drawOverlay.key}
          initial={{
            left: drawOverlay.from.left,
            top: drawOverlay.from.top,
            width: drawOverlay.from.width,
            height: drawOverlay.from.height,
            padding: fromFrame.padding,
            borderRadius: fromFrame.outerRadius,
            rotate: drawOverlay.initialRotate,
            scale: 1,
            opacity: 0.96,
          }}
          animate={{
            left: [
              drawOverlay.from.left,
              (drawOverlay.from.left + drawOverlay.to.left) / 2,
              drawOverlay.to.left,
            ],
            top: [drawOverlay.from.top, drawOverlay.to.top - 84, drawOverlay.to.top],
            width: [
              drawOverlay.from.width,
              (drawOverlay.from.width + drawOverlay.to.width) / 2,
              drawOverlay.to.width,
            ],
            height: [
              drawOverlay.from.height,
              (drawOverlay.from.height + drawOverlay.to.height) / 2,
              drawOverlay.to.height,
            ],
            padding: [
              fromFrame.padding,
              (fromFrame.padding + toFrame.padding) / 2,
              toFrame.padding,
            ],
            borderRadius: [
              fromFrame.outerRadius,
              (fromFrame.outerRadius + toFrame.outerRadius) / 2,
              toFrame.outerRadius,
            ],
            rotate: [drawOverlay.initialRotate, drawOverlay.initialRotate * 0.4, 0],
            scale: [1, drawOverlay.isMajorArcana ? 1.16 : 1.1, 1],
            opacity: 1,
          }}
          transition={{
            duration: drawAnimationMs / 1000,
            ease: [0.16, 1, 0.3, 1],
            times: [0, 0.62, 1],
          }}
          className={cn(
            "ritual-fly-card",
            drawOverlay.isMajorArcana && "ritual-fly-card-major",
          )}
        >
          {drawOverlay.isMajorArcana ? (
            <motion.span
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0.72 }}
              animate={{ opacity: [0, 0.9, 0.62], scale: [0.72, 1.35, 1.05] }}
              transition={{
                duration: drawAnimationMs / 1000,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="ritual-fly-card-glow"
            />
          ) : null}
          <motion.div
            initial={{ borderRadius: fromFrame.innerRadius }}
            animate={{
              borderRadius: [
                fromFrame.innerRadius,
                (fromFrame.innerRadius + toFrame.innerRadius) / 2,
                toFrame.innerRadius,
              ],
            }}
            transition={{
              duration: drawAnimationMs / 1000,
              ease: [0.16, 1, 0.3, 1],
              times: [0, 0.62, 1],
            }}
            className="ritual-fly-card-inner"
          >
            <CardImage
              src={CARD_BACK_IMAGE}
              alt={`${drawOverlay.positionName} card back`}
              sizes={`${Math.ceil(drawOverlay.to.width)}px`}
              quality={50}
              priority
            />
          </motion.div>
        </motion.div>
      ) : null}

      <h1
        className={cn(
          "ritual-plaque",
          introPhase === "flying" && "ritual-intro-hidden",
        )}
        aria-label={`仪式 · ${selectedSpread.name}`}
      >
        <span className="ritual-plaque-segment ritual-plaque-kicker">
          <span
            aria-hidden="true"
            className={cn("ritual-status-dot", isComplete && "ritual-status-dot-done")}
          />
          仪式 · RITUAL
        </span>
        <span className="ritual-plaque-segment ritual-plaque-name">
          {selectedSpread.name}
        </span>
        <span className="ritual-plaque-segment ritual-plaque-count" aria-live="polite">
          {formatCount(drawnCards.length)} / {formatCount(selectedSpread.positions.length)}
        </span>
      </h1>

      <div className="ritual-altar">
        <div className="ritual-altar-rings" aria-hidden="true">
          <span className="ritual-altar-axis ritual-altar-axis-horizontal" />
          <span className="ritual-altar-axis ritual-altar-axis-vertical" />
          <span className="ritual-altar-ring" />
          <span className="ritual-altar-center-mark" />
          {Array.from({ length: VISIBLE_DECK_CARD_COUNT }, (_, index) => {
            const angle = (index / VISIBLE_DECK_CARD_COUNT) * 360;
            return (
              <span
                key={`fan-tick-${index}`}
                className="ritual-altar-tick"
                style={{ transform: `rotate(${angle}deg) translateY(calc((var(--ritual-ring-radius) + 10px) * -1))` }}
              />
            );
          })}
          {[0, 90, 180, 270].map((angle) => (
            <span
              key={`cardinal-tick-${angle}`}
              className="ritual-altar-tick ritual-altar-tick-cardinal"
              style={{ transform: `rotate(${angle}deg) translateY(calc((var(--ritual-ring-radius) + 10px) * -1))` }}
            />
          ))}
        </div>

        <ol
          data-testid="ritual-position-track"
          data-count={selectedSpread.positions.length}
          className={cn(
            "ritual-position-track",
            selectedSpread.positions.length >= 6 && "ritual-position-track-dense",
            introPhase === "flying" && "ritual-intro-hidden",
          )}
        >
          {selectedSpread.positions.map((position, index) => {
            const drawn = drawnCards.find((card) => card.positionId === position.id);
            const layout = positionLayout[index];
            const isCurrent = index === drawnCards.length;
            const slotStyle: RitualSlotStyle = {
              "--ritual-slot-x": `${layout?.x ?? 0}px`,
              "--ritual-slot-y": `${layout?.y ?? 0}px`,
            };

            return (
              <li
                key={position.id}
                className={cn(
                  "ritual-position",
                  layout?.labelAbove && "ritual-position-label-above",
                  drawn && "ritual-position-drawn",
                  isCurrent && "ritual-position-current",
                )}
                style={slotStyle}
                aria-current={isCurrent ? "step" : undefined}
              >
                <div
                  ref={(node) => {
                    slotRefs.current[position.id] = node;
                  }}
                  className={cn(
                    "ritual-slot",
                    drawn && "ritual-slot-filled",
                  )}
                >
                  {drawn ? (
                    <div className="ritual-slot-inner">
                      <CardImage
                        src={CARD_BACK_IMAGE}
                        alt={`${position.name} · 已归位的牌`}
                        sizes="(min-width: 900px) 72px, 56px"
                        quality={50}
                      />
                    </div>
                  ) : (
                    <span className="ritual-slot-hint">待归位</span>
                  )}
                </div>
                <span className="ritual-position-label">
                  <span className="ritual-position-index">{formatCount(index + 1)}</span>
                  <span className="ritual-position-name">{position.name}</span>
                </span>
              </li>
            );
          })}
        </ol>

        <div className="ritual-deck-field">
          <div ref={deckOriginRef} className="ritual-deck-origin" />
          {Array.from({ length: visibleDeckCardCount }).map(
            (_, index) => {
              const baseAngle = (index / VISIBLE_DECK_CARD_COUNT) * 360;
              const isKeyboardDrawTarget = index === visibleDeckCardCount - 1;
              const isExtracting = extractingDeckIndex === index;
              const isBeingFlown = drawOverlay !== null && isExtracting;
              const isHovered = hoveredDeckIndex === index;
              const isDimmed =
                !isShuffling &&
                (hoveredDeckIndex !== null || extractingDeckIndex !== null) &&
                !isHovered &&
                !isExtracting;
              const shouldPromoteDeckCard =
                introPhase !== "done" || isShuffling || isHovered || isExtracting;

              const randA = pseudoRandom(index + 1);
              const randB = pseudoRandom(index + 101);
              const randC = pseudoRandom(index + 202);
              const flyX = (randA - 0.5) * viewportWidth * 0.72;
              const flyY = -(viewportHeight * (0.9 + randB * 0.3));
              const flyRotate = baseAngle + (randC - 0.5) * 540;
              const pileX = (randC - 0.5) * 3;
              const pileY = -index * 0.5;
              const pileRotate = (randB - 0.5) * 5;

              const popOffset = isExtracting ? 36 : isHovered ? 20 : 0;
              const scaleValue = isExtracting ? 1.12 : isHovered ? 1.04 : 1;

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
                motionTarget = {
                  x: pileX,
                  y: pileY,
                  rotate: pileRotate,
                  scale: 1,
                  opacity: 1,
                };
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
                motionTarget = {
                  x: pileX,
                  y: pileY,
                  rotate: pileRotate,
                  scale: 1,
                  opacity: 1,
                };
                motionTransition = {
                  type: "spring",
                  stiffness: 170,
                  damping: 21,
                  delay: index * 0.004,
                };
              } else if (shufflePhase === "splitting") {
                motionTarget = {
                  x: splitX,
                  y: splitY,
                  rotate: splitRotate,
                  scale: 1,
                  opacity: 1,
                };
                motionTransition = { type: "spring", stiffness: 180, damping: 20 };
              } else if (shufflePhase === "riffling") {
                motionTarget = {
                  x: landX,
                  y: pileY,
                  rotate: landRotate,
                  scale: 1,
                  opacity: 1,
                };
                motionTransition = {
                  type: "spring",
                  stiffness: 220,
                  damping: 22,
                  delay: riffleOrder * 0.007,
                };
              } else if (shufflePhase === "refanning") {
                motionTarget = { x: 0, y: 0, rotate: baseAngle, scale: 1, opacity: 1 };
                motionTransition = {
                  type: "spring",
                  stiffness: 140,
                  damping: 17,
                  delay: index * 0.01,
                };
              } else if (isShuffling) {
                motionTarget = { x: 0, y: 0, rotate: baseAngle, scale: 1, opacity: 1 };
                motionTransition = { duration: 0 };
              } else {
                motionTarget = {
                  rotate: baseAngle,
                  x: popOffset
                    ? Math.sin(baseAngle * (Math.PI / 180)) * popOffset
                    : 0,
                  y: popOffset
                    ? -Math.cos(baseAngle * (Math.PI / 180)) * popOffset
                    : 0,
                  scale: scaleValue,
                  opacity: isBeingFlown ? 0 : isDimmed ? 0.4 : 1,
                };
                motionTransition = {
                  duration: isExtracting ? DRAW_POP_MS / 1000 : 0.8,
                  ease: "easeOut",
                  type: "spring",
                };
              }

              return (
                <motion.button
                  key={index}
                  type="button"
                  aria-label={isKeyboardDrawTarget ? "从牌堆抽牌" : undefined}
                  aria-hidden={isKeyboardDrawTarget ? undefined : true}
                  tabIndex={isKeyboardDrawTarget ? 0 : -1}
                  data-testid="deck-card"
                  data-deck-index={index}
                  initial={
                    introPhase === "flying"
                      ? {
                          x: flyX,
                          y: flyY,
                          rotate: flyRotate,
                          scale: 1.06,
                          opacity: 0,
                        }
                      : false
                  }
                  animate={motionTarget}
                  transition={motionTransition}
                  className={cn(
                    "deck-card ritual-deck-card",
                    shouldPromoteDeckCard && "ritual-deck-card-animating",
                  )}
                  style={{
                    zIndex: isExtracting
                      ? 90
                      : isHovered
                        ? 80
                        : shufflePhase === "riffling"
                          ? 10 + riffleOrder
                          : 10 + index,
                  }}
                  onPointerEnter={() => {
                    if (canDraw) setHoveredDeckIndex(index);
                  }}
                  onPointerDown={(event) => {
                    if (!isKeyboardDrawTarget) event.preventDefault();
                  }}
                  onPointerLeave={() => {
                    setHoveredDeckIndex((currentIndex) =>
                      currentIndex === index ? null : currentIndex,
                    );
                  }}
                  onFocus={() => {
                    if (canDraw) setHoveredDeckIndex(index);
                  }}
                  onBlur={() => {
                    setHoveredDeckIndex((currentIndex) =>
                      currentIndex === index ? null : currentIndex,
                    );
                  }}
                  onClick={(event) => {
                    void handleDraw({
                      cardIndex: index,
                      targetElement: event.currentTarget,
                      rotate: baseAngle,
                    });
                  }}
                  disabled={!canDraw}
                >
                  <div className="ritual-deck-card-inner">
                    <CardImage
                      src={CARD_BACK_IMAGE}
                      alt=""
                      sizes="(min-width: 900px) 120px, 90px"
                      quality={50}
                      priority={isKeyboardDrawTarget}
                      className={cn(
                        "ritual-deck-card-image",
                        isExtracting && "ritual-deck-card-image-extracting",
                        isHovered && "ritual-deck-card-image-hovered",
                      )}
                    />
                  </div>
                </motion.button>
              );
            },
          )}
        </div>
      </div>

      <div
        className={cn(
          "ritual-actions",
          introPhase === "flying" && "ritual-intro-hidden",
        )}
      >
        <button
          type="button"
          onClick={() => void handleShuffle()}
          disabled={isShuffling || isDrawing || isComplete || !introComplete}
          className="ritual-action-button ritual-action-button-quiet"
        >
          <LegacyIcon
            name="refresh"
            className={cn("ritual-action-icon", isShuffling && "animate-spin")}
          />
          <span>{isShuffling ? "洗牌中" : "洗牌"}</span>
        </button>
        <button
          type="button"
          onClick={() => void handleDraw()}
          disabled={!canDraw}
          className="ritual-action-button ritual-action-button-draw"
        >
          抽取一张牌
        </button>
        {isComplete ? (
          <button
            type="button"
            onClick={handleReveal}
            disabled={isNavigatingToReveal}
            className="ritual-action-button ritual-action-button-reveal"
          >
            {isNavigatingToReveal ? "正在揭示..." : "揭示牌阵"}
          </button>
        ) : null}
      </div>

      <div
        className={cn(
          "ritual-table-note",
          isComplete && "ritual-table-note-ready",
          introPhase === "flying" && "ritual-intro-hidden",
        )}
        role="status"
        aria-live="polite"
      >
        <span className="ritual-note-label">
          {nextPosition ? `当前槽位 · ${nextPosition.name}` : "就绪 · READY"}
        </span>
        <span className="ritual-note-text">
          {nextPosition ? nextPosition.description : "全部位置已归位，可以揭示牌阵。"}
        </span>
      </div>

      {introPhase !== "done" ? (
        <span className="ritual-skip-hint">点击任意处跳过入场</span>
      ) : null}
    </section>
  );
}
