"use client";

import Link from "next/link";
import CardImage from "@/components/ui/CardImage";
import type { DrawnCard, ReadingCardResult } from "@aethertarot/shared-types";
import { cn } from "@/lib/utils";

interface CardByCardSectionProps {
  readingCards: ReadingCardResult[];
  drawnCards: DrawnCard[];
}

export function CardByCardSection({ readingCards, drawnCards }: CardByCardSectionProps) {
  return (
    <section id="reading-cards" className="scroll-mt-32">
      <h2 className="font-serif text-2xl text-ink md:text-[26px]">逐牌展开</h2>
      <div>
        {readingCards.map((card) => {
          const drawnCard = drawnCards.find(
            (item) => item.positionId === card.position_id,
          );
          const evidenceKeywords = drawnCard
            ? (
                drawnCard.isReversed
                  ? drawnCard.card.reversedKeywords
                  : drawnCard.card.uprightKeywords
              ).slice(0, 3)
            : [];

          const isReversed = card.orientation === "reversed";
          const orientationLabel = isReversed ? "逆位" : "正位";

          return (
            <article
              key={`${card.position_id}-${card.card_id}`}
              className="grid grid-cols-[92px_1fr] gap-x-4 gap-y-4 border-t border-paper-border/60 py-8 first:border-t-0 first:pt-6 sm:grid-cols-[140px_1fr] sm:gap-x-6 md:grid-cols-[160px_1fr] md:gap-x-8"
            >
              {drawnCard ? (
                <div className="row-span-3 w-full overflow-hidden rounded-card-md border border-paper-border shadow-sm">
                  <CardImage
                    src={drawnCard.card.thumbnailUrl ?? drawnCard.card.imageUrl}
                    alt={`${drawnCard.card.name}，${card.position}，${orientationLabel}`}
                    sizes="(min-width: 768px) 160px, (min-width: 640px) 140px, 92px"
                    quality={75}
                    isReversed={drawnCard.isReversed}
                  />
                </div>
              ) : null}
              <div className="min-w-0">
                <p className="font-sans text-[13px] text-text-muted">
                  {card.position}
                  <span className="mx-1.5 text-paper-border">·</span>
                  <span className={isReversed ? "text-indigo-ink" : undefined}>
                    {orientationLabel}
                  </span>
                </p>
                <h3 className="mt-1.5 font-serif text-xl text-ink">
                  <Link
                    href={`/encyclopedia?card=${encodeURIComponent(card.card_id)}`}
                    className="inline-flex min-h-11 items-center underline-offset-4 transition-colors hover:text-text-accent hover:underline"
                  >
                    {card.name}
                  </Link>
                  <span className="ml-2 align-middle font-sans text-xs font-normal text-text-muted">
                    {card.english_name}
                  </span>
                </h3>
              </div>
              <div className="min-w-0">
                <h4
                  className={cn(
                    "font-sans text-[13px] font-semibold",
                    isReversed ? "text-indigo-ink" : "text-text-accent",
                  )}
                >
                  这意味着什么
                </h4>
                <p className="mt-2 font-serif text-[16px] leading-[1.85] text-text-body md:text-[17px]">
                  {card.interpretation}
                </p>
              </div>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2 sm:gap-6">
                <div>
                  <h4 className="font-sans text-[13px] font-semibold text-text-muted">
                    看到什么
                  </h4>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
                    {evidenceKeywords.length > 0
                      ? evidenceKeywords.join(" · ")
                      : "暂无线索"}
                  </p>
                </div>
                <div>
                  <h4 className="font-sans text-[13px] font-semibold text-text-muted">
                    它代表着…
                  </h4>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
                    {card.position_meaning}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
