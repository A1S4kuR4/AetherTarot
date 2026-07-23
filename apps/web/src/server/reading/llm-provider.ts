import "server-only";

import {
  buildFinalReadingPrompt,
  buildInitialReadingPrompt,
} from "@aethertarot/prompting";
import type {
  AgentProfile,
  ReadingCardResult,
  ReadingPhase,
} from "@aethertarot/shared-types";
import { ReadingServiceError } from "@/server/reading/errors";
import {
  OpenAiCompatibleTransport,
  resolveLlmProviderConfig,
  type LlmProviderConfig,
} from "@/server/llm/openai-compatible-transport";
import {
  databaseLlmTokenGate,
  type LlmTokenGate,
} from "@/server/beta/token-budget";
import type {
  FinalReadingContext,
  HydratedReadingContext,
  ReadingDraft,
  ReadingProvider,
} from "@/server/reading/types";

export { resolveLlmProviderConfig };
export type { LlmProviderConfig };

type FetchImplementation = typeof fetch;

type JsonRecord = Record<string, unknown>;

const READING_OUTPUT_TOKEN_BUDGETS: Record<
  AgentProfile,
  readonly [number, number, number, number]
> = {
  lite: [900, 1400, 1800, 2200],
  standard: [1400, 1900, 2400, 2800],
  sober: [1800, 2300, 2800, 3200],
};

export function resolveReadingMaxOutputTokens({
  agentProfile,
  cardCount,
  configuredMaxOutputTokens,
}: {
  agentProfile: AgentProfile;
  cardCount: number;
  configuredMaxOutputTokens: number;
}) {
  const budgetIndex = cardCount <= 1
    ? 0
    : cardCount <= 4
      ? 1
      : cardCount <= 7
        ? 2
        : 3;

  return Math.min(
    READING_OUTPUT_TOKEN_BUDGETS[agentProfile][budgetIndex],
    configuredMaxOutputTokens,
  );
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function collectInterpretationText(value: unknown): string[] {
  if (typeof value === "string") {
    const normalized = asNonEmptyString(value);
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectInterpretationText(item));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.values(value as JsonRecord).flatMap((item) =>
    collectInterpretationText(item),
  );
}

function normalizeCardInterpretation(record: JsonRecord) {
  const direct = asNonEmptyString(record.interpretation);

  if (direct) {
    return direct;
  }

  const aliases = [
    record.interpretation,
    record.card_interpretation,
    record.cardInterpretation,
    record.meaning,
    record.reading,
    record.analysis,
    record.explanation,
  ];

  for (const value of aliases) {
    const joined = collectInterpretationText(value).join(" ").trim();

    if (joined) {
      return joined;
    }
  }

  return null;
}

function buildAuthorityCards(context: HydratedReadingContext): ReadingCardResult[] {
  return context.drawnCards.map((drawnCard) => {
    const position = context.spread.positions.find(
      (item) => item.id === drawnCard.positionId,
    );

    return {
      card_id: drawnCard.card.id,
      name: drawnCard.card.name,
      english_name: drawnCard.card.englishName,
      orientation: drawnCard.isReversed ? "reversed" : "upright",
      position_id: drawnCard.positionId,
      position: position?.name ?? "未知位置",
      position_meaning:
        position?.description ?? "这个位置提醒你留意问题的关键层面。",
      interpretation: "",
    };
  });
}

function normalizeStringArray({
  value,
  field,
  min,
  max,
}: {
  value: unknown;
  field: string;
  min: number;
  max: number;
}) {
  if (!Array.isArray(value)) {
    throw new ReadingServiceError(
      "generation_failed",
      `llm provider 返回的 ${field} 必须是数组。`,
      500,
    );
  }

  const seen = new Set<string>();
  const normalized = value
    .map((item) => asNonEmptyString(item))
    .filter((item): item is string => Boolean(item))
    .filter((item) => {
      if (seen.has(item)) {
        return false;
      }

      seen.add(item);
      return true;
    })
    .slice(0, max);

  if (normalized.length < min) {
    throw new ReadingServiceError(
      "generation_failed",
      `llm provider 返回的 ${field} 数量不足。`,
      500,
    );
  }

  return normalized;
}

function normalizeGroundingClaims(value: unknown): ReadingDraft["grounding_claims"] {
  if (!Array.isArray(value)) {
    return [];
  }

  const claims: NonNullable<ReadingDraft["grounding_claims"]> = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const record = item as JsonRecord;
    const path = asNonEmptyString(record.path);
    if (!path || !/^(?:cards\.\d+\.interpretation|synthesis)$/.test(path)) {
      continue;
    }
    const sourceRefs = Array.isArray(record.source_refs)
      ? [...new Set(record.source_refs.map(asNonEmptyString).filter((ref): ref is string => Boolean(ref)))]
      : [];
    if (sourceRefs.length > 0) {
      claims.push({
        path: path as `cards.${number}.interpretation` | "synthesis",
        source_refs: sourceRefs,
      });
    }
  }
  return claims;
}

function normalizeCards({
  value,
  authorityCards,
}: {
  value: unknown;
  authorityCards: ReadingCardResult[];
}) {
  if (!Array.isArray(value)) {
    throw new ReadingServiceError(
      "generation_failed",
      "llm provider 返回的 cards 必须是数组。",
      500,
    );
  }

  if (value.length !== authorityCards.length) {
    throw new ReadingServiceError(
      "generation_failed",
      "llm provider 返回的 cards 数量必须与 authority cards 一致。",
      500,
    );
  }

  return authorityCards.map((authorityCard, index) => {
    const rawCard = value[index];

    if (!rawCard || typeof rawCard !== "object" || Array.isArray(rawCard)) {
      throw new ReadingServiceError(
        "generation_failed",
        "llm provider 返回的某张 card 不是合法对象。",
        500,
      );
    }

    const record = rawCard as JsonRecord;
    const interpretation = normalizeCardInterpretation(record);
    const rawCardId = asNonEmptyString(record.card_id);
    const rawPositionId = asNonEmptyString(record.position_id);
    const rawOrientation = asNonEmptyString(record.orientation);

    if (!interpretation) {
      throw new ReadingServiceError(
        "generation_failed",
        "llm provider 返回的 card interpretation 不能为空。",
        500,
      );
    }

    if (rawCardId && rawCardId !== authorityCard.card_id) {
      throw new ReadingServiceError(
        "generation_failed",
        "llm provider 返回的 card_id 与 authority cards 不一致。",
        500,
      );
    }

    if (rawPositionId && rawPositionId !== authorityCard.position_id) {
      throw new ReadingServiceError(
        "generation_failed",
        "llm provider 返回的 position_id 与 authority cards 不一致。",
        500,
      );
    }

    if (
      rawOrientation
      && rawOrientation !== "upright"
      && rawOrientation !== "reversed"
    ) {
      throw new ReadingServiceError(
        "generation_failed",
        "llm provider 返回的 orientation 不是合法值。",
        500,
      );
    }

    if (rawOrientation && rawOrientation !== authorityCard.orientation) {
      throw new ReadingServiceError(
        "generation_failed",
        "llm provider 返回的 orientation 与 authority cards 不一致。",
        500,
      );
    }

    return {
      card_id: authorityCard.card_id,
      name: authorityCard.name,
      english_name: authorityCard.english_name,
      orientation: authorityCard.orientation,
      position_id: authorityCard.position_id,
      position: authorityCard.position,
      position_meaning: authorityCard.position_meaning,
      interpretation,
    } satisfies ReadingCardResult;
  });
}

function getFollowupBounds(
  phase: ReadingPhase,
  agentProfile: AgentProfile,
) {
  if (phase === "final") {
    return { min: 0, max: 1 };
  }

  if (agentProfile === "lite") {
    return { min: 0, max: 1 };
  }

  return { min: 1, max: 2 };
}

export function normalizeReadingDraft({
  payload,
  context,
  phase,
}: {
  payload: unknown;
  context: HydratedReadingContext;
  phase: ReadingPhase;
}): ReadingDraft {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ReadingServiceError(
      "generation_failed",
      "llm provider 返回的 draft 不是合法对象。",
      500,
    );
  }

  const record = payload as JsonRecord;
  const followupBounds = getFollowupBounds(phase, context.agentProfile);
  const authorityCards = buildAuthorityCards(context);
  const confidenceNote = asNonEmptyString(record.confidence_note);

  if (!confidenceNote) {
    throw new ReadingServiceError(
      "generation_failed",
      "llm provider 返回的 confidence_note 不能为空。",
      500,
    );
  }

  return {
    cards: normalizeCards({ value: record.cards, authorityCards }),
    themes: normalizeStringArray({
      value: record.themes,
      field: "themes",
      min: 2,
      max: 4,
    }),
    synthesis: asNonEmptyString(record.synthesis)
      ?? (() => {
        throw new ReadingServiceError(
          "generation_failed",
          "llm provider 返回的 synthesis 不能为空。",
          500,
        );
      })(),
    reflective_guidance: normalizeStringArray({
      value: record.reflective_guidance,
      field: "reflective_guidance",
      min: 2,
      max: 4,
    }),
    follow_up_questions: normalizeStringArray({
      value: record.follow_up_questions ?? [],
      field: "follow_up_questions",
      min: followupBounds.min,
      max: followupBounds.max,
    }),
    confidence_note: confidenceNote,
    grounding_claims: normalizeGroundingClaims(record.grounding_claims),
  };
}

export class LlmReadingProvider implements ReadingProvider {
  private readonly transport: OpenAiCompatibleTransport;

  constructor(
    private readonly config: LlmProviderConfig,
    fetchImplementation: FetchImplementation = fetch,
    tokenGate: LlmTokenGate = databaseLlmTokenGate,
  ) {
    this.transport = new OpenAiCompatibleTransport(
      config,
      fetchImplementation,
      tokenGate,
    );
  }

  private requestDraft(
    prompt: { system: string; user: string },
    maxOutputTokens: number,
  ) {
    return this.transport.request({
      source: "reading",
      prompt,
      maxOutputTokens,
      parse: (payload) => payload,
      truncatedMessage:
        "llm provider 输出达到长度上限，解读未完整生成，请稍后重试或减少牌数。",
    });
  }

  async generateInitialRead(context: HydratedReadingContext) {
    const maxOutputTokens = resolveReadingMaxOutputTokens({
      agentProfile: context.agentProfile,
      cardCount: context.drawnCards.length,
      configuredMaxOutputTokens: this.config.maxOutputTokens,
    });
    const payload = await this.requestDraft(
      buildInitialReadingPrompt(context),
      maxOutputTokens,
    );

    return normalizeReadingDraft({
      payload,
      context,
      phase: "initial",
    });
  }

  async generateFinalRead(context: FinalReadingContext) {
    const maxOutputTokens = resolveReadingMaxOutputTokens({
      agentProfile: context.agentProfile,
      cardCount: context.drawnCards.length,
      configuredMaxOutputTokens: this.config.maxOutputTokens,
    });
    const payload = await this.requestDraft(
      buildFinalReadingPrompt(context),
      maxOutputTokens,
    );

    return normalizeReadingDraft({
      payload,
      context,
      phase: "final",
    });
  }
}

export function createLlmReadingProviderFromEnv(
  env: Partial<NodeJS.ProcessEnv> = process.env,
  fetchImplementation: FetchImplementation = fetch,
  tokenGate: LlmTokenGate = databaseLlmTokenGate,
) {
  return new LlmReadingProvider(
    resolveLlmProviderConfig(env),
    fetchImplementation,
    tokenGate,
  );
}
