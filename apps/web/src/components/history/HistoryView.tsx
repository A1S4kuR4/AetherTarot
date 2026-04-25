"use client";

import { useMemo } from "react";

import { useRouter } from "next/navigation";
import { getAllSpreads } from "@aethertarot/domain-tarot";
import { HISTORY_THUMBNAIL } from "@/constants";
import { useReading } from "@/context/ReadingContext";
import LegacyIcon from "@/components/ui/LegacyIcon";

const spreads = getAllSpreads();

function formatHistoryDate(createdAt: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(createdAt));
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  relationship: "关系议题",
  career: "职业议题",
  self_growth: "自我成长",
  decision: "行动选择",
  other: "综合议题",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function analyzeRecentThemes(history: any[]) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentReadings = history.filter((entry) => {
    return new Date(entry.createdAt) >= thirtyDaysAgo;
  });

  const typeCounts: Record<string, number> = {};
  for (const entry of recentReadings) {
    const qt = entry.reading?.question_type;
    if (qt && qt !== "other") {
      typeCounts[qt] = (typeCounts[qt] || 0) + 1;
    }
  }

  let topType = null;
  let maxCount = 0;
  for (const [qt, count] of Object.entries(typeCounts)) {
    if (count > maxCount) {
      maxCount = count;
      topType = qt;
    }
  }

  if (maxCount >= 2 && topType) {
    return { type: topType, count: maxCount };
  }
  return null;
}

export default function HistoryView() {
  const router = useRouter();
  const { history, selectHistoryReading, continueFromHistoryReading } = useReading();

  const recentTheme = useMemo(() => analyzeRecentThemes(history), [history]);

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

      {history.length > 0 && recentTheme && (
        <div className="mb-10 rounded-3xl border border-terracotta/20 bg-gradient-to-r from-terracotta/5 to-paper p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <LegacyIcon name="psychology" className="text-xl text-terracotta/80" />
            <h3 className="font-serif text-xl text-ink">阶段觉察追踪</h3>
          </div>
          <p className="font-sans text-sm leading-[1.8] text-text-body">
            系统注意到，在过去的 30 天里，你有 <strong className="text-terracotta">{recentTheme.count}</strong> 次问及了与「<strong>{QUESTION_TYPE_LABELS[recentTheme.type]}</strong>」相关的议题。
            <br />
            <br />
            如果某个主题在你的生命中反复回旋，或许它不是在向你索求答案，而是在邀请你更深地注视它的结构。你可以随时点击下方的某条历史记录，更新你的「反思手记」。
          </p>
        </div>
      )}

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
              <article
                key={historyEntry.id}
                className="group relative w-full cursor-pointer rounded-2xl border border-paper-border bg-paper-raised p-5 text-left transition-all duration-200 hover:border-terracotta/20 hover:shadow-sm"
              >
                <div className="flex items-start gap-5">
                  <div className="h-24 w-[68px] shrink-0 overflow-hidden rounded-xl border border-paper-border">
                    <img
                      src={HISTORY_THUMBNAIL}
                      alt="Reading"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-start justify-between gap-4">
                      <span className="font-sans text-[11px] font-medium text-text-muted">
                        {formatHistoryDate(historyEntry.createdAt)}
                      </span>
                      <LegacyIcon
                        name="north_east"
                        className="text-sm text-terracotta opacity-0 transition-opacity group-hover:opacity-100"
                      />
                    </div>

                    <h3 className="mb-1.5 font-serif text-lg text-ink">
                      {spread?.name ?? historyEntry.reading.spread.name}
                    </h3>

                    <p className="line-clamp-2 text-sm italic leading-relaxed text-text-muted">
                      {`"${historyEntry.reading.question}"`}
                    </p>

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

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          selectHistoryReading(historyEntry);
                          router.push("/reading");
                        }}
                        className="rounded-full border border-paper-border bg-paper px-4 py-2 text-xs font-medium text-ink transition hover:bg-paper"
                      >
                        回看这次解读
                      </button>
                      {historyEntry.reading.session_capsule ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (!continueFromHistoryReading(historyEntry)) {
                              return;
                            }

                            router.push("/new");
                          }}
                          className="rounded-full border border-terracotta/20 bg-terracotta/5 px-4 py-2 text-xs font-medium text-terracotta transition hover:bg-terracotta/10"
                        >
                          延续这条线
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
