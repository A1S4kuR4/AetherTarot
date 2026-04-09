"use client";

import { useState } from "react";
import { getAllCards } from "@aethertarot/domain-tarot";
import type { TarotCard } from "@aethertarot/shared-types";
import { cn } from "@/lib/utils";

const tarotCards = getAllCards();

export default function EncyclopediaView() {
  const [selectedCard, setSelectedCard] = useState<TarotCard>(tarotCards[0]);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 lg:flex-row lg:px-8">
      {/* Card Grid */}
      <div className="w-full space-y-6 lg:w-1/3">
        <header>
          <h1 className="mb-1 font-serif text-3xl font-semibold text-ink md:text-4xl">
            塔罗百科
          </h1>
          <p className="font-sans text-sm text-text-muted">
            探索 78 张塔罗牌的象征与含义
          </p>
        </header>

        <div className="grid max-h-[60vh] grid-cols-4 gap-2.5 overflow-y-auto pr-2 md:grid-cols-6 lg:grid-cols-4">
          {tarotCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setSelectedCard(card)}
              className={cn(
                "aspect-[2/3] cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-200",
                selectedCard.id === card.id
                  ? "scale-[1.04] border-terracotta shadow-sm"
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

      {/* Card Detail */}
      <div className="flex-1 rounded-3xl border border-paper-border bg-paper-raised p-8 md:p-10">
        <div className="flex flex-col gap-10 md:flex-row">
          {/* Card Image */}
          <div className="w-full md:w-5/12">
            <div className="relative aspect-[2/3.4] overflow-hidden rounded-2xl border border-paper-border shadow-sm">
              <img
                src={selectedCard.imageUrl}
                alt={selectedCard.name}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          {/* Card Info */}
          <div className="flex-1 space-y-7">
            <div>
              <span className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
                {selectedCard.arcana} · {selectedCard.element}
              </span>
              <h2 className="mt-1.5 font-serif text-4xl text-ink">
                {selectedCard.name}
              </h2>
              <p className="font-serif text-lg text-text-accent">
                {selectedCard.englishName}
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <h4 className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
                描述
              </h4>
              <p className="text-base leading-[1.8] text-text-body">
                {selectedCard.description}
              </p>
            </div>

            {/* Keywords Grid */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <h4 className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-terracotta">
                  正位关键词
                </h4>
                <ul className="space-y-1.5">
                  {selectedCard.uprightKeywords.map((keyword) => (
                    <li
                      key={keyword}
                      className="flex items-center gap-2 text-sm text-text-body"
                    >
                      <span className="h-1 w-1 rounded-full bg-terracotta/50" />
                      {keyword}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2.5">
                <h4 className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-accent">
                  逆位关键词
                </h4>
                <ul className="space-y-1.5">
                  {selectedCard.reversedKeywords.map((keyword) => (
                    <li
                      key={keyword}
                      className="flex items-center gap-2 text-sm text-text-body"
                    >
                      <span className="h-1 w-1 rounded-full bg-text-accent/50" />
                      {keyword}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Symbolism */}
            <div className="space-y-2.5">
              <h4 className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
                象征意义
              </h4>
              <ul className="space-y-2">
                {selectedCard.symbolism.map((symbolism, index) => (
                  <li
                    key={`${selectedCard.id}-${index}`}
                    className="border-l-2 border-paper-border pl-4 text-sm leading-relaxed text-text-muted"
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
