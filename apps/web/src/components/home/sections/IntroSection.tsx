"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { m } from "motion/react";
import { getAllSpreads } from "@aethertarot/domain-tarot";
import type { DrawnCard } from "@aethertarot/shared-types";
import { drawCardsForSpread } from "@/lib/tarotDraw";
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
  const [isNavigating, setIsNavigating] = useState(false);

  const handleDrawClick = useCallback(() => {
    if (isOverlayOpen || isNavigating) return;

    const spreads = getAllSpreads();
    const singleSpread =
      spreads.find((s) => s.id === "single") ?? spreads[0];

    if (!singleSpread) return;

    const cards = drawCardsForSpread(singleSpread.positions);

    if (cards.length !== singleSpread.positions.length || !cards[0]) return;

    setDrawnCard(cards[0]);
    setIsOverlayOpen(true);
  }, [isOverlayOpen, isNavigating]);

  const handleClose = useCallback(() => {
    setIsOverlayOpen(false);
    setDrawnCard(null);
  }, []);

  const handleEnterReading = useCallback(() => {
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
    router.push("/reading");
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
              在名为&ldquo;潜意识&rdquo;的湖泊中，那些未被察觉的情绪、渴望与困惑，
              正通过 78 张古老的象征图景，寻找着与你的共鸣。
            </p>
          </div>
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="flex justify-center pt-8"
          >
            <m.button
              type="button"
              disabled={isNavigating}
              onClick={handleDrawClick}
              whileHover={!isNavigating ? "hover" : undefined}
              initial="rest"
              animate="rest"
              variants={{
                rest: { y: 0, filter: "drop-shadow(0px 0px 0px rgba(201,100,66,0))" },
                hover: { y: -4, filter: "drop-shadow(0px 6px 12px rgba(201,100,66,0.3))" }
              }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="group flex flex-col items-center gap-8 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-sm font-medium text-terracotta/80 transition-colors group-hover:text-terracotta">
                抽一张当下之镜
              </span>
              <LegacyIcon
                name="keyboard_double_arrow_down"
                className="animate-float-slow text-text-placeholder transition-colors group-hover:text-terracotta/70"
              />
            </m.button>
          </m.div>
        </m.div>
      </section>

      <QuickDrawOverlay
        isOpen={isOverlayOpen}
        drawnCard={drawnCard}
        onClose={handleClose}
        onEnterReading={handleEnterReading}
      />
    </>
  );
}
