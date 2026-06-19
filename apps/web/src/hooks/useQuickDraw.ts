import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAllSpreads } from "@aethertarot/domain-tarot";
import { drawCardsForSpread } from "@/lib/tarotDraw";
import { useReading } from "@/context/ReadingContext";

export function useQuickDraw() {
  const router = useRouter();
  const {
    question,
    selectedSpread,
    setQuestion,
    setSelectedSpread,
    setAgentProfile,
    setDrawSource,
    completeRitual,
  } = useReading();

  const [isNavigating, setIsNavigating] = useState(false);

  const performQuickDraw = (overrideQuestion?: string) => {
    if (isNavigating) return;

    const finalQuestion = (overrideQuestion ?? question).trim();
    if (!finalQuestion) {
      return;
    }

    const spreads = getAllSpreads();
    const fallbackSpread = spreads.find((s) => s.id === "single") ?? spreads[0];
    
    // If overrideQuestion is provided, it's a "cold start" entry point.
    // We default to the single spread instead of whatever might be selected.
    const targetSpread = overrideQuestion ? fallbackSpread : (selectedSpread ?? fallbackSpread);

    if (!targetSpread) {
      return;
    }

    const quickDrawnCards = drawCardsForSpread(targetSpread.positions);

    if (quickDrawnCards.length !== targetSpread.positions.length) {
      return;
    }

    setIsNavigating(true);

    if (overrideQuestion) {
      setQuestion(overrideQuestion);
    }
    
    setAgentProfile("lite");
    setDrawSource("digital_random");
    setSelectedSpread(targetSpread);
    completeRitual(quickDrawnCards);
    router.push("/reading");
  };

  return { performQuickDraw, isNavigating };
}
