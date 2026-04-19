import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { getAllCards } from "@aethertarot/domain-tarot";

export interface EncyclopediaCoverageSummary {
  runtimeCards: number;
  runtimeMajor: number;
  runtimeMinor: number;
  runtimeBySuit: {
    wands: number;
    cups: number;
    swords: number;
    pentacles: number;
  };
  knowledgeCards: number;
  knowledgeMajor: number;
  knowledgeMinor: number;
  knowledgeConcepts: number;
  knowledgeSpreads: number;
}

async function countFiles(directory: string) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).length;
}

function resolveKnowledgeWikiRoot() {
  return path.resolve(process.cwd(), "..", "..", "knowledge", "wiki");
}

export async function getEncyclopediaCoverageSummary(): Promise<EncyclopediaCoverageSummary> {
  const cards = getAllCards();
  const knowledgeWikiRoot = resolveKnowledgeWikiRoot();
  const runtimeMajor = cards.filter((card) => card.arcana === "major").length;
  const runtimeBySuit = {
    wands: cards.filter((card) => card.arcana === "minor" && card.element === "Fire").length,
    cups: cards.filter((card) => card.arcana === "minor" && card.element === "Water").length,
    swords: cards.filter((card) => card.arcana === "minor" && card.element === "Air").length,
    pentacles: cards.filter((card) => card.arcana === "minor" && card.element === "Earth").length,
  };
  const knowledgeMajor = await countFiles(path.join(knowledgeWikiRoot, "major-arcana"));
  const knowledgeMinor = await countFiles(path.join(knowledgeWikiRoot, "minor-arcana", "wands"))
    + await countFiles(path.join(knowledgeWikiRoot, "minor-arcana", "cups"))
    + await countFiles(path.join(knowledgeWikiRoot, "minor-arcana", "swords"))
    + await countFiles(path.join(knowledgeWikiRoot, "minor-arcana", "pentacles"));
  const knowledgeConcepts = await countFiles(path.join(knowledgeWikiRoot, "concepts"));
  const knowledgeSpreads = await countFiles(path.join(knowledgeWikiRoot, "spreads"));

  return {
    runtimeCards: cards.length,
    runtimeMajor,
    runtimeMinor: cards.length - runtimeMajor,
    runtimeBySuit,
    knowledgeCards: knowledgeMajor + knowledgeMinor,
    knowledgeMajor,
    knowledgeMinor,
    knowledgeConcepts,
    knowledgeSpreads,
  };
}
