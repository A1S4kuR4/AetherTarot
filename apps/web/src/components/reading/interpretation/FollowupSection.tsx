"use client";

import type { FollowupAnswer } from "@aethertarot/shared-types";
import { ChapterNumber } from "./ChapterNumber";

interface FollowupSectionProps {
  readingId: string;
  readingPhase: "initial" | "final";
  questions: string[];
  answers?: FollowupAnswer[] | null;
  chapterLabel?: string;
}

export function FollowupSection({
  readingId,
  readingPhase,
  questions,
  answers,
  chapterLabel,
}: FollowupSectionProps) {
  const isFinal = readingPhase === "final";
  const title = isFinal ? "回望与觉察" : "继续探索";

  return (
    <section id="reading-followup" className="scroll-mt-32">
      <ChapterNumber value={chapterLabel} />
      <h2 className="reading-section-title">{title}</h2>
      <div className="mt-5 space-y-5">
        {questions.map((prompt, index) => {
          const matchingAnswer = answers?.find((a) => a.question === prompt) ?? answers?.[index];

          return (
            <div key={`${readingId}-followup-${index}`}>
              <p className="font-serif text-[15px] leading-relaxed text-ink">
                问题 {index + 1}：{prompt}
              </p>
              {isFinal && matchingAnswer?.answer ? (
                <blockquote className="mt-2 border-l border-paper-border pl-4 text-sm leading-relaxed text-text-muted">
                  {matchingAnswer.answer}
                </blockquote>
              ) : null}
            </div>
          );
        })}
      </div>
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
  chapterLabel?: string;
}

export function FollowupAnswerFormSection({
  readingId,
  questions,
  drafts,
  isValid,
  isLoading,
  onDraftChange,
  onSubmit,
  chapterLabel,
}: FollowupAnswerFormSectionProps) {
  return (
    <section id="reading-followup" className="scroll-mt-32">
      <ChapterNumber value={chapterLabel} />
      <h2 className="reading-section-title">回望与觉察</h2>
      <div className="mt-6 border border-terracotta/30 bg-terracotta/[0.05] p-5 md:p-7">
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
              name={`followup_answer_${index + 1}`}
              value={drafts[index] ?? ""}
              onChange={(event) => onDraftChange(index, event.target.value)}
              autoComplete="off"
              placeholder="写下你的现实补充…"
              className="h-24 w-full resize-none border border-paper-border bg-paper p-4 font-serif text-base text-ink outline-none focus-visible:border-terracotta/50 focus-visible:ring-2 focus-visible:ring-terracotta/40"
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={!isValid || isLoading}
        onClick={onSubmit}
        className="btn-primary mt-6 disabled:cursor-not-allowed disabled:opacity-50"
      >
        生成整合深读
      </button>
      </div>
    </section>
  );
}
