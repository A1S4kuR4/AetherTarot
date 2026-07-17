export type ShareMode = "minimal" | "summary";

export const SHARE_CARD_WIDTH = 600;
export const SHARE_CARD_HEIGHT = 900;
export const SHARE_CARD_PIXEL_RATIO = 2;
export const SHARE_SAFETY_NOTE_MAX_LENGTH = 180;

export const SHARE_MODE_LABELS: Record<ShareMode, string> = {
  minimal: "牌阵卡",
  summary: "解读摘要卡",
};

export const SHARE_MODE_DESCRIPTIONS: Record<ShareMode, string> = {
  minimal: "只分享牌面、位置与主题，不显示你的问题与解读内容。",
  summary: "分享你的问题、牌阵、主题和解读摘要。图片保存或发送后无法撤回。",
};

export interface ContentBudget {
  maxQuestionLines: number;
  maxSynthesisLines: number;
  maxGuidanceCount: number;
}

export function getContentBudget(cardCount: number): ContentBudget {
  if (cardCount <= 3) {
    return { maxQuestionLines: 4, maxSynthesisLines: 8, maxGuidanceCount: 3 };
  }
  if (cardCount <= 7) {
    return { maxQuestionLines: 3, maxSynthesisLines: 6, maxGuidanceCount: 2 };
  }
  return { maxQuestionLines: 2, maxSynthesisLines: 4, maxGuidanceCount: 2 };
}

export const SHARE_FIXED_COPY = {
  brand: "灵语塔罗",
  brandEnglish: "AetherTarot",
  brandUrl: "aethertarot.cn",
  spreadLabel: "牌阵",
  positionUpright: "正位",
  positionReversed: "逆位",
  themesLabel: "主题",
  questionLabel: "我的问题",
  synthesisLabel: "综合解读",
  guidanceLabel: "可以带走的思考",
  exportedLabel: "导出于",
  footerSlogan: "每张牌都是当下的镜子",
} as const;
