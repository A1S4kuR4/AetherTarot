"use client";

import { useRouter } from "next/navigation";
import { getAllSpreads } from "@aethertarot/domain-tarot";
import { HISTORY_THUMBNAIL } from "@/constants";
import { useReading } from "@/context/ReadingContext";

const spreads = getAllSpreads();

function formatHistoryDate(createdAt: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(createdAt));
}

export default function HistoryView() {
  const router = useRouter();
  const { history, selectHistoryReading } = useReading();

  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-16 lg:px-8">
      <header className="mb-10">
        <h1 className="mb-1 font-serif text-3xl font-semibold text-ink md:text-4xl">
          占卜历史
        </h1>
        <p className="font-sans text-sm text-text-muted">
          你的每一次探索都被安静地记录在这里
        </p>
      </header>

      <div className="space-y-4">
        {history.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-serif text-lg italic text-text-muted">
              暂无占卜记录，开启你的第一次探索吧。
            </p>
          </div>
        ) : (
          history.map((historyEntry) => {
            const spread = spreads.find(
              (item) => item.id === historyEntry.spreadId,
            );

            return (
              <button
                key={historyEntry.id}
                type="button"
                onClick={() => {
                  selectHistoryReading(historyEntry);
                  router.push("/reading");
                }}
                className="group relative w-full cursor-pointer rounded-2xl border border-paper-border bg-paper-raised p-5 text-left transition-all duration-200 hover:shadow-sm hover:border-terracotta/20"
              >
                <div className="flex items-start gap-5">
                  {/* Thumbnail */}
                  <div className="h-24 w-[68px] shrink-0 overflow-hidden rounded-xl border border-paper-border">
                    <img
                      src={HISTORY_THUMBNAIL}
                      alt="Reading"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-start justify-between gap-4">
                      <span className="font-sans text-[11px] font-medium text-text-muted">
                        {formatHistoryDate(historyEntry.createdAt)}
                      </span>
                      <span className="material-symbols-outlined text-sm text-terracotta opacity-0 transition-opacity group-hover:opacity-100">
                        north_east
                      </span>
                    </div>

                    <h3 className="mb-1.5 font-serif text-lg text-ink">
                      {spread?.name ?? historyEntry.reading.spread.name}
                    </h3>

                    <p className="line-clamp-2 text-sm italic text-text-muted leading-relaxed">
                      "{historyEntry.reading.question}"
                    </p>

                    {/* Theme chips */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {historyEntry.reading.themes.map((theme) => (
                        <span
                          key={`${historyEntry.id}-${theme}`}
                          className="chip-warm text-[10px]"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>

                    <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-text-body">
                      {historyEntry.reading.synthesis}
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
