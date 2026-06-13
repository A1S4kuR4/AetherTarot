"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion } from "motion/react";
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

function useColumnsPerRow(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [columns, setColumns] = useState(4);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const width = el.clientWidth;
      if (width >= 768 && width < 1024) {
        setColumns(6);
      } else {
        setColumns(4);
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  return columns;
}

export default function EncyclopediaView({
  coverage,
  isQuestionEnabled,
}: {
  coverage: EncyclopediaCoverageSummary;
  isQuestionEnabled: boolean;
}) {
  const [selectedCard, setSelectedCard] = useState<TarotCard>(tarotCards[0]);
  const [runtimeFilter, setRuntimeFilter] = useState<RuntimeFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const detailRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const columnsPerRow = useColumnsPerRow(gridRef);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const y = e.currentTarget.scrollTop;
    if (y > 120 && !isCollapsed) setIsCollapsed(true);
    if (y <= 80 && isCollapsed) setIsCollapsed(false);
  }, [isCollapsed]);

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

  const totalRows = Math.ceil(visibleCards.length / columnsPerRow);

  const virtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => gridRef.current,
    estimateSize: () => 170,
    overscan: 2,
  });

  const isSelectedCardVisible = visibleCards.some((card) => card.id === selectedCard.id);
  const activeCard = isSelectedCardVisible ? selectedCard : visibleCards[0] ?? selectedCard;

  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0 });
    setIsCollapsed(false);
  }, [activeCard.id]);

  const handleSelectCard = useCallback((card: TarotCard) => {
    setSelectedCard(card);
    setIsCollapsed(false);

    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      window.requestAnimationFrame(() => {
        const title = detailRef.current?.querySelector("[data-card-detail-title]");
        (title ?? detailRef.current)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, []);

  return (
    <section className="viewport-workspace mx-auto flex w-full max-w-7xl flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden px-4 sm:px-6 lg:px-8 pt-4 gap-4 lg:gap-10">
      {/* Left Gallery Pane */}
      <motion.div
        layout
        initial={false}
        className={cn(
          "shrink-0 z-10 flex flex-col justify-center",
          isCollapsed
            ? "w-full max-w-[260px] mx-auto lg:mx-0 lg:w-32 lg:h-auto lg:mt-4"
            : "w-full max-w-[260px] mx-auto lg:w-5/12 h-auto lg:h-full pb-4 lg:pb-8"
        )}
      >
        <motion.div
          layout
          className={cn(
            "relative overflow-hidden border border-paper-border shadow-sm transition-all",
            isCollapsed ? "aspect-[1/1.7] rounded-card-sm" : "aspect-[1/1.7] rounded-card-md"
          )}
        >
          <Image
            src={activeCard.imageUrl}
            alt={activeCard.name}
            fill
            sizes={isCollapsed ? "128px" : "(min-width: 1024px) 40vw, 100vw"}
            quality={80}
            priority
            className="h-full w-full object-cover"
          />
        </motion.div>
      </motion.div>

      {/* Right Content Pane */}
      <motion.div 
        layout 
        onScroll={handleScroll}
        className="flex-1 min-w-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-6 lg:gap-8 lg:pr-4 pb-12"
      >
        <header className="shrink-0 mt-2 lg:mt-0">
          <h1 className="mb-1 font-serif text-3xl font-semibold text-ink md:text-4xl">
            塔罗百科
          </h1>
          <p className="font-sans text-sm text-text-muted">
            沉浸式探索七十八张牌的奥秘。
          </p>
        </header>

        {/* Top Section: Coverage & Filters */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Coverage */}
          <div className="rounded-3xl border border-paper-border bg-paper-raised p-4 sm:p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 text-terracotta mb-4">
              <LegacyIcon name="stacks" className="text-lg" />
              <h2 className="font-serif text-base text-ink">覆度状态</h2>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">Runtime</p>
                <p className="font-serif text-xl text-ink mt-1">{coverage.runtimeCards} <span className="text-sm text-text-muted">/ 78</span></p>
              </div>
              <div>
                <p className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">Knowledge</p>
                <p className="font-serif text-xl text-ink mt-1">{coverage.knowledgeCards} <span className="text-sm text-text-muted">/ 78</span></p>
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="rounded-3xl border border-paper-border bg-paper-raised p-4 sm:p-5 shadow-sm flex flex-col justify-center space-y-3.5">
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
                className="min-h-10 w-full rounded-2xl border border-paper-border bg-paper py-2 pl-10 pr-4 text-sm text-text-body outline-none transition focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setRuntimeFilter(filter.id)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] transition-all",
                    runtimeFilter === filter.id
                      ? "border-terracotta/40 bg-terracotta/10 text-terracotta"
                      : "border-paper-border bg-paper text-text-muted hover:text-ink"
                  )}
                >
                  {filter.label} ({getFilterCount(filter.id)})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Virtual Grid */}
        <div
          ref={gridRef}
          data-testid="runtime-card-grid"
          className="h-[240px] shrink-0 overflow-y-auto custom-scrollbar rounded-2xl border border-paper-border bg-paper/50 p-3"
        >
          {visibleCards.length > 0 ? (
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const startIndex = virtualRow.index * columnsPerRow;
                const rowCards = visibleCards.slice(startIndex, startIndex + columnsPerRow);

                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className={cn(
                      "grid gap-2.5 mb-2.5",
                      columnsPerRow === 6 ? "grid-cols-6" : "grid-cols-4"
                    )}
                  >
                    {rowCards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => handleSelectCard(card)}
                        className={cn(
                          "relative aspect-[1/1.7] cursor-pointer overflow-hidden rounded-card-sm border-2 transition-all duration-200",
                          activeCard.id === card.id
                            ? "scale-[1.04] border-terracotta shadow-sm"
                            : "border-transparent opacity-60 hover:opacity-100"
                        )}
                      >
                        <Image
                          src={card.thumbnailUrl ?? card.imageUrl}
                          alt={card.name}
                          fill
                          sizes="86px"
                          quality={40}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-text-muted">
              没有找到匹配的牌。
            </div>
          )}
        </div>

        {/* Card Details Article */}
        <article
          ref={detailRef}
          data-testid="encyclopedia-card-detail"
          className="scroll-mt-20 shrink-0 flex flex-col gap-7 rounded-3xl border border-paper-border bg-paper-raised p-5 sm:p-8 md:p-10 mb-8"
        >
          {isQuestionEnabled ? (
            <EncyclopediaQuestionPanel activeCard={activeCard} />
          ) : null}

          <div>
            <span className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
              {activeCard.arcana} · {activeCard.element}
            </span>
            <h2 className="mt-1.5 font-serif text-3xl text-ink md:text-4xl">
              <span data-card-detail-title>{activeCard.name}</span>
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

          <div className="grid gap-6 sm:grid-cols-2">
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
        </article>
      </motion.div>
    </section>
  );
}
