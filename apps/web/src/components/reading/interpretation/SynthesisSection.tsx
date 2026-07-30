"use client";

interface SynthesisSectionProps {
  synthesis: string;
  title?: string;
}

export function SynthesisSection({
  synthesis,
  title = "串联在一起的故事",
}: SynthesisSectionProps) {
  return (
    <section id="reading-synthesis" className="scroll-mt-32 border-t border-paper-border/70 pt-10">
      <h2 className="font-serif text-2xl text-ink md:text-[26px]">{title}</h2>
      <p className="mt-6 max-w-[44rem] font-serif text-[17px] leading-[1.9] text-text-body md:text-[18px]">
        {synthesis}
      </p>
    </section>
  );
}
