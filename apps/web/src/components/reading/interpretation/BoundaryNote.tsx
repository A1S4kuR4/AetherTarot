"use client";

import LegacyIcon from "@/components/ui/LegacyIcon";

interface BoundaryNoteProps {
  safetyNote?: string | null;
  confidenceNote?: string | null;
}

export function BoundaryNote({ safetyNote, confidenceNote }: BoundaryNoteProps) {
  const content = safetyNote ?? confidenceNote;

  if (!content) {
    return null;
  }

  return (
    <section
      id="reading-boundary"
      className="scroll-mt-32 border-y border-safety/30 py-6"
    >
      <div className="flex items-center gap-2.5">
        <LegacyIcon name="info" className="text-[18px] text-safety-ink" />
        <h2 className="font-serif text-lg font-semibold text-safety-ink">温柔的提醒</h2>
      </div>
      <p className="mt-3 text-[15px] leading-[1.85] text-text-body">
        {content}
      </p>
    </section>
  );
}
