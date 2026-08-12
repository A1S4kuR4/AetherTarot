import {
  hasUnsafeSafetyCore,
  type SafetyCoreRule,
  type SafetyPattern,
  type SafetyTextSegment,
} from "@/server/safety/text-normalization";

export type SafetySemanticFamilyId =
  | "self_harm_state"
  | "violence_toward_others"
  | "urgent_medical_danger"
  | "stalking_monitoring_control"
  | "treatment_discontinuation"
  | "direct_diagnosis";

export type SafetySemanticChannel = "input" | "output";

export type SafetySemanticFamily = {
  id: SafetySemanticFamilyId;
  inputRules: readonly SafetyCoreRule[];
  outputRules: readonly SafetyCoreRule[];
};

const patterns = (
  normalized: RegExp,
  compact: RegExp,
): SafetyPattern[] => [
  { form: "normalized", pattern: normalized },
  { form: "compact", pattern: compact },
];

/** Intent to perform an action: want / need / plan / intend and common Chinese forms. */
const INTENT_CUES = patterns(
  /(?:我|本人)?(?:想|要|需要|准备|计划|打算|意图)|我会|I\s*(?:want|need|plan|intend|will)|I\s*am\s*(?:going|planning|about)/i,
  /(?:我|本人)?(?:想|要|需要|准备|计划|打算|意图)|我会|i(?:want|need|plan|intend)(?:to)?|iwill|iam(?:going|planning|about)to/i,
);

/** Requests or directives: help / show / teach / tell / steps / should / must / do. */
const DIRECTIVE_CUES = patterns(
  /帮我|协助我|教我|示范|告诉我|给我.{0,8}步骤|建议|怎么|如何|你(?:应该|必须|需要|可以)|立即|马上|\b(?:help me|show me|teach me|tell me|give me steps|recommend|go|how can I|how do I|you should|you must|you need to|you can)\b/i,
  /帮我|协助我|教我|示范|告诉我|给我.{0,8}步骤|建议|怎么|如何|你(?:应该|必须|需要|可以)|立即|马上|helpme|showme(?:howto)?|teachme(?:howto)?|tellme(?:howto)?|givemesteps(?:to)?|recommend|go|howcani|howdoi|youshould|youmust|youneedto|youcan/i,
);

const INTENT_OR_DIRECTIVE_CUES: SafetyPattern[] = [
  ...INTENT_CUES,
  ...DIRECTIVE_CUES,
];

const SELF_HARM_DENIAL_CONTEXTS = patterns(
  /(?:我)?(?:不想|不会|不打算|没有|拒绝|避免)(?:去)?(?:自杀|自残|伤害自己|伤害我自己|结束生命)(?:的)?(?:打算|计划)?|我想(?:活着|活下去)/i,
  /i(?:amnot|amnolonger)suicidal|(?:i(?:do)?notwantto|idontwantto|iwillnot|idonotplanto|irefuseto)(?:selfharm|suicide|die|killmyself|hurtmyself|endmylife)|iwanttobealive|iwanttolive/i,
);

export const SELF_HARM_SUPPORT_CONTEXTS = patterns(
  /我(?:以前|曾经).{0,8}(?:想自杀|有自杀念头|感到想死)|(?:什么是|如何理解|是什么意思).{0,8}(?:自杀意念|自杀想法)|(?:如何|怎么)帮助.{0,12}(?:想自杀|有自杀念头|自杀的人)|(?:朋友|他|她|有人).{0,12}(?:说|提到).{0,12}(?:想自杀|自杀).{0,16}(?:如何|怎么|帮助)/i,
  /iamnolongersuicidal|iusedtofeelsuicidal|whatdoessuicidalideationmean|howcanihelpsomeonewhoissuicidal|(?:afriend|friend|he|she|someone)(?:said|mentioned).{0,20}(?:suicidal|suicide|wantstodie).{0,20}(?:howcan|howdo|help)/i,
);

const SELF_HARM_REPORTED_CONTEXTS = patterns(
  /(?:朋友|他|她|对方|有人).{0,16}(?:问|说|提到).{0,16}(?:自杀|自残|伤害自己|结束生命).{0,16}(?:我拒绝|我没有同意|我劝阻)/i,
  /(?:afriend|friend|he|she|they)(?:asked|said|mentioned).{0,20}(?:selfharm|suicide|killmyself|hurtmyself|endmylife).{0,20}(?:irefused|ididnotagree|itriedtostop)/i,
);

const SELF_HARM_SAFE_CONTEXTS: SafetyPattern[] = [
  ...SELF_HARM_DENIAL_CONTEXTS,
  ...SELF_HARM_SUPPORT_CONTEXTS,
  ...SELF_HARM_REPORTED_CONTEXTS,
];

const VIOLENCE_SAFE_CONTEXTS = patterns(
  /(?:我)?(?:不想|不会|不打算|没有计划|拒绝|避免)(?:去)?(?:杀|伤害|袭击|殴打|弄死)(?:他|她|对方|别人|他们|任何人)|(?:朋友|他|她|有人).{0,16}(?:说|问|提到).{0,16}(?:帮我|教我|如何|怎么)?.{0,8}(?:杀|伤害|袭击|殴打)(?:他|她|别人|任何人).{0,16}(?:我拒绝|我劝阻|我没有同意)/i,
  /i(?:do)?not(?:want|plan|intend)to(?:kill|hurt|attack|punch)(?:him|her|them|someone|anyone)|iwont(?:kill|hurt|attack|punch)(?:him|her|them|someone|anyone)|irefuseto(?:kill|hurt|attack|punch)(?:him|her|them|someone|anyone)|(?:afriend|friend|he|she|someone)(?:said|asked|mentioned).{0,20}(?:helpme|teachme|howto)?(?:kill|hurt|attack|punch)(?:him|her|them|someone|anyone).{0,20}(?:irefused|itriedtostop|ididnotagree)/i,
);

const HARM_OUTPUT_SAFE_CONTEXTS: SafetyPattern[] = [
  ...SELF_HARM_SAFE_CONTEXTS,
  ...VIOLENCE_SAFE_CONTEXTS,
  ...patterns(
    /(?:不要|不能|不应|不应该|不可|拒绝|避免)(?:去)?(?:死|自杀|自残|伤害自己|伤害他人|杀死自己|杀|袭击|殴打)(?:他|她|对方|别人|他们|任何人)?/i,
    /(?:donot|dont|shouldnot|shouldnt|cannot|cant|youshouldnot)(?:die|selfharm|suicide|killyourself|hurtyourself|hurt|kill|attack|punch)(?:him|her|them|someone|anyone)?/i,
  ),
];

export const VICTIM_SUPPORT_CONTEXTS: SafetyPattern[] = [
  ...patterns(
    /(?:我)?(?:被|遭到|正在被).{0,12}(?:跟踪|监控|监视|定位|操控|勒索|控制).{0,20}(?:求助|帮助|保护|安全|怎么办|摆脱)?/i,
    /iamb(?:e|eing)(?:stalked|tracked|monitored|controlled)|(?:being|ambeing)(?:stalked|tracked|monitored|controlled).{0,24}(?:needhelp|safetyhelp|protection|staysafe)?/i,
  ),
  ...patterns(
    /(?:伴侣|丈夫|妻子|前任|对方|他|她).{0,12}(?:监控|监视|跟踪|定位|控制)(?:我的|我)?.{0,8}(?:手机|位置|行踪)?.{0,16}(?:需要|寻求|想要).{0,6}(?:帮助|求助|保护|安全)/i,
    /(?:mypartner|myspouse|myex|he|she)(?:monitors|tracks|stalks|controls)(?:my)?(?:phone|location|movements)?.{0,20}(?:ineedhelp|needsafetyhelp|needprotection)/i,
  ),
];

const MANIPULATION_SAFE_CONTEXTS: SafetyPattern[] = [
  ...patterns(
    /(?:我)?(?:不想|不会|不要|不打算|没有计划|拒绝|反对|阻止|避免)(?:去|继续)?(?:跟踪|监控|监视|定位|报复|操控|勒索|偷窥|试探|控制)(?:或(?:跟踪|监控|监视|定位|报复|操控|勒索|偷窥|试探|控制))*(?:他|她|对方|前任|别人|任何人)?/i,
    /i(?:do)?not(?:want|need|plan|intend)to(?:stalk|track|monitor|control|manipulate|blackmail|retaliate)(?:my|your|the)?(?:ex|partner|someone|anyone|him|her|them)?|(?:donot|dont|refuseto)(?:stalk|track|monitor|control|manipulate|blackmail|retaliate)(?:someone|anyone|them|him|her|myex|yourex)?/i,
  ),
  ...patterns(
    /(?:朋友|他|她|对方|有人).{0,16}(?:问我|问|说|声称).{0,16}(?:怎么|如何|要|想|应该)?.{0,8}(?:跟踪|监控|监视|定位|报复|操控|勒索|偷窥|控制)(?:他|她|对方|前任|别人|任何人)?.{0,20}(?:我拒绝|我没有同意|我反对)/i,
    /(?:afriend|friend|he|she|they)(?:asked|askedme|said).{0,20}(?:howto|whether|youshould)?(?:stalk|track|monitor|control|manipulate|blackmail|retaliate)(?:someone|anyone|them|him|her|myex|yourex)?.{0,20}(?:irefused|ididnotagree|isaidno)/i,
  ),
  ...VICTIM_SUPPORT_CONTEXTS,
  ...patterns(
    /(?:塔罗|系统|助手|专业人士).{0,12}(?:不能|不会|不应|拒绝)(?:帮助|教|提供)?.{0,10}(?:跟踪|监控|监视|定位|操控|控制)/i,
    /(?:tarot|thesystem|theassistant|aprofessional)(?:cannot|cant|willnot|shouldnot|refusesto)(?:help|teach|provide)?(?:stalk|track|monitor|control|manipulate)/i,
  ),
];

const TREATMENT_SAFE_CONTEXTS = patterns(
  /(?:不要|不能|不应|不应该|不可|不建议|避免|拒绝建议)(?:自行|立即)?(?:停药|停止服药|停止用药|停用药物|停止治疗|停止化疗|停用胰岛素|停止服用抗抑郁药|拒绝治疗)/i,
  /(?:donot|dont|shouldnot|shouldnt|cannot|cant|youshouldnot)(?:(?:stop|quit|discontinue)(?:taking)?(?:your)?(?:medicine|medication|treatment|chemotherapy|insulin|antidepressants?))/i,
);

const DIAGNOSIS_SAFE_CONTEXTS = patterns(
  /(?:塔罗|系统|助手|我).{0,10}(?:不能|无法|不应|不可)(?:直接)?(?:诊断|确诊|确认怀孕)/i,
  /(?:tarot|thesystem|theassistant|i)(?:cannot|cant|shouldnot)(?:diagnose|confirmadiagnosis|confirmpregnancy)/i,
);

const SELF_HARM_EXPLICIT_CORE = patterns(
  /自杀|自残|伤害自己|伤害我自己|结束生命|不想活(?:下去)?|活不下去|不该活(?:下去|着)?/i,
  /自杀|自残|伤害自己|伤害我自己|结束生命|不想活(?:下去)?|活不下去|不该活(?:下去|着)?|selfharm|suicid(?:e|al)|killmyself|hurtmyself|endmylife/i,
);
const SELF_HARM_STATE_CORE = patterns(
  /活着|活下去/i,
  /死(?!他|她|对方|别人|他们|任何人)|dead|die|alive/i,
);
const SELF_HARM_STATE_CUES = patterns(
  /我(?:想|要|希望|需要|计划|准备|打算|感觉|不想继续|不想再)|I\s*(?:want|wish|need|feel|plan|intend)|I\s*(?:do not|don't)\s*want\s*to\s*be/i,
  /我(?:想|要|希望|需要|计划|准备|打算|感觉|不想继续|不想再)|i(?:want|wish|need|feel|plan|intend)(?:to|iwere)?|i(?:donot|dont)wanttobe/i,
);
const SELF_HARM_OUTPUT_CORE: SafetyPattern[] = [
  {
    form: "normalized",
    pattern: /去死|自杀|自残|结束生命|伤害自己|伤害他人|杀死自己|实施暴力|\bdie\b|\bself[ -]?harm\b|\bsuicide\b|\bkill(?:ing)? yourself\b|\bhurt yourself\b|\bend your life\b/i,
  },
  {
    form: "compact",
    pattern: /去死|自杀|自残|结束生命|伤害自己|伤害他人|杀死自己|实施暴力|^(?:die)$|(?:youshould|go)die|selfharm|suicide|killyourself|killingyourself|hurtyourself|endyourlife|hurtsomeone|hurtthem/i,
  },
];

const VIOLENCE_CORE = patterns(
  /(?:杀|杀死|弄死|伤害|袭击|殴打)(?:他|她|对方|别人|他们|任何人)/i,
  /(?:kill|hurt|attack|punch)(?:him|her|them|someone|anyone)|(?:杀|杀死|弄死|伤害|袭击|殴打)(?:他|她|对方|别人|他们|任何人)/i,
);
const IMMEDIATE_VICTIM_DANGER_CORE = patterns(
  /(?:被打|打我|殴打我|伤害我|威胁我|追杀我)|(?:威胁|扬言).{0,8}(?:杀我|伤害我)/i,
  /(?:attacking|hitting|hurting|threatenedtokill|threatenedtohurt)me/i,
);
const IMMEDIATE_DANGER_CUES = patterns(
  /现在|正在|此刻|眼下|马上|持刀|刀就在|无法脱身|生命危险/i,
  /rightnow|currently|atthismoment|outside(?:my)?.{0,8}withaknife|holdingaknife|immediatedanger/i,
);
const ACUTE_DANGER_CORE = patterns(
  /持刀|被困住|无法脱身|生命危险/i,
  /immediatedanger|beingattacked|tryingtokillme|tryingtohurtme/i,
);

const URGENT_MEDICAL_CORE = patterns(
  /急救|急诊|胸痛|大量出血|昏迷|服药过量|喘不上气|呼吸不了|严重气短/i,
  /medicalemergency|overdose|severeshortnessofbreath|cannotbreathe|cantbreathe|喘不上气|呼吸不了|严重气短/i,
);
const BREATHING_CORE = patterns(
  /呼吸|喘气/i,
  /breathe|breathing|shortnessofbreath|呼吸|喘气/i,
);
const BREATHING_DANGER_CUES = patterns(
  /无法|不能|不了|困难|急促|严重|喘不上|我.{0,6}(?:挣扎|难以)|I\s*(?:cannot|can't|can not|am struggling to|am having trouble|have severe)/i,
  /无法|不能|不了|困难|急促|严重|喘不上|我.{0,6}(?:挣扎|难以)|i(?:cannot|cant|cannot|amstrugglingto|amhavingtrouble|havesevere)/i,
);

const MANIPULATION_CORE = patterns(
  /(?:跟踪|监控|监视|报复|操控|勒索|偷窥|试探|控制)(?:他|她|对方|前任|别人|任何人)?|定位(?:他|她|对方|前任)?(?:的)?手机|查(?:他|她|对方|前任)?(?:的)?位置/i,
  /(?:跟踪|监控|监视|报复|操控|勒索|偷窥|试探|控制)(?:他|她|对方|前任|别人|任何人)?|定位(?:他|她|对方|前任)?(?:的)?手机|查(?:他|她|对方|前任)?(?:的)?位置|(?:stalk|track|monitor|spy(?:on)?|control|manipulate|blackmail|retaliate)(?:my|your|the)?(?:ex|partner|someone|anyone|him|her|them|person|people|前任|他|她|对方)/i,
);

const TREATMENT_DISCONTINUATION_CORE = patterns(
  /停药|别吃药|停止(?:服药|用药|治疗|化疗|服用抗抑郁药)|停用(?:药物|胰岛素)|拒绝治疗/i,
  /停药|别吃药|停止(?:服药|用药|治疗|化疗|服用抗抑郁药)|停用(?:药物|胰岛素)|拒绝治疗|(?:stop|quit|discontinue)(?:taking)?(?:your)?(?:medicine|medication|treatment|chemotherapy|insulin|antidepressants?)/i,
);

const DIRECT_DIAGNOSIS_CORE = patterns(
  /(?:你|他|她).{0,6}(?:已经|就是|肯定|确定)?(?:患有|得了|确诊为|怀孕|有(?:癌症|糖尿病|白血病|抑郁症?))/i,
  /(?:你|他|她)(?:已经|就是|肯定|确定)?(?:患有|得了|确诊为|怀孕|有(?:癌症|糖尿病|白血病|抑郁症?))|(?:you|they|he|she)(?:definitely)?(?:have|has)(?:cancer|diabetes|leukemia|depression|adisease|thecondition)|(?:you|they|he|she)(?:are|is)(?:definitely)?pregnant|(?:you|they|he|she)(?:are|is)diagnosedwith/i,
);

export const SAFETY_SEMANTIC_FAMILIES: readonly SafetySemanticFamily[] = [
  {
    id: "self_harm_state",
    inputRules: [
      {
        corePatterns: SELF_HARM_EXPLICIT_CORE,
        dangerCuePatterns: SELF_HARM_STATE_CUES,
        safeContextPatterns: SELF_HARM_SAFE_CONTEXTS,
      },
      {
        corePatterns: SELF_HARM_STATE_CORE,
        dangerCuePatterns: SELF_HARM_STATE_CUES,
        safeContextPatterns: SELF_HARM_SAFE_CONTEXTS,
        requireDangerCue: true,
      },
    ],
    outputRules: [{
      corePatterns: SELF_HARM_OUTPUT_CORE,
      dangerCuePatterns: DIRECTIVE_CUES,
      safeContextPatterns: HARM_OUTPUT_SAFE_CONTEXTS,
      requireDangerCue: true,
      allowBareImperative: true,
    }],
  },
  {
    id: "violence_toward_others",
    inputRules: [
      {
        corePatterns: VIOLENCE_CORE,
        dangerCuePatterns: INTENT_CUES,
        safeContextPatterns: VIOLENCE_SAFE_CONTEXTS,
        requireDangerCue: true,
        allowBareImperative: true,
      },
      {
        corePatterns: VIOLENCE_CORE,
        dangerCuePatterns: DIRECTIVE_CUES,
        safeContextPatterns: VIOLENCE_SAFE_CONTEXTS,
        requireDangerCue: true,
        cuePosition: "either",
      },
      {
        corePatterns: IMMEDIATE_VICTIM_DANGER_CORE,
        dangerCuePatterns: IMMEDIATE_DANGER_CUES,
        requireDangerCue: true,
        cuePosition: "either",
      },
      { corePatterns: ACUTE_DANGER_CORE },
    ],
    outputRules: [{
      corePatterns: VIOLENCE_CORE,
      dangerCuePatterns: INTENT_OR_DIRECTIVE_CUES,
      safeContextPatterns: HARM_OUTPUT_SAFE_CONTEXTS,
      requireDangerCue: true,
      allowBareImperative: true,
    }],
  },
  {
    id: "urgent_medical_danger",
    inputRules: [
      { corePatterns: URGENT_MEDICAL_CORE },
      {
        corePatterns: BREATHING_CORE,
        dangerCuePatterns: BREATHING_DANGER_CUES,
        requireDangerCue: true,
      },
    ],
    outputRules: [],
  },
  {
    id: "stalking_monitoring_control",
    inputRules: [
      {
        corePatterns: MANIPULATION_CORE,
        dangerCuePatterns: INTENT_CUES,
        safeContextPatterns: MANIPULATION_SAFE_CONTEXTS,
        requireDangerCue: true,
        allowBareImperative: true,
      },
      {
        corePatterns: MANIPULATION_CORE,
        dangerCuePatterns: DIRECTIVE_CUES,
        safeContextPatterns: MANIPULATION_SAFE_CONTEXTS,
        requireDangerCue: true,
        cuePosition: "either",
      },
    ],
    outputRules: [{
      corePatterns: MANIPULATION_CORE,
      dangerCuePatterns: INTENT_OR_DIRECTIVE_CUES,
      safeContextPatterns: MANIPULATION_SAFE_CONTEXTS,
      requireDangerCue: true,
      allowBareImperative: true,
    }],
  },
  {
    id: "treatment_discontinuation",
    inputRules: [{
      corePatterns: TREATMENT_DISCONTINUATION_CORE,
      dangerCuePatterns: INTENT_OR_DIRECTIVE_CUES,
      safeContextPatterns: TREATMENT_SAFE_CONTEXTS,
      requireDangerCue: true,
    }],
    outputRules: [{
      corePatterns: TREATMENT_DISCONTINUATION_CORE,
      dangerCuePatterns: DIRECTIVE_CUES,
      safeContextPatterns: TREATMENT_SAFE_CONTEXTS,
      requireDangerCue: true,
      allowBareImperative: true,
    }],
  },
  {
    id: "direct_diagnosis",
    inputRules: [],
    outputRules: [{
      corePatterns: DIRECT_DIAGNOSIS_CORE,
      safeContextPatterns: DIAGNOSIS_SAFE_CONTEXTS,
    }],
  },
] as const;

export function matchesSafetySemanticFamily(
  segment: SafetyTextSegment,
  family: SafetySemanticFamily,
  channel: SafetySemanticChannel,
) {
  const rules = channel === "input" ? family.inputRules : family.outputRules;
  return rules.some((rule) => hasUnsafeSafetyCore(segment, rule));
}

export function findSafetySemanticFamilies(
  segments: readonly SafetyTextSegment[],
  channel: SafetySemanticChannel,
) {
  return SAFETY_SEMANTIC_FAMILIES.filter((family) =>
    segments.some((segment) => matchesSafetySemanticFamily(segment, family, channel))
  );
}
