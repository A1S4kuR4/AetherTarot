export type TarotKnowledgeOrientation = "upright" | "reversed" | "unknown";

export interface TarotKnowledgeChunk {
  id: string;
  source_id: string;
  title: string;
  content: string;
  source: string;
  card?: string;
  orientation?: TarotKnowledgeOrientation;
  topic?: string[];
  tags?: string[];
}

export interface ScoredTarotKnowledgeChunk extends TarotKnowledgeChunk {
  score: number;
  confidence: "low" | "medium" | "high";
}
