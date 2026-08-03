"use client";

import { m } from "motion/react";

export default function MindsetSection() {
  return (
    <section
      id="mindset"
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
          CHAPTER III
        </span>
        <h2 className="mb-8 font-serif text-[clamp(2.25rem,4vw,3.5rem)] font-semibold leading-[1.16] tracking-[-0.03em] text-ink">
          从预言到反思
        </h2>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,2.2fr)_minmax(13rem,1fr)] lg:gap-16">
          <div className="max-w-[44rem]">
            <p className="mb-8 font-serif text-lg leading-[1.9] text-text-body">
              提问的方式决定了镜子中倒影的清晰度。塔罗不会给你一个简单粗暴的指令，而是帮助你看见行为背后的动机、环境中的隐藏阻力，以及每一个选择所携带的能量轨迹。
            </p>
            <div className="grid gap-8 md:grid-cols-2">
              <div className="border-b border-paper-border pb-6">
                <span className="mb-2 block font-mono text-xs tracking-[0.1em] text-text-muted">01 / 避开宿命论</span>
                <p className="mb-3 font-serif text-lg leading-relaxed text-text-muted/60 line-through">
                  “我会和他/她结婚吗？”
                </p>
                <p className="font-serif text-xl italic leading-relaxed text-terracotta">
                  “在这段关系中，我需要学习什么？”
                </p>
              </div>
              <div className="border-b border-paper-border pb-6">
                <span className="mb-2 block font-mono text-xs tracking-[0.1em] text-text-muted">02 / 避开封闭性</span>
                <p className="mb-3 font-serif text-lg leading-relaxed text-text-muted/60 line-through">
                  “我要不要辞职？”
                </p>
                <p className="font-serif text-xl italic leading-relaxed text-terracotta">
                  “如果离开，我的核心恐惧和渴望是什么？”
                </p>
              </div>
            </div>
          </div>
          <aside className="self-start border-l border-terracotta pl-4 font-serif text-sm italic leading-relaxed text-terracotta lg:mt-2">
            <span className="mb-1 block font-mono text-[0.7rem] not-italic font-semibold tracking-[0.12em]">REFLECTIVE INSIGHT</span>
            将确切的结论推断，转换为可验证的自我观察。
          </aside>
        </div>
      </m.div>
    </section>
  );
}
