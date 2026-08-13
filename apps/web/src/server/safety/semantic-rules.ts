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
  /我(?:以前|曾经).{0,12}(?:想自杀|有自杀念头|感到想死|想结束生命)|(?:什么是|如何理解|是什么意思).{0,8}(?:自杀意念|自杀想法)|(?:如何|怎么)帮助.{0,12}(?:想自杀|有自杀念头|自杀的人)|(?:朋友|学生|来访者|他|她|有人).{0,16}(?:问|说|提到).{0,16}(?:想自杀|自杀|自杀意念).{0,20}(?:如何|怎么|帮助)?/i,
  /我(?:以前|曾经).{0,12}(?:想自杀|有自杀念头|感到想死|想结束生命)|(?:什么是|如何理解|是什么意思).{0,8}(?:自杀意念|自杀想法)|(?:如何|怎么)帮助.{0,12}(?:想自杀|有自杀念头|自杀的人)|(?:朋友|学生|来访者|他|她|有人).{0,16}(?:问|说|提到).{0,16}(?:想自杀|自杀|自杀意念).{0,20}(?:如何|怎么|帮助)?|iamnolongersuicidal|iusedto(?:feel|thinkabout|consider|wantto)?(?:suicidal|suicide|dying|end(?:ing)?mylife)|isurvivedasuicideattempt.{0,32}(?:safe|recovered)|whatdoessuicidalideationmean|howcanihelpsomeonewhoissuicidal|(?:myfriend|afriend|friend|student|client|he|she|someone)(?:is|was|asked|said|mentioned).{0,24}(?:suicidal|suicide|wantstodie|endtheirlife|suicidalideation)/i,
);

export const SELF_HARM_REPORTED_CONTEXTS = patterns(
  /(?:朋友|学生|来访者|他|她|对方|有人).{0,16}(?:问|说|提到).{0,16}(?:自杀|自残|伤害自己|结束生命|想死)/i,
  /(?:myfriend|afriend|friend|student|client|he|she|they|someone)(?:is|was|asked|said|mentioned).{0,24}(?:selfharm|suicide|suicidal|killmyself|hurtmyself|endmylife|wanttodie)/i,
);

const SELF_HARM_SAFE_CONTEXTS: SafetyPattern[] = [
  ...SELF_HARM_DENIAL_CONTEXTS,
  ...SELF_HARM_SUPPORT_CONTEXTS,
  ...SELF_HARM_REPORTED_CONTEXTS,
];

const VIOLENCE_SAFE_CONTEXTS: SafetyPattern[] = [
  ...patterns(
    /(?:我)?(?:不想|不会|不打算|没有计划|拒绝|避免)(?:去)?(?:杀|伤害|袭击|殴打|弄死|枪击|刺|捅|毒)(?:他|她|对方|别人|他们|任何人)|(?:朋友|他|她|有人).{0,16}(?:说|问|提到).{0,16}(?:帮我|教我|如何|怎么)?.{0,8}(?:杀|伤害|袭击|殴打|枪击|刺|捅|毒)(?:他|她|别人|任何人).{0,16}(?:我拒绝|我劝阻|我没有同意)/i,
    /i(?:do)?not(?:want|plan|intend)to(?:kill|hurt|attack|punch|shoot|stab|beat|poison)(?:him|her|them|someone|anyone)|iwont(?:kill|hurt|attack|punch|shoot|stab|beat|poison)(?:him|her|them|someone|anyone)|irefuseto(?:kill|hurt|attack|punch|shoot|stab|beat|poison)(?:him|her|them|someone|anyone)|(?:afriend|friend|he|she|someone)(?:said|asked|mentioned).{0,20}(?:helpme|teachme|howto)?(?:kill|hurt|attack|punch|shoot|stab|beat|poison)(?:him|her|them|someone|anyone).{0,20}(?:irefused|itriedtostop|ididnotagree)/i,
  ),
  ...patterns(
    /(?:please\s+)?(?:can|could|would|should|may)\s+(?:you|i)\s+(?:please\s+)?not\s+(?:kill|hurt|attack|punch|shoot|stab|beat|poison)\s+(?:(?:my|your|the|our|his|her|their)\s+)?(?:boss|wife|husband|boyfriend|girlfriend|partner|ex|friend|neighbor|colleague|coworker|parent|mother|father|brother|sister|teacher|student|client|doctor|him|her|them|someone|anyone)|please\s+do\s+not\s+(?:kill|hurt|attack|punch|shoot|stab|beat|poison)\s+\S+/i,
    /(?:please)?(?:can|could|would|should|may)(?:you|i)(?:please)?not(?:kill|hurt|attack|punch|shoot|stab|beat|poison)(?:(?:my|your|the|our|his|her|their))?(?:boss|wife|husband|boyfriend|girlfriend|partner|ex|friend|neighbor|colleague|coworker|parent|mother|father|brother|sister|teacher|student|client|doctor|him|her|them|someone|anyone)|pleasedonot(?:kill|hurt|attack|punch|shoot|stab|beat|poison)\p{L}+/iu,
  ),
  ...patterns(
    /\bshoot\s+(?:a|the)\s+(?:film|movie|photo|video)\b|\bbeat\s+(?:a|the)\s+(?:game|level|record)\b|\bKill\s+Bill\b.{0,20}\b(?:movie|film|title)\b/i,
    /shoot(?:a|the)(?:film|movie|photo|video)|beat(?:a|the)(?:game|level|record)|killbill.{0,20}(?:movie|film|title)/i,
  ),
];

const HARM_OUTPUT_SAFE_CONTEXTS: SafetyPattern[] = [
  ...SELF_HARM_SAFE_CONTEXTS,
  ...VIOLENCE_SAFE_CONTEXTS,
  ...patterns(
    /(?:不要|不能|不应|不应该|不可|拒绝|避免)(?:去)?(?:死|自杀|自残|伤害自己|伤害他人|杀死自己|杀|袭击|殴打)(?:他|她|对方|别人|他们|任何人)?/i,
    /(?:donot|dont|shouldnot|shouldnt|cannot|cant|youshouldnot)(?:die|selfharm|suicide|killyourself|hurtyourself|hurt|kill|attack|punch)(?:him|her|them|someone|anyone)?/i,
  ),
  ...patterns(
    /\b(?:suicide|self-harm)\s+prevention\b|\bprevention\s+of\s+(?:suicide|self-harm)\b/i,
    /(?:suicide|selfharm)prevention|preventionof(?:suicide|selfharm)/i,
  ),
];

export const VICTIM_REPORT_CONTEXTS = patterns(
  /(?:我)?(?:被|遭到|正在被).{0,12}(?:跟踪|监控|监视|定位|操控|勒索|控制)|(?:伴侣|丈夫|妻子|前任|对方|他|她).{0,12}(?:监控|监视|跟踪|定位|控制)(?:我的|我)?.{0,8}(?:手机|位置|行踪)?/i,
  /i(?:am)?being(?:stalked|tracked|monitored|controlled)|(?:mypartner|myspouse|myex|he|she)(?:monitors|tracks|stalks|controls)(?:my)?(?:phone|location|movements)?/i,
);

export const SUPPORT_REQUEST_CONTEXTS = patterns(
  /(?:我)?(?:需要|寻求|想要).{0,8}(?:帮助|求助|保护|安全)|(?:求助|怎么办|如何保护自己|如何帮助|怎么帮助|保持安全)/i,
  /i(?:need|want)(?:safety)?help|needsafetyhelp|needprotection|howcanistaysafe|helpmestaysafe|howcan(?:i|we)(?:help|support).{0,20}(?:safe|safety)|howdo(?:i|we)(?:help|support)/i,
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
    /(?:please\s+)?(?:do\s+)?not\s+(?:install|put|place|hide)\s+(?:an?\s+)?(?:airtag|gps\s*tracker|spyware)|(?:how\s+do\s+i|how\s+can\s+i)\s+(?:remove|uninstall|detect)\s+(?:an?\s+)?(?:airtag|gps\s*tracker|spyware)/i,
    /(?:please)?(?:do)?not(?:install|put|place|hide)(?:an?)?(?:airtag|gpstracker|spyware)|how(?:do|can)i(?:remove|uninstall|detect)(?:an?)?(?:airtag|gpstracker|spyware)/i,
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
  ...patterns(
    /(?:please\s+)?(?:can|could|would|should|may)\s+(?:you|i)\s+(?:please\s+)?not\s+(?:secretly\s+)?(?:stalk|track|monitor|spy\s+on|record|locate|control|manipulate|blackmail|check|find)\s+.+/i,
    /(?:please)?(?:can|could|would|should|may)(?:you|i)(?:please)?not(?:secretly)?(?:stalk|track|monitor|spyon|record|locate|control|manipulate|blackmail|check|find)\p{L}+/iu,
  ),
];

const TREATMENT_SAFE_CONTEXTS: SafetyPattern[] = [
  ...patterns(
    /(?:不要|不能|不应|不应该|不可|不建议|避免|拒绝建议)(?:自行|立即)?(?:停|停止|停用|拒绝|跳过|漏服|丢弃|改变|调整)(?:服用|使用)?(?:药|药物|服药|用药|治疗|剂量|化疗|胰岛素|抗抑郁药|抗生素|心脏药)/i,
    /(?:donot|dont|shouldnot|shouldnt|cannot|cant|youshouldnot)(?:(?:stop|quit|discontinue|skip|miss|discard|throwaway|change|adjust)(?:taking)?(?:your)?(?:medicine|medication|treatment|dose|dosage|chemotherapy|insulin|antidepressants?|antibiotics?|heartmedication|bloodpressuremedication|seizuremedication))/i,
  ),
  ...patterns(
    /(?:please\s+)?(?:can|could|would|should|may)\s+(?:you|i)\s+(?:please\s+)?not\s+(?:stop|quit|discontinue|skip|miss|discard|throw\s+away|change|adjust)\s+.+/i,
    /(?:please)?(?:can|could|would|should|may)(?:you|i)(?:please)?not(?:stop|quit|discontinue|skip|miss|discard|throwaway|change|adjust)\p{L}+/iu,
  ),
];

const DIAGNOSIS_SAFE_CONTEXTS = patterns(
  /(?:塔罗|系统|助手|我).{0,10}(?:不能|无法|不应|不可)(?:直接)?(?:诊断|确诊|确认怀孕)|(?:你|他|她)(?:没有|并非|不是)(?:癌症|糖尿病|白血病|抑郁症|怀孕)/i,
  /(?:tarot|thesystem|theassistant|i)(?:cannot|cant|shouldnot)(?:diagnose|confirmadiagnosis|confirmpregnancy)|(?:you|they|he|she)(?:donot|dont|doesnot|isnot|arenot|arent|isnt)(?:have)?(?:cancer|diabetes|leukemia|depression|depressed|bipolardisorder|pregnant)|youhavequestionsabout(?:cancer|diabetes|leukemia|depression|bipolardisorder|pregnancy)/i,
);

const SELF_HARM_EXPLICIT_CORE = patterns(
  /自杀|自残|伤害自己|伤害我自己|结束生命|不想活(?:下去)?|活不下去|不该活(?:下去|着)?/i,
  /自杀|自残|伤害自己|伤害我自己|结束生命|不想活(?:下去)?|活不下去|不该活(?:下去|着)?|selfharm|suicid(?:e|al)|killmyself|hurtmyself|end(?:ing)?mylife|tak(?:e|ing)myownlife/i,
);
const SELF_HARM_STATE_CORE = patterns(
  /活着|活下去/i,
  /死(?!他|她|对方|别人|他们|任何人)|dead|die|alive|liveanymore/i,
);
const SELF_HARM_STATE_CUES = patterns(
  /我(?:想|要|希望|需要|计划|准备|打算|感觉|不想继续|不想再)|I\s*(?:want|wish|need|feel|plan|intend|am\s+thinking\s+about)|I\s*(?:do not|don't)\s*want\s*to(?:\s*be)?/i,
  /我(?:想|要|希望|需要|计划|准备|打算|感觉|不想继续|不想再)|i(?:want|wish|need|feel|plan|intend|amthinkingabout)(?:to|iwere)?|i(?:donot|dont)wantto(?:be)?/i,
);
const SELF_HARM_OUTPUT_CORE: SafetyPattern[] = [
  {
    form: "normalized",
    pattern: /去死|自杀|自残|结束生命|伤害自己|伤害他人|杀死自己|实施暴力|\bdie\b|\bdead\b|\bself[ -]?harm\b|\bsuicide\b|\bkill(?:ing)? yourself\b|\bhurt yourself\b|\bend your life\b/i,
  },
  {
    form: "compact",
    pattern: /去死|自杀|自残|结束生命|伤害自己|伤害他人|杀死自己|实施暴力|^(?:die|dead)$|(?:youshould|go)die|betteroffdead|selfharm|suicide|killyourself|killingyourself|hurtyourself|end(?:ing)?yourlife|tak(?:e|ing)yourownlife|hurtsomeone|hurtthem/i,
  },
];

const SELF_HARM_OUTPUT_DEVALUATION = patterns(
  /nobody\s+would\s+miss\s+you\s+if\s+you\s+died|no\s+one\s+would\s+miss\s+you\s+if\s+you\s+died/i,
  /(?:nobody|noone)wouldmissyouifyoudied/i,
);

const SELF_HARM_OUTPUT_ENCOURAGEMENT_CUES: SafetyPattern[] = [
  ...DIRECTIVE_CUES,
  ...patterns(
    /\b(?:better\s+off|best\s+option|recommend|encourage)\b/i,
    /(?:betteroff|bestoption|recommend|encourage)/i,
  ),
];

const VIOLENCE_ACTIONS = patterns(
  /\b(?:kill|murder|hurt|punch|shoot|stab|beat|poison|attack|strangle|choke)(?:s|ed|ing)?\b|杀死|弄死|伤害|袭击|殴打|枪击|开枪|刺伤|捅伤|毒死|掐死|勒死|(?<!自)杀|打|刺|捅|毒/i,
  /(?:kill|murder|hurt|punch|shoot|stab|beat|poison|attack|strangle|choke)(?:s|ed|ing)?|杀死|弄死|伤害|袭击|殴打|枪击|开枪|刺伤|捅伤|毒死|掐死|勒死|(?<!自)杀|打|刺|捅|毒/i,
);
const INTRINSIC_VIOLENCE_ACTIONS = patterns(
  /\b(?:murder|strangle|choke)(?:s|ed|ing)?\b|杀死|弄死|掐死|勒死/i,
  /(?:murder|strangle|choke)(?:s|ed|ing)?|杀死|弄死|掐死|勒死/i,
);
const OTHER_PERSON_TARGETS: SafetyPattern[] = [
  ...patterns(
    /\b(?:(?:my|your|the|our|his|her|their)\s+)?(?:boss|landlord|wife|husband|boyfriend|girlfriend|partner|ex|friend|neighbor|colleague|coworker|parent|mother|father|brother|sister|teacher|student|client|doctor)\b|\b(?:him|her|them|someone|anyone|another person|people|an unknown person)\b|他|她|对方|别人|他们|任何人|陌生人|房东|老板|老婆|老公/i,
    /(?:(?:my|your|the|our|his|her|their))?(?:boss|landlord|wife|husband|boyfriend|girlfriend|partner|ex|friend|neighbor|colleague|coworker|parent|mother|father|brother|sister|teacher|student|client|doctor)|(?:him|her|them|someone|anyone|anotherperson|people|anunknownperson)|他|她|对方|别人|他们|任何人|陌生人|房东|老板|老婆|老公/i,
  ),
  { form: "normalized", pattern: /\b[A-Z][a-z]{1,24}\b/ },
];
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
const IMMEDIATE_ASSAULT_CORE = patterns(
  /(?:pointing|aiming).{0,12}(?:gun|knife).{0,12}(?:at )?me|(?:strangling|choking|attacking|hitting|beating|stabbing|shooting|holding)(?: at)? me(?: down)?|(?:他|她|有人).{0,8}(?:正在)?(?:掐住?|勒住?)(?:我的)?(?:脖子|颈部)|(?:他|她|有人).{0,8}(?:拿|用|持)(?:着)?(?:枪|刀).{0,8}(?:指着|对准)我/i,
  /(?:pointing|aiming).{0,12}(?:gun|knife).{0,12}(?:at)?me|(?:strangling|choking|attacking|hitting|beating|stabbing|shooting|holding)(?:at)?me(?:down)?|(?:他|她|有人).{0,8}(?:正在)?(?:掐住?|勒住?)(?:我的)?(?:脖子|颈部)|(?:他|她|有人).{0,8}(?:拿|用|持)(?:着)?(?:枪|刀).{0,8}(?:指着|对准)我/i,
);
const IMMEDIATE_THREAT_CORE = patterns(
  /(?:my\s+)?(?:wife|husband|boyfriend|girlfriend|partner|ex|he|she|someone).{0,16}(?:has|holds|is holding).{0,6}(?:a\s+)?(?:gun|knife)|(?:threatening|threatens|threatened).{0,12}(?:me|my life)/i,
  /(?:my)?(?:wife|husband|boyfriend|girlfriend|partner|ex|he|she|someone).{0,16}(?:has|holds|isholding)(?:a)?(?:gun|knife)|(?:threatening|threatens|threatened).{0,12}(?:me|mylife)/i,
);
const IMMEDIATE_RESTRAINT_CORE = patterns(
  /(?:will not|won't|does not|doesn't|refuses? to)\s+let\s+me\s+leave|(?:locked|trapped|restrained|holding)\s+me(?:\s+down)?|blocking\s+(?:my\s+)?(?:exit|way out)|(?:他|她|有人).{0,8}(?:把)?我(?:锁|关|困|按|压)(?:在|进|住|倒)?.{0,10}(?:房间|屋里|里面|地上)?/i,
  /(?:willnot|wont|doesnot|doesnt|refusesto)letmeleave|(?:locked|trapped|restrained|holding)me(?:down)?|blocking(?:my)?(?:exit|wayout)|(?:他|她|有人).{0,8}(?:把)?我(?:锁|关|困|按|压)(?:在|进|住|倒)?.{0,10}(?:房间|屋里|里面|地上)?/i,
);
const WEAPON_CURRENT_ESCAPE_CUES = patterns(
  /\b(?:gun|knife|weapon|right now|currently|is|are|will not|won't|leave|escape|exit|way out)\b|正在|枪|刀|锁|房间|无法离开|不能离开|逃不掉/i,
  /(?:gun|knife|weapon|rightnow|currently|willnot|wont|leave|escape|exit|wayout)|正在|枪|刀|锁|房间|无法离开|不能离开|逃不掉/i,
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
  /(?:stalk|track|monitor|spy(?!ware)|locate|control|manipulate|blackmail|retaliate)(?:s|ed|ing)?|跟踪|监控|监视|定位|操控|勒索|偷窥|控制/i,
);
const SURVEILLANCE_TARGETS = patterns(
  /\b(?:my|your|the|his|her|their)?\s*(?:ex|partner|wife|husband|boyfriend|girlfriend|boss|neighbor|him|her|them|someone|anyone|person|people|unknown\s+person|third\s+party|phone|location|messages?|gps\s*tracker|spyware)\b|\b[A-Z][a-z]{1,24}\b|前任|伴侣|妻子|丈夫|女朋友|男朋友|对方|第三方|别人|任何人|陌生人|他|她|手机|位置|行踪|消息|聊天记录|GPS\s*追踪器|定位器|间谍软件/i,
  /(?:my|your|the|his|her|their)?(?:ex|partner|wife|husband|boyfriend|girlfriend|boss|neighbor|him|her|them|someone|anyone|person|people|unknownperson|thirdparty|phone|location|messages?|gpstracker|spyware)|前任|伴侣|妻子|丈夫|女朋友|男朋友|对方|第三方|别人|任何人|陌生人|他|她|手机|位置|行踪|消息|聊天记录|gps追踪器|定位器|间谍软件/i,
);
const PRIVATE_RECORD_ACTIONS = patterns(
  /\b(?:secretly\s+)?record(?:s|ed|ing)?\b|偷录|偷拍|秘密录音|秘密录像/i,
  /(?:secretly)?record(?:s|ed|ing)?|偷录|偷拍|秘密录音|秘密录像/i,
);
const SURVEILLANCE_INSTALL_ACTIONS = patterns(
  /\binstall(?:s|ed|ing)?\b|安装/i,
  /install(?:s|ed|ing)?|安装/i,
);
const SURVEILLANCE_INSTALL_TARGETS = patterns(
  /\b(?:airtag|gps\s*tracker|spyware)\b|AirTag|GPS\s*追踪器|定位器|间谍软件/i,
  /(?:airtag|gpstracker|spyware)|gps追踪器|定位器|间谍软件/i,
);
const SURVEILLANCE_PLACEMENT_ACTIONS = patterns(
  /\b(?:put|place|hide)(?:s|d|ing)?\b|放置|藏|放/i,
  /(?:put|place|hide)(?:s|d|ing)?|放置|藏|放/i,
);
const PRIVATE_MESSAGE_ACTIONS = patterns(
  /\b(?:read|view)(?:s|ing)?\b|读取|查看|偷看|查阅/i,
  /(?:read|view)(?:s|ing)?|读取|查看|偷看|查阅/i,
);
const PRIVATE_MESSAGE_TARGETS = patterns(
  /\b(?:(?:my|your|the)\s+(?:partner|ex|wife|husband)(?:'s)?\s+|(?:my|your|his|her|their|the)\s+)?(?:private\s+)?messages?\b|(?:老婆|老公|伴侣|前任|对方)?(?:的)?(?:微信|聊天记录|私信|消息)/i,
  /(?:(?:my|your|the)(?:partner|ex|wife|husband)s?|(?:my|your|his|her|their|the))?(?:private)?messages?|(?:老婆|老公|伴侣|前任|对方)?(?:的)?(?:微信|聊天记录|私信|消息)/i,
);
const LOCATION_LOOKUP_ACTIONS = patterns(
  /\b(?:look\s*up|check|find)\b|查询|查找|查/i,
  /(?:lookup|check|find)|查询|查找|查/i,
);
const LOCATION_LOOKUP_TARGETS = patterns(
  /\b(?:(?:(?:my|your|his|her|their|the)\s+)?(?:wife|husband|boyfriend|girlfriend|partner|ex|someone|unknown person)(?:'s)?\s+|[A-Z][a-z]{1,24}(?:'s)?\s+|(?:his|her|their)\s+)?(?:phone|location|whereabouts)\b|手机|位置|行踪/i,
  /(?:(?:(?:my|your|his|her|their|the))?(?:wife|husband|boyfriend|girlfriend|partner|ex|someone|unknownperson)s?|(?:his|her|their))?(?:phone|location|whereabouts)|手机|位置|行踪/i,
);

const TREATMENT_STOP_ACTIONS = patterns(
  /\b(?:stop|quit|discontinue|skip|miss|discard|change|adjust|double|increase|reduce|halve)(?:ping|ped|sed|ted|d|ing)?\b|\bthrow\s+away\b|停止|停用|停服|停掉|停|别吃|拒绝|跳过|漏服|丢弃|扔掉|改变|调整|加倍|增加|减少|减半/i,
  /(?:stop|quit|discontinue|skip|miss|discard|change|adjust|double|increase|reduce|halve)(?:ping|ped|sed|ted|d|ing)?|throwaway|停止|停用|停服|停掉|停|别吃|拒绝|跳过|漏服|丢弃|扔掉|改变|调整|加倍|增加|减少|减半/i,
);
const TREATMENT_ENTITIES = patterns(
  /\b(?:(?:a|one)\s+)?(?:dose|dosage)(?:\s+of\s+(?:seizure|blood\s+pressure|heart)?\s*(?:medicine|medication))?|\b(?:medicine|medication|treatment|insulin|chemotherapy|antidepressants?|antibiotics?|(?:heart|blood\s+pressure|seizure)\s+medication)\b|药物|药|服药|用药|治疗|剂量|胰岛素|化疗|抗抑郁药|抗生素|心脏药|降压药|抗癫痫药/i,
  /(?:(?:a|one))?(?:dose|dosage)(?:of(?:seizure|bloodpressure|heart)?(?:medicine|medication))?|(?:medicine|medication|treatment|insulin|chemotherapy|antidepressants?|antibiotics?|(?:heart|bloodpressure|seizure)medication)|药物|药|服药|用药|治疗|剂量|胰岛素|化疗|抗抑郁药|抗生素|心脏药|降压药|抗癫痫药/i,
);

const DIAGNOSIS_ASSERTIONS = patterns(
  /\b(?:you|they|he|she)\s+(?:(?:definitely|likely|probably|possibly)\s+)?(?:have|has|are|is)\b|(?:你|他|她)(?:已经|肯定|确定|很可能)?(?:有|是|患有|得了|确诊为|怀孕)/i,
  /(?:you|they|he|she)(?:definitely|likely|probably|possibly)?(?:have|has|are|is)|(?:你|他|她)(?:已经|肯定|确定|很可能)?(?:有|是|患有|得了|确诊为|怀孕)/i,
);
const DIAGNOSIS_ENTITIES = patterns(
  /\b(?:pregnant|pregnancy|diabetes|cancer|leukemia|depression|depressed|bipolar\s+disorder|ptsd|hiv|aids|heart\s+attack|a\s+disease|the\s+condition)\b|怀孕|糖尿病|癌症|白血病|抑郁症?|双相情感障碍|创伤后应激障碍|艾滋病|HIV|心脏病发作|心梗/i,
  /(?:pregnant|pregnancy|diabetes|cancer|leukemia|depression|depressed|bipolardisorder|ptsd|hiv|aids|heartattack|adisease|thecondition)|怀孕|糖尿病|癌症|白血病|抑郁症?|双相情感障碍|创伤后应激障碍|艾滋病|hiv|心脏病发作|心梗/i,
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
      dangerCuePatterns: SELF_HARM_OUTPUT_ENCOURAGEMENT_CUES,
      safeContextPatterns: HARM_OUTPUT_SAFE_CONTEXTS,
      requireDangerCue: true,
      allowBareImperative: true,
      cuePosition: "either",
    }, { corePatterns: SELF_HARM_OUTPUT_DEVALUATION }],
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
        targetPlacement: "after",
        bridgePattern: /^(?:(?:at|really|seriously|badly|directly))*$/i,
      },
      {
        actionPatterns: INTRINSIC_VIOLENCE_ACTIONS,
        speechActs: ACTION_SPEECH_ACTS,
        safeContextPatterns: VIOLENCE_SAFE_CONTEXTS,
        requireTarget: false,
        requireSpeechAct: true,
        allowBareDirective: true,
      },
      {
        corePatterns: IMMEDIATE_VICTIM_DANGER_CORE,
        dangerCuePatterns: IMMEDIATE_DANGER_CUES,
        requireDangerCue: true,
        cuePosition: "either",
      },
      {
        corePatterns: IMMEDIATE_ASSAULT_CORE,
        dangerCuePatterns: WEAPON_CURRENT_ESCAPE_CUES,
        requireDangerCue: true,
        cuePosition: "either",
      },
      {
        corePatterns: IMMEDIATE_THREAT_CORE,
        dangerCuePatterns: WEAPON_CURRENT_ESCAPE_CUES,
        requireDangerCue: true,
        cuePosition: "either",
      },
      {
        corePatterns: IMMEDIATE_RESTRAINT_CORE,
        dangerCuePatterns: WEAPON_CURRENT_ESCAPE_CUES,
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
      targetPlacement: "after",
      bridgePattern: /^(?:(?:at|really|seriously|badly|directly))*$/i,
    }, {
      actionPatterns: INTRINSIC_VIOLENCE_ACTIONS,
      speechActs: ACTION_SPEECH_ACTS,
      safeContextPatterns: HARM_OUTPUT_SAFE_CONTEXTS,
      requireTarget: false,
      requireSpeechAct: true,
      allowBareDirective: true,
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
        actionPatterns: SURVEILLANCE_PLACEMENT_ACTIONS,
        targetPatterns: SURVEILLANCE_INSTALL_TARGETS,
        speechActs: ACTION_SPEECH_ACTS,
        safeContextPatterns: MANIPULATION_SAFE_CONTEXTS,
        requireSpeechAct: true,
        allowBareDirective: true,
        targetPlacement: "after",
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
        actionPatterns: PRIVATE_RECORD_ACTIONS,
        targetPatterns: SURVEILLANCE_TARGETS,
        speechActs: ACTION_SPEECH_ACTS,
        safeContextPatterns: MANIPULATION_SAFE_CONTEXTS,
        requireSpeechAct: true,
        allowBareDirective: true,
        bridgePattern: /^(?:(?:secretly|my|your|his|her|their|the))*$/i,
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
        actionPatterns: SURVEILLANCE_PLACEMENT_ACTIONS,
        targetPatterns: SURVEILLANCE_INSTALL_TARGETS,
        speechActs: ACTION_SPEECH_ACTS,
        safeContextPatterns: MANIPULATION_SAFE_CONTEXTS,
        requireSpeechAct: true,
        allowBareDirective: true,
        targetPlacement: "after",
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
        actionPatterns: PRIVATE_RECORD_ACTIONS,
        targetPatterns: SURVEILLANCE_TARGETS,
        speechActs: ACTION_SPEECH_ACTS,
        safeContextPatterns: MANIPULATION_SAFE_CONTEXTS,
        requireSpeechAct: true,
        allowBareDirective: true,
        bridgePattern: /^(?:(?:secretly|my|your|his|her|their|the))*$/i,
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
      bridgePattern: /^(?:(?:taking|using|a|one|dose|of|my|your|the|his|her|their))*$/i,
    }],
    outputRules: [{
      actionPatterns: TREATMENT_STOP_ACTIONS,
      targetPatterns: TREATMENT_ENTITIES,
      speechActs: ACTION_SPEECH_ACTS,
      safeContextPatterns: TREATMENT_SAFE_CONTEXTS,
      requireSpeechAct: true,
      allowBareDirective: true,
      bridgePattern: /^(?:(?:taking|using|a|one|dose|of|my|your|the|his|her|their))*$/i,
    }],
  },
  {
    id: "direct_diagnosis",
    inputRules: [],
    outputRules: [{
      actionPatterns: DIAGNOSIS_ASSERTIONS,
      targetPatterns: DIAGNOSIS_ENTITIES,
      safeContextPatterns: DIAGNOSIS_SAFE_CONTEXTS,
      bridgePattern: /^(?:(?:a|the|definitely|likely|probably|possibly))*$/i,
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
