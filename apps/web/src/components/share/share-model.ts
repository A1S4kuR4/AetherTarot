import type { DrawnCard, StructuredReading } from "@aethertarot/shared-types";
import type { ShareMode } from "./constants";

export interface ShareCardItem {
  positionId: string;
  position: string;
  cardId: string;
  isMajor: boolean;
  name: string;
  englishName: string;
  orientation: "upright" | "reversed";
  imageUrl: string;
}

export interface ShareCardModel {
  mode: ShareMode;
  exportedAt: string;
  question: string;
  spreadName: string;
  cards: ShareCardItem[];
  themes: string[];
  synthesis: string;
  guidance: string[];
  safetyNote: string | null;
  confidenceNote: string | null;
}

interface BuildShareCardModelOptions {
  reading: StructuredReading;
  drawnCards: DrawnCard[];
  mode: ShareMode;
  exportedAt?: string;
}

export function buildShareCardModel({
  reading,
  drawnCards,
  mode,
  exportedAt,
}: BuildShareCardModelOptions): ShareCardModel {
  const cardMap = new Map(drawnCards.map((item) => [item.positionId, item]));

  const cards: ShareCardItem[] = reading.cards.map((card) => {
    const drawn = cardMap.get(card.position_id);
    const imageUrl = drawn?.card.thumbnailUrl ?? drawn?.card.imageUrl ?? "";

    return {
      positionId: card.position_id,
      position: card.position,
      cardId: card.card_id,
      isMajor: drawn?.card.arcana.toLowerCase().startsWith("major") ?? false,
      name: card.name,
      englishName: card.english_name,
      orientation: card.orientation,
      imageUrl,
    };
  });

  return {
    mode,
    exportedAt: exportedAt ?? new Date().toISOString(),
    question: reading.question,
    spreadName: reading.spread.name,
    cards,
    themes: reading.themes,
    synthesis: reading.synthesis,
    guidance: reading.reflective_guidance,
    safetyNote: reading.safety_note,
    confidenceNote: reading.confidence_note,
  };
}
