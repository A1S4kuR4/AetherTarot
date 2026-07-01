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
  return (
    <header className="space-y-5">
      <h1 className="font-serif text-3xl font-semibold text-ink md:text-5xl">
        {phase === "initial" ? "初步解读" : "解读结果"}
      </h1>
      <blockquote className="border-l-2 border-terracotta/30 py-2 pl-5 text-base italic leading-relaxed text-text-muted">
        这些牌面映射的是你当下的状态与可能性——不是定论，而是一面帮你看清方向的镜子。
      </blockquote>

      {hideQuestion ? null : (
        <div className="reading-card">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                你的提问
              </p>
              <p className="mt-1.5 text-base leading-relaxed text-ink">
                {`"${question}"`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {questionType ? (
                <span className="chip-accent text-[11px]">
                  {QUESTION_TYPE_LABELS[questionType]}
                </span>
              ) : null}
              <span className="chip-warm text-[11px]">{spreadName}</span>
              {isOffline ? <span className="chip-accent text-[11px]">线下录入</span> : null}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
