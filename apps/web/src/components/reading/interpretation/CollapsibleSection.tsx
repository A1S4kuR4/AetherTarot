"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import LegacyIcon from "@/components/ui/LegacyIcon";

interface CollapsibleSectionProps {
  id?: string;
  title: string;
  defaultOpen?: boolean;
  collapsedHint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({
  id,
  title,
  defaultOpen = false,
  collapsedHint,
  children,
  className,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = `${useId()}-content`;

  return (
    <section id={id} className={cn("scroll-mt-32 border-t border-paper-border/70 pt-8", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="flex min-h-11 w-full items-center justify-between gap-4 text-left"
      >
        <h2 className="font-serif text-xl text-ink md:text-2xl">{title}</h2>
        <LegacyIcon
          name="keyboard_double_arrow_down"
          className={cn(
            "text-lg text-text-muted transition-transform duration-200 motion-reduce:transition-none",
            isOpen && "rotate-180",
          )}
        />
      </button>
      {!isOpen && collapsedHint ? (
        <div className="mt-3">{collapsedHint}</div>
      ) : null}
      {isOpen ? <div id={contentId} className="mt-6">{children}</div> : null}
    </section>
  );
}
