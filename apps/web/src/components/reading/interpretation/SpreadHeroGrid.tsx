"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import CardImage from "@/components/ui/CardImage";
import { cn } from "@/lib/utils";
import { getSpreadFieldMetrics, getSpreadLayout } from "./spreadLayout";
import { ChapterNumber } from "./ChapterNumber";
import type { DrawnCard } from "@aethertarot/shared-types";

interface SpreadHeroGridProps {
  spreadId: string;
  spreadName: string;
  spreadNote: string;
  drawnCards: DrawnCard[];
  positionNames: string[];
  chapterLabel?: string;
}

export function SpreadHeroGrid({
  spreadId,
  spreadName,
  spreadNote,
  drawnCards,
  positionNames,
  chapterLabel,
}: SpreadHeroGridProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(0);
  const layout = getSpreadLayout(spreadId, drawnCards.length);
  const metrics = getSpreadFieldMetrics(layout);
  const scale = stageWidth > 0 ? Math.min(1, stageWidth / metrics.fieldWidth) : 1;
  const ringSize = Math.min(metrics.fieldWidth, metrics.fieldHeight);

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    const updateWidth = () => setStageWidth(stage.clientWidth);
    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="reading-spread"
      data-testid="hero-spread-display"
      aria-label="整组牌阵"
      className="scroll-mt-32"
    >
      <ChapterNumber value={chapterLabel} />
      <h2 className="reading-section-title">整组牌阵</h2>
      <div className="reading-spread-plate">
        <div className="reading-spread-plate-head">
          <span className="reading-spread-plate-title">{spreadName}</span>
        </div>
        <div
          ref={stageRef}
          className="reading-spread-stage"
          style={{ height: `${Math.round(metrics.fieldHeight * scale)}px` }}
        >
          <div
            className="reading-spread-field"
            style={{
              width: `${metrics.fieldWidth}px`,
              height: `${metrics.fieldHeight}px`,
              transform: `translate(-50%, -50%) scale(${scale})`,
            }}
          >
            <span
              aria-hidden="true"
              className="reading-spread-ring reading-spread-ring-inner"
              style={{ width: `${ringSize * 0.72}px`, height: `${ringSize * 0.72}px` }}
            />
            <span
              aria-hidden="true"
              className="reading-spread-ring"
              style={{ width: `${ringSize * 0.94}px`, height: `${ringSize * 0.94}px` }}
            />
            <ol className="list-none">
              {drawnCards.map((drawnCard, index) => {
                const point = layout.points[index] ?? { x: 0, y: 0 };
                const position = positionNames[index] ?? `位置 ${index + 1}`;
                const orientationLabel = drawnCard.isReversed ? "逆位" : "正位";
                const isMajor = drawnCard.card.arcana?.toLowerCase().startsWith("major");
                const labelAbove = point.y < 0 || Boolean(point.rotate);
                const zIndex = spreadId === "celtic-cross" && index < 2 ? 20 + index * 10 : undefined;
                const slotStyle = {
                  left: `calc(50% + ${point.x}px)`,
                  top: `calc(50% + ${point.y}px)`,
                  zIndex,
                } satisfies CSSProperties;

                return (
                  <li
                    key={`hero-${drawnCard.positionId}`}
                    className="reading-altar-slot"
                    data-label-above={labelAbove ? "true" : undefined}
                    style={slotStyle}
                  >
                    <motion.div
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.6,
                        delay: shouldReduceMotion ? 0 : index * 0.08,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="reading-altar-slot-content"
                    >
                      <div
                        className={cn(
                          "reading-altar-card",
                          isMajor && "reading-altar-card-major",
                          point.rotate && "reading-altar-card-cross",
                        )}
                        style={{ width: `${layout.cardWidth}px` }}
                      >
                        <CardImage
                          src={drawnCard.card.thumbnailUrl ?? drawnCard.card.imageUrl}
                          alt={`${drawnCard.card.name}，${position}，${orientationLabel}`}
                          sizes={`${layout.cardWidth}px`}
                          quality={75}
                          loading={index === 0 ? "eager" : "lazy"}
                          isReversed={drawnCard.isReversed}
                          className="h-full w-full object-cover"
                        />
                        {drawnCard.isReversed ? (
                          <span className="reading-reversed-badge">逆位</span>
                        ) : null}
                      </div>
                      <p className="reading-altar-position">
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <strong>{position}</strong>
                      </p>
                    </motion.div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
        <p className="reading-spread-note">
          <strong>牌阵注记 — </strong>{spreadNote}
        </p>
      </div>
    </section>
  );
}
