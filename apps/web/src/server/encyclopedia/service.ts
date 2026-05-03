import "server-only";

import type { EncyclopediaQueryResponse } from "@aethertarot/shared-types";
import {
  deriveRelatedItems,
  retrieveEncyclopediaSources,
} from "@/server/encyclopedia/retrieval";
import { encyclopediaQueryResponseSchema } from "@/server/encyclopedia/schemas";
import { loadEncyclopediaWikiPages } from "@/server/encyclopedia/wiki";
import {
  getEncyclopediaProvider,
  type EncyclopediaProvider,
} from "@/server/encyclopedia/provider";

export interface GenerateEncyclopediaAnswerOptions {
  provider?: EncyclopediaProvider;
  loadPages?: typeof loadEncyclopediaWikiPages;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function detectBoundaryNote(query: string) {
  const normalized = query.toLowerCase();

  if (
    /自杀|自残|不想活|结束生命|kill myself|suicide/.test(normalized)
  ) {
    return "如果这个问题涉及你或他人的即时安全，请优先联系现实中的紧急支持；百科解释不能替代危机干预。";
  }

  if (
    /停止治疗|停药|诊断|怀孕|疾病|病|治疗|急救|急诊|overdose|emergency/.test(normalized)
  ) {
    return "健康与治疗相关问题需要以合格专业意见为准；这里最多解释塔罗语义，不能替代诊断或治疗建议。";
  }

  if (
    /离婚|辞职|投资|诉讼|起诉|借钱|贷款|买股票|all in|全部投入/.test(normalized)
  ) {
    return "重大现实决定应先回到事实、风险承受和专业建议；百科回答不能替你做决定。";
  }

  if (
    /他一定|她一定|对方一定|他会不会|她会不会|回来|爱我|恨我|真实想法|心里想/.test(normalized)
  ) {
    return "百科可以解释牌义与常见关系语境，但不能确认第三方隐藏想法或未来必然结果。";
  }

  if (/跟踪|监控|报复|操控|控制|pua|试探/.test(normalized)) {
    return "百科回答不能帮助控制、试探、监控或报复他人；请把重点放回边界、安全和现实沟通。";
  }

  return null;
}

function buildNoSourceResponse(query: string): EncyclopediaQueryResponse {
  const boundaryNote = detectBoundaryNote(query);

  return {
    answer:
      "我暂时没有在当前塔罗百科资料中找到足够可靠的对应条目。你可以换成更具体的牌名、概念或牌阵来问，例如“愚者逆位怎么理解”或“赛尔特十字的结果位是什么意思”。",
    sources: [],
    related_cards: [],
    related_concepts: [],
    related_spreads: [],
    boundary_note: boundaryNote,
  };
}

function applyBoundaryRestriction({
  answer,
  boundaryNote,
}: {
  answer: string;
  boundaryNote: string | null;
}) {
  if (!boundaryNote) {
    return answer;
  }

  if (
    /一定会|必然|必须|停止治疗|停药|确诊|百分之百|命中注定/.test(answer)
  ) {
    return `这个问题更适合先回到百科层面的牌义理解，而不是把塔罗语义当成现实结论。\n\n边界提醒：${boundaryNote}`;
  }

  return `${answer}\n\n边界提醒：${boundaryNote}`;
}

export async function generateEncyclopediaAnswer({
  query,
  cardId,
}: {
  query: string;
  cardId?: string;
}, options: GenerateEncyclopediaAnswerOptions = {}) {
  const pages = await (options.loadPages ?? loadEncyclopediaWikiPages)();
  const sources = retrieveEncyclopediaSources({ pages, query, cardId });

  if (sources.length === 0) {
    return encyclopediaQueryResponseSchema.parse(buildNoSourceResponse(query));
  }

  const boundaryNote = detectBoundaryNote(query);
  const provider = options.provider ?? getEncyclopediaProvider();
  const draft = await provider.generateAnswer({
    query,
    sources,
    boundaryNote,
  });
  const related = deriveRelatedItems(sources);

  return encyclopediaQueryResponseSchema.parse({
    answer: applyBoundaryRestriction({
      answer: draft.answer,
      boundaryNote,
    }),
    sources: sources.map((source) => ({
      title: source.title,
      path: source.path,
      type: source.type,
      source_ids: source.source_ids,
      excerpt: source.excerpt,
    })),
    related_cards: uniqueStrings([
      ...draft.related_cards,
      ...related.related_cards,
    ]).slice(0, 5),
    related_concepts: uniqueStrings([
      ...draft.related_concepts,
      ...related.related_concepts,
    ]).slice(0, 5),
    related_spreads: uniqueStrings([
      ...draft.related_spreads,
      ...related.related_spreads,
    ]).slice(0, 5),
    boundary_note: boundaryNote,
  });
}
