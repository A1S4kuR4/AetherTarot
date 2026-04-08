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
    <section className="mx-auto w-full max-w-4xl p-8 lg:p-12">
      <header className="mb-10">
        <h1 className="mb-2 font-serif text-4xl text-secondary">占卜历史</h1>
        <p className="text-sm uppercase tracking-widest text-on-surface-variant opacity-80">
          Reading History
        </p>
      </header>

      <div className="space-y-6">
        {history.length === 0 ? (
          <div className="py-20 text-center italic text-on-surface-variant">
            暂无占卜记录，开启你的第一次探索吧。
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
                className="group relative w-full cursor-pointer rounded-xl bg-surface-container p-6 text-left transition-all duration-500 hover:-translate-y-1 hover:bg-surface-container-highest/60"
              >
                <div className="flex items-start gap-5">
                  <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-lowest">
                    <img
                      src={HISTORY_THUMBNAIL}
                      alt="Reading"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-start justify-between gap-4">
                      <span className="font-label text-[10px] uppercase tracking-widest text-secondary-fixed/60">
                        {formatHistoryDate(historyEntry.createdAt)}
                      </span>
                      <span className="material-symbols-outlined text-sm text-secondary-fixed opacity-0 transition-opacity group-hover:opacity-100">
                        north_east
                      </span>
                    </div>
                    <h3 className="mb-2 font-serif text-xl text-primary">
                      {spread?.name ?? historyEntry.reading.spread.name}
                    </h3>
                    <p className="line-clamp-2 text-sm italic text-on-surface-variant">
                      “{historyEntry.reading.question}”
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {historyEntry.reading.themes.map((theme) => (
                        <span
                          key={`${historyEntry.id}-${theme}`}
                          className="rounded-full border border-secondary-fixed/20 bg-secondary-fixed/10 px-3 py-1 text-[10px] uppercase tracking-widest text-secondary-fixed"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                    <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-on-surface-variant/85">
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
