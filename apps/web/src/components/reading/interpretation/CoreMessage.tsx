"use client";

interface CoreQuickRead {
  core: string;
  keywords: string[];
  action: string;
  boundary: string;
}

interface CoreMessageProps {
  quickRead: CoreQuickRead;
}

function firstSentence(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  const match = normalized.match(/^.+?[。！？!?]/);
  return match?.[0] ?? normalized;
}

export function CoreMessage({ quickRead }: CoreMessageProps) {
  return (
    <section id="reading-quick" className="scroll-mt-32" aria-label="当下的关键启示">
      <h2 className="font-serif text-xl text-ink md:text-2xl">当下的关键启示</h2>
      <p className="mt-4 max-w-[38rem] font-serif text-[21px] leading-[1.65] text-ink md:text-[24px] md:leading-[1.6]">
        {quickRead.core}
      </p>
      <div className="mt-7 grid gap-4 border-t border-paper-border/70 pt-5 md:grid-cols-2 md:gap-8">
        <p className="text-sm leading-relaxed text-text-body">
          <span className="font-sans font-semibold text-ink">试着问自己——</span>
          {quickRead.action}
        </p>
        <p className="text-sm leading-relaxed text-text-muted">
          <span className="font-sans font-semibold text-text-body">一个小前提——</span>
          {firstSentence(quickRead.boundary)}
        </p>
      </div>
    </section>
  );
}
