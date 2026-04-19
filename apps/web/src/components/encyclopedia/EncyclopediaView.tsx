"use client";

import { useMemo, useState } from "react";
import { getAllCards } from "@aethertarot/domain-tarot";
import type { TarotCard } from "@aethertarot/shared-types";
import type { EncyclopediaCoverageSummary } from "@/server/encyclopedia/coverage";
import { cn } from "@/lib/utils";

const tarotCards = getAllCards();

type RuntimeFilter = "all" | "major" | "wands" | "cups";

const FILTERS: Array<{
  id: RuntimeFilter;
  label: string;
  predicate: (card: TarotCard) => boolean;
}> = [
  {
    id: "all",
    label: "全部",
    predicate: () => true,
  },
  {
    id: "major",
    label: "大阿卡纳",
    predicate: (card) => card.arcana === "major",
  },
  {
    id: "wands",
    label: "权杖",
    predicate: (card) => card.arcana === "minor" && card.element === "Fire",
  },
  {
    id: "cups",
    label: "圣杯",
    predicate: (card) => card.arcana === "minor" && card.element === "Water",
  },
];

function getFilterCount(filterId: RuntimeFilter) {
  return tarotCards.filter(
    FILTERS.find((filter) => filter.id === filterId)?.predicate ?? (() => true),
  ).length;
}

export default function EncyclopediaView({
  coverage,
}: {
  coverage: EncyclopediaCoverageSummary;
}) {
  const [selectedCard, setSelectedCard] = useState<TarotCard>(tarotCards[0]);
  const [runtimeFilter, setRuntimeFilter] = useState<RuntimeFilter>("all");
  const visibleCards = useMemo(() => {
    const activeFilter = FILTERS.find((filter) => filter.id === runtimeFilter);
    return tarotCards.filter(activeFilter?.predicate ?? (() => true));
  }, [runtimeFilter]);

  const isSelectedCardVisible = visibleCards.some((card) => card.id === selectedCard.id);
  const activeCard = isSelectedCardVisible ? selectedCard : visibleCards[0] ?? tarotCards[0];

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 lg:flex-row lg:px-8">
      {/* Card Grid */}
      <div className="w-full space-y-6 lg:w-1/3">
        <header>
          <h1 className="mb-1 font-serif text-3xl font-semibold text-ink md:text-4xl">
            塔罗百科
          </h1>
          <p className="font-sans text-sm text-text-muted">
            当前页面展示的是已接入运行时的牌库；runtime / knowledge 的当前覆度请以下方状态为准。
          </p>
        </header>

        <div className="rounded-3xl border border-paper-border bg-paper-raised p-5 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-lg text-terracotta">
              stacks
            </span>
            <h2 className="font-serif text-lg text-ink">覆度状态</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-paper-border bg-paper p-4">
              <p className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
                Runtime
              </p>
              <p className="mt-2 font-serif text-2xl text-ink">
                {coverage.runtimeCards} / 78
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                当前已接入 {coverage.runtimeMajor} 张大阿卡纳、{coverage.runtimeBySuit.wands} 张权杖、{coverage.runtimeBySuit.cups} 张圣杯。
              </p>
            </div>
            <div className="rounded-2xl border border-paper-border bg-paper p-4">
              <p className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
                Knowledge
              </p>
              <p className="mt-2 font-serif text-2xl text-ink">
                {coverage.knowledgeCards} / 78
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                知识页已完整，另有 {coverage.knowledgeConcepts} 个概念页与 {coverage.knowledgeSpreads} 个牌阵页。
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-terracotta/15 bg-terracotta/5 px-4 py-3">
            <p className="text-xs leading-relaxed text-text-body">
              当前百科仍直接消费 runtime deck JSON。这一版先把“已接入运行时”与“知识层已完成”明确分开；后续若接入 `knowledge/wiki`，应作为独立的下一阶段对齐工作推进。
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
            Runtime 过滤
          </h2>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => {
                  setRuntimeFilter(filter.id);
                  const nextVisibleCards = tarotCards.filter(filter.predicate);
                  if (!nextVisibleCards.some((card) => card.id === activeCard.id)) {
                    setSelectedCard(nextVisibleCards[0] ?? tarotCards[0]);
                  }
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-all",
                  runtimeFilter === filter.id
                    ? "border-terracotta/40 bg-terracotta/10 text-terracotta"
                    : "border-paper-border bg-paper-raised text-text-muted hover:text-ink",
                )}
              >
                {filter.label} ({getFilterCount(filter.id)})
              </button>
            ))}
          </div>
        </div>

        <div className="grid max-h-[60vh] grid-cols-4 gap-2.5 overflow-y-auto pr-2 md:grid-cols-6 lg:grid-cols-4">
          {visibleCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setSelectedCard(card)}
              className={cn(
                "aspect-[1/1.7] cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-200",
                activeCard.id === card.id
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
            <div className="relative aspect-[1/1.7] overflow-hidden rounded-2xl border border-paper-border shadow-sm">
              <img
                src={activeCard.imageUrl}
                alt={activeCard.name}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          {/* Card Info */}
          <div className="flex-1 space-y-7">
            <div>
              <span className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
                {activeCard.arcana} · {activeCard.element}
              </span>
              <h2 className="mt-1.5 font-serif text-4xl text-ink">
                {activeCard.name}
              </h2>
              <p className="font-serif text-lg text-text-accent">
                {activeCard.englishName}
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <h4 className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
                描述
              </h4>
              <p className="text-base leading-[1.8] text-text-body">
                {activeCard.description}
              </p>
            </div>

            {/* Keywords Grid */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <h4 className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-terracotta">
                  正位关键词
                </h4>
                <ul className="space-y-1.5">
                  {activeCard.uprightKeywords.map((keyword) => (
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
                  {activeCard.reversedKeywords.map((keyword) => (
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
                {activeCard.symbolism.map((symbolism, index) => (
                  <li
                    key={`${activeCard.id}-${index}`}
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
