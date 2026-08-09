"use client";

import { cn } from "@/lib/utils";
import { FEEDBACK_OPTIONS } from "./constants";
import type { FeedbackLabel } from "./constants";
import { ChapterNumber } from "./ChapterNumber";

interface FeedbackSectionProps {
  labels: FeedbackLabel[];
  note: string;
  isSubmitted: boolean;
  isSubmitting: boolean;
  error: string | null;
  replayConsent: boolean;
  onToggleLabel: (value: FeedbackLabel) => void;
  onNoteChange: (value: string) => void;
  onReplayConsentChange: (value: boolean) => void;
  onSubmit: () => void;
  chapterLabel?: string;
}

export function FeedbackSection({
  labels,
  note,
  isSubmitted,
  isSubmitting,
  error,
  replayConsent,
  onToggleLabel,
  onNoteChange,
  onReplayConsentChange,
  onSubmit,
  chapterLabel,
}: FeedbackSectionProps) {
  return (
    <section id="reading-feedback" className="scroll-mt-32">
      <ChapterNumber value={chapterLabel} />
      <h2 className="reading-section-title">这次解读给你的感觉</h2>
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2" role="group" aria-label="反馈标签">
        {FEEDBACK_OPTIONS.map((option) => {
          const isSelected = labels.includes(option.value);

          return (
            <button
              key={option.value}
              type="button"
              disabled={isSubmitted}
              aria-pressed={isSelected}
              onClick={() => onToggleLabel(option.value)}
              className={cn(
                "min-h-11 border-b-2 px-1 text-sm transition-colors",
                isSelected
                  ? "border-terracotta text-terracotta-ink"
                  : "border-transparent text-text-body hover:border-paper-border",
                isSubmitted && "cursor-not-allowed opacity-70",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <textarea
        name="feedback_note"
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        disabled={isSubmitted}
        autoComplete="off"
        aria-label="反馈补充（可选）"
        placeholder="可选：哪里准确、哪里模板、哪里太迎合？"
        className="mt-5 h-24 w-full resize-none border-y border-paper-border bg-transparent px-0 py-3 font-serif text-base text-ink outline-none focus-visible:border-terracotta focus-visible:ring-2 focus-visible:ring-terracotta/20 disabled:opacity-70"
      />
      <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-text-muted">
        <input
          type="checkbox"
          name="feedback_replay_consent"
          checked={replayConsent}
          disabled={isSubmitted}
          onChange={(event) => onReplayConsentChange(event.target.checked)}
          className="mt-1"
        />
        <span>
          我同意将这次解读与反馈在去标识化后用于内部质量评估。默认不授权，也不会影响反馈提交。
        </span>
      </label>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" aria-live="polite" className={cn("text-sm", error && !isSubmitted ? "text-error" : "text-text-muted")}>
          {isSubmitted ? "反馈已记录，谢谢。" : isSubmitting ? "正在提交…" : error}
        </p>
        <button
          type="button"
          disabled={isSubmitted || isSubmitting || labels.length === 0}
          onClick={onSubmit}
          className="min-h-11 border border-paper-border px-5 py-2 text-sm text-ink transition-colors hover:border-terracotta hover:text-terracotta disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "正在提交…" : "提交反馈"}
        </button>
      </div>
    </section>
  );
}
