import type { QuestionType } from "@aethertarot/shared-types";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  relationship: "关系议题",
  career: "职业议题",
  self_growth: "自我成长",
  decision: "行动选择",
  other: "综合议题",
};

export const FEEDBACK_OPTIONS = [
  { label: "有帮助", value: "helpful" },
  { label: "还可以更好", value: "could_be_better" },
] as const;

export type FeedbackLabel = (typeof FEEDBACK_OPTIONS)[number]["value"];

export const READING_NAV_ITEMS = [
  { id: "reading-spread", label: "牌阵" },
  { id: "reading-quick", label: "核心" },
  { id: "reading-cards", label: "逐牌" },
  { id: "reading-synthesis", label: "综合" },
  { id: "reading-evidence", label: "依据" },
  { id: "reading-guidance", label: "思考" },
  { id: "reading-followup", label: "追问" },
  { id: "reading-radar", label: "能量" },
  { id: "reading-feedback", label: "反馈" },
  { id: "reading-notes", label: "手记" },
] as const;

export type ReadingNavItem = (typeof READING_NAV_ITEMS)[number];
export type ReadingSectionId = ReadingNavItem["id"];

const CHAPTER_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"] as const;

export function getReadingChapterLabels(
  visibleSectionIds: readonly ReadingSectionId[],
): Partial<Record<ReadingSectionId, string>> {
  return Object.fromEntries(
    visibleSectionIds.map((id, index) => [id, CHAPTER_NUMERALS[index]]),
  ) as Partial<Record<ReadingSectionId, string>>;
}

export const LOADING_STAGES = [
  {
    delayMs: 0,
    title: "正在确认访问与本次牌阵…",
    detail: "系统会先校验内测访问、额度和抽到的牌位，避免无效请求浪费等待时间。",
  },
  {
    delayMs: 4500,
    title: "正在组织牌面线索…",
    detail: "正在把你的问题、牌阵位置和正逆位整理成可检查的解读上下文。",
  },
  {
    delayMs: 12000,
    title: "正在生成并复核边界…",
    detail: "弱网或模型响应较慢时可能需要更久；如果超时，当前牌阵会保留并允许重试。",
  },
] as const;
