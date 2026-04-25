"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllCards } from "@aethertarot/domain-tarot";
import type { DrawnCard, TarotCard } from "@aethertarot/shared-types";
import { useReading } from "@/context/ReadingContext";
import { cn } from "@/lib/utils";
import LegacyIcon from "@/components/ui/LegacyIcon";

type OfflineCardInput = {
  cardId: string;
  isReversed: boolean;
};

const tarotCards = getAllCards();

function searchCards(query: string, selectedCardIds: Set<string>) {
  const normalizedQuery = query.trim().toLowerCase();
  const candidates = normalizedQuery
    ? tarotCards.filter((card) => {
        const haystack = [
          card.name,
          card.englishName,
          ...card.uprightKeywords,
          ...card.reversedKeywords,
        ].join(" ").toLowerCase();

        return haystack.includes(normalizedQuery);
      })
    : tarotCards;

  return candidates
    .filter((card) => !selectedCardIds.has(card.id))
    .slice(0, 10);
}

function getCardById(cardId: string) {
  return tarotCards.find((card) => card.id === cardId) ?? null;
}

export default function OfflineDrawView() {
  const router = useRouter();
  const {
    question,
    selectedSpread,
    drawSource,
    completeRitual,
    setDrawSource,
  } = useReading();
  const [activePositionIndex, setActivePositionIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [inputsByPosition, setInputsByPosition] = useState<Record<string, OfflineCardInput>>({});

  useEffect(() => {
    if (drawSource !== "offline_manual") {
      setDrawSource("offline_manual");
    }
  }, [drawSource, setDrawSource]);

  useEffect(() => {
    if (!question.trim() || !selectedSpread) {
      router.replace("/");
    }
  }, [question, router, selectedSpread]);

  const activePosition = selectedSpread?.positions[activePositionIndex] ?? null;
  const selectedCardIds = useMemo(
    () => new Set(
      Object.values(inputsByPosition)
        .map((input) => input.cardId)
        .filter(Boolean),
    ),
    [inputsByPosition],
  );
  const searchResults = useMemo(
    () => searchCards(query, selectedCardIds),
    [query, selectedCardIds],
  );
  const completedCount = selectedSpread
    ? selectedSpread.positions.filter((position) => inputsByPosition[position.id]?.cardId).length
    : 0;
  const isComplete = Boolean(selectedSpread && completedCount === selectedSpread.positions.length);

  if (!selectedSpread || !activePosition || !question.trim()) {
    return null;
  }

  const activeInput = inputsByPosition[activePosition.id] ?? {
    cardId: "",
    isReversed: false,
  };
  const activeCard = activeInput.cardId ? getCardById(activeInput.cardId) : null;

  const selectCard = (card: TarotCard) => {
    setInputsByPosition((currentInputs) => ({
      ...currentInputs,
      [activePosition.id]: {
        cardId: card.id,
        isReversed: currentInputs[activePosition.id]?.isReversed ?? false,
      },
    }));
    setQuery("");
  };

  const setOrientation = (isReversed: boolean) => {
    setInputsByPosition((currentInputs) => ({
      ...currentInputs,
      [activePosition.id]: {
        cardId: currentInputs[activePosition.id]?.cardId ?? "",
        isReversed,
      },
    }));
  };

  const clearActivePosition = () => {
    setInputsByPosition((currentInputs) => {
      const nextInputs = { ...currentInputs };
      delete nextInputs[activePosition.id];
      return nextInputs;
    });
    setQuery("");
  };

  const goToNextOpenPosition = () => {
    const nextEmptyIndex = selectedSpread.positions.findIndex(
      (position, index) => index > activePositionIndex && !inputsByPosition[position.id]?.cardId,
    );

    if (nextEmptyIndex >= 0) {
      setActivePositionIndex(nextEmptyIndex);
      setQuery("");
      return;
    }

    const firstEmptyIndex = selectedSpread.positions.findIndex(
      (position) => !inputsByPosition[position.id]?.cardId,
    );

    if (firstEmptyIndex >= 0) {
      setActivePositionIndex(firstEmptyIndex);
      setQuery("");
    }
  };

  const finishOfflineDraw = () => {
    if (!isComplete) {
      return;
    }

    const drawnCards = selectedSpread.positions
      .map((position): DrawnCard | null => {
        const input = inputsByPosition[position.id];
        const card = input ? getCardById(input.cardId) : null;

        if (!input || !card) {
          return null;
        }

        return {
          positionId: position.id,
          card,
          isReversed: input.isReversed,
        };
      })
      .filter((card): card is DrawnCard => card !== null);

    if (drawnCards.length !== selectedSpread.positions.length) {
      return;
    }

    completeRitual(drawnCards);
    router.push("/reveal");
  };

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 pb-12 pt-10 lg:px-12">
      <header className="mx-auto max-w-3xl text-center">
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-text-inverse-muted">
          线下塔罗模式
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-text-inverse md:text-5xl">
          录入你的实体牌阵
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-text-inverse-muted">
          请在线下完成洗牌、切牌与抽取，再按 {selectedSpread.name} 的位置顺序录入牌面。
          实体抽牌只改变牌面来源，解读仍用于反思与启发。
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-3xl border border-midnight-border bg-midnight-panel/70 p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-sans text-[10px] font-medium uppercase tracking-[0.18em] text-indigo/80">
                当前位置
              </p>
              <h2 className="mt-1 font-serif text-2xl text-text-inverse">
                {activePositionIndex + 1}. {activePosition.name}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-text-inverse-muted">
                {activePosition.description}
              </p>
            </div>
            <span className="self-start rounded-full border border-midnight-border-subtle bg-black/10 px-3 py-1.5 font-sans text-[11px] text-text-inverse-muted md:self-center">
              {completedCount} / {selectedSpread.positions.length} 已录入
            </span>
          </div>

          <div className="grid gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
            <div className="flex flex-col items-center gap-4">
              <div className="aspect-[1/1.7] w-[150px] overflow-hidden rounded-2xl border border-midnight-border bg-midnight-elevated shadow-[0_12px_32px_rgba(0,0,0,0.28)]">
                {activeCard ? (
                  <img
                    src={activeCard.imageUrl}
                    alt={activeCard.name}
                    className={cn(
                      "h-full w-full object-cover",
                      activeInput.isReversed && "rotate-180",
                    )}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center px-5 text-center font-sans text-xs leading-relaxed text-text-inverse-muted/60">
                    选择你在线下抽到的牌
                  </div>
                )}
              </div>
              {activeCard ? (
                <div className="text-center">
                  <h3 className="font-serif text-xl text-text-inverse">{activeCard.name}</h3>
                  <p className="text-xs text-text-inverse-muted">{activeCard.englishName}</p>
                </div>
              ) : null}
            </div>

            <div className="space-y-5">
              <div>
                <label htmlFor="offline-card-search" className="block font-sans text-[10px] font-medium uppercase tracking-[0.16em] text-text-inverse-muted">
                  搜索牌名
                </label>
                <input
                  id="offline-card-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="输入中文名、英文名或关键词"
                  className="mt-2 w-full rounded-2xl border border-midnight-border bg-midnight-elevated px-4 py-3 text-sm text-text-inverse outline-none transition focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10"
                />
              </div>

              <div className="grid max-h-[320px] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                {searchResults.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => selectCard(card)}
                    className={cn(
                      "rounded-2xl border px-3 py-3 text-left transition",
                      activeInput.cardId === card.id
                        ? "border-terracotta/50 bg-terracotta/10"
                        : "border-midnight-border bg-black/10 hover:border-midnight-border-subtle",
                    )}
                  >
                    <span className="block font-serif text-sm text-text-inverse">
                      {card.name}
                    </span>
                    <span className="mt-1 block text-[11px] text-text-inverse-muted">
                      {card.englishName}
                    </span>
                  </button>
                ))}
              </div>

              <div>
                <p className="font-sans text-[10px] font-medium uppercase tracking-[0.16em] text-text-inverse-muted">
                  正逆位
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-midnight-border bg-black/10 p-1">
                  {[
                    { label: "正位", value: false },
                    { label: "逆位", value: true },
                  ].map((orientation) => (
                    <button
                      key={orientation.label}
                      type="button"
                      onClick={() => setOrientation(orientation.value)}
                      className={cn(
                        "rounded-xl px-4 py-2 text-sm transition",
                        activeInput.isReversed === orientation.value
                          ? "bg-terracotta text-paper"
                          : "text-text-inverse-muted hover:bg-midnight-elevated",
                      )}
                    >
                      {orientation.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={clearActivePosition}
                  disabled={!activeInput.cardId}
                  className="rounded-full border border-midnight-border bg-transparent px-5 py-2.5 text-sm text-text-inverse-muted transition hover:border-midnight-border-subtle hover:text-text-inverse disabled:cursor-not-allowed disabled:opacity-40"
                >
                  清空当前位置
                </button>
                <button
                  type="button"
                  onClick={goToNextOpenPosition}
                  disabled={isComplete}
                  className="btn-secondary-dark disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <LegacyIcon name="arrow_forward" className="text-lg" />
                  <span>下一张未录入</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="midnight-panel">
            <div className="mb-4 flex items-center gap-2 text-text-inverse">
              <LegacyIcon name="account_tree" className="text-lg text-indigo" />
              <h2 className="font-serif text-lg">牌阵位置</h2>
            </div>
            <div className="space-y-2">
              {selectedSpread.positions.map((position, index) => {
                const input = inputsByPosition[position.id];
                const card = input?.cardId ? getCardById(input.cardId) : null;

                return (
                  <button
                    key={position.id}
                    type="button"
                    onClick={() => {
                      setActivePositionIndex(index);
                      setQuery("");
                    }}
                    className={cn(
                      "w-full rounded-2xl border px-3 py-3 text-left transition",
                      activePosition.id === position.id
                        ? "border-terracotta/50 bg-terracotta/10"
                        : "border-midnight-border bg-black/10 hover:border-midnight-border-subtle",
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-inverse-muted">
                          {index + 1}. {position.name}
                        </span>
                        <span className="mt-1 block truncate font-serif text-sm text-text-inverse">
                          {card ? card.name : "未录入"}
                        </span>
                      </span>
                      {card ? (
                        <span className="shrink-0 rounded-full border border-midnight-border-subtle px-2 py-1 text-[10px] text-text-inverse-muted">
                          {input.isReversed ? "逆位" : "正位"}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-midnight-border-subtle p-5">
            <p className="text-sm leading-relaxed text-text-inverse-muted">
              录入完成后，系统会按牌阵权威位置顺序进入揭示页。重复牌默认不可选，避免一副实体牌被录入两次。
            </p>
          </div>

          <button
            type="button"
            onClick={finishOfflineDraw}
            disabled={!isComplete}
            className="btn-primary w-full justify-center py-4 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>揭示牌阵</span>
            <LegacyIcon name="visibility" className="text-lg" />
          </button>
        </aside>
      </div>
    </section>
  );
}
