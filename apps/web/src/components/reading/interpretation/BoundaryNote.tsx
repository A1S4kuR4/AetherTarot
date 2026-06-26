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
    <section className="scroll-mt-32 rounded-2xl border border-terracotta/20 bg-[#F4F1EE] p-5 shadow-inner ring-1 ring-inset ring-terracotta/10 md:p-6">
      <div className="flex items-center gap-3 border-b border-terracotta/20 pb-3">
        <LegacyIcon name="info" className="text-terracotta/80" />
        <div>
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-terracotta/80">
            安全与边界说明
          </p>
          <h2 className="mt-0.5 font-serif text-lg text-terracotta">温柔的提醒</h2>
        </div>
      </div>
      <p className="mt-4 text-base font-medium leading-[1.85] text-terracotta/90">
        {content}
      </p>
    </section>
  );
}
