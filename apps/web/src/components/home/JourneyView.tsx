"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import type { ReadingHistoryEntry } from "@aethertarot/shared-types";
import { useReading } from "@/context/ReadingContext";

export default function JourneyView() {
  const router = useRouter();
  const { history, selectHistoryReading } = useReading();

  const handleSelectHistory = (entry: ReadingHistoryEntry) => {
    selectHistoryReading(entry);
    router.push("/reading");
  };

  const handleNewReading = () => {
    router.push("/new");
  };

  return (
    <main className="mx-auto min-h-[92vh] max-w-5xl px-6 pb-20 pt-24 lg:px-16">
      <header className="mb-16 space-y-4 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-serif text-4xl font-semibold text-ink md:text-5xl"
        >
          意识之流 (The Journey)
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mx-auto max-w-lg text-base text-text-muted"
        >
          塔罗不过是照见潜意识的镜子。在这里，你过去的疑问与线索被收束成主题，映照着你成长的轨迹。
        </motion.p>
      </header>

      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl text-ink">过往回溯</h2>
          <button
            type="button"
            onClick={handleNewReading}
            className="btn-primary px-5 py-2 text-sm"
          >
            开启新的抽牌
          </button>
        </div>

        {history.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {history.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                onClick={() => handleSelectHistory(entry)}
                className="group flex cursor-pointer flex-col justify-between rounded-3xl border border-paper-border bg-paper-raised p-6 transition-all hover:border-terracotta/40 hover:shadow-sm"
              >
                <div>
                  <div className="mb-4 flex items-start justify-between">
                    <span className="chip-warm text-[10px]">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="mb-3 line-clamp-2 font-serif text-lg leading-relaxed text-ink transition-colors group-hover:text-terracotta">
                    {`"${entry.reading.question}"`}
                  </h3>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {entry.reading.themes.slice(0, 2).map((theme) => (
                      <span
                        key={theme}
                        className="rounded-full border border-paper-border bg-paper px-2 py-1 font-sans text-[11px] text-text-muted"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                  {entry.user_notes && (
                    <div className="flex items-center gap-2 border-t border-paper-border/50 pt-3 text-text-muted">
                      <span className="material-symbols-outlined text-[14px]">
                        edit_note
                      </span>
                      <span className="truncate text-[11px]">有手记记录</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="reading-card bg-paper/50 py-20 text-center">
            <span className="material-symbols-outlined mb-4 text-4xl text-terracotta/40">
              auto_awesome
            </span>
            <h3 className="font-serif text-xl text-ink">尚无回溯线索</h3>
            <p className="mt-2 text-sm text-text-muted">
              你还没有在这里留下过印记。
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
