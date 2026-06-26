"use client";

import { cn } from "@/lib/utils";
import type { PresentationMode } from "@aethertarot/shared-types";

interface GuidanceSectionProps {
  guidance: string[];
  presentationMode?: PresentationMode;
}

export function GuidanceSection({ guidance, presentationMode }: GuidanceSectionProps) {
  const isVoidNarrative = presentationMode === "void_narrative";

  return (
    <section
      id="reading-guidance"
      className={cn(
        "reading-card scroll-mt-32",
        isVoidNarrative && "border-none bg-transparent px-0 shadow-none",
        presentationMode === "sober_anchor" && "border-paper-border bg-paper",
      )}
    >
      <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
        思考
      </p>
      <h2 className="mt-1 font-serif text-2xl text-ink">可以带走的思考</h2>
      <ul className="mt-4 space-y-3">
        {guidance.map((item) => (
          <li
            key={item}
            className={cn(
              "flex gap-3 text-base leading-relaxed text-text-body",
              isVoidNarrative
                ? "border-l-0 pl-0"
                : "border-l-2 border-terracotta/20 pl-4",
            )}
          >
            {!isVoidNarrative ? (
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta/50" />
            ) : null}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
