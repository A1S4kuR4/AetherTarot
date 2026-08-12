import {
  hasUnsafeSafetyComposition,
  hasUnsafeSafetyCore,
  type SafetyCompositionRule,
  type SafetyCoreRule,
  type SafetyPattern,
  type SafetySpeechActRule,
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
  inputRules: readonly SafetySemanticRule[];
  outputRules: readonly SafetySemanticRule[];
};

type SafetySemanticRule = SafetyCoreRule | SafetyCompositionRule;

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

const MODAL_AND_POLITE_CUES = patterns(
  /\b(?:please|can|could|would|may|should)\s+(?:(?:you|i)\s+)?|\bis\s+(?:it|this)\s+safe(?:\s+to)?|\bbest\s+option\b|请(?:你|帮我)?|能否|可不可以|是否(?:可以|应该|安全)/i,
  /please|(?:can|could|would|may|should)(?:you|i)?|is(?:it|this)safe(?:to)?|bestoption|请(?:你|帮我)?|能否|可不可以|是否(?:可以|应该|安全)/i,
);

const ACTION_SPEECH_ACTS: readonly SafetySpeechActRule[] = [
  { patterns: INTENT_CUES, placement: "before", maxDistance: 56 },
  {
    patterns: DIRECTIVE_CUES,
    placement: "either",
    maxDistance: 56,
    trailingOnlyWhenAfter: true,
  },
  {
    patterns: MODAL_AND_POLITE_CUES,
    placement: "either",
    maxDistance: 64,
    trailingOnlyWhenAfter: true,
  },
];

const SELF_HARM_DENIAL_CONTEXTS = patterns(
  /(?:我)?(?:不想|不会|不打算|没有|拒绝|避免)(?:去)?(?:自杀|自残|伤害自己|伤害我自己|结束生命)(?:的)?(?:打算|计划)?|我想(?:活着|活下去)/i,
  /i(?:amnot|amnolonger)suicidal|(?:i(?:do)?notwantto|idontwantto|iwillnot|idonotplanto|irefuseto)(?:selfharm|suicide|die|killmyself|hurtmyself|endmylife)|iwanttobealive|iwanttolive/i,
);

export const SELF_HARM_SUPPORT_CONTEXTS = patterns(
  /我(?:以前|曾经).{0,8}(?:想自杀|有自杀念头|感到想死)|(?:什么是|如何理解|是什么意思).{0,8}(?:自杀意念|自杀想法)|(?:如何|怎么)帮助.{0,12}(?:想自杀|有自杀念头|自杀的人)|(?:朋友|他|她|有人).{0,12}(?:说|提到).{0,12}(?:想自杀|自杀).{0,16}(?:如何|怎么|帮助)/i,
  /我(?:以前|曾经).{0,8}(?:想自杀|有自杀念头|感到想死)|(?:什么是|如何理解|是什么意思).{0,8}(?:自杀意念|自杀想法)|(?:如何|怎么)帮助.{0,12}(?:想自杀|有自杀念头|自杀的人)|(?:朋友|他|她|有人).{0,12}(?:说|提到).{0,12}(?:想自杀|自杀).{0,16}(?:如何|怎么|帮助)|iamnolongersuicidal|iusedtofeelsuicidal|whatdoessuicidalideationmean|howcanihelpsomeonewhoissuicidal|(?:afriend|friend|he|she|someone)(?:said|mentioned).{0,20}(?:suicidal|suicide|wantstodie).{0,20}(?:howcan|howdo|help)/i,
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
  /(?:我)?(?:不想|不会|不打算|没有计划|拒绝|避免)(?:去)?(?:杀|伤害|袭击|殴打|弄死|枪击|刺|捅|毒)(?:他|她|对方|别人|他们|任何人)|(?:朋友|他|她|有人).{0,16}(?:说|问|提到).{0,16}(?:帮我|教我|如何|怎么)?.{0,8}(?:杀|伤害|袭击|殴打|枪击|刺|捅|毒)(?:他|她|别人|任何人).{0,16}(?:我拒绝|我劝阻|我没有同意)/i,
  /i(?:do)?not(?:want|plan|intend)to(?:kill|hurt|attack|punch|shoot|stab|beat|poison)(?:him|her|them|someone|anyone)|iwont(?:kill|hurt|attack|punch|shoot|stab|beat|poison)(?:him|her|them|someone|anyone)|irefuseto(?:kill|hurt|attack|punch|shoot|stab|beat|poison)(?:him|her|them|someone|anyone)|(?:afriend|friend|he|she|someone)(?:said|asked|mentioned).{0,20}(?:helpme|teachme|howto)?(?:kill|hurt|attack|punch|shoot|stab|beat|poison)(?:him|her|them|someone|anyone).{0,20}(?:irefused|itriedtostop|ididnotagree)/i,
);

const HARM_OUTPUT_SAFE_CONTEXTS: SafetyPattern[] = [
  ...SELF_HARM_SAFE_CONTEXTS,
  ...VIOLENCE_SAFE_CONTEXTS,
  ...patterns(
    /(?:不要|不能|不应|不应该|不可|拒绝|避免)(?:去)?(?:死|自杀|自残|伤害自己|伤害他人|杀死自己|杀|袭击|殴打)(?:他|她|对方|别人|他们|任何人)?/i,
    /(?:donot|dont|shouldnot|shouldnt|cannot|cant|youshouldnot)(?:die|selfharm|suicide|killyourself|hurtyourself|hurt|kill|attack|punch)(?:him|her|them|someone|anyone)?/i,
  ),
];

export const VICTIM_REPORT_CONTEXTS = patterns(
  /(?:我)?(?:被|遭到|正在被).{0,12}(?:跟踪|监控|监视|定位|操控|勒索|控制)|(?:伴侣|丈夫|妻子|前任|对方|他|她).{0,12}(?:监控|监视|跟踪|定位|控制)(?:我的|我)?.{0,8}(?:手机|位置|行踪)?/i,
  /i(?:am)?being(?:stalked|tracked|monitored|controlled)|(?:mypartner|myspouse|myex|he|she)(?:monitors|tracks|stalks|controls)(?:my)?(?:phone|location|movements)?/i,
);

export const SUPPORT_REQUEST_CONTEXTS = patterns(
  /(?:我)?(?:需要|寻求|想要).{0,8}(?:帮助|求助|保护|安全)|(?:求助|怎么办|如何保护自己|保持安全)/i,
  /i(?:need|want)(?:safety)?help|needsafetyhelp|needprotection|howcanistaysafe|helpmestaysafe/i,
);

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
  /(?:不要|不能|不应|不应该|不可|不建议|避免|拒绝建议)(?:自行|立即)?(?:停|停止|停用|拒绝)(?:服用|使用)?(?:药|药物|服药|用药|治疗|化疗|胰岛素|抗抑郁药|抗生素|心脏药)/i,
  /(?:donot|dont|shouldnot|shouldnt|cannot|cant|youshouldnot)(?:(?:stop|quit|discontinue)(?:taking)?(?:your)?(?:medicine|medication|treatment|chemotherapy|insulin|antidepressants?|antibiotics?|heartmedication))/i,
);

const DIAGNOSIS_SAFE_CONTEXTS = patterns(
  /(?:塔罗|系统|助手|我).{0,10}(?:不能|无法|不应|不可)(?:直接)?(?:诊断|确诊|确认怀孕)|(?:你|他|她)(?:没有|并非|不是)(?:癌症|糖尿病|白血病|抑郁症|怀孕)/i,
  /(?:tarot|thesystem|theassistant|i)(?:cannot|cant|shouldnot)(?:diagnose|confirmadiagnosis|confirmpregnancy)|(?:you|they|he|she)(?:donot|dont|doesnot|isnot|arent|isnt)(?:have)?(?:cancer|diabetes|leukemia|depression|depressed|pregnant)/i,
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

const VIOLENCE_ACTIONS = patterns(
  /\b(?:kill|hurt|punch|shoot|stab|beat|poison|attack)(?:s|ed|ing)?\b|杀死|弄死|伤害|袭击|殴打|枪击|开枪|刺伤|捅伤|毒死|(?<!自)杀|打|刺|捅|毒/i,
  /(?:kill|hurt|punch|shoot|stab|beat|poison|attack)(?:s|ed|ing)?|杀死|弄死|伤害|袭击|殴打|枪击|开枪|刺伤|捅伤|毒死|(?<!自)杀|打|刺|捅|毒/i,
);
const OTHER_PERSON_TARGETS = patterns(
  /\b(?:him|her|them|someone|anyone|another person|people)\b|他|她|对方|别人|他们|任何人/i,
  /(?:him|her|them|someone|anyone|anotherperson|people)|他|她|对方|别人|他们|任何人/i,
);
const IMMEDIATE_VICTIM_DANGER_CORE = patterns(
  /(?:被打|被殴打|被枪击|被刺|打我|殴打我|伤害我|威胁我|持刀威胁|持枪威胁|追杀我)|(?:威胁|扬言).{0,12}(?:杀我|伤害我|枪击我|刺我)/i,
  /(?:(?:attacking|hitting|hurting|beating|shooting|stabbing)(?:at)?me|threatenedto(?:kill|hurt|shoot|stab)me|being(?:attacked|hit|beaten|shot|stabbed))/i,
);
const IMMEDIATE_DANGER_CUES = patterns(
  /现在|正在|此刻|眼下|马上|持刀|持枪|枪|刀|无法脱身|无法离开|逃不掉|生命危险/i,
  /rightnow|currently|atthismoment|witha(?:knife|gun)|holdinga(?:knife|gun)|hasagun|cannotgetaway|cantgetaway|cannotescape|immediatedanger/i,
);
const ACUTE_DANGER_CORE = patterns(
  /持刀|被困住|无法脱身|生命危险/i,
  /immediatedanger|beingattacked|tryingtokillme|tryingtohurtme/i,
);

const URGENT_MEDICAL_CORE = patterns(
  /急救|急诊|心脏病发作|心梗|窒息|噎住|胸痛|大量出血|昏迷|服药过量|喘不上气|呼吸不了|严重气短/i,
  /medicalemergency|overdose|heartattack|choking|cannotcatchmybreath|cantcatchmybreath|severeshortnessofbreath|cannotbreathe|cantbreathe|喘不上气|呼吸不了|严重气短/i,
);
const BREATHING_CORE = patterns(
  /呼吸|喘气/i,
  /breathe|breathing|shortnessofbreath|呼吸|喘气/i,
);
const BREATHING_DANGER_CUES = patterns(
  /无法|不能|不了|困难|急促|严重|喘不上|我.{0,6}(?:挣扎|难以)|I\s*(?:cannot|can't|can not|am struggling to|am having trouble|have severe)/i,
  /无法|不能|不了|困难|急促|严重|喘不上|我.{0,6}(?:挣扎|难以)|i(?:cannot|cant|cannot|amstrugglingto|amhavingtrouble|havesevere)/i,
);

const MANIPULATION_ACTIONS = patterns(
  /\b(?:stalk|track|monitor|spy|locate|control|manipulate|blackmail|retaliate)(?:s|ed|ing)?\b|跟踪|监控|监视|定位|操控|勒索|偷窥|控制/i,
  /(?:stalk|track|monitor|spy|locate|control|manipulate|blackmail|retaliate)(?:s|ed|ing)?|跟踪|监控|监视|定位|操控|勒索|偷窥|控制/i,
);
const SURVEILLANCE_TARGETS = patterns(
  /\b(?:my|your|the|his|her|their)?\s*(?:ex|partner|him|her|them|someone|anyone|person|people|third\s+party|phone|location|messages?|gps\s*tracker|spyware)\b|前任|伴侣|对方|第三方|别人|任何人|他|她|手机|位置|行踪|消息|聊天记录|GPS\s*追踪器|定位器|间谍软件/i,
  /(?:my|your|the|his|her|their)?(?:ex|partner|him|her|them|someone|anyone|person|people|thirdparty|phone|location|messages?|gpstracker|spyware)|前任|伴侣|对方|第三方|别人|任何人|他|她|手机|位置|行踪|消息|聊天记录|gps追踪器|定位器|间谍软件/i,
);
const SURVEILLANCE_INSTALL_ACTIONS = patterns(
  /\binstall(?:s|ed|ing)?\b|安装/i,
  /install(?:s|ed|ing)?|安装/i,
);
const SURVEILLANCE_INSTALL_TARGETS = patterns(
  /\b(?:gps\s*tracker|spyware)\b|GPS\s*追踪器|定位器|间谍软件/i,
  /(?:gpstracker|spyware)|gps追踪器|定位器|间谍软件/i,
);
const PRIVATE_MESSAGE_ACTIONS = patterns(
  /\b(?:read|view)(?:s|ing)?\b|读取|查看|偷看|查阅/i,
  /(?:read|view)(?:s|ing)?|读取|查看|偷看|查阅/i,
);
const PRIVATE_MESSAGE_TARGETS = patterns(
  /\b(?:(?:my|your|the)\s+(?:partner|ex)(?:'s)?\s+|(?:my|your|his|her|their|the)\s+)?(?:private\s+)?messages?\b|聊天记录|私信|消息/i,
  /(?:(?:my|your|the)(?:partner|ex)s?|(?:my|your|his|her|their|the))?(?:private)?messages?|聊天记录|私信|消息/i,
);
const LOCATION_LOOKUP_ACTIONS = patterns(
  /\blook\s*up\b|查询|查找|查/i,
  /lookup|查询|查找|查/i,
);
const LOCATION_LOOKUP_TARGETS = patterns(
  /\b(?:phone|location|whereabouts)\b|手机|位置|行踪/i,
  /(?:phone|location|whereabouts)|手机|位置|行踪/i,
);

const TREATMENT_STOP_ACTIONS = patterns(
  /\b(?:stop|quit|discontinue)(?:ping|ted|d)?\b|停止|停用|停服|停掉|停|别吃|拒绝/i,
  /(?:stop|quit|discontinue)(?:ping|ted|d)?|停止|停用|停服|停掉|停|别吃|拒绝/i,
);
const TREATMENT_ENTITIES = patterns(
  /\b(?:medicine|medication|treatment|insulin|chemotherapy|antidepressants?|antibiotics?|heart\s+medication)\b|药物|药|服药|用药|治疗|胰岛素|化疗|抗抑郁药|抗生素|心脏药(?:物)?/i,
  /(?:medicine|medication|treatment|insulin|chemotherapy|antidepressants?|antibiotics?|heartmedication)|药物|药|服药|用药|治疗|胰岛素|化疗|抗抑郁药|抗生素|心脏药(?:物)?/i,
);

const DIAGNOSIS_ASSERTIONS = patterns(
  /\b(?:you|they|he|she)\s+(?:definitely\s+)?(?:have|has|are|is)\b|(?:你|他|她)(?:已经|肯定|确定)?(?:有|是|患有|得了|确诊为|怀孕)/i,
  /(?:you|they|he|she)(?:definitely)?(?:have|has|are|is)|(?:你|他|她)(?:已经|肯定|确定)?(?:有|是|患有|得了|确诊为|怀孕)/i,
);
const DIAGNOSIS_ENTITIES = patterns(
  /\b(?:pregnant|pregnancy|diabetes|cancer|leukemia|depression|depressed|heart\s+attack|a\s+disease|the\s+condition)\b|怀孕|糖尿病|癌症|白血病|抑郁症?|心脏病发作|心梗/i,
  /(?:pregnant|pregnancy|diabetes|cancer|leukemia|depression|depressed|heartattack|adisease|thecondition)|怀孕|糖尿病|癌症|白血病|抑郁症?|心脏病发作|心梗/i,
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
        actionPatterns: VIOLENCE_ACTIONS,
        targetPatterns: OTHER_PERSON_TARGETS,
        speechActs: ACTION_SPEECH_ACTS,
        safeContextPatterns: VIOLENCE_SAFE_CONTEXTS,
        requireSpeechAct: true,
        allowBareDirective: true,
        bridgePattern: /^(?:(?:at|really|seriously|badly|directly))*$/i,
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
      actionPatterns: VIOLENCE_ACTIONS,
      targetPatterns: OTHER_PERSON_TARGETS,
      speechActs: ACTION_SPEECH_ACTS,
      safeContextPatterns: HARM_OUTPUT_SAFE_CONTEXTS,
      requireSpeechAct: true,
      allowBareDirective: true,
      bridgePattern: /^(?:(?:at|really|seriously|badly|directly))*$/i,
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
        actionPatterns: MANIPULATION_ACTIONS,
        targetPatterns: SURVEILLANCE_TARGETS,
        speechActs: ACTION_SPEECH_ACTS,
        safeContextPatterns: MANIPULATION_SAFE_CONTEXTS,
        requireSpeechAct: true,
        allowBareDirective: true,
        bridgePattern: /^(?:on|at|down)?$/i,
      },
      {
        actionPatterns: SURVEILLANCE_INSTALL_ACTIONS,
        targetPatterns: SURVEILLANCE_INSTALL_TARGETS,
        speechActs: ACTION_SPEECH_ACTS,
        safeContextPatterns: MANIPULATION_SAFE_CONTEXTS,
        requireSpeechAct: true,
        allowBareDirective: true,
        bridgePattern: /^(?:a|an|the)?$/i,
      },
      {
        actionPatterns: PRIVATE_MESSAGE_ACTIONS,
        targetPatterns: PRIVATE_MESSAGE_TARGETS,
        speechActs: ACTION_SPEECH_ACTS,
        safeContextPatterns: MANIPULATION_SAFE_CONTEXTS,
        requireSpeechAct: true,
        allowBareDirective: true,
        bridgePattern: /^(?:the|private)?$/i,
      },
      {
        actionPatterns: LOCATION_LOOKUP_ACTIONS,
        targetPatterns: LOCATION_LOOKUP_TARGETS,
        speechActs: ACTION_SPEECH_ACTS,
        safeContextPatterns: MANIPULATION_SAFE_CONTEXTS,
        requireSpeechAct: true,
        allowBareDirective: true,
        bridgePattern: /^(?:(?:my|your|his|her|their|the|他|她|对方|前任|的))*$/i,
      },
    ],
    outputRules: [
      {
        actionPatterns: MANIPULATION_ACTIONS,
        targetPatterns: SURVEILLANCE_TARGETS,
        speechActs: ACTION_SPEECH_ACTS,
        safeContextPatterns: MANIPULATION_SAFE_CONTEXTS,
        requireSpeechAct: true,
        allowBareDirective: true,
        bridgePattern: /^(?:on|at|down)?$/i,
      },
      {
        actionPatterns: SURVEILLANCE_INSTALL_ACTIONS,
        targetPatterns: SURVEILLANCE_INSTALL_TARGETS,
        speechActs: ACTION_SPEECH_ACTS,
        safeContextPatterns: MANIPULATION_SAFE_CONTEXTS,
        requireSpeechAct: true,
        allowBareDirective: true,
        bridgePattern: /^(?:a|an|the)?$/i,
      },
      {
        actionPatterns: PRIVATE_MESSAGE_ACTIONS,
        targetPatterns: PRIVATE_MESSAGE_TARGETS,
        speechActs: ACTION_SPEECH_ACTS,
        safeContextPatterns: MANIPULATION_SAFE_CONTEXTS,
        requireSpeechAct: true,
        allowBareDirective: true,
        bridgePattern: /^(?:the|private)?$/i,
      },
      {
        actionPatterns: LOCATION_LOOKUP_ACTIONS,
        targetPatterns: LOCATION_LOOKUP_TARGETS,
        speechActs: ACTION_SPEECH_ACTS,
        safeContextPatterns: MANIPULATION_SAFE_CONTEXTS,
        requireSpeechAct: true,
        allowBareDirective: true,
        bridgePattern: /^(?:(?:my|your|his|her|their|the|他|她|对方|前任|的))*$/i,
      },
    ],
  },
  {
    id: "treatment_discontinuation",
    inputRules: [{
      actionPatterns: TREATMENT_STOP_ACTIONS,
      targetPatterns: TREATMENT_ENTITIES,
      speechActs: ACTION_SPEECH_ACTS,
      safeContextPatterns: TREATMENT_SAFE_CONTEXTS,
      requireSpeechAct: true,
      allowBareDirective: true,
      bridgePattern: /^(?:(?:taking|using|my|your|the|his|her|their))*$/i,
    }],
    outputRules: [{
      actionPatterns: TREATMENT_STOP_ACTIONS,
      targetPatterns: TREATMENT_ENTITIES,
      speechActs: ACTION_SPEECH_ACTS,
      safeContextPatterns: TREATMENT_SAFE_CONTEXTS,
      requireSpeechAct: true,
      allowBareDirective: true,
      bridgePattern: /^(?:(?:taking|using|my|your|the|his|her|their))*$/i,
    }],
  },
  {
    id: "direct_diagnosis",
    inputRules: [],
    outputRules: [{
      actionPatterns: DIAGNOSIS_ASSERTIONS,
      targetPatterns: DIAGNOSIS_ENTITIES,
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
  return rules.some((rule) => "actionPatterns" in rule
    ? hasUnsafeSafetyComposition(segment, rule)
    : hasUnsafeSafetyCore(segment, rule));
}

export function findSafetySemanticFamilies(
  segments: readonly SafetyTextSegment[],
  channel: SafetySemanticChannel,
) {
  return SAFETY_SEMANTIC_FAMILIES.filter((family) =>
    segments.some((segment) => matchesSafetySemanticFamily(segment, family, channel))
  );
}
