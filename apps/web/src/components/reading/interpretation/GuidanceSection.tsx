"use client";

import { ChapterNumber } from "./ChapterNumber";

interface GuidanceSectionProps {
  guidance: string[];
  chapterLabel?: string;
}

export function GuidanceSection({ guidance, chapterLabel }: GuidanceSectionProps) {
  if (!guidance || guidance.length === 0) {
    return null;
  }

  const [firstQuestion, ...remainingQuestions] = guidance;

  return (
    <section id="reading-guidance" className="scroll-mt-32">
      <ChapterNumber value={chapterLabel} />
      <h2 className="reading-section-title">可以带走的思考</h2>
      {firstQuestion ? (
        <p className="mt-5 max-w-[40rem] font-serif text-[17px] leading-[1.8] text-ink">
          {firstQuestion}
        </p>
      ) : null}
      {remainingQuestions.length > 0 ? (
        <ol start={2} className="mt-5 space-y-3">
          {remainingQuestions.map((item, index) => (
            <li
              key={item}
              className="flex gap-3 text-[15px] leading-relaxed text-text-body"
            >
              <span aria-hidden="true" className="shrink-0 font-serif text-text-accent">
                {index + 2}.
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
