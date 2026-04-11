"use client";

import { motion } from "motion/react";

export default function MindsetSection() {
  return (
    <section className="scroll-snap-section px-6 py-24 text-center">
      <div className="w-full max-w-3xl space-y-12">
        <header className="space-y-4">
          <h2 className="font-serif text-3xl font-medium text-ink md:text-4xl">
            如何发问：从预言到反思
          </h2>
          <p className="font-sans text-base text-text-muted">
            提问的方式决定了镜子中倒影的清晰度
          </p>
        </header>

        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-paper-border/60 bg-white/50 p-6 text-left"
            >
              <h4 className="mb-2 font-sans text-xs font-semibold uppercase tracking-widest text-text-placeholder">
                避开宿命论
              </h4>
              <p className="font-serif text-lg text-text-muted line-through opacity-50">
                “我会和他/她结婚吗？”
              </p>
              <div className="mt-4 flex items-center gap-2 text-terracotta">
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                <span className="font-serif text-lg italic">
                  “在这段关系中，我需要学习什么？”
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border border-paper-border/60 bg-white/50 p-6 text-left"
            >
              <h4 className="mb-2 font-sans text-xs font-semibold uppercase tracking-widest text-text-placeholder">
                避开封闭性
              </h4>
              <p className="font-serif text-lg text-text-muted line-through opacity-50">
                “我要不要辞职？”
              </p>
              <div className="mt-4 flex items-center gap-2 text-terracotta">
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                <span className="font-serif text-lg italic">
                  “如果离开，我的核心恐惧和渴望是什么？”
                </span>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-terracotta/10 bg-terracotta/[0.02] p-8"
          >
            <p className="italic leading-relaxed text-text-body">
              塔罗不会给你一个“是”或“否”的简单指令。它会剥开现实的洋葱，让你看到行为背后的动机、环境中的隐藏阻力，以及每一个选择所携带的能量轨迹。
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
