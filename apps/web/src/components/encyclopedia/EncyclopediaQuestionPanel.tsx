"use client";

import { useState, useSyncExternalStore } from "react";
import type {
  EncyclopediaQueryResponse,
  ReadingErrorPayload,
  TarotCard,
} from "@aethertarot/shared-types";
import LegacyIcon from "@/components/ui/LegacyIcon";
import { cn } from "@/lib/utils";
import { formatSourceLabel } from "@/lib/encyclopedia/wiki-content";

type QueryState =
  | { status: "idle"; data?: undefined; error?: undefined }
  | { status: "loading"; data?: EncyclopediaQueryResponse; error?: undefined }
  | { status: "success"; data: EncyclopediaQueryResponse; error?: undefined }
  | { status: "error"; data?: EncyclopediaQueryResponse; error: string }
  | {
      status: "safety_intercept";
      data?: EncyclopediaQueryResponse;
      reason: string;
      referralLinks: string[];
    };

const subscribeToClientReady = () => () => undefined;
const getClientReadySnapshot = () => true;
const getServerReadySnapshot = () => false;

async function readErrorPayload(response: Response) {
  try {
    const payload = (await response.json()) as ReadingErrorPayload;

    return payload.error;
  } catch {
    return null;
  }
}

export default function EncyclopediaQuestionPanel({
  activeCard,
}: {
  activeCard: TarotCard;
}) {
  const [query, setQuery] = useState(`这张牌逆位怎么理解？`);
  const [queryState, setQueryState] = useState<QueryState>({ status: "idle" });
  const isClientReady = useSyncExternalStore(
    subscribeToClientReady,
    getClientReadySnapshot,
    getServerReadySnapshot,
  );

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
        const errorPayload = await readErrorPayload(response);

        if (errorPayload?.code === "safety_intercept") {
          setQueryState({
            status: "safety_intercept",
            reason:
              errorPayload.intercept_reason
              ?? errorPayload.message
              ?? "这次问题需要先回到现实安全与支持。",
            referralLinks: errorPayload.referral_links ?? [],
          });
          return;
        }

        throw new Error(errorPayload?.message ?? "百科问答暂时不可用。");
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
      className="space-y-5 border-t border-paper-border pt-8"
    >
      <div className="flex items-start gap-3">
        <LegacyIcon name="auto_stories" className="mt-1 text-lg text-terracotta" />
        <div>
          <p className="manuscript-label">ASK THE ARCHIVE</p>
          <h3 className="mt-2 font-serif text-xl text-ink">向百科提问</h3>
          <p className="mt-1 text-xs leading-6 text-text-muted">
            基于当前知识库回答牌义、概念与牌阵问题。
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {quickQuestions.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setQuery(item)}
            className="inline-flex min-h-11 items-center border-b border-paper-border px-1 py-2 text-xs text-text-muted transition-colors hover:border-terracotta hover:text-terracotta"
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
          readOnly={!isClientReady}
          rows={3}
          maxLength={500}
          placeholder="问一个牌义、逆位、象征或牌阵问题..."
          className="w-full resize-none border-y border-paper-border bg-transparent px-0 py-3 text-sm leading-relaxed text-text-body outline-none transition focus:border-terracotta"
        />
      </label>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-muted">
          当前锚定：{activeCard.name}
        </p>
        <button
          type="button"
          onClick={submitQuery}
          disabled={!isClientReady || !query.trim() || queryState.status === "loading"}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 border px-4 py-2 font-serif text-sm transition-colors",
            !query.trim() || queryState.status === "loading"
              ? "cursor-not-allowed border-paper-border text-text-muted"
              : "border-terracotta-ink bg-terracotta-ink text-paper hover:bg-terracotta-active",
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
        <div className="border-l border-red-200 px-4 py-3 text-sm text-red-700">
          {queryState.error}
        </div>
      ) : null}

      {queryState.status === "safety_intercept" ? (
        <div
          data-testid="encyclopedia-safety-intercept"
          className="space-y-3 border-l border-red-900/30 px-4 py-4 text-sm text-red-200"
        >
          <div className="flex items-center gap-2 font-medium text-red-300">
            <LegacyIcon name="gavel" className="text-lg" />
            <span>现实安全优先</span>
          </div>
          <p className="leading-relaxed">{queryState.reason}</p>
          {queryState.referralLinks.length > 0 ? (
            <div className="flex flex-col gap-2">
              {queryState.referralLinks.map((link) => (
                <a
                  key={link}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-xs text-red-300 underline hover:text-red-200"
                >
                  {link}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {queryState.data ? (
        <div
          data-testid="encyclopedia-agent-answer"
          className="space-y-5 border-y border-paper-border py-6"
        >
          <p className="whitespace-pre-line text-sm leading-[1.8] text-text-body">
            {queryState.data.answer}
          </p>

          {queryState.data.boundary_note ? (
            <div className="border-l border-terracotta/40 pl-4 text-xs leading-relaxed text-terracotta">
              {queryState.data.boundary_note}
            </div>
          ) : null}

          {queryState.data.sources.length > 0 ? (
            <div className="space-y-2">
              <h4 className="manuscript-label">
                来源
              </h4>
              <div className="space-y-3">
                {queryState.data.sources.map((source) => (
                  <article
                    key={`${source.path}-${source.excerpt}`}
                    className="border-l border-paper-border pl-3"
                  >
                    <p className="text-sm font-medium text-ink">{source.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-text-muted">
                      {source.excerpt}
                    </p>
                    <p className="mt-1 text-[11px] text-text-muted">
                      {source.path} · {source.source_ids.map(formatSourceLabel).join(", ") || "未知来源"}
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
