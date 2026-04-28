"use client";

import { motion } from "motion/react";
import LegacyIcon from "@/components/ui/LegacyIcon";

export default function IntroSection() {
  return (
    <section className="flex h-full w-full items-center justify-center px-6 text-center">
      <motion.div
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="pt-12"
        >
          <LegacyIcon
            name="keyboard_double_arrow_down"
            className="animate-float-slow text-text-placeholder"
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
