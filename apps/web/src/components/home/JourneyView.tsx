"use client";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import type { ReadingHistoryEntry } from "@aethertarot/shared-types";
import { useReading } from "@/context/ReadingContext";
import { cn } from "@/lib/utils";
import LegacyIcon from "@/components/ui/LegacyIcon";

export default function JourneyView() {
  const router = useRouter();
  const { history, selectHistoryReading, continueFromHistoryReading } = useReading();
  const [viewMode, setViewMode] = useState<"timeline" | "themes">("timeline");

  const themeClusters = useMemo(() => {
    const clusters: Record<string, ReadingHistoryEntry[]> = {};
    history.forEach((entry) => {
      entry.reading.themes.forEach((theme) => {
        if (!clusters[theme]) {
          clusters[theme] = [];
        }
        clusters[theme].push(entry);
      });
    });
    // Sort themes by count descending
    return Object.entries(clusters)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([name, entries]) => ({ name, entries }));
  }, [history]);

  const handleSelectHistory = (entry: ReadingHistoryEntry) => {
    selectHistoryReading(entry);
    router.push("/reading");
  };

  const handleContinueLine = (entry: ReadingHistoryEntry) => {
    if (!continueFromHistoryReading(entry)) {
      return;
    }

    router.push("/new");
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

      <section className="space-y-10">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-1 rounded-full border border-paper-border bg-paper-raised p-1">
            <button
              onClick={() => setViewMode("timeline")}
              className={cn(
                "rounded-full px-5 py-1.5 text-xs font-medium transition-all",
                viewMode === "timeline" ? "bg-paper text-ink shadow-sm ring-1 ring-ink/5" : "text-text-muted hover:text-ink"
              )}
            >
              时间轴
            </button>
            <button
              onClick={() => setViewMode("themes")}
              className={cn(
                "rounded-full px-5 py-1.5 text-xs font-medium transition-all",
                viewMode === "themes" ? "bg-paper text-ink shadow-sm ring-1 ring-ink/5" : "text-text-muted hover:text-ink"
              )}
            >
              主题星群
            </button>
          </div>
          <button
            type="button"
            onClick={handleNewReading}
            className="btn-primary flex items-center gap-2 px-6 py-2.5 text-sm"
          >
            <LegacyIcon name="add" className="text-[18px]" />
            开启新的抽牌
          </button>
        </div>

        {history.length > 0 ? (
          <AnimatePresence mode="wait">
            {viewMode === "timeline" ? (
              <motion.div
                key="timeline"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
              >
                {history.map((entry, index) => (
                  <HistoryCard
                    key={entry.id}
                    entry={entry}
                    index={index}
                    onReplay={() => handleSelectHistory(entry)}
                    onContinue={() => handleContinueLine(entry)}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="themes"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="grid gap-8 md:grid-cols-2"
              >
                {themeClusters.map((cluster, index) => (
                  <ThemeClusterCard
                    key={cluster.name}
                    cluster={cluster}
                    index={index}
                    onSelectEntry={handleSelectHistory}
                    onContinueEntry={handleContinueLine}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <div className="reading-card bg-paper/50 py-24 text-center">
            <LegacyIcon
              name="auto_awesome"
              className="mb-4 text-4xl text-terracotta/40"
            />
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

function HistoryCard({
  entry,
  index,
  onReplay,
  onContinue,
}: {
  entry: ReadingHistoryEntry;
  index: number;
  onReplay: () => void;
  onContinue: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="group flex flex-col justify-between rounded-3xl border border-paper-border bg-paper-raised p-6 transition-all hover:border-terracotta/40 hover:shadow-md"
    >
      <div>
        <div className="mb-4 flex items-start justify-between">
          <span className="chip-warm text-[10px]">
            {new Date(entry.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
          </span>
        </div>
        <h3 className="mb-4 line-clamp-3 font-serif text-lg leading-relaxed text-ink transition-colors group-hover:text-terracotta">
          {`"${entry.reading.question}"`}
        </h3>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {entry.reading.themes.slice(0, 3).map((theme) => (
            <span
              key={theme}
              className="rounded-full border border-paper-border bg-paper px-2.5 py-1 font-sans text-[10px] text-text-muted"
            >
              #{theme}
            </span>
          ))}
        </div>
        {entry.user_notes && (
          <div className="flex items-center gap-2 border-t border-paper-border/30 pt-4 text-text-muted">
            <LegacyIcon name="edit_note" className="text-[16px] text-terracotta/60" />
            <span className="truncate text-[11px]">沉淀了感悟</span>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={onReplay}
            className="rounded-full border border-paper-border bg-paper px-4 py-2 text-xs font-medium text-ink transition hover:bg-paper-raised"
          >
            回看解读
          </button>
          {entry.reading.session_capsule ? (
            <button
              type="button"
              onClick={onContinue}
              className="rounded-full border border-terracotta/20 bg-terracotta/5 px-4 py-2 text-xs font-medium text-terracotta transition hover:bg-terracotta/10"
            >
              延续这条线
            </button>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

function ThemeClusterCard({ 
  cluster, 
  index, 
  onSelectEntry,
  onContinueEntry,
}: { 
  cluster: { name: string; entries: ReadingHistoryEntry[] }; 
  index: number;
  onSelectEntry: (entry: ReadingHistoryEntry) => void;
  onContinueEntry: (entry: ReadingHistoryEntry) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      className="relative flex flex-col rounded-[2.5rem] border border-paper-border bg-paper p-8 shadow-sm"
    >
      <div className="mb-8 flex items-end justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-terracotta" />
            <h3 className="font-serif text-2xl font-medium text-ink">{cluster.name}</h3>
          </div>
          <p className="text-xs text-text-muted">{cluster.entries.length} 次意识共振</p>
        </div>
        <LegacyIcon name="cloud" className="text-4xl text-paper-border/40" />
      </div>

      <div className="space-y-4">
        {cluster.entries.slice(0, 4).map((entry) => (
          <div
            key={entry.id}
            className="border-b border-paper-border/30 pb-3"
          >
            <div className="flex items-start gap-4">
              <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-paper-border" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm text-ink">
                  {entry.reading.question}
                </p>
                <p className="mt-1 text-[10px] text-text-placeholder">
                  {new Date(entry.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 pl-5">
              <button
                type="button"
                onClick={() => onSelectEntry(entry)}
                className="rounded-full border border-paper-border bg-paper px-3 py-1.5 text-[11px] font-medium text-ink transition hover:bg-paper-raised"
              >
                回看
              </button>
              {entry.reading.session_capsule ? (
                <button
                  type="button"
                  onClick={() => onContinueEntry(entry)}
                  className="rounded-full border border-terracotta/20 bg-terracotta/5 px-3 py-1.5 text-[11px] font-medium text-terracotta transition hover:bg-terracotta/10"
                >
                  延续这条线
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {cluster.entries.length > 4 && (
          <p className="pt-2 text-center text-[10px] italic text-text-placeholder">
            及其他 {cluster.entries.length - 4} 条回响...
          </p>
        )}
      </div>
    </motion.div>
  );
}

