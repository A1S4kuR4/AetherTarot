"use client";

import LegacyIcon from "@/components/ui/LegacyIcon";
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
  trustPathCards: TrustPathCard[];
  spreadExperience: SpreadExperience | null;
  continuitySource: ContinuitySource | null;
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

  return `${trimmed}...`;
}

export function EvidencePanel({
  question,
  reading,
  spreadName,
  trustPathCards,
  spreadExperience,
  continuitySource,
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
      kicker="解读依据"
      title="这个解读是怎么来的"
      defaultOpen={false}
      collapsedHint={collapsedHint}
      className="border-terracotta/20 bg-paper-raised/70"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-paper-border bg-paper px-5 py-4">
          <div className="mb-3 flex items-center gap-2 text-terracotta">
            <LegacyIcon name="edit_note" className="text-[18px]" />
            <h3 className="font-serif text-lg text-ink">你的问题</h3>
          </div>
          <p className="text-sm leading-relaxed text-text-body">{question}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="chip-accent text-[10px]">
              {QUESTION_TYPE_LABELS[reading.question_type]}
            </span>
            <span className="chip-warm text-[10px]">
              {continuitySource ? "带延续线索" : "无延续线索"}
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-paper-border bg-paper px-5 py-4">
          <div className="mb-3 flex items-center gap-2 text-terracotta">
            <LegacyIcon name="style" className="text-[18px]" />
            <h3 className="font-serif text-lg text-ink">牌面线索</h3>
          </div>
          <div className="space-y-3">
            {trustPathCards.map((card) => (
              <div
                key={`trust-${card.position_id}`}
                className="border-l-2 border-paper-border pl-3"
              >
                <p className="text-sm font-medium text-ink">
                  {card.position}：{card.name}（{card.orientation === "reversed" ? "逆位" : "正位"}）
                </p>
                {card.keywords.length > 0 ? (
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">
                    {card.keywords.join(" / ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-paper-border bg-paper px-5 py-4">
          <div className="mb-3 flex items-center gap-2 text-terracotta">
            <LegacyIcon name="account_tree" className="text-[18px]" />
            <h3 className="font-serif text-lg text-ink">解读逻辑</h3>
          </div>
          <p className="text-sm leading-relaxed text-text-body">
            {spreadExperience?.readingMechanism}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            {spreadExperience?.evidencePath}
          </p>
        </div>
      </div>
    </CollapsibleSection>
  );
}
