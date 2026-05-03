"use client";

import { useState } from "react";
import type {
  EncyclopediaQueryResponse,
  TarotCard,
} from "@aethertarot/shared-types";
import LegacyIcon from "@/components/ui/LegacyIcon";
import { cn } from "@/lib/utils";

type QueryState =
  | { status: "idle"; data?: undefined; error?: undefined }
  | { status: "loading"; data?: EncyclopediaQueryResponse; error?: undefined }
  | { status: "success"; data: EncyclopediaQueryResponse; error?: undefined }
  | { status: "error"; data?: EncyclopediaQueryResponse; error: string };

async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string };
    };

    return payload.error?.message ?? "百科问答暂时不可用。";
  } catch {
    return "百科问答暂时不可用。";
  }
}

export default function EncyclopediaQuestionPanel({
  activeCard,
}: {
  activeCard: TarotCard;
}) {
  const [query, setQuery] = useState(`这张牌逆位怎么理解？`);
  const [queryState, setQueryState] = useState<QueryState>({ status: "idle" });

  const submitQuery = async () => {
    const normalizedQuery = query.trim();

    if (!normalizedQuery || queryState.status === "loading") {
      return;
    }

    setQueryState((current) => ({
      status: "loading",
      data: current.data,
    }));

    try {
      const response = await fetch("/api/encyclopedia/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: normalizedQuery,
          cardId: activeCard.id,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as EncyclopediaQueryResponse;
      setQueryState({ status: "success", data });
    } catch (error) {
      setQueryState({
        status: "error",
        error: error instanceof Error ? error.message : "百科问答暂时不可用。",
      });
    }
  };

  const quickQuestions = [
    `这张牌逆位怎么理解？`,
    `${activeCard.name} 在关系问题里常见含义是什么？`,
    `${activeCard.name} 和哪些主题有关？`,
  ];

  return (
    <section
      data-testid="encyclopedia-agent-panel"
      className="space-y-4 rounded-2xl border border-paper-border bg-paper p-4"
    >
      <div className="flex items-center gap-2.5">
        <LegacyIcon name="auto_stories" className="text-xl text-terracotta" />
        <div>
          <h3 className="font-serif text-xl text-ink">百科问答</h3>
          <p className="text-xs text-text-muted">
            基于当前知识库回答牌义、概念与牌阵问题。
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {quickQuestions.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setQuery(item)}
            className="rounded-full border border-paper-border bg-paper-raised px-3 py-1.5 text-xs text-text-muted transition hover:border-terracotta/40 hover:text-terracotta"
          >
            {item}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="sr-only">向塔罗百科提问</span>
        <textarea
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          rows={3}
          maxLength={500}
          placeholder="问一个牌义、逆位、象征或牌阵问题..."
          className="w-full resize-none rounded-2xl border border-paper-border bg-paper-raised px-4 py-3 text-sm leading-relaxed text-text-body outline-none transition focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10"
        />
      </label>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-muted">
          当前锚定：{activeCard.name}
        </p>
        <button
          type="button"
          onClick={submitQuery}
          disabled={!query.trim() || queryState.status === "loading"}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition",
            !query.trim() || queryState.status === "loading"
              ? "cursor-not-allowed bg-paper-border text-text-muted"
              : "bg-terracotta text-paper shadow-sm hover:bg-terracotta/90",
          )}
        >
          <LegacyIcon
            name={queryState.status === "loading" ? "hourglass_top" : "search"}
            className="text-base"
          />
          {queryState.status === "loading" ? "检索中" : "提问"}
        </button>
      </div>

      {queryState.status === "error" ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {queryState.error}
        </div>
      ) : null}

      {queryState.data ? (
        <div
          data-testid="encyclopedia-agent-answer"
          className="space-y-4 rounded-2xl border border-paper-border bg-paper-raised p-4"
        >
          <p className="whitespace-pre-line text-sm leading-[1.8] text-text-body">
            {queryState.data.answer}
          </p>

          {queryState.data.boundary_note ? (
            <div className="rounded-2xl border border-terracotta/20 bg-terracotta/10 px-4 py-3 text-xs leading-relaxed text-terracotta">
              {queryState.data.boundary_note}
            </div>
          ) : null}

          {queryState.data.sources.length > 0 ? (
            <div className="space-y-2">
              <h4 className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
                来源
              </h4>
              <div className="grid gap-2">
                {queryState.data.sources.map((source) => (
                  <article
                    key={`${source.path}-${source.excerpt}`}
                    className="rounded-2xl border border-paper-border bg-paper px-3 py-2"
                  >
                    <p className="text-sm font-medium text-ink">{source.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-text-muted">
                      {source.excerpt}
                    </p>
                    <p className="mt-1 text-[11px] text-text-muted">
                      {source.path} · {source.source_ids.join(", ") || "未知来源"}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
