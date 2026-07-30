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
    <header>
      <p
        data-testid="reading-hero-meta"
        className="font-sans text-[13px] font-medium tracking-wide text-text-muted"
      >
        {metaParts.join(" · ")}
      </p>
      <h1 className="mt-4 max-w-[46rem] font-serif text-[26px] leading-[1.4] text-ink md:text-[34px] md:leading-[1.35]">
        {hideQuestion ? `${spreadName} · ${phaseLabel}` : `"${question}"`}
      </h1>
    </header>
  );
}
