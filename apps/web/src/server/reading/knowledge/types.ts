export type TarotKnowledgeOrientation = "upright" | "reversed" | "unknown";

export interface TarotKnowledgeChunk {
  id: string;
  source_ids?: string[];
  /** @deprecated Kept for internal fixture compatibility. */
  source_id?: string;
  title: string;
  content: string;
  source: string;
  card?: string;
  spread?: string;
  orientation?: TarotKnowledgeOrientation;
  topic?: string[];
  tags?: string[];
  has_inline_source?: boolean;
}

export interface ScoredTarotKnowledgeChunk extends TarotKnowledgeChunk {
  score: number;
  confidence: "low" | "medium" | "high";
}
