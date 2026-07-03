"use client";

import { motion, type Variants } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useReading } from "@/context/ReadingContext";
import LegacyIcon from "@/components/ui/LegacyIcon";

const DAILY_RITUAL_QUESTION = "今日的能量给我的启示是什么？";
const DAILY_RITUAL_SPREAD_ID = "single";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: "easeOut",
    },
  },
};

export default function RitualLandingPage() {
  const router = useRouter();
  const { startDailyRitual } = useReading();

  const handleStartDailyRitual = () => {
    const success = startDailyRitual(DAILY_RITUAL_QUESTION, DAILY_RITUAL_SPREAD_ID);
    if (success) {
      router.push("/ritual/draw");
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] w-full flex-col items-center justify-center overflow-hidden px-6 py-12 text-center">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-60 mix-blend-screen bg-[radial-gradient(ellipse_at_top_center,rgba(67,56,202,0.15)_0%,transparent_70%)]" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative z-10 flex max-w-2xl flex-col items-center gap-8"
      >
        <motion.div variants={itemVariants} className="flex flex-col items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo/20 bg-indigo/10 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-indigo-light">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo shadow-[0_0_8px_rgba(113,112,255,0.8)] animate-pulse" />
            <span>今日启示</span>
          </div>
          <h1 className="mt-4 font-serif text-3xl leading-tight tracking-wide text-text-inverse md:text-5xl" style={{ fontFamily: "var(--font-noto-serif-sc, serif)" }}>
            灵魂的对镜
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-text-inverse-muted md:text-base">
            静下心来，剥离外界的喧嚣。每一次抽牌，都是与内在智慧的深度对话。选择今日的预设启示，或提出你内心的专属困惑。
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="mt-6 flex w-full flex-col items-center gap-6">
          <button
            type="button"
            onClick={handleStartDailyRitual}
            className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-full bg-indigo px-8 py-4 text-sm font-semibold tracking-wide text-white transition-all duration-300 hover:scale-[1.02] hover:bg-indigo-light active:scale-95 shadow-[0_0_32px_rgba(113,112,255,0.24)] hover:shadow-[0_0_48px_rgba(113,112,255,0.4)]"
          >
            <span className="relative z-10 flex items-center gap-2">
              <LegacyIcon name="auto_awesome" className="text-lg" />
              开启今日仪式
            </span>
          </button>

          <Link
            href="/new"
            className="group flex items-center gap-2 text-sm font-medium tracking-wide text-text-inverse-muted transition-colors hover:text-text-inverse"
          >
            <span>或者，提出你的专属困惑</span>
            <LegacyIcon
              name="arrow_forward"
              className="text-base transition-transform group-hover:translate-x-1"
            />
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
