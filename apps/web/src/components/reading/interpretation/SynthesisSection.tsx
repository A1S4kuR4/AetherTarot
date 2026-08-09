"use client";

import { ChapterNumber } from "./ChapterNumber";

interface SynthesisSectionProps {
  synthesis: string;
  title?: string;
  chapterLabel?: string;
}

export function splitSynthesisParagraphs(synthesis: string): string[] {
  const paragraphs = synthesis
    .split(/\n\s*\n|\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length <= 4) {
    return paragraphs;
  }

  return [...paragraphs.slice(0, 3), paragraphs.slice(3).join("\n")];
}

export function SynthesisSection({
  synthesis,
  title = "串联在一起的故事",
  chapterLabel,
}: SynthesisSectionProps) {
  const paragraphs = splitSynthesisParagraphs(synthesis);

  return (
    <section id="reading-synthesis" className="scroll-mt-32 border-t border-paper-border pt-11">
      <ChapterNumber value={chapterLabel} />
      <h2 className="reading-section-title">{title}</h2>
      <div className="reading-synthesis-body">
        {paragraphs.map((paragraph, index) => (
          <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}
