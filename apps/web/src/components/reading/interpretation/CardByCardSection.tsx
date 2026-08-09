"use client";

import Link from "next/link";
import CardImage from "@/components/ui/CardImage";
import type { DrawnCard, ReadingCardResult } from "@aethertarot/shared-types";
import { cn } from "@/lib/utils";
import { ChapterNumber } from "./ChapterNumber";

interface CardByCardSectionProps {
  readingCards: ReadingCardResult[];
  drawnCards: DrawnCard[];
  chapterLabel?: string;
}

export function CardByCardSection({
  readingCards,
  drawnCards,
  chapterLabel,
}: CardByCardSectionProps) {
  return (
    <section id="reading-cards" className="scroll-mt-32">
      <ChapterNumber value={chapterLabel} />
      <h2 className="reading-section-title">逐牌展开</h2>
      <div>
        {readingCards.map((card, index) => {
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
          const isMajor = drawnCard?.card.arcana?.toLowerCase().startsWith("major");

          return (
            <article
              key={`${card.position_id}-${card.card_id}`}
              className="reading-card-entry"
            >
              {drawnCard ? (
                <div
                  data-testid="reading-card-image-frame"
                  className={cn(
                    "reading-card-entry-thumb",
                    isMajor && "reading-card-entry-thumb-major",
                  )}
                >
                  <CardImage
                    src={drawnCard.card.thumbnailUrl ?? drawnCard.card.imageUrl}
                    alt={`${drawnCard.card.name}，${card.position}，${orientationLabel}`}
                    sizes="(min-width: 900px) 152px, (min-width: 640px) 132px, 84px"
                    quality={75}
                    isReversed={drawnCard.isReversed}
                    className="h-full w-full object-cover"
                  />
                  {drawnCard.isReversed ? (
                    <span className="reading-reversed-badge">逆位</span>
                  ) : null}
                </div>
              ) : null}
              <div className="min-w-0">
                <p className="reading-card-entry-meta">
                  {String(index + 1).padStart(2, "0")}
                  <span className="mx-1.5 text-paper-border">·</span>
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
                <p className="reading-card-entry-interpretation">
                  {card.interpretation}
                </p>
                <p className="reading-card-entry-keywords">
                  {evidenceKeywords.length > 0
                    ? evidenceKeywords.join(" · ")
                    : "暂无线索"}
                </p>
                <p className="reading-card-entry-position-note">
                  <span>牌位</span>{card.position_meaning}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
