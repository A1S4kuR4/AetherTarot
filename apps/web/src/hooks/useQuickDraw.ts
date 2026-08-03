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
    if (isNavigating) return false;

    const spreads = getAllSpreads();
    const fallbackSpread = spreads.find((s) => s.id === "single") ?? spreads[0];
    
    // A questionless mirror always uses a single card. A submitted question
    // keeps the user's selected spread, matching the established quick path.
    const hasQuestion = Boolean((overrideQuestion ?? question).trim());
    const targetSpread = overrideQuestion !== undefined || !hasQuestion
      ? fallbackSpread
      : (selectedSpread ?? fallbackSpread);

    if (!targetSpread) {
      return false;
    }

    const quickDrawnCards = drawCardsForSpread(targetSpread.positions);

    if (quickDrawnCards.length !== targetSpread.positions.length) {
      return false;
    }

    setIsNavigating(true);

    if (overrideQuestion !== undefined) {
      setQuestion(overrideQuestion);
    }
    
    setAgentProfile("lite");
    setDrawSource("digital_random");
    setSelectedSpread(targetSpread);
    completeRitual(quickDrawnCards);
    router.push("/reading");
    return true;
  };

  return { performQuickDraw, isNavigating };
}
