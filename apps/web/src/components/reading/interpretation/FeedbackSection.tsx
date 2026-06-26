"use client";

import { cn } from "@/lib/utils";
import { FEEDBACK_OPTIONS } from "./constants";
import type { FeedbackLabel } from "./constants";

interface FeedbackSectionProps {
  labels: FeedbackLabel[];
  note: string;
  isSubmitted: boolean;
  error: string | null;
  onToggleLabel: (value: FeedbackLabel) => void;
  onNoteChange: (value: string) => void;
  onSubmit: () => void;
}

export function FeedbackSection({
  labels,
  note,
  isSubmitted,
  error,
  onToggleLabel,
  onNoteChange,
  onSubmit,
}: FeedbackSectionProps) {
  return (
    <section
      id="reading-feedback"
      className="reading-card scroll-mt-32 bg-paper-raised"
    >
      <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
        反馈
      </p>
      <h2 className="mt-1 font-serif text-2xl text-ink">这次解读给你的感觉</h2>
      <div className="mt-5 flex flex-wrap gap-2">
        {FEEDBACK_OPTIONS.map((option) => {
          const isSelected = labels.includes(option.value);

          return (
            <button
              key={option.value}
              type="button"
              disabled={isSubmitted}
              onClick={() => onToggleLabel(option.value)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                isSelected
                  ? "border-terracotta/40 bg-terracotta/10 text-terracotta"
                  : "border-paper-border bg-paper text-text-body hover:bg-paper-muted",
                isSubmitted && "cursor-not-allowed opacity-70",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <textarea
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        disabled={isSubmitted}
        placeholder="可选：哪里准确、哪里模板、哪里太迎合？"
        className="mt-4 h-24 w-full resize-none rounded-xl border border-paper-border bg-paper p-4 font-serif text-base text-ink outline-none focus:border-terracotta/50 focus:ring-1 focus:ring-terracotta/50 disabled:opacity-70"
      />
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-muted">
          {isSubmitted ? "反馈已记录，谢谢。" : error}
        </p>
        <button
          type="button"
          disabled={isSubmitted || labels.length === 0}
          onClick={onSubmit}
          className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          提交反馈
        </button>
      </div>
    </section>
  );
}
