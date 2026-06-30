"use client";

import { cn } from "@/lib/utils";
import type { PresentationMode } from "@aethertarot/shared-types";

interface FollowupSectionProps {
  readingId: string;
  readingPhase: "initial" | "final";
  questions: string[];
  presentationMode?: PresentationMode;
}

export function FollowupSection({
  readingId,
  readingPhase,
  questions,
  presentationMode,
}: FollowupSectionProps) {
  const isFinal = readingPhase === "final";
  const title = isFinal ? "回望与觉察" : "继续探索";
  const kicker = isFinal ? "觉察" : "探索";

  return (
    <section
      id="reading-followup"
      className={cn(
        "reading-card scroll-mt-32",
        presentationMode === "void_narrative" && "border-none bg-transparent px-0 shadow-none",
        presentationMode === "sober_anchor" && "border-paper-border bg-paper",
      )}
    >
      <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
        {kicker}
      </p>
      <h2 className="mt-1 font-serif text-2xl text-ink">{title}</h2>
      <ul className="mt-4 space-y-3">
        {questions.map((prompt, index) => (
          <li
            key={`${readingId}-followup-${index}`}
            className="rounded-xl border border-paper-border bg-paper px-5 py-3.5 text-base leading-relaxed text-text-body"
          >
            {prompt}
          </li>
        ))}
      </ul>
    </section>
  );
}

interface FollowupAnswerFormSectionProps {
  readingId: string;
  questions: string[];
  drafts: Record<number, string>;
  isValid: boolean;
  isLoading: boolean;
  onDraftChange: (index: number, value: string) => void;
  onSubmit: () => void;
}

export function FollowupAnswerFormSection({
  readingId,
  questions,
  drafts,
  isValid,
  isLoading,
  onDraftChange,
  onSubmit,
}: FollowupAnswerFormSectionProps) {
  return (
    <section className="reading-card scroll-mt-32 border-terracotta/30 bg-terracotta/5">
      <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
        校准
      </p>
      <h2 className="mt-1 font-serif text-2xl text-ink">回答后进入整合深读</h2>
      <p className="mt-3 text-sm leading-relaxed text-text-body">
        这些问题来自牌面里的矛盾点。你的回答不会推翻初读，只会帮助系统把解释空间收束得更贴近现实。
      </p>
      <div className="mt-5 space-y-4">
        {questions.map((prompt, index) => (
          <label
            key={`${readingId}-answer-${index}`}
            className="block space-y-2"
          >
            <span className="block font-serif text-sm text-ink">
              {index + 1}. {prompt}
            </span>
            <textarea
              value={drafts[index] ?? ""}
              onChange={(event) => onDraftChange(index, event.target.value)}
              placeholder="写下你的现实补充..."
              className="h-24 w-full resize-none rounded-xl border border-paper-border bg-paper p-4 font-serif text-base text-ink outline-none focus:border-terracotta/50 focus:ring-1 focus:ring-terracotta/50"
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={!isValid || isLoading}
        onClick={onSubmit}
        className="btn-primary mt-6 transition-all disabled:cursor-not-allowed disabled:opacity-50"
      >
        生成整合深读
      </button>
    </section>
  );
}
