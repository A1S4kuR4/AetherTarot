"use client";

import { CollapsibleSection } from "./CollapsibleSection";
import { QUESTION_TYPE_LABELS } from "./constants";
import type { ContinuitySource } from "@/context/ReadingContext";
import type {
  ReadingCardResult,
  StructuredReading,
} from "@aethertarot/shared-types";

interface TrustPathCard extends ReadingCardResult {
  keywords: string[];
}

interface SpreadExperience {
  readingMechanism?: string;
  evidencePath?: string;
}

interface EvidencePanelProps {
  question: string;
  reading: StructuredReading;
  spreadName: string;
  drawSourceLabel: string;
  trustPathCards: TrustPathCard[];
  spreadExperience: SpreadExperience | null;
  continuitySource: ContinuitySource | null;
  chapterLabel?: string;
}

const FALLBACK_MECHANISM_SUMMARY = "基于提问、牌阵位置与牌面关键词综合整理。";
const SUMMARY_MAX_LENGTH = 60;

function summarizeMechanism(value: string | undefined) {
  const normalized = value?.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return FALLBACK_MECHANISM_SUMMARY;
  }

  if (normalized.length <= SUMMARY_MAX_LENGTH) {
    return normalized;
  }

  const slice = normalized.slice(0, SUMMARY_MAX_LENGTH);
  const boundaryIndex = Math.max(
    slice.lastIndexOf("。"),
    slice.lastIndexOf("，"),
    slice.lastIndexOf("；"),
    slice.lastIndexOf("、"),
    slice.lastIndexOf("."),
    slice.lastIndexOf(","),
    slice.lastIndexOf(";"),
    slice.lastIndexOf(" "),
  );
  const trimmed = boundaryIndex > 12 ? slice.slice(0, boundaryIndex + 1).trim() : slice.trim();

  return `${trimmed}…`;
}

export function EvidencePanel({
  question,
  reading,
  spreadName,
  drawSourceLabel,
  trustPathCards,
  spreadExperience,
  continuitySource,
  chapterLabel,
}: EvidencePanelProps) {
  const totalCards = reading.cards.length;
  const firstCardName = trustPathCards[0]?.name ?? reading.cards[0]?.name ?? "暂无";
  const cardSummary = totalCards > 1
    ? `${firstCardName}等 ${totalCards} 张`
    : firstCardName;
  const collapsedHint = (
    <div
      data-testid="reading-evidence-summary"
      className="space-y-1.5 text-sm leading-relaxed text-text-muted"
    >
      <p>
        {QUESTION_TYPE_LABELS[reading.question_type]} · {spreadName} · 关键牌：{cardSummary}
      </p>
      <p>{summarizeMechanism(spreadExperience?.readingMechanism)}</p>
    </div>
  );

  return (
    <CollapsibleSection
      id="reading-evidence"
      title="这个解读是怎么来的"
      chapterLabel={chapterLabel}
      defaultOpen={false}
      collapsedHint={collapsedHint}
    >
      <div className="reading-evidence-block">
        <p className="reading-evidence-meta">
          {QUESTION_TYPE_LABELS[reading.question_type]} · {spreadName} · 关键牌：{cardSummary}
          {reading.themes.length > 0 ? ` · 主题：${reading.themes.join(" / ")}` : ""}
        </p>
        <div className="reading-evidence-grid">
          <div>
            <h3>你的问题</h3>
            <p className="reading-evidence-copy">{question}</p>
            <p className="reading-evidence-subcopy">
              {QUESTION_TYPE_LABELS[reading.question_type]} · {drawSourceLabel}
            </p>
            {continuitySource ? (
              <span className="reading-continuity-tag">
                延续线索：{continuitySource.question}
              </span>
            ) : null}
          </div>
          <div>
            <h3>牌面线索</h3>
            <ul className="reading-evidence-card-list">
              {trustPathCards.map((card) => (
                <li key={`trust-${card.position_id}`}>
                  <p>{card.position}：{card.name}（{card.orientation === "reversed" ? "逆位" : "正位"}）</p>
                  {card.keywords.length > 0 ? (
                    <span>{card.keywords.join(" / ")}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>解读逻辑</h3>
            <p className="reading-evidence-copy">
              {spreadExperience?.readingMechanism ?? FALLBACK_MECHANISM_SUMMARY}
            </p>
            {spreadExperience?.evidencePath ? (
              <p className="reading-evidence-subcopy">{spreadExperience.evidencePath}</p>
            ) : null}
          </div>
        </div>
        {reading.grounding ? (
          <details
            data-testid="reading-grounding-sources"
            className="mx-6 border-t border-paper-border/60 py-5"
          >
            <summary className="cursor-pointer text-sm font-medium text-ink">
              牌义来源
              <span className="ml-2 text-xs font-normal text-text-muted">
                {reading.grounding.status === "degraded"
                  ? "部分使用运行时牌面资料"
                  : `${reading.grounding.sources.length} 条已校验来源`}
              </span>
            </summary>
            <div className="mt-4 space-y-4">
              {reading.cards.map((card, index) => {
                const claim = reading.grounding?.claims.find(
                  (item) => item.path === `cards.${index}.interpretation`,
                );
                const sources = reading.grounding?.sources.filter((source) =>
                  claim?.source_refs.includes(source.ref)
                ) ?? [];
                return (
                  <div key={`grounding-${card.position_id}`} className="border-l border-paper-border pl-3">
                    <p className="text-sm font-medium text-ink">
                      {card.position}：{card.name}
                    </p>
                    {sources.map((source) => (
                      <p key={source.ref} className="mt-1 text-xs leading-relaxed text-text-muted">
                        {source.title}
                        {source.source_ids.length > 0
                          ? ` · ${source.source_ids.join(" / ")}`
                          : " · 权威运行时牌面资料"}
                      </p>
                    ))}
                  </div>
                );
              })}
              <div className="border-l border-paper-border pl-3">
                <p className="text-sm font-medium text-ink">综合解读</p>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  综合只使用上方已校验的逐牌来源；未验证引用不会展示。
                </p>
              </div>
            </div>
          </details>
        ) : null}
      </div>
    </CollapsibleSection>
  );
}
