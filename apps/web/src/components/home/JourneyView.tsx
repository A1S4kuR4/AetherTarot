"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useReading } from "@/context/ReadingContext";
import type { ReadingHistoryEntry } from "@aethertarot/shared-types";

export default function JourneyView() {
  const router = useRouter();
  const { history, selectHistoryReading } = useReading();

  const handleSelectHistory = (entry: ReadingHistoryEntry) => {
    selectHistoryReading(entry);
    router.push("/interpretation");
  };

  const handleNewReading = () => {
    // Navigate straight to ritual setup but render HomeView essentially
    router.push("/new"); 
  };

  return (
    <main className="mx-auto max-w-5xl px-6 pt-24 pb-20 lg:px-16 min-h-[92vh]">
      <header className="mb-16 text-center space-y-4">
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
          className="text-text-muted text-base max-w-lg mx-auto"
        >
          塔罗不过是照见潜意识的镜子。在这里，你过去的疑问与线索被收束成主题，映照着你成长的轨迹。
        </motion.p>
      </header>

      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl text-ink">过往回溯</h2>
          <button 
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
                className="cursor-pointer group flex flex-col justify-between rounded-3xl border border-paper-border bg-paper-raised p-6 transition-all hover:border-terracotta/40 hover:shadow-sm"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="chip-warm text-[10px]">{new Date(entry.createdAt).toLocaleDateString()}</span>
                  </div>
                  <h3 className="font-serif text-lg text-ink line-clamp-2 leading-relaxed mb-3 group-hover:text-terracotta transition-colors">
                    "{entry.reading.question}"
                  </h3>
                </div>
                
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {entry.reading.themes.slice(0, 2).map((theme) => (
                      <span key={theme} className="font-sans text-[11px] px-2 py-1 bg-paper border border-paper-border text-text-muted rounded-full">
                        {theme}
                      </span>
                    ))}
                  </div>
                  {entry.user_notes && (
                    <div className="pt-3 border-t border-paper-border/50 flex items-center gap-2 text-text-muted">
                      <span className="material-symbols-outlined text-[14px]">edit_note</span>
                      <span className="text-[11px] truncate">有手记记录</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="reading-card text-center py-20 bg-paper/50">
            <span className="material-symbols-outlined text-4xl text-terracotta/40 mb-4">auto_awesome</span>
            <h3 className="font-serif text-xl text-ink">尚无回溯线索</h3>
            <p className="text-text-muted text-sm mt-2">
              你还没有在这里留下过印记。
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
