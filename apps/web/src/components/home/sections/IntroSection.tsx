"use client";

import { m } from "motion/react";
import LegacyIcon from "@/components/ui/LegacyIcon";
import { useQuickDraw } from "@/hooks/useQuickDraw";

export default function IntroSection() {
  const { performQuickDraw, isNavigating } = useQuickDraw();

  return (
    <section className="flex min-h-[calc(100dvh-4rem)] w-full items-center justify-center px-6 py-12 text-center lg:h-full lg:min-h-0 lg:py-0">
      <m.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-3xl space-y-8"
      >
        <h1 className="font-serif text-5xl font-semibold tracking-tight text-ink md:text-7xl">
          万物皆有回声
        </h1>
        <div className="space-y-4">
          <p className="font-serif text-xl leading-relaxed text-text-muted md:text-2xl">
            塔罗并非开启未来的钥匙，而是映照当下的镜子。
          </p>
          <p className="mx-auto max-w-2xl font-sans text-base leading-relaxed text-text-muted opacity-80 md:text-lg">
            在名为“潜意识”的湖泊中，那些未被察觉的情绪、渴望与困惑，
            正通过 78 张古老的象征图景，寻找着与你的共鸣。
          </p>
        </div>
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="flex flex-col items-center gap-8 pt-8"
        >
          <button
            type="button"
            disabled={isNavigating}
            onClick={() => performQuickDraw("我还不知道具体要问什么，请抽取我当下最需要看见的状态。")}
            className="text-sm font-medium text-terracotta/80 underline underline-offset-4 transition-colors hover:text-terracotta disabled:cursor-not-allowed disabled:opacity-50"
          >
            抽一张当下之镜
          </button>
          <LegacyIcon
            name="keyboard_double_arrow_down"
            className="animate-float-slow text-text-placeholder"
          />
        </m.div>
      </m.div>
    </section>
  );
}
