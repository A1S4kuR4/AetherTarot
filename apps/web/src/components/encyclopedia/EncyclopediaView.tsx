"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { getAllCards } from "@aethertarot/domain-tarot";
import type { TarotCard } from "@aethertarot/shared-types";
import type { EncyclopediaCoverageSummary } from "@/server/encyclopedia/coverage";
import type {
  CardWikiSummary,
  EncyclopediaKnowledgeCounts,
} from "@/server/encyclopedia/wiki-summary";
import { resolveInitialCardId } from "@/lib/encyclopedia/card-selection";
import { cn } from "@/lib/utils";
import { formatSourceLabel } from "@/lib/encyclopedia/wiki-content";
import LegacyIcon from "@/components/ui/LegacyIcon";
import EncyclopediaQuestionPanel from "@/components/encyclopedia/EncyclopediaQuestionPanel";
import WikiContent from "@/components/encyclopedia/WikiContent";

const tarotCards = getAllCards();

type RuntimeFilter = "all" | "major" | "wands" | "cups" | "swords" | "pentacles";
type ImagePaneMode = "auto" | "manual-expanded" | "manual-collapsed";

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

function resolveCardById(cardId: string | null | undefined) {
  const resolvedCardId = resolveInitialCardId({
    requestedCardId: cardId,
    fallbackCardId: tarotCards[0].id,
    knownCardIds: tarotCards.map((card) => card.id),
  });

  return tarotCards.find((card) => card.id === resolvedCardId) ?? tarotCards[0];
}

function isMobileViewport() {
  return typeof window !== "undefined" && window.innerWidth < 1024;
}

function useColumnsPerRow(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [columns, setColumns] = useState(4);
  const [gridWidth, setGridWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const width = el.clientWidth;
      setGridWidth(width);
      if (width < 400) {
        setColumns(3);
      } else if (width >= 768 && width < 1024) {
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

  return { columns, gridWidth };
}

const LAYOUT_TRANSITION_MS = 300;

export default function EncyclopediaView({
  coverage,
  cardWikiPages,
  initialCardId,
  isQuestionEnabled,
  knowledgeCounts,
}: {
  coverage: EncyclopediaCoverageSummary;
  cardWikiPages: CardWikiSummary[];
  initialCardId: string | null;
  isQuestionEnabled: boolean;
  knowledgeCounts: EncyclopediaKnowledgeCounts;
}) {
  const [selectedCard, setSelectedCard] = useState<TarotCard>(() => resolveCardById(initialCardId));
  const [runtimeFilter, setRuntimeFilter] = useState<RuntimeFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const detailRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const { columns: columnsPerRow, gridWidth } = useColumnsPerRow(gridRef);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [imagePaneMode, setImagePaneMode] = useState<ImagePaneMode>("auto");
  const [hasMounted, setHasMounted] = useState(false);
  const shouldReduceMotion = useReducedMotion() ?? false;
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHasMounted(true);
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        if (imagePaneMode === "auto") {
          setIsCollapsed(isMobileViewport());
        }
        timeoutId = null;
      }, 100);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => {
      window.removeEventListener("resize", handleResize);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [imagePaneMode]);

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

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual exposes imperative measurement APIs; this component keeps the virtualizer local.
  const virtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => gridRef.current,
    estimateSize: useCallback(() => {
      if (!gridWidth) return 170;
      const contentWidth = gridWidth - 24; // p-3 * 2 padding
      const gap = 10;                      // gap-2.5
      const cardWidth = (contentWidth - gap * (columnsPerRow - 1)) / columnsPerRow;
      const rowHeight = cardWidth * 1.7 + 10; // mb-2.5
      return Math.max(120, rowHeight);
    }, [columnsPerRow, gridWidth]),
    overscan: 2,
  });

  const isSelectedCardVisible = visibleCards.some((card) => card.id === selectedCard.id);
  const activeCard = isSelectedCardVisible ? selectedCard : visibleCards[0] ?? selectedCard;
  const activeWikiPage = useMemo(
    () => cardWikiPages.find((page) => page.cardId === activeCard.id) ?? null,
    [activeCard.id, cardWikiPages],
  );
  const isImageCollapsed = imagePaneMode === "manual-expanded"
    ? false
    : imagePaneMode === "manual-collapsed"
      ? true
      : isCollapsed;

  const syncCardQuery = useCallback((cardId: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("card", cardId);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0 });
    setIsCollapsed(isMobileViewport());
  }, [activeCard.id]);

  useEffect(() => {
    setSelectedCard(resolveCardById(initialCardId));
    setImagePaneMode("auto");
    setIsCollapsed(isMobileViewport());
  }, [initialCardId]);

  const handleSelectCard = useCallback((card: TarotCard) => {
    setSelectedCard(card);
    setImagePaneMode("auto");
    setIsCollapsed(isMobileViewport());
    syncCardQuery(card.id);

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    if (isMobileViewport()) {
      scrollTimeoutRef.current = setTimeout(() => {
        const title =
          detailRef.current?.querySelector("[data-wiki-detail-title]")
          ?? detailRef.current?.querySelector("[data-card-detail-title]");
        (title ?? detailRef.current)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, LAYOUT_TRANSITION_MS);
    }
  }, [syncCardQuery]);

  const handleToggleImagePane = useCallback(() => {
    setImagePaneMode(isImageCollapsed ? "manual-expanded" : "manual-collapsed");
    setIsCollapsed(!isImageCollapsed);
  }, [isImageCollapsed]);

  return (
    <section className="viewport-workspace mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pt-6 sm:px-6 lg:h-[calc(100dvh-4rem)] lg:flex-row lg:gap-12 lg:overflow-hidden lg:px-8">
      {/* Left Gallery Pane */}
      <motion.div
        layout={hasMounted && !shouldReduceMotion}
        initial={false}
        data-testid="encyclopedia-image-pane"
        className={cn(
          "z-10 flex shrink-0 flex-col pb-2 lg:h-full lg:pb-8",
          isImageCollapsed
            ? "mx-auto w-24 lg:mx-0 lg:w-28 lg:justify-start lg:pt-4"
            : "mx-auto w-44 max-w-[260px] sm:w-52 lg:w-[min(32vw,22rem)] lg:justify-center"
        )}
      >
        <div
          className={cn(
            "relative overflow-hidden border border-paper-border bg-paper-raised",
            "aspect-[1/1.7]"
          )}
        >
          <AnimatePresence mode="sync">
            <motion.div
              key={activeCard.id}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
              layout={false}
              className="absolute inset-0"
            >
              <Image
                src={activeCard.imageUrl}
                alt={activeCard.name}
                fill
                sizes={isImageCollapsed ? "128px" : "(min-width: 1024px) 32vw, 100vw"}
                quality={80}
                priority
                loading="eager"
                className="h-full w-full object-cover"
              />
            </motion.div>
          </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={handleToggleImagePane}
          aria-pressed={!isImageCollapsed}
          className="mt-3 inline-flex min-h-11 items-center justify-center border-b border-paper-border px-2 py-2 text-xs text-text-muted transition-colors hover:border-terracotta hover:text-terracotta"
        >
          {isImageCollapsed ? "展开牌图" : "收起牌图"}
        </button>
      </motion.div>

      {/* Right Content Pane */}
      <div 
        data-testid="encyclopedia-content-pane"
        className="custom-scrollbar flex min-w-0 flex-1 flex-col gap-8 pb-16 lg:h-full lg:overflow-y-auto lg:pr-6"
      >
        <header className="mt-2 shrink-0 border-b border-paper-border pb-7 lg:mt-0">
          <p className="manuscript-label">ENCYC · CARD ARCHIVE</p>
          <h1 className="mt-4 text-balance font-serif text-3xl font-semibold tracking-[-0.02em] text-ink md:text-4xl">
            塔罗百科
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">
            沉浸式探索七十八张牌的奥秘。已收录 {coverage.knowledgeCards}/{coverage.runtimeCards} 张牌 · {knowledgeCounts.concepts} 个核心概念 · {knowledgeCounts.spreads} 种牌阵
          </p>
        </header>

        <div className="shrink-0 border-b border-paper-border pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
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
                className="min-h-11 w-full border-b border-paper-border bg-transparent py-2 pl-9 pr-2 text-sm text-text-body outline-none transition placeholder:text-text-placeholder focus:border-terracotta lg:w-72"
              />
            </label>
            <div
              data-testid="encyclopedia-filter-list"
              className="flex flex-wrap gap-x-4 gap-y-2"
            >
              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setRuntimeFilter(filter.id)}
                  className={cn(
                    "min-h-10 border-b-2 px-0 py-2 text-xs leading-none transition-colors",
                    runtimeFilter === filter.id
                      ? "border-terracotta text-terracotta"
                      : "border-transparent text-text-muted hover:border-paper-border hover:text-ink"
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
          className="custom-scrollbar shrink-0 overflow-visible border-y border-paper-border py-4 lg:h-[240px] lg:overflow-y-auto"
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
                      "mb-2.5 grid gap-2.5",
                      columnsPerRow === 6 ? "grid-cols-6" : columnsPerRow === 4 ? "grid-cols-4" : "grid-cols-3"
                    )}
                  >
                    {rowCards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => handleSelectCard(card)}
                        className={cn(
                          "relative aspect-[1/1.7] cursor-pointer overflow-hidden border-l-2 border-transparent transition-colors duration-200",
                          activeCard.id === card.id
                            ? "border-terracotta opacity-100"
                            : "opacity-60 hover:bg-paper-muted hover:opacity-100"
                        )}
                      >
                        <Image
                          src={card.thumbnailUrl ?? card.imageUrl}
                          alt={card.name}
                          fill
                          sizes="86px"
                          quality={50}
                          loading={activeCard.id === card.id ? "eager" : "lazy"}
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
          className="mb-8 flex shrink-0 flex-col gap-10 scroll-mt-20 border-b border-paper-border pb-12 pt-2"
        >
          {isQuestionEnabled ? (
            <EncyclopediaQuestionPanel activeCard={activeCard} />
          ) : null}

          <div>
            <span className="manuscript-label">
              {activeCard.arcana} · {activeCard.element}
            </span>
            <h2 className="mt-2 text-balance font-serif text-3xl text-ink md:text-4xl">
              <span data-card-detail-title>{activeCard.name}</span>
            </h2>
            <p className="mt-1 font-sans text-sm tracking-[0.08em] text-text-muted">
              {activeCard.englishName}
            </p>
          </div>

          <div className="max-w-3xl space-y-3">
            <h4 className="manuscript-label">
              描述
            </h4>
            <p className="manuscript-drop-cap text-[17px] leading-8 text-text-body">
              {activeCard.description}
            </p>
          </div>

          <div className="grid gap-8 border-y border-paper-border py-6 sm:grid-cols-2">
            <div className="space-y-3">
              <h4 className="manuscript-label">
                正位关键词
              </h4>
              <ul className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                {activeCard.uprightKeywords.map((keyword) => (
                  <li
                    key={keyword}
                    className="border-l border-paper-border pl-3 text-sm text-text-body"
                  >
                    {keyword}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="manuscript-label text-text-accent">
                逆位关键词
              </h4>
              <ul className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                {activeCard.reversedKeywords.map((keyword) => (
                  <li
                    key={keyword}
                    className="border-l border-paper-border pl-3 text-sm text-text-body"
                  >
                    {keyword}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="max-w-3xl space-y-3">
            <h4 className="font-mono text-[11px] font-semibold tracking-[0.12em] text-terracotta">
              象征意义
            </h4>
            <ul className="space-y-2">
              {activeCard.symbolism.map((symbolism, index) => (
                <li
                  key={`${activeCard.id}-${index}`}
                  className="border-l border-paper-border pl-4 text-sm leading-7 text-text-muted"
                >
                  {symbolism}
                </li>
              ))}
            </ul>
          </div>

          <section className="max-w-3xl space-y-7 border-t border-paper-border pt-9">
            <div>
              <h3
                data-wiki-detail-title
                className="text-balance font-serif text-2xl text-ink"
              >
                深度百科
              </h3>
              <p className="mt-1 text-sm text-text-muted">
                {activeWikiPage
                  ? `${activeWikiPage.title} · 来源 ${activeWikiPage.sourceIds.map(formatSourceLabel).join(" / ")}`
                  : "这张牌的 wiki 条目尚未收录。"}
              </p>
            </div>
            {activeWikiPage ? (
              <div className="space-y-6">
                {activeWikiPage.sections.map((section, index) => (
                  <section
                    key={`${activeWikiPage.cardId}-${section.heading}`}
                    className="space-y-3 border-t border-paper-border/70 pt-7 first:border-t-0 first:pt-0"
                  >
                    <div>
                      <p className="manuscript-label">REFERENCE {String(index + 1).padStart(2, "0")}</p>
                      <h4 className="mt-2 font-serif text-xl text-ink">{section.heading}</h4>
                    </div>
                    <div className="space-y-3">
                      <WikiContent content={section.content} />
                    </div>
                  </section>
                ))}
              </div>
            ) : null}
          </section>
        </article>
      </div>
    </section>
  );
}
