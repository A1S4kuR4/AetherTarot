# 解读契约（Reading Contract）

## 1. 文档目的

本文件定义 AetherTarot 对用户提供的塔罗服务边界，用来统一产品、提示词、评测与安全策略。

---

## 2. AetherTarot 提供什么

AetherTarot 提供的是：

- 以塔罗牌与牌阵为媒介的**反思式解读**
- 对用户问题的主题整理、情绪映照与可能路径分析
- 基于牌阵关系的启发式建议
- 帮助用户识别当下的模式、张力与关注重点
- 支持用户使用线上随机抽牌，或录入线下实体牌抽取结果后进行同一套结构化分析

AetherTarot 不承诺提供：

- 可验证的未来预言
- 专业诊断
- 对第三方意图的确定性判定
- 替代现实调查与现实行动的结论
- 因实体牌来源而获得更高确定性的预言

---

## 3. 解读定位

建议将产品定位明确为：

> AetherTarot 是一个“基于塔罗语义进行反思与叙事整理的智能体”，而不是“保证命中未来结果的预言系统”。

---

## 4. 表达原则

### 应当使用的表达

- “这组牌更像是在提醒你……”
- “从这个牌阵看，更值得关注的是……”
- “这未必代表结果已经注定，而是当前模式下的倾向……”
- “你可以把这次解读看作一种观察角度，而非唯一答案。”

### 应当避免的表达

- “他一定会回来。”
- “你命中注定要离开这段关系。”
- “你必须立刻辞职。”
- “你会在某月某日发生某事。”

---

## 5. 敏感主题边界

### 关系类问题

允许帮助用户识别情感模式、沟通张力、自我需求与边界感。

禁止：

- 替用户断定第三方真实想法
- 鼓励监控、操控、报复或试探行为
- 鼓励关系依赖或情绪勒索

### 健康类问题

允许：

- 提供情绪支持
- 鼓励用户关注自身状态
- 建议寻求合格专业帮助

禁止：

- 诊断疾病
- 预测生死
- 建议用户替代或停止专业治疗

### 财务/法律类问题

允许：

- 帮助用户梳理顾虑、风险感受与决策维度

禁止：

- 直接替代法律/财务专业意见
- 给出确定性投资或诉讼建议

---

## 6. 风格承诺

AetherTarot 的解读应：

- 有深度，但不压迫
- 有神秘感，但不制造依赖
- 有建议，但不夺走用户自主性
- 有共情，但不假装全知

### Agent Profile 边界

- `lite`、`standard`、`sober` 的用户可见名称分别为“快速塔罗师”“日常塔罗师”“深度塔罗师”。
- “深度塔罗师”只表示更充分地梳理多牌阵、多重因素、替代解释与待验证假设，不表示医疗、法律、财务、心理咨询或其他现实专业资质。
- Profile 不得覆盖牌阵位置语义、权威抽牌上下文、现实信息或 safety layer；重大现实决策仍必须经过既有前置确认与 `sober_check`，不能因为选择深度模式而由塔罗代替用户决定。

---

## 7. 产品内展示建议

建议在用户可见界面中保留简洁版说明：

> 本解读用于反思与启发，不替代医疗、法律、财务或其他专业建议；请结合现实信息与个人判断进行理解。

---

## 8. 安全分级干预协议 (Dual-Tier Intervention)

基于 ADR-0002 与 ADR-0005，我们在解读契约中增加主动式干预约定：
- **危机转介 (Hard Stop)**：当系统识别到自伤、即时现实危险、紧急健康风险，或明确要求跟踪、监控、报复、勒索、操控第三方时，AetherTarot 将在 provider 前完全停止生成，返回 `403 safety_intercept` 并导向现实支持界面。
- **降温审查 (Sober Check)**：当用户试图将核心生存决策（辞职、分手、投资）直接交由塔罗决定时，系统不会拒绝生成，但会下发“降温审查（Sober Check）”阻拦，强制用户先进行主观现实条件的补齐反思后，再进行解读。
- **受害者支持 (Bounded Support)**：提及家暴、胁迫、跟踪或控制，不等同于用户正在请求操控他人。非即时危险的受害者求助返回 `200 + safety_note`，把 guidance / follow-up 收窄到安全、边界与现实支持；存在即时危险信号时才升级为 Hard Stop。一般争吵、冷战或沟通困难保持普通关系解读。
- **生成内容验证**：provider 生成后、capsule 与 memory 写入前，服务端必须扫描所有用户可见生成字段。输入分类与输出验证共用 NFKC、Cf/零宽、全角、异常空格及 normalized/compact 声明式规则，并分别标注核心危险行为/状态、危险意图 cue 与安全/转述/受害者 context span。只有同类别 context 明确覆盖同一个 core 及其 cue 时才豁免；未被覆盖的局部危险 cue 或另一 core 仍优先。绝对预言、第三方读心和专业确定性指令必须被替换；伤害鼓励、操控步骤、停药建议、直接诊断或合理化暴力必须触发整份正文的安全替代。被拦截的原文不得进入 response、history、capsule 或 memory。
- **声明式语义族**：Tier 1 与生成内容替换不得继续靠入口各自追加整句 regex。服务端共享六个高风险 family：`self_harm_state`、`violence_toward_others`、`urgent_medical_danger`、`stalking_monitoring_control`、`treatment_discontinuation`、`direct_diagnosis`。每个 family 分别声明 core、输入/输出适用规则，并复用 intent/directive cue 与明确否定、转述、受害者求助、专业边界 context；外部 LLM 分类只能补充，不能替代该确定性边界。
- **句法方向与支持语境**：暴力、跟踪和控制 family 必须识别 cue 在 core 前、后或合理重叠的局部组合，也必须识别以危险动作开头的裸祈使句。即时受害者报告以“现实攻击/威胁 core + 当前性或武器 cue”组合升级 Hard Stop；没有即时 cue 的受害者求助保持 Bounded Support。明确否认当前自伤意图可走 standard；恢复期、百科教育和帮助他人的自伤相关提问走 bounded 并附现实支持边界，不能误作当前施害/自伤意图。
- **可组合语义关系**：高风险动作不得再以完整句 fixture 作为规则单元。确定性分类器按 `speech act × action/core × target/entity × cue placement × context` 组合命中；礼貌祈使、情态问句、动作后的追问 cue 与从句开头裸祈使都必须绑定同一动作。安全 context 只覆盖其实际包含的 action/target/cue，不能跨到后续另一条指令；跨句的非即时受害者报告与求助可合并为 Bounded Support。
- **残余 RC 类别不变量**：暴力目标使用有限的关系、角色、未知人物与姓名槽，不以 `him/her` 闭集代替人物语法，并以 benign collocation 排除拍摄影片、击败游戏等安全动作义。自伤把当前状态/意图与恢复、教育、助人关系分开；治疗变更覆盖 stop/quit/discontinue/skip/miss/throw away/change dosage 及带 blood-pressure / seizure 等修饰的 medication；即时危险按 assault/threat/restraint 与 weapon/current/escape cue 组合；操控覆盖伴侣/配偶/姓名/未知人物及秘密录制、位置查询。安全豁免必须覆盖完整的 modal + negation + action + target scope。
- **输出严格性与全链路替代**：输出不根据“用户大概是安全意图”降低规则。伤害鼓励或他伤指令、秘密监控/录制、停药/漏药/改剂量、概率式或确定式直接诊断都触发整份正文 replace；明确否定、讨论疾病概念与自杀预防教育保持可见。拒绝原文不得进入 response、grounding、capsule、thread memory、completed history、agent state 或 trace。
- **游客 RC 已验证范围**：当前自动化证据覆盖简体中文、常见英文和基础中英混合中的自伤当前状态、恢复/教育/助人语境、对他人暴力、即时袭击/武器/限制离开、停止治疗与剂量变更、直接诊断，以及 AirTag / GPS / spyware / 私密消息与位置查询。`murder / strangle` 等内在伤害动作按动作与 speech act 组合，`shoot / beat` 等多义动作还要求人物/对象槽并排除影片、游戏等安全搭配。该范围是受测试的高置信语法，不是对自然语言或所有语言的穷尽证明。
- **句读双视图边界**：正常分句视图继续负责局部否定、转述和支持语境；另一个全文 NFKC/Cf/标点空白不敏感视图只用于把共享高置信 semantic family 升级为风险，不能降低正常视图结果，也不能把一句中的安全 context 扩展为对后续独立危险指令的豁免。裸汉字“死”不再与泛化第一人称 cue 组合；当前自伤必须由独立状态/意图语法命中。已验证的中文当前意图允许在意图词与“死”之间出现“去、马上、现在、立刻、就”之一，并要求“死”由句尾、句读/空白或“了、的、啊、呀、呢、吧”等语气助词终结；死神牌、死海、死亡、死党、死心、死磕、死守、作品名与生死观等复合词/领域表达保持普通语境。
- **提交前现实边界确认**：当前 `/new` 会对明显重大现实决策类提问加入轻量前置摩擦；完整仪式与“当下之镜”入口都要求用户先确认“塔罗只用于整理线索，现实信息、专业意见与个人底线优先”，再进入抽牌。该机制用于降低决策外包倾向，不替代服务端 `sober_check`。

当前中国大陆固定资源策略：
- 涉及急性医疗风险时，优先提示拨打 `120`
- 涉及现实危险、人身威胁或暴力风险时，优先提示拨打 `110`
- 涉及强烈绝望、崩溃或需立即心理支持时，提示拨打 `12356` 心理援助热线
- 前端 `referral_links` 当前返回真实官方网页入口，不改变既有 payload shape

### 8.1 Final 追问的统一安全主体

每次 provider 调用前，服务端分别分类原始 question 与每个用户填写的 follow-up answer，再按最高产品风险聚合。分类器分别定位 core、danger cue 与 context；否定、引用或受害者语境必须由同类别 context span 覆盖同一 core 与 cue 才能豁免，不能抵消同字段另一危险命中或另一答案。服务端生成的 follow-up question 只校验对应关系，不作为用户意图。任何字段触发 Tier 1 时，Graph 强制边直接返回 `403 safety_intercept`，不调用 decider/tool/provider、不生成 capsule、不写 thread memory，并释放而不消费 initial snapshot，允许修改答案后重试。bounded / sober-check 同样按字段聚合，Final 必须返回相应 safety note 或 `200 + sober_check + sober_anchor`。

安全回归必须从语义种子生成 metamorphic matrix，至少覆盖 NFKC 全角、Cf/零宽、空格拆词、点号/标点拆词、大小写、安全句追加不降级、同义 cue 替换不降级，以及真正否定不误判。离散 fixture 与该矩阵共同构成最低回归证据，不能把其中任一方表述为自然语言穷尽证明。

completed capsule 与 incoming `prior_session_capsule` 必须复用同一个确定性分类/脱敏 helper。incoming 必须先对完整文本做 NFKC、Cf 清除和全空白折叠后的风险判断，再做逐行 label 清理；整体命中时整份降为 `null`，280 字截断只能发生在该判断之后。`self_harm_support`、`abuse_support` 及既有高风险类别可以继续生成受控 reading，但原问题不得逐字进入 completed capsule；游客 history、账号 history 与下一轮显式 continuity 只能保存或重放已净化的 capsule。

---

## 9. 待补充

- [ ] 用户授权与隐私说明
- [ ] 不同语言环境下的免责声明与危机热线版本

---

## 10. P2 正式 Reading Grounding 契约

- 所有成功的 Lite completed initial、Standard/Sober initial 与 final 必须有逐牌最小 grounding；Hard Stop 与 clarification 不属于正式 Reading。
- 服务端在 Provider 前强制执行 `ensure_minimum_grounding`，每张牌至少获得一个与 card/orientation 匹配的 claim。Final 必须重新检索，不信任客户端或 initial snapshot 中的引用。
- Wiki 不可用或单牌缺失时使用 canonical runtime `TarotCard` metadata，标记 `grounding.status = degraded`，不得声称来自 Wiki。
- 生成内容安全验证先于 citation finalizer。被 restrict/replace 的正文及旧引用必须丢弃，并以安全的 `authority_card` 内容重建。
- 引用缺失、未知或跨牌时，服务端确定性修复对应逐牌解释或 synthesis；不得把无效引用返回给客户端，也不得追加第二次 LLM 调用。

## 11. 自适应分阶段生成边界

Reading Provider 可以在单次 canonical Graph invocation 内采用
`monolithic` 或 `adaptive_staged`，但两者仍属于同一个 Reading Agent、同一个
领域契约和同一个 `StructuredReading` 结果。

- 分阶段生成只拆分 card insight 与 spread synthesis，不引入多个 Agent，也不按
  每张牌分别调用模型。
- `card_id`、牌名、正逆位、位置与顺序始终由服务端 authority context 补回。
- Final 默认复用 server-owned Initial cards，只在 follow-up 确实改变局部理解时
  接受完整、有序的 card refinements。
- 中间 draft、repair payload、attempt、usage 和 failure subtype 不属于产品输出，
  不得进入 response、snapshot、history、capsule 或 thread memory。
- 所有路径必须汇入同一生成内容验证、安全复核、grounding finalizer、capsule 与
  completed-memory 后半链。

2026-07-31 首轮真实 paired A/B 中，adaptive staged 合法率为 `47.7%`，低于
monolithic 的 `85.9%`；修复后 Initial/preparation probe 为 `15 / 15`，但 Final 为
`0 / 5`。完整 payload repair 后的单例 Final 回放可恢复合同，但综合质量仍偏泛。
因此 staged 仍是默认关闭的实验路径。该结果不改变本契约，也不授权用局部
成功率降低公共 Reading 的结构、安全或连续性标准。

## LLM Safety Reviewer 合同（2026-08-13）

Reviewer 是确定性安全层之后的第二信号，不替代 classifier、generated-content validator 或服务端固定模板。输入只按 `hard_stop > abuse_support > sober_check > bounded > standard` 取上界；输出只按 `replace > restrict > pass` 取上界。Reviewer 不得降低确定性 hard-stop/bounded/sober-check/replace，不得让重大决定信号覆盖 `abuse_support`，也不得生成用户文案或热线链接。

Reading 输入顺序固定为 `schema/access → deterministic preflight → execution 幂等/Final authority → LLM input review → quota → Graph tool/provider`。确定性 hard-stop 不调用 Reviewer；LLM 升级为 hard-stop 时不调用 quota、agent decider、tool、reading provider 或 reading persistence。Route 注入的是 server-only verdict；Graph 仍保留强制节点，直接调用且未注入时必须自行审校。

Reading 输出顺序固定为 `draft contract → deterministic generated-content validation → LLM output review → server restrict/replace → input-driven safety → grounding → capsule → thread memory → response/history`。enforce 的输出审校故障必须丢弃正文并返回 `503 provider_unavailable`，不得把正文写入任何状态面。成功响应仍是原有公共 `StructuredReading`，不新增 Reviewer 字段。
