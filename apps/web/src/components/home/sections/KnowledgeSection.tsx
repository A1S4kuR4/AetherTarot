"use client";

import { motion } from "motion/react";

export default function KnowledgeSection() {
  return (
    <section className="scroll-snap-section bg-paper-raised/50 px-6 py-24">
      <div className="w-full max-w-5xl space-y-20">
        <header className="text-center">
          <h2 className="font-serif text-3xl font-medium text-ink md:text-4xl">
            象征：灵魂的 78 个切面
          </h2>
          <div className="mx-auto mt-4 h-px w-24 bg-terracotta/30" />
        </header>

        <div className="grid gap-12 md:grid-cols-2">
          {/* Major Arcana */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-paper-border bg-paper p-8 shadow-sm transition-all hover:shadow-md"
          >
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
              <span className="material-symbols-outlined">stars</span>
            </div>
            <h3 className="mb-4 font-serif text-2xl text-ink">大阿尔卡纳 · Major Arcana</h3>
            <p className="font-sans text-base leading-relaxed text-text-body">
              由 22 张具有深度原型的牌组成。它们描绘的是从“愚人”到“世界”的灵魂旅程，象征着生命中重大的转折点、精神课题与核心命运。
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["原型", "命运", "课题", "转折"].map((tag) => (
                <span key={tag} className="chip-muted text-[11px]">{tag}</span>
              ))}
            </div>
          </motion.div>

          {/* Minor Arcana */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-paper-border bg-paper p-8 shadow-sm transition-all hover:shadow-md"
          >
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <span className="material-symbols-outlined">waves</span>
            </div>
            <h3 className="mb-4 font-serif text-2xl text-ink">小阿尔卡纳 · Minor Arcana</h3>
            <p className="font-sans text-base leading-relaxed text-text-body">
              由 56 张牌组成，对应四种元素。它们反映的是我们日常生活的纹理：工作、情感、思想与物质。它们是灵魂在现实尘埃中的具体舞动。
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["情感", "意志", "物质", "逻辑"].map((tag) => (
                <span key={tag} className="chip-muted text-[11px]">{tag}</span>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="text-center font-serif text-lg italic text-text-muted"
        >
          “理解了象征，便理解了生命在这个时刻向你呈现的姿态。”
        </motion.p>
      </div>
    </section>
  );
}
