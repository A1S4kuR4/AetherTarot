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
    <main className="mx-auto min-h-[92vh] max-w-6xl px-6 pb-24 pt-24 lg:px-16">
      <header className="mb-14 max-w-3xl border-b border-paper-border pb-10">
        <p className="manuscript-label">
          JOURNEY · PERSONAL ARCHIVE
        </p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 text-balance font-serif text-4xl font-semibold tracking-[-0.02em] text-ink md:text-5xl"
        >
          意识之流 (The Journey)
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-4 max-w-2xl text-base leading-8 text-text-muted"
        >
          塔罗不过是照见潜意识的镜子。在这里，你过去的疑问与线索被收束成主题，映照着你成长的轨迹。
        </motion.p>
      </header>

      <section className="space-y-10">
        <div className="flex flex-col justify-between gap-6 border-b border-paper-border pb-5 md:flex-row md:items-end">
          <div className="flex items-center gap-6" aria-label="旅程浏览方式">
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              className={cn(
                "min-h-10 border-b-2 px-0 font-sans text-sm transition-colors",
                viewMode === "timeline" ? "border-terracotta text-ink" : "border-transparent text-text-muted hover:text-ink"
              )}
            >
              时间轴
            </button>
            <button
              type="button"
              onClick={() => setViewMode("themes")}
              className={cn(
                "min-h-10 border-b-2 px-0 font-sans text-sm transition-colors",
                viewMode === "themes" ? "border-terracotta text-ink" : "border-transparent text-text-muted hover:text-ink"
              )}
            >
              主题星群
            </button>
          </div>
          <button
            type="button"
            onClick={handleNewReading}
            className="inline-flex min-h-11 items-center gap-2 border border-terracotta-ink bg-terracotta-ink px-5 py-2 font-serif text-sm text-paper transition-colors hover:bg-terracotta-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
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
                className="divide-y divide-paper-border"
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
                className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_12rem]"
              >
                <div className="space-y-12">
                  {themeClusters.map((cluster, index) => (
                    <ThemeClusterCard
                      key={cluster.name}
                      cluster={cluster}
                      index={index}
                      onSelectEntry={handleSelectHistory}
                      onContinueEntry={handleContinueLine}
                    />
                  ))}
                </div>
                <aside className="hidden border-l border-paper-border pl-5 lg:sticky lg:top-24 lg:block lg:self-start">
                  <p className="manuscript-label">THEME INDEX</p>
                  <ol className="mt-4 space-y-2">
                    {themeClusters.map((cluster, index) => (
                      <li key={`index-${cluster.name}`}>
                        <a
                          href={`#journey-theme-${index}`}
                          className="flex gap-2 text-xs leading-5 text-text-muted transition-colors hover:text-terracotta"
                        >
                          <span className="font-mono text-[10px] text-terracotta-ink">{String(index + 1).padStart(2, "0")}</span>
                          {cluster.name}
                        </a>
                      </li>
                    ))}
                  </ol>
                </aside>
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <div className="border-y border-paper-border py-20 text-center">
            <LegacyIcon
              name="auto_awesome"
              className="mb-5 text-3xl text-terracotta/60"
            />
            <p className="manuscript-label">FIRST ENTRY</p>
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
      className="group grid gap-5 py-8 md:grid-cols-[6.5rem_minmax(0,1fr)_auto] md:items-start md:gap-8"
    >
      <p className="font-mono text-[10px] font-semibold tracking-[0.08em] text-terracotta [font-variant-numeric:tabular-nums]">
        {new Date(entry.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" })}
      </p>
      <div className="min-w-0 border-l border-paper-border pl-5 transition-colors group-hover:border-terracotta/70">
        <h3 className="text-balance font-serif text-lg leading-8 text-ink transition-colors group-hover:text-terracotta md:text-xl">
          {`"${entry.reading.question}"`}
        </h3>
        <p className="mt-4 text-sm leading-7 text-text-muted">
          {entry.reading.themes.slice(0, 3).map((theme) => (
            <span
              key={theme}
              className="after:mx-2 after:text-paper-border after:content-['/'] last:after:hidden"
            >
              {theme}
            </span>
          ))}
        </p>
        {entry.user_notes && (
          <div className="mt-4 flex items-center gap-2 text-text-muted">
            <LegacyIcon name="edit_note" className="text-[16px] text-terracotta/70" />
            <span className="truncate text-xs">沉淀了感悟</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-3 md:justify-end">
          <button
            type="button"
            onClick={onReplay}
            className="min-h-10 border-b border-ink/30 font-sans text-sm text-ink transition-colors hover:border-terracotta hover:text-terracotta"
          >
            回看解读
          </button>
          {entry.reading.session_capsule ? (
            <button
              type="button"
              onClick={onContinue}
              className="min-h-10 border-b border-terracotta/40 font-sans text-sm text-terracotta transition-colors hover:border-terracotta"
            >
              延续这条线
            </button>
          ) : null}
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
      id={`journey-theme-${index}`}
      className="scroll-mt-24 border-t border-paper-border pt-8 first:border-t-0 first:pt-0"
    >
      <div className="mb-7 flex items-end justify-between gap-6">
        <div className="space-y-2">
          <p className="manuscript-label">
            THEME {String(index + 1).padStart(2, "0")}
          </p>
          <h3 className="font-serif text-2xl font-medium text-ink">{cluster.name}</h3>
          <p className="text-xs text-text-muted">{cluster.entries.length} 次意识共振</p>
        </div>
        <span className="font-mono text-xs text-text-placeholder [font-variant-numeric:tabular-nums]">{String(cluster.entries.length).padStart(2, "0")}</span>
      </div>

      <div className="space-y-4">
        {cluster.entries.slice(0, 4).map((entry) => (
          <div
            key={entry.id}
            className="border-b border-paper-border/70 py-4 first:pt-0"
          >
            <div className="grid items-start gap-3 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-5">
              <p className="font-mono text-[10px] text-terracotta [font-variant-numeric:tabular-nums]">
                {new Date(entry.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
              </p>
              <div className="min-w-0">
                <p className="line-clamp-2 font-serif text-base leading-7 text-ink">
                  {entry.reading.question}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 sm:pl-[7rem]">
              <button
                type="button"
                onClick={() => onSelectEntry(entry)}
                className="border-b border-ink/30 pb-1 text-xs text-ink transition-colors hover:border-terracotta hover:text-terracotta"
              >
                回看
              </button>
              {entry.reading.session_capsule ? (
                <button
                  type="button"
                  onClick={() => onContinueEntry(entry)}
                  className="border-b border-terracotta/40 pb-1 text-xs text-terracotta transition-colors hover:border-terracotta"
                >
                  延续这条线
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {cluster.entries.length > 4 && (
          <p className="pt-4 font-serif text-sm italic text-text-placeholder">
            及其他 {cluster.entries.length - 4} 条回响...
          </p>
        )}
      </div>
    </motion.div>
  );
}

