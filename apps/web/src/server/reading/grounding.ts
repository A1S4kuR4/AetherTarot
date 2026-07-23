import "server-only";

import type {
  DrawnCard,
  ReadingGrounding,
  Spread,
  StructuredReading,
} from "@aethertarot/shared-types";
import type {
  ReadingDraft,
  ReadingKnowledgeGrounding,
  ReadingKnowledgeGroundingChunk,
} from "@/server/reading/types";
import type { RetrieveTarotKnowledgeOutput } from "@/server/reading/tools/retrieve-tarot-knowledge";

const MAX_GROUNDING_CHUNKS = 12;

function normalizeCardId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "")
    .replace(/^the/, "");
}

function isSameCard(left: string | undefined, right: string) {
  return left ? normalizeCardId(left) === normalizeCardId(right) : false;
}

function orientationOf(drawnCard: DrawnCard) {
  return drawnCard.isReversed ? "reversed" as const : "upright" as const;
}

function authorityChunk(
  drawnCard: DrawnCard,
  spread: Spread,
): Omit<ReadingKnowledgeGroundingChunk, "ref"> {
  const orientation = orientationOf(drawnCard);
  const keywords = orientation === "reversed"
    ? drawnCard.card.reversedKeywords
    : drawnCard.card.uprightKeywords;
  const position = spread.positions.find((item) => item.id === drawnCard.positionId);
  return {
    id: `authority-card:${drawnCard.card.id}:${orientation}`,
    kind: "authority_card",
    title: `${drawnCard.card.name}（${orientation === "reversed" ? "逆位" : "正位"}）运行时牌面资料`,
    content: [
      `关键词：${keywords.slice(0, 4).join("、") || "保持开放观察"}`,
      `牌面描述：${drawnCard.card.description}`,
      `位置：${position?.name ?? drawnCard.positionId}；${position?.description ?? "留意此位置对应的现实层面。"}`,
    ].join("。"),
    source: "runtime/domain-tarot",
    source_ids: [],
    card: drawnCard.card.id,
    orientation,
    score: 0,
    confidence: "medium",
  };
}

function withStableRefs(
  chunks: Array<Omit<ReadingKnowledgeGroundingChunk, "ref">>,
): ReadingKnowledgeGroundingChunk[] {
  return chunks.map((chunk, index) => ({ ...chunk, ref: `K${index + 1}` }));
}

export function buildMinimumReadingGrounding({
  output,
  drawnCards,
  spread,
}: {
  output: RetrieveTarotKnowledgeOutput | null | undefined;
  drawnCards: DrawnCard[];
  spread: Spread;
}): ReadingKnowledgeGrounding {
  const wikiChunks = output?.chunks ?? [];
  const selected: Array<Omit<ReadingKnowledgeGroundingChunk, "ref">> = [];
  const selectedIds = new Set<string>();
  let degraded = !output || output.groundingStatus !== "retrieved";

  const add = (chunk: Omit<ReadingKnowledgeGroundingChunk, "ref">) => {
    if (selected.length < MAX_GROUNDING_CHUNKS && !selectedIds.has(chunk.id)) {
      selected.push(chunk);
      selectedIds.add(chunk.id);
    }
  };

  for (const drawnCard of drawnCards) {
    const orientation = orientationOf(drawnCard);
    const match = wikiChunks.find((chunk) =>
      isSameCard(chunk.card, drawnCard.card.id) && chunk.orientation === orientation
    ) ?? wikiChunks.find((chunk) =>
      isSameCard(chunk.card, drawnCard.card.id) && chunk.orientation === "unknown"
    ) ?? wikiChunks.find((chunk) => isSameCard(chunk.card, drawnCard.card.id));

    if (match) {
      add({
        ...match,
        kind: "wiki",
        card: drawnCard.card.id,
        orientation: match.orientation ?? "unknown",
      });
    } else {
      degraded = true;
      add(authorityChunk(drawnCard, spread));
    }
  }

  const spreadChunk = wikiChunks.find((chunk) => chunk.spread === spread.id);
  if (spreadChunk) {
    add({
      ...spreadChunk,
      kind: "wiki",
      card: drawnCards[0]?.card.id ?? "spread",
      orientation: spreadChunk.orientation ?? "unknown",
    });
  }
  for (const chunk of wikiChunks) {
    if (selected.length >= MAX_GROUNDING_CHUNKS) {
      break;
    }
    if (!chunk.card) {
      continue;
    }
    add({
      ...chunk,
      kind: "wiki",
      card: chunk.card,
      orientation: chunk.orientation ?? "unknown",
    });
  }

  return {
    status: degraded ? "degraded" : "retrieved",
    chunks: withStableRefs(selected),
  };
}

function authorityForCard(
  cardIndex: number,
  drawnCards: DrawnCard[],
  spread: Spread,
  sources: ReadingKnowledgeGroundingChunk[],
) {
  const drawnCard = drawnCards[cardIndex];
  const existing = sources.find((source) =>
    source.kind === "authority_card" && source.card === drawnCard.card.id
  );
  if (existing) {
    return existing;
  }
  const created = {
    ...authorityChunk(drawnCard, spread),
    ref: `A${cardIndex + 1}`,
  };
  sources.push(created);
  return created;
}

export function finalizeReadingGrounding({
  reading,
  draft,
  grounding,
  drawnCards,
  spread,
}: {
  reading: StructuredReading;
  draft: ReadingDraft;
  grounding: ReadingKnowledgeGrounding;
  drawnCards: DrawnCard[];
  spread: Spread;
}): StructuredReading {
  const sources = grounding.chunks.map((chunk) => ({ ...chunk }));
  const providerClaims = new Map(
    (draft.grounding_claims ?? []).map((claim) => [claim.path, claim.source_refs]),
  );
  const claims: ReadingGrounding["claims"] = [];
  let degraded = grounding.status !== "retrieved";

  const cards = reading.cards.map((card, index) => {
    const path = `cards.${index}.interpretation` as const;
    const requestedRefs = providerClaims.get(path) ?? [];
    const allowedRefs = requestedRefs.filter((ref) => {
      const source = sources.find((item) => item.ref === ref);
      return Boolean(
        source
        && source.card === card.card_id
        && (
          source.orientation === card.orientation
          || source.orientation === "unknown"
        ),
      );
    });
    const wasSafetyChanged = draft.cards[index]?.interpretation !== card.interpretation;
    if (allowedRefs.length > 0 && !wasSafetyChanged) {
      claims.push({ path, source_refs: allowedRefs });
      return card;
    }

    degraded = true;
    const authority = authorityForCard(index, drawnCards, spread, sources);
    const position = spread.positions.find((item) => item.id === card.position_id);
    const keywords = card.orientation === "reversed"
      ? drawnCards[index].card.reversedKeywords
      : drawnCards[index].card.uprightKeywords;
    claims.push({ path, source_refs: [authority.ref] });
    return {
      ...card,
      interpretation:
        `${card.position}的${card.name}（${card.orientation === "reversed" ? "逆位" : "正位"}）`
        + `可先从“${keywords.slice(0, 3).join("、") || "保持开放观察"}”理解。`
        + `${position?.description ?? "请把牌面放回这个位置的现实语境。"}`
        + "这是一条反思线索，不构成对结果、他人想法或专业事项的确定结论。",
    };
  });

  const synthesisRefs = providerClaims.get("synthesis") ?? [];
  const validSynthesisRefs = synthesisRefs.filter((ref) =>
    sources.some((source) => source.ref === ref)
  );
  const synthesisWasSafetyChanged = draft.synthesis !== reading.synthesis;
  let synthesis = reading.synthesis;
  if (validSynthesisRefs.length === 0 || synthesisWasSafetyChanged) {
    degraded = true;
    const cardRefs = claims.flatMap((claim) => claim.source_refs);
    claims.push({ path: "synthesis", source_refs: [...new Set(cardRefs)] });
    synthesis =
      `这组牌可保守地理解为：${cards.map((card) => `${card.position}的${card.name}`).join("、")}`
      + "共同提供了若干观察角度，但没有替你确认唯一结果。请把这些线索与现实事实、可观察反馈和个人边界一起核对。";
  } else {
    claims.push({ path: "synthesis", source_refs: [...new Set(validSynthesisRefs)] });
  }

  const usedRefs = new Set(claims.flatMap((claim) => claim.source_refs));
  const publicSources = sources
    .filter((source) => usedRefs.has(source.ref))
    .map((source) => ({
      ref: source.ref,
      kind: source.kind,
      title: source.title,
      card_id: source.card,
      orientation: source.orientation,
      chunk_id: source.id,
        source_ids: source.source_ids ?? [],
    }));

  return {
    ...reading,
    cards,
    synthesis,
    grounding: {
      version: 1,
      status: degraded ? "degraded" : "grounded",
      sources: publicSources,
      claims,
    },
  };
}
