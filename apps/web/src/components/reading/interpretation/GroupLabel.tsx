"use client";

interface GroupLabelProps {
  children: React.ReactNode;
}

// Editorial group marker for the closing act of the reading page. Purely a
// visual rhythm device — section headings carry the document outline.
export function GroupLabel({ children }: GroupLabelProps) {
  return (
    <div className="border-t border-paper-border pt-10">
      <p className="manuscript-label">READING NOTE</p>
      <p className="mt-2 font-serif text-lg font-semibold text-ink">{children}</p>
    </div>
  );
}
