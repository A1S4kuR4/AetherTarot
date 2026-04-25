export interface SpreadExperience {
  organizationModel: string[];
  revealFocus: string;
  readingMechanism: string;
  evidencePath: string;
}

const SPREAD_EXPERIENCES: Record<string, SpreadExperience> = {
  single: {
    organizationModel: [
      "单一焦点",
      "当下最需要被照亮的线索",
      "不把一张牌读成确定答案",
    ],
    revealFocus:
      "单牌启示会把随机收束到一个核心位置。请先看这张牌照亮了什么，而不是急着把它听成一个最终裁决。",
    readingMechanism:
      "单牌启示把随机收束到一个核心位置，先看这张牌如何照亮本轮问题最需要被看见的焦点；它提供的是观察入口，不是确定答案。",
    evidencePath:
      "证据路径很短：先确认牌面与正逆位，再回到核心指引的位置语义，最后才进入综合推断。",
  },
  "holy-triangle": {
    organizationModel: ["过去", "现在", "潜在流向"],
    revealFocus:
      "圣三角形会把随机牌面放进过去、现在与潜在流向。请先看这条时间与因果路径是否成立。",
    readingMechanism:
      "圣三角形会按过去、现在与潜在流向阅读，把随机牌面放进一条可复核的时间与因果路径。",
    evidencePath:
      "证据路径会先看每个时间位置的牌面线索，再比较三点之间的变化，而不是只取其中一张牌下结论。",
  },
  "four-aspects": {
    organizationModel: ["身体", "情感", "心智", "精神"],
    revealFocus:
      "四个面向会把同一议题拆成身体、情感、心智与精神四层。请先观察哪一层最亮，哪一层最有阻力。",
    readingMechanism:
      "四个面向会把随机牌面拆入身体、情感、心智与精神四层，让同一问题先被分层观看，再进入综合。",
    evidencePath:
      "证据路径会先分层保存牌面差异，再看这些层面之间是否互相支持、互相牵制或彼此脱节。",
  },
  "seven-card": {
    organizationModel: [
      "时间线",
      "答案 / 结果主轴",
      "外部气候 / 主观投射张力",
    ],
    revealFocus:
      "七张牌会先抓答案与结果主轴，再回看时间线如何把它推出来，并分清外部气候与内在投射。",
    readingMechanism:
      "七张牌会先看时间线，再抓答案 / 结果主轴，并分辨外部气候与希望恐惧之间的张力。",
    evidencePath:
      "证据路径会优先校准答案与结果是否在同一条线上，再用环境、希望与恐惧拆开现实条件和主观投射。",
  },
  "celtic-cross": {
    organizationModel: [
      "核心 / 挑战",
      "意识 / 潜意识",
      "时间线",
      "自我 / 环境 / 希望恐惧 / 结果",
    ],
    revealFocus:
      "赛尔特十字会把问题展开成多层剖面。请先找核心与挑战，再看意识、潜意识、时间线和外部位置如何互相牵动。",
    readingMechanism:
      "赛尔特十字会从核心与挑战展开，再对照意识、潜意识、时间线、自我、环境、希望恐惧与结果。",
    evidencePath:
      "证据路径会先守住核心与挑战，再逐层对照内在动机、外部环境和时间落点，避免把十张牌压成一句结论。",
  },
};

export function getSpreadExperience(
  spreadId: string,
  spreadName: string,
  positionNames: string[],
): SpreadExperience {
  return SPREAD_EXPERIENCES[spreadId] ?? {
    organizationModel: positionNames,
    revealFocus:
      `${spreadName} 会按权威位置组织本轮牌面。请先看位置之间如何形成结构，再进入综合解读。`,
    readingMechanism:
      `${spreadName} 会按照权威位置顺序阅读本轮随机牌面，让每张牌先回到自己的位置语义，再进入整体综合。`,
    evidencePath:
      "证据路径会先保留牌面线索与位置语义，再把它们收束为综合推断。",
  };
}
