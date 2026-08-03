"use client";

import { m } from "motion/react";
import NextLink from "next/link";

export default function FinalGateSection() {
  return (
    <section
      id="final-gate"
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
          CHAPTER IV
        </span>
        <h2 className="mb-8 font-serif text-[clamp(2.25rem,4vw,3.5rem)] font-semibold leading-[1.16] tracking-[-0.03em] text-ink">
          通往深处
        </h2>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(14rem,1.1fr)] lg:gap-16">
          <div className="max-w-[44rem]">
            <span className="mb-3 block font-mono text-xs tracking-[0.12em] text-terracotta">01 / INITIATE RITUAL</span>
            <h3 className="mb-4 font-serif text-3xl font-semibold leading-tight text-ink">开启崭新仪式</h3>
            <p className="font-serif text-lg leading-[1.9] text-text-body">
              在这里，你的意志将化为指引。完成了理性辨析与发问准备后，在安静的氛围中，让 78 张牌重新排列出当下的共鸣。带着具体的困惑或开放的视角，开启一次完整的深读陪伴。
            </p>
            <NextLink
              href="/new"
              className="mt-10 inline-flex min-h-12 items-center gap-3 border border-terracotta px-6 py-3 font-serif text-lg text-terracotta transition-colors hover:bg-terracotta hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
            >
              <span>进入仪式场域</span>
              <span aria-hidden="true">→</span>
            </NextLink>
          </div>
          <div className="self-start lg:pt-1">
            <span className="mb-3 block font-mono text-xs tracking-[0.12em] text-terracotta">02 / MEMORY ARCHIVE</span>
            <h3 className="mb-3 font-serif text-2xl font-semibold leading-tight text-ink">回溯过往旅程</h3>
            <p className="font-serif text-base leading-[1.85] text-text-body">
              在这面镜子前，你曾经的提问与觉察线索依然闪烁，随时等待重新审视与反思。
            </p>
            <NextLink
              href="/journey"
              className="mt-7 inline-flex items-center gap-2 border-b border-terracotta pb-1 font-serif text-base text-terracotta transition-opacity hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo"
            >
              <span>调取历史档案</span>
              <span aria-hidden="true">→</span>
            </NextLink>
            <aside className="mt-10 border-t border-dashed border-paper-border pt-6">
              <div className="border-l border-terracotta pl-4 font-serif text-sm italic leading-relaxed text-terracotta">
                <span className="mb-1 block font-mono text-[0.7rem] not-italic font-semibold tracking-[0.12em]">ACTION &amp; EXPLORATION</span>
                从自我觉察走向现实选择与仪式探索。
              </div>
            </aside>
          </div>
        </div>
      </m.div>
    </section>
  );
}
