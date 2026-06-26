"use client";

import LegacyIcon from "@/components/ui/LegacyIcon";
import { CollapsibleSection } from "./CollapsibleSection";
import { QUESTION_TYPE_LABELS } from "./constants";
import type { ContinuitySource } from "@/context/ReadingContext";
import type {
  DrawnCard,
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
  drawnCards: DrawnCard[];
  trustPathCards: TrustPathCard[];
  spreadExperience: SpreadExperience | null;
  continuitySource: ContinuitySource | null;
}

export function EvidencePanel({
  question,
  reading,
  drawnCards,
  trustPathCards,
  spreadExperience,
  continuitySource,
}: EvidencePanelProps) {
  const collapsedHint = (
    <p className="text-sm leading-relaxed text-text-muted">
      基于你的提问、{drawnCards.length} 张牌面与牌阵位置综合分析得出。点击展开查看详细依据。
    </p>
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
