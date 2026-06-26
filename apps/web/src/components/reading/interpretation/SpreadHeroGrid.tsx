"use client";

import { motion } from "motion/react";
import CardImage from "@/components/ui/CardImage";
import type { DrawnCard } from "@aethertarot/shared-types";

interface SpreadHeroGridProps {
  drawnCards: DrawnCard[];
  positionNames: string[];
}

export function SpreadHeroGrid({ drawnCards, positionNames }: SpreadHeroGridProps) {
  return (
    <section
      data-testid="hero-spread-display"
      className="my-2 md:my-6"
    >
      <div className="flex flex-wrap items-end justify-center gap-4 md:gap-5 lg:gap-6">
        {drawnCards.map((drawnCard, index) => {
          const position = positionNames[index] ?? `位置 ${index + 1}`;

          return (
            <motion.div
              key={`hero-${drawnCard.positionId}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.12, ease: "easeOut" }}
              className="flex w-[100px] flex-col items-center sm:w-[120px] md:w-[140px] lg:w-[150px]"
            >
              <div className="card-hero-glow aspect-[1/1.7] w-full overflow-hidden rounded-card-md border border-paper-border bg-paper-raised">
                <CardImage
                  src={drawnCard.card.thumbnailUrl ?? drawnCard.card.imageUrl}
                  alt={drawnCard.card.name}
                  sizes="(min-width: 1024px) 150px, (min-width: 768px) 140px, (min-width: 640px) 120px, 100px"
                  quality={75}
                  isReversed={drawnCard.isReversed}
                />
              </div>
              <p className="mt-2 text-center font-sans text-[11px] font-medium text-text-muted">
                {position}
              </p>
              <p className="mt-0.5 text-center font-serif text-[13px] text-ink">
                {drawnCard.card.name}
              </p>
              <span className="mt-0.5 font-sans text-[10px] text-text-muted">
                {drawnCard.isReversed ? "逆位" : "正位"}
              </span>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
