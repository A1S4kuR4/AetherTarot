"use client";

interface GroupLabelProps {
  children: React.ReactNode;
}

// Editorial group marker for the closing act of the reading page. Purely a
// visual rhythm device — section headings carry the document outline.
export function GroupLabel({ children }: GroupLabelProps) {
  return (
    <p className="border-t border-paper-border/70 pt-8 font-serif text-[15px] font-semibold text-text-accent">
      {children}
    </p>
  );
}
