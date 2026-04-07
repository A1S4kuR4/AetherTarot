"use client";

import { useRouter } from "next/navigation";
import { HISTORY_THUMBNAIL, SPREADS } from "@/constants";
import { useReading } from "@/context/ReadingContext";

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
          history.map((reading) => (
            <button
              key={reading.id}
              type="button"
              onClick={() => {
                selectHistoryReading(reading);
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
                <div className="flex-1">
                  <div className="mb-2 flex items-start justify-between">
                    <span className="font-label text-[10px] uppercase tracking-widest text-secondary-fixed/60">
                      {reading.date}
                    </span>
                    <span className="material-symbols-outlined text-sm text-secondary-fixed opacity-0 transition-opacity group-hover:opacity-100">
                      north_east
                    </span>
                  </div>
                  <h3 className="mb-2 font-serif text-xl text-primary">
                    {SPREADS.find((spread) => spread.id === reading.spreadId)?.name}
                  </h3>
                  <p className="line-clamp-2 text-sm italic text-on-surface-variant">
                    “{reading.question}”
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
