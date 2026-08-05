"use client";

import { motion, useReducedMotion } from "motion/react";
import CardImage from "@/components/ui/CardImage";
import { cn } from "@/lib/utils";
import { getSpreadLayout } from "./spreadLayout";
import type { DrawnCard } from "@aethertarot/shared-types";

interface SpreadHeroGridProps {
  spreadId: string;
  drawnCards: DrawnCard[];
  positionNames: string[];
}

const BASE_ITEM = "flex flex-col items-center";

export function SpreadHeroGrid({
  spreadId,
  drawnCards,
  positionNames,
}: SpreadHeroGridProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const layout = getSpreadLayout(spreadId, drawnCards.length);

  return (
    <section data-testid="hero-spread-display" aria-label="整组牌阵" className="my-2 border-y border-paper-border py-7 md:my-4">
      <p className="manuscript-label mb-5">THE SPREAD</p>
      <ol className={cn("list-none", layout.container)}>
        {drawnCards.map((drawnCard, index) => {
          const position = positionNames[index] ?? `位置 ${index + 1}`;
          const orientationLabel = drawnCard.isReversed ? "逆位" : "正位";

          return (
            <motion.li
              key={`hero-${drawnCard.positionId}`}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.45,
                delay: shouldReduceMotion ? 0 : index * 0.08,
                ease: "easeOut",
              }}
              className={cn(BASE_ITEM, layout.itemClass(index))}
            >
              <div
                className={cn(
                  "aspect-[1/1.7] w-full overflow-hidden border border-paper-border bg-paper-raised",
                  layout.isEmphasized(index) && "border-terracotta/25",
                )}
              >
                <CardImage
                  src={drawnCard.card.thumbnailUrl ?? drawnCard.card.imageUrl}
                  alt={`${drawnCard.card.name}，${position}，${orientationLabel}`}
                  sizes="(min-width: 1024px) 160px, (min-width: 768px) 130px, 96px"
                  quality={75}
                  loading={index === 0 ? "eager" : "lazy"}
                  isReversed={drawnCard.isReversed}
                />
              </div>
              <p className="mt-3 text-center font-mono text-[10px] font-semibold tracking-[0.08em] text-text-muted">
                {position}
              </p>
              <p className="mt-0.5 text-center font-serif text-[13px] text-ink">
                {drawnCard.card.name}
              </p>
              <span
                className={cn(
                  "mt-0.5 font-sans text-[10px]",
                  drawnCard.isReversed ? "text-indigo-ink" : "text-text-muted",
                )}
              >
                {orientationLabel}
              </span>
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
