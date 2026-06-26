"use client";

import { cn } from "@/lib/utils";
import type { PresentationMode } from "@aethertarot/shared-types";

interface SynthesisSectionProps {
  synthesis: string;
  presentationMode?: PresentationMode;
}

export function SynthesisSection({ synthesis, presentationMode }: SynthesisSectionProps) {
  return (
    <section
      id="reading-synthesis"
      className={cn(
        "reading-card scroll-mt-32",
        presentationMode === "sober_anchor" && "border-paper-border bg-paper",
      )}
    >
      <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
        故事
      </p>
      <h2 className="mt-1 font-serif text-2xl text-ink">串联在一起的故事</h2>
      <p className="mt-4 text-base leading-[1.85] text-text-body">{synthesis}</p>
    </section>
  );
}
