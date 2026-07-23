import "server-only";

import type { EncyclopediaQueryResponse } from "@aethertarot/shared-types";
import { isEncyclopediaQueryEnabled } from "@/server/beta/config";
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
import type { EncyclopediaRetrievedSource } from "@/server/encyclopedia/retrieval";

type FetchImplementation = typeof fetch;
type JsonRecord = Record<string, unknown>;

export type EncyclopediaDraft = Pick<
  EncyclopediaQueryResponse,
  "answer" | "related_cards" | "related_concepts" | "related_spreads"
>;

export interface EncyclopediaProvider {
  generateAnswer(input: {
    query: string;
    sources: EncyclopediaRetrievedSource[];
    boundaryNote: string | null;
    cardName?: string | null;
  }): Promise<EncyclopediaDraft>;
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asNonEmptyString(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 5);
}

function normalizeDraft(payload: unknown): EncyclopediaDraft {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ReadingServiceError(
      "generation_failed",
      "百科 provider 返回的 draft 不是合法对象。",
      500,
    );
  }

  const record = payload as JsonRecord;
  const answer = asNonEmptyString(record.answer);

  if (!answer) {
    throw new ReadingServiceError(
      "generation_failed",
      "百科 provider 返回的 answer 不能为空。",
      500,
    );
  }

  return {
    answer,
    related_cards: normalizeStringArray(record.related_cards),
    related_concepts: normalizeStringArray(record.related_concepts),
    related_spreads: normalizeStringArray(record.related_spreads),
  };
}

function buildPrompt({
  query,
  sources,
  boundaryNote,
  cardName,
}: {
  query: string;
  sources: EncyclopediaRetrievedSource[];
  boundaryNote: string | null;
  cardName?: string | null;
}) {
  return {
    system: [
      "You are AetherTarot's encyclopedia answer provider.",
      "Answer only as a tarot encyclopedia explainer, not as a reading agent.",
      "Use only the provided wiki sources. Do not draw cards, predict outcomes, infer hidden third-party intent, diagnose, or give medical/legal/financial instructions.",
      "Return JSON only with keys: answer, related_cards, related_concepts, related_spreads.",
      "All user-visible prose must be natural Simplified Chinese.",
    ].join("\n"),
    user: [
      cardName ? `用户当前正在查看的牌：${cardName}` : null,
      `用户问题：${query}`,
      boundaryNote ? `边界提示：${boundaryNote}` : null,
      "可用百科来源：",
      ...sources.map((source, index) =>
        [
          `Source ${index + 1}: ${source.title}`,
          `path: ${source.path}`,
          `type: ${source.type}`,
          `source_ids: ${source.source_ids.join(", ") || "unknown"}`,
          source.content,
        ].join("\n"),
      ),
      "回答要求：",
      "- 用 2-4 个自然段解释，必须贴合来源内容。",
      "- 不要声称这是一次塔罗解读，不要替用户做现实决定。",
      "- 若用户问题带有预测、依赖、治疗、法律或财务倾向，先解释百科含义，再温和提醒这不能替代现实判断或专业支持。",
      "- related_* 只返回和来源直接相关的标题数组。",
    ].filter(Boolean).join("\n\n"),
  };
}

export class LlmEncyclopediaProvider implements EncyclopediaProvider {
  private readonly transport: OpenAiCompatibleTransport;

  constructor(
    private readonly config: LlmProviderConfig = resolveLlmProviderConfig(),
    fetchImplementation: FetchImplementation = fetch,
    tokenGate: LlmTokenGate = databaseLlmTokenGate,
  ) {
    this.transport = new OpenAiCompatibleTransport(
      config,
      fetchImplementation,
      tokenGate,
    );
  }

  async generateAnswer(input: {
    query: string;
    sources: EncyclopediaRetrievedSource[];
    boundaryNote: string | null;
    cardName?: string | null;
  }) {
    const prompt = buildPrompt(input);
    const maxOutputTokens = Math.min(this.config.maxOutputTokens, 900);
    return this.transport.request({
      source: "encyclopedia",
      prompt,
      maxOutputTokens,
      parse: normalizeDraft,
      truncatedMessage:
        "百科 provider 输出达到长度上限，回答未完整生成，请缩短问题后重试。",
    });
  }
}

export function getEncyclopediaProvider() {
  if (!isEncyclopediaQueryEnabled()) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "百科问答暂未开放。",
      503,
    );
  }

  return new LlmEncyclopediaProvider();
}
