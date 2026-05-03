"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getAllCards } from "@aethertarot/domain-tarot";
import type { TarotCard } from "@aethertarot/shared-types";
import type { EncyclopediaCoverageSummary } from "@/server/encyclopedia/coverage";
import { cn } from "@/lib/utils";
import LegacyIcon from "@/components/ui/LegacyIcon";
import EncyclopediaQuestionPanel from "@/components/encyclopedia/EncyclopediaQuestionPanel";

const tarotCards = getAllCards();

type RuntimeFilter = "all" | "major" | "wands" | "cups" | "swords" | "pentacles";

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
    predicate: (card) => card.arcana.startsWith("Major Arcana"),
  },
  {
    id: "wands",
    label: "权杖",
    predicate: (card) => card.arcana.startsWith("Minor Arcana") && card.element === "Fire",
  },
  {
    id: "cups",
    label: "圣杯",
    predicate: (card) => card.arcana.startsWith("Minor Arcana") && card.element === "Water",
  },
  {
    id: "swords",
    label: "宝剑",
    predicate: (card) => card.arcana.startsWith("Minor Arcana") && card.element === "Air",
  },
  {
    id: "pentacles",
    label: "星币",
    predicate: (card) => card.arcana.startsWith("Minor Arcana") && card.element === "Earth",
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
  const [searchTerm, setSearchTerm] = useState("");
  const detailRef = useRef<HTMLElement>(null);

  const visibleCards = useMemo(() => {
    const activeFilter = FILTERS.find((filter) => filter.id === runtimeFilter);
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return tarotCards.filter((card) => {
      const matchesFilter = activeFilter?.predicate(card) ?? true;
      const matchesSearch =
        !normalizedSearch ||
        card.name.toLowerCase().includes(normalizedSearch) ||
        card.englishName.toLowerCase().includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });
  }, [runtimeFilter, searchTerm]);

  const isSelectedCardVisible = visibleCards.some((card) => card.id === selectedCard.id);
  const activeCard = isSelectedCardVisible ? selectedCard : visibleCards[0] ?? selectedCard;

  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0 });
  }, [activeCard.id]);

  return (
    <section className="viewport-workspace mx-auto grid w-full max-w-7xl gap-5 px-6 py-4 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:px-8">
      <aside className="flex min-h-0 flex-col gap-4">
        <header className="shrink-0">
          <h1 className="mb-1 font-serif text-3xl font-semibold text-ink md:text-4xl">
            塔罗百科
          </h1>
          <p className="font-sans text-sm text-text-muted">
            左侧切换牌面，右侧保持介绍阅读。
          </p>
        </header>

        <div className="shrink-0 rounded-3xl border border-paper-border bg-paper-raised p-4 shadow-sm">
          <div className="flex items-center gap-2.5 text-terracotta">
            <LegacyIcon name="stacks" className="text-lg" />
            <h2 className="font-serif text-lg text-ink">覆度状态</h2>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-paper-border bg-paper px-4 py-3">
              <p className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
                Runtime
              </p>
              <p className="mt-1 font-serif text-xl text-ink">
                {coverage.runtimeCards} / 78
              </p>
            </div>
            <div className="rounded-2xl border border-paper-border bg-paper px-4 py-3">
              <p className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
                Knowledge
              </p>
              <p className="mt-1 font-serif text-xl text-ink">
                {coverage.knowledgeCards} / 78
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-text-muted">
            已接入 {coverage.runtimeMajor} 张大阿卡纳；四花色各 14 张。知识层另有 {coverage.knowledgeConcepts} 个概念页与 {coverage.knowledgeSpreads} 个牌阵页。
          </p>
        </div>

        <div className="shrink-0 space-y-3">
          <label className="relative block">
            <LegacyIcon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-text-muted"
            />
            <input
              type="search"
              aria-label="搜索卡牌"
              placeholder="搜索卡牌名称"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-2xl border border-paper-border bg-paper-raised py-2.5 pl-10 pr-4 text-sm text-text-body outline-none transition focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10"
            />
          </label>

          <h2 className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
            Runtime 过滤
          </h2>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setRuntimeFilter(filter.id)}
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

        <div
          data-testid="runtime-card-grid"
          className="grid min-h-[280px] grid-cols-4 gap-2.5 overflow-y-auto pr-2 md:grid-cols-6 lg:min-h-0 lg:flex-1 lg:grid-cols-4"
        >
          {visibleCards.length > 0 ? (
            visibleCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => setSelectedCard(card)}
                className={cn(
                  "aspect-[1/1.7] cursor-pointer overflow-hidden rounded-card-sm border-2 transition-all duration-200",
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
            ))
          ) : (
            <div className="col-span-full rounded-2xl border border-paper-border bg-paper-raised p-6 text-sm text-text-muted">
              没有找到匹配的牌。
            </div>
          )}
        </div>
      </aside>

      <article
        ref={detailRef}
        data-testid="encyclopedia-card-detail"
        className="min-h-0 overflow-y-auto rounded-3xl border border-paper-border bg-paper-raised p-8 md:p-10"
      >
        <div className="flex flex-col gap-10 md:flex-row">
          <div className="w-full md:w-5/12">
            <div className="relative aspect-[1/1.7] overflow-hidden rounded-card-md border border-paper-border shadow-sm">
              <img
                src={activeCard.imageUrl}
                alt={activeCard.name}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          <div className="flex-1 space-y-7">
            <EncyclopediaQuestionPanel activeCard={activeCard} />

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

            <div className="space-y-2">
              <h4 className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
                描述
              </h4>
              <p className="text-base leading-[1.8] text-text-body">
                {activeCard.description}
              </p>
            </div>

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
      </article>
    </section>
  );
}
