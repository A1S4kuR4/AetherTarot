import type { AgentProfile, DrawnCard, Spread } from "@aethertarot/shared-types";

interface QuickReadingStateInput {
  agentProfile: AgentProfile;
  selectedSpread: Spread | null;
  drawnCards: DrawnCard[];
}

export function isQuickReadingState({
  agentProfile,
  selectedSpread,
  drawnCards,
}: QuickReadingStateInput) {
  const singlePosition = selectedSpread?.positions[0];

  return (
    agentProfile === "lite"
    && selectedSpread?.id === "single"
    && selectedSpread.positions.length === 1
    && drawnCards.length === 1
    && drawnCards[0]?.positionId === singlePosition?.id
  );
}
