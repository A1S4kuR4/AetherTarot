"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { m } from "motion/react";
import { getAllSpreads } from "@aethertarot/domain-tarot";
import type { DrawnCard } from "@aethertarot/shared-types";
import { drawCardsForSpread } from "@/lib/tarotDraw";
import { buildLocalQuickAnalysis, type QuickAnalysis } from "@/lib/quickAnalysis";
import { useReading } from "@/context/ReadingContext";
import LegacyIcon from "@/components/ui/LegacyIcon";
import QuickDrawOverlay from "../QuickDrawOverlay";

const QUICK_DRAW_QUESTION =
  "我还不知道具体要问什么，请抽取我当下最需要看见的状态。";

export default function IntroSection() {
  const router = useRouter();
  const {
    setQuestion,
    setSelectedSpread,
    setAgentProfile,
    setDrawSource,
    completeRitual,
  } = useReading();

  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [drawnCard, setDrawnCard] = useState<DrawnCard | null>(null);
  const [quickAnalysis, setQuickAnalysis] = useState<QuickAnalysis | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleDrawClick = useCallback(() => {
    if (isOverlayOpen || isNavigating) return;

    const spreads = getAllSpreads();
    const singleSpread =
      spreads.find((s) => s.id === "single") ?? spreads[0];

    if (!singleSpread) return;

    const cards = drawCardsForSpread(singleSpread.positions);

    if (cards.length !== singleSpread.positions.length || !cards[0]) return;

    const card = cards[0];

    setDrawnCard(card);
    setQuickAnalysis(buildLocalQuickAnalysis(card));
    setIsOverlayOpen(true);
  }, [isOverlayOpen, isNavigating]);

  const handleClose = useCallback(() => {
    setIsOverlayOpen(false);
    setDrawnCard(null);
    setQuickAnalysis(null);
  }, []);

  const handleDeepReading = useCallback(() => {
    if (isNavigating || !drawnCard) return;

    setIsNavigating(true);

    const spreads = getAllSpreads();
    const singleSpread =
      spreads.find((s) => s.id === "single") ?? spreads[0];

    if (!singleSpread) return;

    setQuestion(QUICK_DRAW_QUESTION);
    setAgentProfile("lite");
    setDrawSource("digital_random");
    setSelectedSpread(singleSpread);
    completeRitual([drawnCard]);
    router.push("/quick-reading");
  }, [
    isNavigating,
    drawnCard,
    setQuestion,
    setAgentProfile,
    setDrawSource,
    setSelectedSpread,
    completeRitual,
    router,
  ]);

  return (
    <>
      <section
        id="intro"
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
            CHAPTER I
          </span>
          <h1 className="mb-8 font-serif text-[clamp(2.75rem,5vw,4.5rem)] font-semibold leading-[1.12] tracking-[-0.035em] text-ink">
            万物皆有回声
          </h1>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,2.2fr)_minmax(13rem,1fr)] lg:gap-16">
            <div className="max-w-[44rem] font-serif text-lg leading-[1.9] text-text-body [&>p:first-child::first-letter]:float-left [&>p:first-child::first-letter]:mr-3 [&>p:first-child::first-letter]:mt-1 [&>p:first-child::first-letter]:font-serif [&>p:first-child::first-letter]:text-[4.1rem] [&>p:first-child::first-letter]:font-bold [&>p:first-child::first-letter]:leading-[0.72] [&>p:first-child::first-letter]:text-terracotta">
              <p className="mb-6">
                塔罗并非开启未来的钥匙，而是映照当下的镜子。在名为&ldquo;潜意识&rdquo;的湖泊中，那些未被察觉的情绪、渴望与困惑，正通过 78 张古老的象征图景，寻找着与你的共鸣。
              </p>
              <p>
                我们拒绝将阅读简化为断言式抽卡或宿命论预言。每一幅图案与牌面，都是一次引你回看内心的契机。
              </p>
              <div className="mt-10 border-t border-dashed border-terracotta/30 pt-7">
            <m.button
              type="button"
              disabled={isNavigating}
              onClick={handleDrawClick}
              whileHover={!isNavigating ? { y: -2 } : undefined}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="group inline-flex min-h-12 items-center gap-3 border border-terracotta px-6 py-3 font-serif text-lg text-terracotta transition-colors hover:bg-terracotta hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>抽一张当下之镜</span>
              <LegacyIcon
                name="arrow_forward"
                className="transition-transform group-hover:translate-x-1"
              />
            </m.button>
              </div>
            </div>
            <aside className="self-start border-l border-terracotta pl-4 font-serif text-sm italic leading-relaxed text-terracotta lg:mt-2">
              <span className="mb-1 block font-mono text-[0.7rem] not-italic font-semibold tracking-[0.12em]">
                PRESENT STATE
              </span>
              让牌面成为一种观察语言，而非替你作出决定的声音。
            </aside>
          </div>
        </m.div>
      </section>

      <QuickDrawOverlay
        isOpen={isOverlayOpen}
        drawnCard={drawnCard}
        quickAnalysis={quickAnalysis}
        onClose={handleClose}
        onDeepReading={handleDeepReading}
      />
    </>
  );
}
