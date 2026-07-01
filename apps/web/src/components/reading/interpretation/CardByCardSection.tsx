"use client";

import Link from "next/link";
import { motion } from "motion/react";
import CardImage from "@/components/ui/CardImage";
import type { DrawnCard, ReadingCardResult } from "@aethertarot/shared-types";
import { cn } from "@/lib/utils";

interface CardByCardSectionProps {
  readingCards: ReadingCardResult[];
  drawnCards: DrawnCard[];
}

export function CardByCardSection({ readingCards, drawnCards }: CardByCardSectionProps) {
  return (
    <section id="reading-cards" className="reading-card scroll-mt-32 space-y-5">
      <div>
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
          逐牌
        </p>
        <h2 className="mt-1 font-serif text-xl md:text-2xl text-ink">逐牌展开</h2>
      </div>
      <div className="space-y-5">
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

          return (
            <motion.article
              key={`${card.position_id}-${card.card_id}`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className={cn(
                "rounded-2xl border bg-paper p-5 transition-all duration-200",
                isReversed ? "border-indigo/15" : "border-paper-border"
              )}
            >
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                {drawnCard ? (
                  <div className="mx-auto w-[140px] shrink-0 overflow-hidden rounded-card-md border border-paper-border shadow-sm md:mx-0 md:w-[180px]">
                    <CardImage
                      src={drawnCard.card.thumbnailUrl ?? drawnCard.card.imageUrl}
                      alt={drawnCard.card.name}
                      sizes="(min-width: 768px) 180px, 140px"
                      quality={75}
                      isReversed={drawnCard.isReversed}
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip-warm text-[10px]">{card.position}</span>
                    <span className="font-sans text-[11px] font-medium text-text-muted">
                      {card.orientation === "reversed" ? "逆位" : "正位"}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-serif text-xl text-ink">
                      <Link
                        href={`/encyclopedia?card=${encodeURIComponent(card.card_id)}`}
                        className="underline-offset-4 transition hover:text-terracotta hover:underline"
                      >
                        {card.name}
                      </Link>
                    </h3>
                    <p className="text-sm text-text-muted">{card.english_name}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="border-l-2 border-paper-border pl-4">
                      <h4 className="font-sans text-[10px] font-medium uppercase tracking-wider text-text-muted opacity-80">
                        看到什么
                      </h4>
                      {evidenceKeywords.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {evidenceKeywords.map((keyword) => (
                            <span
                              key={`${card.position_id}-${keyword}`}
                              className="rounded-full border border-paper-border bg-paper px-2 py-1 font-sans text-[11px] text-text-muted"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 font-sans text-xs text-text-muted">暂无线索</p>
                      )}
                    </div>
                    <div className="border-l-2 border-terracotta/20 pl-4">
                      <h4 className="font-sans text-[10px] font-medium uppercase tracking-wider text-text-muted opacity-80">
                        它代表着...
                      </h4>
                      <p className="mt-2 font-sans text-sm leading-relaxed text-text-body">
                        {card.position_meaning}
                      </p>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "border-l-2 py-3 pl-4 pr-3 rounded-r-lg transition-colors duration-200",
                      isReversed
                        ? "border-indigo/30 bg-indigo/5"
                        : "border-terracotta/30 bg-terracotta/5"
                    )}
                  >
                    <h4
                      className={cn(
                        "mb-2 font-sans text-[10px] font-medium uppercase tracking-wider opacity-80",
                        isReversed ? "text-indigo" : "text-terracotta"
                      )}
                    >
                      这意味着什么
                    </h4>
                    <p className="font-serif text-[17px] leading-[1.85] text-text-body">
                      {card.interpretation}
                    </p>
                  </div>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
