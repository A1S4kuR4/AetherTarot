import deckData from "../../../data/decks/rider-waite-smith.json";
import celticCrossData from "../../../data/spreads/celtic-cross.json";
import holyTriangleData from "../../../data/spreads/holy-triangle.json";
import singleSpreadData from "../../../data/spreads/single.json";
import type { Spread, TarotCard } from "@aethertarot/shared-types";

const tarotCards = deckData as TarotCard[];
const spreads = [singleSpreadData, holyTriangleData, celticCrossData] as Spread[];

export function getAllCards() {
  return tarotCards;
}

export function getAllSpreads() {
  return spreads;
}

export function findCardById(id: string) {
  return tarotCards.find((card) => card.id === id);
}

export function findSpreadById(id: string) {
  return spreads.find((spread) => spread.id === id);
}
