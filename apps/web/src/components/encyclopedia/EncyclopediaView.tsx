"use client";

import { useState } from "react";
import { TAROT_CARDS } from "@/constants";
import { cn } from "@/lib/utils";
import type { TarotCard } from "@/types";

export default function EncyclopediaView() {
  const [selectedCard, setSelectedCard] = useState<TarotCard>(TAROT_CARDS[0]);

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-12 p-8 lg:flex-row lg:p-12">
      <div className="w-full space-y-8 lg:w-1/3">
        <header>
          <h1 className="mb-2 font-serif text-4xl text-secondary">塔罗百科</h1>
          <p className="text-sm uppercase tracking-widest text-on-surface-variant opacity-80">
            Tarot Encyclopedia
          </p>
        </header>

        <div className="grid max-h-[60vh] grid-cols-4 gap-3 overflow-y-auto pr-4 md:grid-cols-6 lg:grid-cols-4">
          {TAROT_CARDS.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setSelectedCard(card)}
              className={cn(
                "aspect-[2/3] cursor-pointer overflow-hidden rounded-lg border-2 transition-all duration-300",
                selectedCard.id === card.id
                  ? "scale-105 border-secondary-fixed shadow-lg shadow-secondary-fixed/20"
                  : "border-transparent opacity-60 hover:opacity-100",
              )}
            >
              <img
                src={card.imageUrl}
                alt={card.name}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel flex-1 rounded-3xl border border-outline-variant/10 p-8 md:p-12">
        <div className="flex flex-col gap-12 md:flex-row">
          <div className="w-full md:w-1/2">
            <div className="relative aspect-[2/3.5] overflow-hidden rounded-2xl border border-secondary-fixed/20 shadow-2xl">
              <img
                src={selectedCard.imageUrl}
                alt={selectedCard.name}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
            </div>
          </div>

          <div className="flex-1 space-y-8">
            <div>
              <span className="font-label text-xs uppercase tracking-widest text-secondary-fixed/60">
                {selectedCard.arcana} • {selectedCard.element}
              </span>
              <h2 className="mt-2 font-serif text-5xl text-secondary">
                {selectedCard.name}
              </h2>
              <p className="font-serif text-xl italic text-primary/60">
                {selectedCard.englishName}
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                Description
              </h4>
              <p className="leading-relaxed text-on-surface-variant">
                {selectedCard.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <h4 className="font-label text-xs uppercase tracking-widest text-secondary-fixed">
                  Upright Keywords
                </h4>
                <ul className="space-y-1">
                  {selectedCard.uprightKeywords.map((keyword) => (
                    <li
                      key={keyword}
                      className="flex items-center gap-2 text-sm text-on-surface"
                    >
                      <span className="h-1 w-1 rounded-full bg-secondary-fixed" />
                      {keyword}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-label text-xs uppercase tracking-widest text-primary">
                  Reversed Keywords
                </h4>
                <ul className="space-y-1">
                  {selectedCard.reversedKeywords.map((keyword) => (
                    <li
                      key={keyword}
                      className="flex items-center gap-2 text-sm text-on-surface"
                    >
                      <span className="h-1 w-1 rounded-full bg-primary" />
                      {keyword}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                Symbolism
              </h4>
              <ul className="space-y-2">
                {selectedCard.symbolism.map((symbolism, index) => (
                  <li
                    key={`${selectedCard.id}-${index}`}
                    className="border-l border-outline-variant/30 pl-4 text-sm italic text-on-surface-variant/80"
                  >
                    {symbolism}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
