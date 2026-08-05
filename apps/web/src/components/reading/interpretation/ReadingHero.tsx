"use client";

import { QUESTION_TYPE_LABELS } from "./constants";
import type { QuestionType } from "@aethertarot/shared-types";

interface ReadingHeroProps {
  phase: "initial" | "final" | null;
  question: string;
  questionType: QuestionType | null;
  spreadName: string;
  isOffline: boolean;
  hideQuestion?: boolean;
}

export function ReadingHero({
  phase,
  question,
  questionType,
  spreadName,
  isOffline,
  hideQuestion = false,
}: ReadingHeroProps) {
  const phaseLabel = phase === "final" ? "解读结果" : "初步解读";
  const metaParts = [
    phaseLabel,
    spreadName,
    questionType ? QUESTION_TYPE_LABELS[questionType] : null,
    isOffline ? "线下录入" : null,
  ].filter((part): part is string => Boolean(part));

  return (
    <header className="border-b border-paper-border pb-9">
      <p
        data-testid="reading-hero-meta"
        className="manuscript-label"
      >
        {metaParts.join(" · ")}
      </p>
      <h1 className="mt-5 max-w-[46rem] text-balance font-serif text-[28px] leading-[1.4] tracking-[-0.02em] text-ink md:text-[38px] md:leading-[1.3]">
        {hideQuestion ? `${spreadName} · ${phaseLabel}` : `"${question}"`}
      </h1>
    </header>
  );
}
