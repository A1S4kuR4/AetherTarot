export const PROMPTS_PER_BATCH = 5;

type PromptCategory = "relationship" | "career" | "self_growth" | "decision";

const PROMPTS_BY_CATEGORY: Record<PromptCategory, string[]> = {
  relationship: [
    "这段关系里，我忽略了什么真实张力？", "在沟通里，我有哪些边界还没有表达？", "我对这段关系最深的期待是什么？", "面对关系中的卡顿，我能先理解哪一部分自己？", "这段关系正在提醒我重视什么？", "我在靠近与独立之间最需要校准什么？", "最近的误解里，有什么事实值得重新确认？", "我想得到的回应，是否也需要先给自己？", "这段关系里的不安，正在保护我什么？", "我可以如何更温和地说出真实需要？", "面对反复拉扯，我最需要守住的底线是什么？", "我在这段关系里投入的节奏是否平衡？", "什么样的互动会让我感到更踏实？", "我是否把某种旧经验带进了现在的关系？", "这段陪伴关系中，什么值得继续培育？", "我能如何区分关心、担心与控制？", "面对沉默时，我最需要先看清什么？", "我对亲近的害怕，来自哪一种需要？", "这段关系里有哪些可以被真实讨论的部分？", "我能怎样让沟通回到彼此都能承受的节奏？", "当我感到委屈时，最值得先照顾的是什么？", "我在等待对方回应时，能为自己做什么？", "我是否把一个未验证的猜测当成了结论？", "我想带着怎样的状态继续面对这段关系？",
  ],
  career: [
    "接下来的工作重心，我适合先聚焦在哪里？", "关于职业方向，我的直觉正在提示什么？", "面对职业抉择，我最需要补齐哪类现实信息？", "当下职场环境里，有什么资源尚未被我利用？", "我是否过度消耗了自己的能量？", "面对职场瓶颈，我能主动做出的微小突破是什么？", "团队分歧中，我忽略了哪些客观因素？", "我的核心优势最适合在哪个场景发挥？", "我最近最需要厘清的工作优先级是什么？", "什么任务正在消耗我，却没有带来相应成长？", "我需要怎样的支持才能推进眼前项目？", "面对变化，我最该先验证哪个假设？", "我在职业选择中最担心失去什么？", "当下的工作节奏需要怎样调整？", "我能如何让自己的贡献被更清楚地看见？", "这次合作里，什么条件还没有对齐？", "我可以怎样把一个大目标拆成可验证的一步？", "我对成功的定义是否正在限制自己？", "什么现实反馈最能帮助我判断下一步？", "我需要补足哪项能力或信息来减少焦虑？", "面对不确定性，我可以先稳住哪件具体事情？", "我与工作之间的边界，哪里需要重新建立？", "最近的阻力正在提醒我注意什么成本？", "我希望工作为生活留下怎样的空间？",
  ],
  self_growth: [
    "我最近在潜意识中抵触什么？", "我现在真正需要看清的情绪是什么？", "我最近反复卡住的模式是什么？", "这份焦虑背后，我内心真正的渴望是什么？", "关于自我提升，我目前最大的认知盲区是什么？", "面对未知与不确定，我该如何安顿当下的不安？", "为了获得内心平静，我现在最需要放下什么？", "我能如何建立更温和的自我认同？", "最近最值得我留意的内在信号是什么？", "我正在对自己施加什么不必要的压力？", "哪一种休息能真正帮助我恢复能量？", "我可以如何更诚实地面对自己的需要？", "我在追求改变时，忽略了哪些已经做到的部分？", "什么习惯正在悄悄影响我的状态？", "当我感到混乱时，最适合从哪里开始整理？", "我可以怎样和自己的犹豫相处？", "此刻最需要被允许的感受是什么？", "我是否把暂时的停顿误解成了退步？", "什么小行动能让我重新感到有掌控感？", "我需要怎样的节奏来照顾长期目标？", "最近反复出现的念头，想提醒我什么？", "我可以如何把注意力从比较带回自己？", "什么边界能帮助我保护当下的能量？", "我想成为的人，今天可以如何被实践一点？",
  ],
  decision: [
    "面对这个选择，我最需要补齐哪类现实信息？", "如果放下对结果的执念，当下最自然的下一步是什么？", "两个选项之间，我最害怕承担的代价是什么？", "眼前困局能带来什么新的观察角度？", "对于当下卡顿，我能主动做出的微小改变是什么？", "做出决定前，我需要看清哪些现实边界？", "面对冲动与焦虑，我该如何维持清醒？", "从更长时间尺度看，这个决定对我意味着什么？", "我是否把必须立刻决定的压力放得太大？", "什么条件一旦被确认，会让我更有判断依据？", "我现在掌握的事实和推测分别是什么？", "这次选择里，什么是我真正不能妥协的？", "我可以怎样为不同方向设置低风险的检验点？", "哪一个担心最需要先被具体化？", "我是否忽略了一个可逆的小步骤？", "面对他人的期待，我自己的立场在哪里？", "这个决定会如何影响我的精力与时间？", "我需要找谁或查什么来补足现实信息？", "什么结果是我可以接受的，什么不是？", "我是否把短期情绪当成了长期方向？", "眼前最值得暂停并重新核对的是什么？", "如果暂不选择，我可以先完成哪件准备？", "我能如何区分直觉、恐惧与事实？", "做出下一步前，我最需要给自己什么空间？",
  ],
};

const ALL_PROMPTS = Array.from(
  { length: Math.max(...Object.values(PROMPTS_BY_CATEGORY).map((prompts) => prompts.length)) },
  (_, index) => (Object.keys(PROMPTS_BY_CATEGORY) as PromptCategory[])
    .map((category) => PROMPTS_BY_CATEGORY[category][index])
    .filter((prompt): prompt is string => Boolean(prompt)),
).flat();

export const CATEGORIZED_PROMPT_POOL: Record<"all" | PromptCategory, string[]> = {
  all: ALL_PROMPTS,
  ...PROMPTS_BY_CATEGORY,
};

export function getPromptBatch(category: keyof typeof CATEGORIZED_PROMPT_POOL, batchIndex: number) {
  const pool = CATEGORIZED_PROMPT_POOL[category];
  const start = batchIndex * PROMPTS_PER_BATCH;

  return Array.from(
    { length: PROMPTS_PER_BATCH },
    (_, index) => pool[(start + index) % pool.length],
  );
}

export function normalizeDecisionQuestion(question: string) {
  return question.replace(/\s+/g, " ").trim();
}

export function needsDecisionBoundary({
  isMajorDecisionQuestion,
  question,
  confirmedQuestion,
}: {
  isMajorDecisionQuestion: boolean;
  question: string;
  confirmedQuestion: string | null;
}) {
  return (
    isMajorDecisionQuestion
    && normalizeDecisionQuestion(question) !== confirmedQuestion
  );
}
