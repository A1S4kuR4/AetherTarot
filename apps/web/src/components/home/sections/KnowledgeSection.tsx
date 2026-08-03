"use client";

import { m } from "motion/react";

export default function KnowledgeSection() {
  return (
    <section
      id="symbolism"
      className="flex min-h-[calc(100dvh-4rem)] w-full items-center px-6 py-14 sm:px-10 lg:h-full lg:min-h-0 lg:px-16 lg:py-10"
    >
      <m.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="mx-auto w-full max-w-[1120px]"
      >
        <span className="mb-3 block font-mono text-xs font-semibold tracking-[0.2em] text-terracotta">
          CHAPTER II
        </span>
        <h2 className="mb-8 font-serif text-[clamp(2.25rem,4vw,3.5rem)] font-semibold leading-[1.16] tracking-[-0.03em] text-ink">
          灵魂的 78 个切面
        </h2>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,2.2fr)_minmax(13rem,1fr)] lg:gap-16">
          <div className="max-w-[44rem] font-serif text-lg leading-[1.9] text-text-body">
            <h3 className="mb-4 font-serif text-2xl font-semibold text-ink">大阿尔卡纳 · Major Arcana</h3>
            <p className="mb-9">
              由 22 张具有深度原型的牌组成。它们描绘的是从“愚人”到“世界”的灵魂旅程，象征着生命中重大的转折点、精神课题与核心命运。
            </p>
            <h3 className="mb-4 font-serif text-2xl font-semibold text-ink">小阿尔卡纳 · Minor Arcana</h3>
            <p>
              由 56 张牌组成，对应四种元素。它们反映的是我们日常生活的纹理：工作、情感、思想与物质。它们是灵魂在现实尘埃中的具体舞动。
            </p>
          </div>
          <aside className="space-y-8 self-start lg:mt-2">
            <div className="border-l border-terracotta pl-4 font-serif text-sm italic leading-relaxed text-terracotta">
              <span className="mb-1 block font-mono text-[0.7rem] not-italic font-semibold tracking-[0.12em]">MAJOR ARCANA</span>
              原型 / 命运 / 课题 / 转折
            </div>
            <div className="border-l border-terracotta pl-4 font-serif text-sm italic leading-relaxed text-terracotta">
              <span className="mb-1 block font-mono text-[0.7rem] not-italic font-semibold tracking-[0.12em]">MINOR ARCANA</span>
              权杖（意志）/ 圣杯（情感）/ 宝剑（逻辑）/ 星币（物质）
            </div>
          </aside>
        </div>
      </m.div>
    </section>
  );
}
