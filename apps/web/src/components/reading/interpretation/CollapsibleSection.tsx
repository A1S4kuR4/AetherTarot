"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import LegacyIcon from "@/components/ui/LegacyIcon";

interface CollapsibleSectionProps {
  id?: string;
  kicker: string;
  title: string;
  defaultOpen?: boolean;
  collapsedHint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({
  id,
  kicker,
  title,
  defaultOpen = false,
  collapsedHint,
  children,
  className,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section
      id={id}
      className={cn("reading-card scroll-mt-32", className)}
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
            {kicker}
          </p>
          <h2 className="mt-1 font-serif text-2xl text-ink">{title}</h2>
        </div>
        <LegacyIcon
          name={isOpen ? "keyboard_double_arrow_down" : "arrow_forward"}
          className={cn(
            "text-lg text-text-muted transition-transform duration-300",
            isOpen && "rotate-180",
          )}
        />
      </button>
      {!isOpen && collapsedHint ? (
        <div className="mt-3">{collapsedHint}</div>
      ) : null}
      {isOpen ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}
