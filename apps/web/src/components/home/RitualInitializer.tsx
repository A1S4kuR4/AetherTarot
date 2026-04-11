"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { getAllSpreads } from "@aethertarot/domain-tarot";
import type { AgentProfile } from "@aethertarot/shared-types";
import { useReading } from "@/context/ReadingContext";
import { cn } from "@/lib/utils";

const SENSITIVE_TERM_REGEX = /(离|辞|投资|买|卖|生病|死|分手|必须|一定|到底|决定|怎么)/;

const spreads = getAllSpreads();

const AGENT_PROFILES: Array<{ id: AgentProfile; name: string; description: string }> = [
  {
    id: "lite",
    name: "快速塔罗师",
    description: "轻量初读，适合先看一个清晰倾向。",
  },
  {
    id: "standard",
    name: "标准塔罗师",
    description: "两阶段校准，先让牌面说话，再结合你的回应。",
  },
  {
    id: "sober",
    name: "清醒塔罗师",
    description: "更强调现实边界，适合重大决定或高压力议题。",
  },
];

export default function RitualInitializer() {
  const router = useRouter();
  const {
    question,
    selectedSpread,
    agentProfile,
    setQuestion,
    setSelectedSpread,
    setAgentProfile,
    startRitual,
  } = useReading();

  const [isPressing, setIsPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showSafetyModal, setShowSafetyModal] = useState(false);

  const startPress = () => {
    if (!question.trim() || !selectedSpread) return;
    setIsPressing(true);
    setProgress(0);

    pressInterval.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + 100 / 15;
      });
    }, 100);

    pressTimer.current = setTimeout(() => {
      stopPress(true);
    }, 1500);
  };

  const stopPress = (completed = false) => {
    if (pressInterval.current) clearInterval(pressInterval.current);
    if (pressTimer.current) clearTimeout(pressTimer.current);

    if (completed) {
      setProgress(100);
      const match = question.match(SENSITIVE_TERM_REGEX);
      if (match) {
        setShowSafetyModal(true);
        setIsPressing(false);
        setProgress(0);
      } else {
        handleStart();
      }
    } else {
      setIsPressing(false);
      setProgress(0);
    }
  };

  const handleSafetyConfirm = () => {
    setShowSafetyModal(false);
    handleStart();
  };

  useEffect(() => {
    return () => {
      if (pressInterval.current) clearInterval(pressInterval.current);
      if (pressTimer.current) clearTimeout(pressTimer.current);
    };
  }, []);

  const handleStart = () => {
    if (!startRitual()) {
      return;
    }

    router.push("/ritual");
  };

  return (
    <div className="w-full max-w-2xl space-y-12 text-center pb-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="relative mx-auto max-w-xl">
          <textarea
            className="w-full resize-none rounded-2xl border border-paper-border bg-paper-raised px-5 py-4 font-sans text-base text-ink placeholder:text-text-placeholder transition-all duration-200 focus:border-terracotta/40 focus:outline-none focus:ring-2 focus:ring-terracotta/10 shadow-sm"
            placeholder="今天，你想向内心询问什么？"
            rows={3}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        className="space-y-4"
      >
        <h2 className="font-sans text-xs font-medium uppercase tracking-[0.2em] text-text-muted">
          选择塔罗师 · Choose Your Reader
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {AGENT_PROFILES.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => setAgentProfile(profile.id)}
              className={cn(
                "rounded-2xl border px-4 py-4 text-left transition-all duration-200",
                agentProfile === profile.id
                  ? "border-terracotta/40 bg-terracotta/5 shadow-sm"
                  : "border-paper-border bg-paper-raised hover:border-paper-border hover:shadow-sm",
              )}
            >
              <span className="block font-serif text-base text-ink">
                {profile.name}
              </span>
              <span className="mt-1.5 block text-xs leading-relaxed text-text-muted">
                {profile.description}
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.25, ease: "easeOut" }}
        className="space-y-6"
      >
        <h2 className="font-sans text-xs font-medium uppercase tracking-[0.2em] text-text-muted">
          选择牌阵 · Choose Your Spread
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {spreads.map((spread) => (
            <button
              key={spread.id}
              type="button"
              onClick={() => setSelectedSpread(spread)}
              className={cn(
                "group flex flex-col items-center rounded-2xl border p-6 text-center transition-all duration-200",
                selectedSpread?.id === spread.id
                  ? "border-terracotta/40 bg-terracotta/5 shadow-sm"
                  : "border-paper-border bg-paper-raised hover:border-paper-border hover:shadow-sm",
              )}
            >
              <div
                className={cn(
                  "mb-4 flex h-12 w-12 items-center justify-center rounded-full transition-colors",
                  selectedSpread?.id === spread.id
                    ? "bg-terracotta/10 text-terracotta"
                    : "bg-paper-muted text-text-muted group-hover:text-text-body",
                )}
              >
                <span className="material-symbols-outlined text-2xl">
                  {spread.icon}
                </span>
              </div>
              <h3 className="mb-2 font-serif text-lg text-ink">
                {spread.name}
              </h3>
              <p className="font-sans text-sm leading-relaxed text-text-muted">
                {spread.description}
              </p>
              {spread.id === "holy-triangle" && (
                <span className="chip-accent mt-3 text-[10px]">
                  最受青睐
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" }}
        className="relative inline-block"
      >
        <motion.button
          type="button"
          onMouseDown={startPress}
          onMouseUp={() => stopPress()}
          onMouseLeave={() => stopPress()}
          onTouchStart={startPress}
          onTouchEnd={() => stopPress()}
          disabled={!question.trim() || !selectedSpread}
          className={cn(
            "btn-primary relative select-none overflow-hidden px-12 py-5 text-base transition-all",
            isPressing && "shadow-inner",
          )}
          animate={{
            scale: isPressing ? 0.95 : 1,
          }}
        >
          <div
            className="absolute inset-0 origin-left bg-ink/10"
            style={{ width: `${progress}%`, transition: "width 0.1s linear" }}
          />
          <span className="relative z-10 font-serif tracking-wide">
            {isPressing ? "正在收束意图..." : "长按开始仪式"}
          </span>
        </motion.button>
        <p className="mt-4 min-h-[20px] text-xs leading-relaxed text-text-muted transition-all">
          {isPressing ? "塔罗是内心的镜像，深呼吸..." : "解读用于反思与启发，不替代专业建议"}
        </p>
      </motion.div>

      {showSafetyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
            onClick={() => setShowSafetyModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-paper-border bg-paper p-8 shadow-2xl"
          >
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-red-100 bg-red-50/50 text-red-500">
              <span className="material-symbols-outlined text-3xl">warning</span>
            </div>
            <h3 className="mb-3 text-center font-serif text-2xl text-ink">
              这是一次重大的决定
            </h3>
            <p className="mb-6 text-center text-sm leading-relaxed text-text-body">
              系统察觉到你的意图涉及到重大的现实变动或决策。
              <br />
              <br />
              请牢记：塔罗无法为你承担生命的重量，它只是一面映照能量场现状的镜子。真正的选择权与结果始终握在你的手中。
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleSafetyConfirm}
                className="w-full rounded-2xl bg-red-900/80 px-6 py-4 text-sm font-medium text-paper transition-all hover:bg-red-900"
              >
                我已知晓，仅作为内省的视角
              </button>
              <button
                type="button"
                onClick={() => setShowSafetyModal(false)}
                className="w-full rounded-2xl border border-paper-border bg-transparent px-6 py-4 text-sm font-medium text-text-muted transition-all hover:bg-paper-raised"
              >
                返回修改问题
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
