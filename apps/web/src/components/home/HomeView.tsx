"use client";

import { useState, useRef, useEffect } from "react";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { getAllSpreads } from "@aethertarot/domain-tarot";
import { useReading } from "@/context/ReadingContext";
import { cn } from "@/lib/utils";

const SENSITIVE_TERM_REGEX = /(离|辞|投资|买|卖|生病|死|分手|必须|一定|到底|决定|怎么)/;

const spreads = getAllSpreads();

export default function HomeView() {
  const router = useRouter();
  const {
    question,
    selectedSpread,
    setQuestion,
    setSelectedSpread,
    startRitual,
  } = useReading();

  const [isPressing, setIsPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [safetyTriggerTerm, setSafetyTriggerTerm] = useState("");

  const startPress = () => {
    if (!question.trim() || !selectedSpread) return;
    setIsPressing(true);
    setProgress(0);

    pressInterval.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + (100 / 15);
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
        setSafetyTriggerTerm(match[0]);
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
    <section className="flex min-h-[92vh] flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl space-y-12 text-center">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="space-y-4"
        >
          <h1 className="font-serif text-5xl font-semibold tracking-tight text-ink md:text-6xl">
            灵语塔罗
          </h1>
          <p className="font-serif text-lg text-text-muted md:text-xl">
            开启你的反思与探索之路
          </p>
        </motion.div>

        {/* Question Input */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        >
          <div className="relative mx-auto max-w-xl">
            <textarea
              className="w-full resize-none rounded-2xl border border-paper-border bg-paper-raised px-5 py-4 font-sans text-base text-ink placeholder:text-text-placeholder focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10 focus:outline-none transition-all duration-200"
              placeholder="今天，你想向内心询问什么？"
              rows={3}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </div>
        </motion.div>

        {/* Spread Selection */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
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
                <p className="text-sm font-sans text-text-muted leading-relaxed">
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

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45, ease: "easeOut" }}
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
              "btn-primary relative overflow-hidden px-10 py-4 text-base transition-all select-none",
              isPressing && "shadow-inner"
            )}
            animate={{
              scale: isPressing ? 0.95 : 1,
            }}
          >
            <div 
              className="absolute inset-0 bg-ink/10 origin-left"
              style={{ width: `${progress}%`, transition: 'width 0.1s linear' }}
            />
            <span className="relative z-10">
              {isPressing ? "正在收束意图..." : "长按开始仪式"}
            </span>
          </motion.button>
        </motion.div>

        {/* Microcopy */}
        <p className="min-h-[20px] text-xs text-text-muted leading-relaxed transition-all">
          {isPressing ? "塔罗是内心的镜像，深呼吸..." : "解读用于反思与启发，不替代专业建议"}
        </p>
      </div>

      {/* Safety Modal */}
      {showSafetyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
            onClick={() => setShowSafetyModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-red-900/20 bg-paper p-8 shadow-2xl"
          >
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50/50 text-red-500 border border-red-100">
              <span className="material-symbols-outlined text-3xl">warning</span>
            </div>
            <h3 className="mb-3 text-center font-serif text-2xl text-ink">
              这是一次重大的决定
            </h3>
            <p className="mb-6 text-center text-sm leading-relaxed text-text-body">
              系统察觉到你的意图涉及到重大的现实变动或决策。
              <br /><br />
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
    </section>
  );
}
