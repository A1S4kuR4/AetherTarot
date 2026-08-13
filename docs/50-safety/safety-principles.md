# 安全原则（Safety Principles）

> 2026-08-12 补充：两阶段 Reading 对原始问题和每条用户追问答案独立分类后聚合。输入分类与生成内容验证共用 NFKC、Unicode Cf/零宽与双向控制符清理、异常空格、全角字符及 normalized/compact 两种声明式匹配视图。规则分别返回核心危险行为/状态、危险意图 cue 与安全/引用/受害者 context span；context 只有覆盖同一 core 与 cue 时才豁免，未被覆盖的危险 cue 或另一 core 仍优先。Tier 1 由 Graph 强制边在 decider/tool/provider/capsule/memory 前停止，并安全释放 initial snapshot。服务端生成的问题不是用户意图。

> 同日 RC 收口：高风险检测集中到六个共享 semantic family（自伤/自杀状态、对他人暴力、紧急呼吸/医疗危险、跟踪监控控制、停止治疗、直接诊断），并把 want/need/plan/intend、help/show/teach/tell/steps、should/must/do/stop 及常见中文表达归入可复用 cue。明确否定、reported speech、受害者求助与专业边界只有覆盖同一 family 的 core/cue 才能豁免；同一局部窗口的未覆盖危险 cue 优先。

> RC 残余收口：暴力与操控规则把 intent、directive 和裸祈使作为三种声明式句法形态；directive / immediacy cue 可以位于 core 前后，但普通 intent cue 仍需与后续 core 局部绑定，避免把另一安全目的误绑到已被否定的动作。即时受害者以攻击/威胁 core 配合“现在、right now、持刀”等 cue hard-stop；非即时受害者、明确当前否认保持非危机路径，恢复期、百科教育和帮助他人的自伤相关表达进入带 `safety_note` 的受限支持。

> 独立 RC 审计收口：确定性规则进一步拆成 `speech act × action/core × target/entity × cue placement × context`。`please`、can/could/would/may/should、`is it safe`、`best option` 与中文“请”是可复用 speech act，不属于某个完整句 fixture；暴力、监控、停治与诊断实体独立声明。裸祈使由局部从句语法识别，不再以 core 是否位于字符串起点近似。completed/outgoing 与 incoming capsule 复用同一分类和脱敏 helper，受限支持问题原文不进入 capsule、history capsule 字段或下一轮 continuity。

> 2026-08-13 RC 架构收口：确定性语法继续承担高置信硬边界；外部 moderation/classifier 只能作为第二信号，不能成为唯一边界或降级确定性结果，必经 classifier 的 timeout/error 必须在生成与持久化前 fail closed。游客首发只声明覆盖受测试的简体中文、常见英文与基础中英混合，不声称穷尽自然语言。Capsule 在逐行处理和 280 字截断前先做完整文本 NFKC/Cf/全空白规范化与整体分类，整体危险即整份降为 `null`。

> RC 实现证据进一步覆盖 `murder / strangle` 等内在伤害动作、`shoot / beat` 的人物/安全对象消歧、自伤当前/恢复/助人关系、即时袭击/枪刀/限制离开、停治与剂量变更、HIV/PTSD 等直接诊断断言，以及 AirTag、spyware、私密消息和位置查询。Capsule 另用全文 NFKC + Cf 清除 + 标点/空白不敏感风险视图抵抗跨字符边界插入；这些均是测试覆盖声明，不代表开放自然语言的完整识别能力。

> 共享 classifier 与生成输出 validator 同样使用“正常分句 + 仅升级的全文风险视图”。风险视图覆盖 `。！？；!?;` 对危险 core/action/target 的逐字符边界插入，但不替代正常分句对局部否定的判断。裸汉字“死”不是当前自伤状态；塔罗牌名、地名、作品名与文化讨论只有在另有独立当前自伤意图时才升级。AirTag/GPS 的放置风险要求第三方物品/车辆语境，自有背包等普通用途不因设备名本身 hard-stop。

## 1. 文档目的

规定 AetherTarot 在表达方式、敏感场景与高风险主题上的安全边界，避免把塔罗解读演变成误导性建议或心理操控工具。

---

## 2. 总原则

### 原则一：反思优先，断言克制

系统应帮助用户整理问题、识别模式、看到可能性，而不是给出确定性命运宣判。

### 原则二：陪伴优先，操控禁止

系统可以提供陪伴感和理解感，但不能诱导依赖、服从或对第三方实施操控。

### 原则三：启发优先，替代禁止

系统可辅助思考，但不能替代医疗、法律、财务、心理危机等专业支持。

### 原则四：表达柔和，边界清晰

语言可以温柔、有神秘感，但必须在关键节点明确提示限制与不确定性。

### 原则五：可以有阻力，但不能越界

为避免 reading 过度迎合用户期待，系统可以保留来自牌面、正逆位、位置语义、牌阵张力或现实未验证条件的“建设性阻力”。这种阻力只能帮助用户看见盲点与待核实条件，不能升级为确定性预言、第三方读心、专业替代建议或命令式决策。

### 原则六：分析深度不等于专业资质

“深度塔罗师”是 `sober` profile 的用户可见名称，只表示更强的结构化分析、替代解释和现实验证，不代表医疗、法律、财务、心理咨询或其他专业资质。任何 profile 都共享同一 Tier 1 / Tier 2、安全提示与现实转介结果，不能覆盖或弱化 safety layer。

---

## 3. 当前实现要求 (Unified Safety Policy)

Reading 与 Encyclopedia 共用同一输入分类策略；Reading 再把分类结果映射为现有 graph friction。安全检查必须同时覆盖生成前意图与生成后内容（详见 `ADR 0002`、`ADR 0005`）：

- **Tier 1 (Hard Stop / 危机干预)**：自伤、即时现实危险、紧急健康风险或明确要求跟踪、监控、报复、勒索、操控第三方时，两条 pipeline 都必须在 provider 前返回 `403 safety_intercept`。
- **Tier 2 (Sober Check / 现实摩擦)**：当用户意图涉及将重大现实决策外包（如离婚、辞职、大额投资等），系统保持 `200 OK` 继续生成，但会在提示词层降级其确定感，并在 `StructuredReading` 的 payload 中强制封入 `sober_check` 字段；前端必须通过交互式强制反思（要求手写输入）拦截最终解释内容。
- **Bounded Support / 受限支持**：普通健康、法律、财务、第三方确定性或非即时的暴力/控制受害者求助可以继续，但必须带显式边界说明并收窄内容。受害者求助优先于普通重大决策 gate，不能因为出现“家暴、控制、跟踪”等词就误判为施害者意图。
- **Self-harm reference support / 自伤相关支持**：明确“当前没有自伤打算”的否认不自动附加危机标签；已明确安全的恢复期表达、百科教育和帮助他人的请求进入 bounded support，并提示在安全状态变化时优先寻求现实支持。reported speech 或教育语境只保护其覆盖的同一 core，不能抵消同字段另一条当前危险意图。
- **Ordinary Relationship Conflict / 一般关系冲突**：争吵、冷战、沟通困难和关系张力不自动升级安全等级；只有出现操控意图、现实暴力、即时危险或第三方确定性请求时才进入更高层级。
- **Pre-ritual boundary confirmation / 提交前现实边界确认**：`/new` 的完整仪式与“当下之镜”入口在进入抽牌前都会对明显重大现实决策类提问加入轻量确认动作，要求用户先承认现实信息、专业意见与个人底线优先于塔罗结果。该前台摩擦只用于提前降低决策外包倾向，不能替代 reading graph 的 Tier 1 / Tier 2 服务端判断。
- **Mandatory generated-content validation / 强制生成内容验证**：Reading 的所有用户可见生成字段和 Encyclopedia 的 `answer` 都必须独立扫描，并与输入策略复用同一 normalized/compact 与 core/cue/context span 合同。可收窄的绝对化/专业越界内容按字段替换；伤害鼓励、操控步骤、停药、直接诊断、合理化暴力或责怪受害者时，整份生成正文必须由服务端安全内容替代。安全句只能覆盖其明确修饰的同类别 core 与 cue，不能使同字段的另一条危险指令通过。
- **Deterministic boundary / 确定性边界**：人物、治疗、即时危险和操控目标以有限类别语法组合，不以代词闭集或完整句 fixture 充当规则；benign collocation 与 modal + negation + action + target 的完整安全 scope 是同等重要的误报控制。输出验证比输入意图推断更严格，严重原文不得出现在 response、grounding、capsule、history、thread memory、agent state 或 trace。
- 前端可以将 `safety_note` 视觉降温为 Safety Rose Clay / 暖色提示，但标题、正文和交互位置都不能把它降级为装饰性安慰；其语义仍是现实边界提醒。
- 当前中国大陆固定 hard-stop 资源顺序为：`120`（急性医疗风险） -> `110`（现实危险 / 人身威胁） -> `12356`（立即心理支持）。
- continuity 也受 safety layer 约束：incoming `prior_session_capsule` 在进入 provider 前先整体规范化和分类，整体命中高风险时直接降为 `null`；逐行 label 清理与 280 字截断都在整体判断之后。
- completed capsule 的 outgoing build 使用与 incoming 相同的分类/脱敏 helper；允许继续生成的 `self_harm_support`、`abuse_support` 也只保留安全占位和受控主轴，不复制原始问题。
---

## 4. 禁止性输出方向

禁止输出：

- 生死、疾病、怀孕等确定性判断
- 对第三方真实想法的绝对判断
- 鼓励报复、跟踪、试探、控制、PUA 等行为
- 建议用户停止治疗或拒绝专业帮助
- 对未成年人输出成人化关系操控内容
- 对危机用户仅给神秘安慰而不提示现实支持路径

---

## 5. 升级处理场景

以下情况应触发更强的安全提醒或分流策略：

- 自伤 / 他伤暗示
- 重度绝望表达
- 家暴、胁迫、跟踪等现实风险
- 严重健康焦虑并寻求塔罗替代诊断
- 法律 / 财务高风险决策并要求确定结论

---

## 6. 表达模板方向

建议使用：

- “我不能替你确认某个必然结果，但可以和你一起看这组牌提示了什么模式。”
- “如果这件事已经影响到你的安全或健康，建议尽快寻求现实中的专业支持。”
- “这次解读更适合作为反思线索，而不是唯一依据。”

高风险问题应补充：

- 明确的边界提醒
- 现实支持或专业帮助导向
- 不鼓励对第三方进行控制、验证或报复的替代建议

---

## 7. 安全评测关注点

每次重要更新后，至少检查：

- 是否出现绝对化断言
- 是否出现替代专业建议
- 是否鼓励不当关系行为
- 是否在高风险情境下返回 `safety_note`
- 是否在需要时把 guidance / follow-up 收敛到现实支持与反思导向
- 是否仍然保持用户体验而不过度机械化
- prior capsule 是否被净化，不会把高风险细节重新喂回 provider
- 建设性阻力是否仍然服从上述边界，没有削弱 hard-stop、sober-check 或 `safety_note`
- provider 越界原文是否在 capsule、thread memory、history 与百科回答中完全不可见
- 家暴受害者求助、明确操控意图与一般关系冲突是否被正确区分
- metamorphic/property 回归是否证明全角、Cf、空格/点号拆词、大小写、无关安全句追加和 cue 同义替换都不能降低风险，同时真正否定仍保持安全

---

## 8. 待补充

- [ ] 危机话题的标准响应层级
- [ ] 未成年人保护策略
- [ ] 各地区法律与语言差异注意事项
- [ ] 安全提示与产品 UI 的协同方式

## 9. 分阶段生成的安全执行顺序

分阶段生成不改变任何安全产品规则。Tier 1 hard stop 仍发生在所有生成 stage
之前；所有成功路径仍统一经过生成内容验证与 input-driven safety review。
中间 stage 失败或取消不得生成可持久化 reading、capsule、history、snapshot
success 或 thread memory。Repair 只能修复当前输出合同，不能绕过安全分类。

2026-07-31 的真实 paired A/B 与 probe 中，authority、grounding、正文泄漏和 safety
禁止级 fatal 的观测数均为 0。这个结果说明新路径仍经过既有安全链，但不能抵消 staged
合法率和 Final integration 的回退，也不能单独作为生产启用依据。
