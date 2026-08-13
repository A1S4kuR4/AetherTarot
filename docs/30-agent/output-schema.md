# 输出协议（Output Schema）

## 1. 文档目的

定义 AetherTarot reading backend 的标准成功输出，确保前端渲染、历史记录、日志记录、质量评测与回放分析使用同一套字段语义。

---

## 2. 当前约束

- `POST /api/reading` 成功时直接返回结构化 reading 对象，不再返回单一 `interpretation: string`
- 首轮默认 `locale = zh-CN`
- MVP 默认 `agent_profile = standard`、`phase = initial`
- `session_capsule` 仅在 completed reading 产出；未完成中间态固定为 `null`
- `cards[]` 的顺序必须与牌阵位置顺序一致
- 两阶段 MVP 使用同一 API 入口：`initial` 返回牌面初读，`final` 返回整合深读
- 高风险问题时允许补充 `safety_note`，并收敛 `reflective_guidance` / `follow_up_questions`
- provider 生成内容在组装后必须经过强制安全验证；验证器与输入策略共享 Unicode/空格 normalized/compact 规则，以及 core / danger cue / context span 覆盖合同，可替换越界字段或整份用户可见正文，但必须保持同一 `StructuredReading` shape
- 前端当前按“问题与阶段 metadata → 完整牌阵 → 当下的关键启示 → 逐牌展开 → 综合深读 → 可折叠证据路径 → 带回现实 → 继续理解 → 能量构成 → 反馈与边界 → 留下手记 → 页尾操作”的呈现顺序消费结果，不应把结构化结果重新折叠为单段长文。`/reading` 只为实际可见章节连续生成 Chapter 编号；快速解读复用的综合与指引组件默认不带 Chapter 标记。
- 前端允许从既有字段派生“此刻的核心讯息”首屏摘要，但它不是协议字段：一句核心判断来自 `synthesis` 的安全截取，行动提醒来自 `reflective_guidance`，边界提醒来自 `confidence_note`
- 前端允许展示可折叠的“解读依据”（用户输入、牌面线索、解释连接）来降低迎合错觉；该展示仍必须保留 `cards[]`、`spread` 与 `synthesis` 的结构边界，不能反向要求 provider 输出隐藏推理过程
- 首页「当下之镜」悬浮层的本地即时分析不是协议字段，不调用 `POST /api/reading`，也不写入历史；它只从运行时牌面数据派生短文案
- `/quick-reading` 是 `lite + single + 1 card` 的前端展示变体，不新增成功 response shape；深度解读仍消费同一个 `StructuredReading`

---

## 3. Request 字段

```json
{
  "request_id": "UUID | undefined",
  "question": "string",
  "spreadId": "string",
  "thread_id": "string | undefined",
  "drawnCards": [
    {
      "positionId": "string",
      "cardId": "string",
      "isReversed": true
    }
  ],
  "draw_source": "digital_random | offline_manual",
  "agent_profile": "lite | standard | sober",
  "phase": "initial | final",
  "prior_session_capsule": "string | null",
  "initial_reading_id": "string | undefined",
  "initial_reading": "{ reading_id: string } | undefined (legacy only)",
  "followup_answers": [
    {
      "question": "string",
      "answer": "string"
    }
  ]
}
```

`phase = initial` 时不提交 initial identity 与 `followup_answers`。`phase = final` 时必须提交 `initial_reading_id` 与答案；服务端按 subject claim 并恢复 canonical snapshot。legacy `initial_reading` 仅兼容 `{ reading_id }`，正文被忽略。`prior_session_capsule` 为显式 opt-in 的低优先级 continuity context。`thread_id` 可选；登录用户以 `{ user_id, thread_id }` 作用域读写持久化短期 `SessionMemory`，匿名用户只使用 capsule，不建立持久身份。

Final 的安全分类不会信任 initial 时的旧结论：每次 provider 前分别评估原始 `question` 与每个 `followup_answers[].answer`，按最高风险聚合。否定、引用和受害者语境只有在同类别 context span 覆盖具体 core 与 cue 时才生效；未覆盖 cue 或另一 core 不能被抵消，另一字段也独立聚合。`followup_answers[].question` 只匹配 snapshot，不是用户意图。Tier 1 返回错误 payload 而非 `StructuredReading`，且不经过 decider/tool/provider，不生成 capsule 或写 thread memory。

`question` 通常为非空文本。协议层唯一的空文本例外是 `phase = initial + agent_profile = lite + spreadId = single + 1 drawn card`，response 会原样保留空字符串；它表示用户没有提供问题，不是隐藏上下文。当前 `/new` 快速入口会在用户未填写时显式提供“当下状态”默认问题，因此通常不会触发该兼容例外；其他路径的空文本仍是 `400 invalid_request`。

`request_id` 是前端为一次 reading phase 生成的 UUID 幂等键。相同用户、相同 `request_id` 与相同 payload 的并发、断网或刷新重试必须共享一次 quota 消费、一次 provider 生成和一条 `reading_events` 记录；成功结果可回放到北京时间当日结束。相同 `request_id` 搭配不同 payload 返回 `409 invalid_request`。旧客户端可暂时省略该字段，但不获得重试幂等保证。

当前协议与历史恢复必须严格分层：顶层 request `agent_profile` 可接受 canonical ID、已知历史别名或省略默认值，归一化后进入 graph；未知值返回 `400 invalid_request`。Provider/current `StructuredReading` 只接受 canonical `lite | standard | sober`。Final 的 profile 与其他 authority 字段都由 server snapshot 校验。仅 localStorage、草稿、账号历史 POST/迁移和数据库旧记录可使用历史恢复 parser。

`draw_source` 表示本轮牌面来源，当前支持：

- `digital_random`：前端线上洗牌与随机抽牌
- `offline_manual`：用户线下使用实体牌抽取，前端只录入牌面、正逆位与牌阵位置

该字段不改变 `StructuredReading` response shape，也不提高解读确定性。无论来源如何，服务端都必须按权威 `spread.positions[]` 校验和重排 `drawnCards[]`。

---

## 4. Response 标准字段

```json
{
  "reading_id": "string",
  "locale": "zh-CN",
  "question": "string",
  "question_type": "relationship | career | self_growth | decision | other",
  "agent_profile": "lite | standard | sober",
  "reading_phase": "initial | final",
  "requires_followup": true,
  "initial_reading_id": "string | null",
  "followup_answers": [
    {
      "question": "string",
      "answer": "string"
    }
  ],
  "spread": {
    "id": "string",
    "name": "string",
    "englishName": "string",
    "description": "string",
    "icon": "string",
    "positions": [
      {
        "id": "string",
        "name": "string",
        "description": "string"
      }
    ]
  },
  "cards": [
    {
      "card_id": "string",
      "name": "string",
      "english_name": "string",
      "orientation": "upright | reversed",
      "position_id": "string",
      "position": "string",
      "position_meaning": "string",
      "interpretation": "string"
    }
  ],
  "themes": ["string"],
  "synthesis": "string",
  "reflective_guidance": ["string"],
  "follow_up_questions": ["string"],
  "safety_note": "string | null",
  "confidence_note": "string | null",
  "session_capsule": "string | null",
  "sober_check?": "string | null",
  "presentation_mode?": "standard | void_narrative | sober_anchor"
}
```

错误响应保持统一 envelope：

```json
{
  "error": {
    "code": "invalid_request | unauthorized | forbidden | rate_limited | token_limit_exceeded | cost_limit_exceeded | provider_unavailable | generation_failed | safety_intercept",
    "message": "string",
    "details": "object | undefined",
    "intercept_reason": "string | undefined",
    "referral_links": ["string"]
  }
}
```

第一轮内测新增的访问与额度错误不会改变成功 `StructuredReading` shape。`rate_limited` 用于完整解读日次数或突发防刷，`token_limit_exceeded` 用于全站每日真实 LLM token 上限；二者都必须在外部 provider 请求前返回。一次完整解读由 `initial` 预占一次个人日额度，合法 `final` 不重复扣减日额度但仍计入共享 IP 分钟防刷和全站 Token 预算。Provider、结构化生成或 token 预占在 `initial` 阶段失败时必须退还该次日额度；`final` 没有新的日额度可退，已经实际使用的 LLM token 仍按 token budget 规则结算。`cost_limit_exceeded` 仅保留为历史兼容错误码，新配额流程不再产生该错误。

---

## 5. 字段解释

### `agent_profile`

本次 reading 使用的塔罗师 profile。内部 ID 与用户可见名称为 `lite`（快速塔罗师）、`standard`（日常塔罗师）、`sober`（深度塔罗师）。它影响追问数量、输出深度与现实校验强度，不应只是文风开关。

用户可见正文目标（不含 JSON metadata）为：Lite 单牌 150–250 字、多牌 250–450 字；Standard 单牌 300–500 字、多牌 500–800 字；Sober 单牌 450–700 字、多牌 700–1100 字。Profile 永远不能覆盖牌阵和 safety 的优先级；“深度塔罗师”也不代表任何现实专业资质。

### `reading_phase`

`initial` 表示第一阶段独立初读；`final` 表示结合用户追问回答后的整合深读。第二阶段必须延续第一阶段主题，不能推翻牌面主轴。

### `requires_followup`

前端流程信标。`standard` 与 `sober` 的 initial reading 默认应为 `true`；`lite` 可为 `false` 并直接作为 completed reading 写入历史。

首页「当下之镜」的深度解读使用 `lite`、单牌阵和单张抽牌；用户点击「开启深度解读」后生成的 completed initial reading 仍按本规则写入历史。悬浮层本地即时分析不属于 completed reading。

### `initial_reading_id`

`final` reading 指向其来源 initial reading。`initial` 阶段固定为 `null`。

### `followup_answers`

`final` reading 记录用户针对第一阶段追问提交的现实补充。`initial` 阶段固定为 `null`。

### `prior_session_capsule`

请求侧 continuity hook。它用于把上一轮 completed reading 产出的紧凑摘要带入当前 reading，但优先级低于当前问题、当前牌阵与当前抽牌。它不是 history replay，也不是长期记忆容器。

当前实现补充：

- provider 实际收到的是服务层净化后的 `prior_session_capsule`
- `用户补充` 类原始细节不会被直接转发
- incoming capsule 先整体执行 NFKC、Cf 清除、全空白折叠和分类，再做逐行 label 清理；自伤/他伤、操控、第三方意图猜测、紧急健康等受限内容在整体文本中命中时整份按 `null` 处理，280 字截断只能在整体判断之后发生

### `question_type`

用于帮助后端和前端理解问题类别，也可作为评测分桶字段。

当前前台补充：

- 前端会把它显示为轻量标签，例如“关系议题 / 职业议题 / 行动选择”。
- 它是阅读镜头，不是对用户状态的诊断结论。
- 它不应被前台渲染成压过牌阵与主题的主标题。

### `spread`

返回运行时实际使用的权威牌阵快照，避免前端和历史记录依赖客户端自带的临时牌阵对象。

当前前台补充：

- 前台应保留 `spread.name` 作为阅读容器标识，并在逐牌展示中持续尊重 `positions[]` 语义。
- 不应只把 `spread` 当作 metadata 藏起来，否则容易削弱“牌阵在组织解释”的可感知性。

### `cards[].interpretation`

单张牌在当前问题与当前位置下的解释，不应只是基础牌义拼贴。

它是用户可见正文：允许自然吸收服务端 grounding 的牌义内容，但不得显示知识库标题、chunk、`source_id`、citation 或 Provider 编排术语。来源归因只能进入可选 `grounding` 元数据。

当前前台补充：

- 前台应把单牌解释与 `position` / `position_meaning` 一起展示，避免用户把它误读为脱离牌阵的通用牌义。
- `cards[]` 是离牌面最近的一层证据，不应用更长的综合段把它完全盖掉。

### `themes`

从整体牌阵中提炼出的主题标签，建议 2-4 个。`final` 阶段应保留 initial 阶段的核心主题。

当前前台补充：

- 前台当前会先展示主题，再展开逐牌；这是为了让用户先看“整组牌的共同气候”，而不是直接进入逐牌堆砌。
- `themes` 应保持短、具体、可被用户复核，不应写成装饰性栏目标题。

### `synthesis`

整体综合段落。必须高于逐牌层级，不能只是逐牌解释的拼接。

牌阵轴与 initial/final 阶段规则属于内部生成约束；`synthesis` 只呈现由它们得出的故事、张力与现实观察。单牌不得虚构多位置路径，也不得输出“从同一位置一路带到同一位置”一类模板句。

当前前台补充：

- `synthesis` 是结构化结果里的“综合推断层”，不应在语气上伪装成唯一答案。
- 前端不应只展示 `synthesis` 就结束阅读流程；否则会重新制造“顺着用户问题写一段结论”的迎合错觉。

### `reflective_guidance`

可执行但不命令式的建议列表。高风险场景下应优先收敛到现实支持与边界澄清。

### `follow_up_questions`

在 `initial` 阶段用于进入第二阶段的牌面锚定追问；在 `final` 阶段仅作为延伸反思问题，不再阻塞流程。Lite 允许为空数组。

当前前台补充：

- 当 `reading_phase = initial` 且 `requires_followup = true` 时，前端应把这些问题渲染为进入第二阶段的校准输入，而不是普通附录。
- 当 `reading_phase = final` 时，前端可以把它们作为延伸反思问题展示，但不应再阻塞 completed 状态。

### `safety_note`

当问题涉及常规安全边界时返回，通常作为后置补充说明。

它也用于标记生成内容被服务端限制或替换的结果。生成内容验证覆盖 `cards[].interpretation`、`themes[]`、`synthesis`、`reflective_guidance[]`、`follow_up_questions[]` 与 `confidence_note`；严重输出按整份正文 replace，任何被拦截的 provider 原文都不能进入 response、grounding、`session_capsule`、thread memory、completed history、agent state 或 trace。

当前前台补充：

- `safety_note` 应以显式边界区块展示，不应藏在普通正文里。
- 它的作用是校正理解边界，而不是成为另一个可被忽略的小脚注。

### `confidence_note`

用于表达不确定性与解释范围，不应伪装成绝对结论。

该字段不得承载检索状态、知识库名称、来源 ID 或引用机制；这些信息统一由 `grounding` 和折叠的证据面板展示。

### `session_capsule`

本轮 completed reading 的紧凑摘要。当前保持 `string | null`，只在以下状态产出非空值：

- `lite` 的 completed initial reading
- `standard / sober` 的 completed final reading

`standard / sober` 的 `initial` 阶段固定为 `null`，避免把未完成中间态误当成可复用记忆。

当前模板补充：

- capsule 只保留当前问题、牌阵、核心主题与 1-2 条延续主轴
- capsule 不直带 `followup_answers` 原文，不承载原始 transcript
- capsule 必须避免泄露高风险安全细节、急性情绪细节与未验证的第三方意图
- outgoing build 与 incoming `prior_session_capsule` 复用同一确定性分类/脱敏 helper；`self_harm_support`、`abuse_support` 等允许继续生成的受限类别也不得把原问题逐字写入 capsule
- 游客与账号 completed history 可以保存同一 `StructuredReading.session_capsule` 供回放，但只能保存已净化版本；再次显式 continuity 注入仍会经过同一 helper

P2 边界补充：

- 本阶段不改变字段 shape，仍保持 `string | null`。
- `session_capsule` 不是 thread id、session id、user id、长期画像或服务端 checkpoint。
- `prior_session_capsule` 只能由前端显式 opt-in 带回 request，且服务端必须先净化再注入 provider。
- capsule 的优先级低于当前问题、当前牌阵、当前抽牌与 safety layer。
- 若未来改成结构化 capsule，需要同步更新 shared types、request validation、历史兼容、前端 consumer、contract tests 与本文档。

### `sober_check`

用于重大决策外包场景（Tier 2 安全拦截）。当系统检测到用户存在重度依赖时，写入此字段。前端须通过阻滞型前置交互，要求用户手写反思此引导问题后，方可解锁解读内容。

协议语义：字段为可选字段；当不存在 Tier 2 现实摩擦时可以缺省或为 `null`。当前 graph 会主动写入 `null` 或具体文本，但消费方必须兼容历史记录、测试 fixture 或外部客户端省略该字段。

当前前台补充：

- 当前前台确实把 `sober_check` 作为解读前置摩擦：在用户写下最基本的现实顾虑 / 底线计划之前，不显示 reading 内容主体。
- `sober_check` 不是普通提示文案，而是流程控制字段。

### `presentation_mode`

呈现模式信标（`standard` | `void_narrative` | `sober_anchor`）。它是正式协议的一部分，将被记录与回放。

协议语义：字段为可选字段；缺省时前端应按 `standard` 处理。当前 graph 会主动派生并写入该字段，但共享类型与 schema 仍保留 optional 兼容层。

当前前台补充：

- `presentation_mode` 影响前台阅读节奏与视觉强度，但不改变底层 reading shape。
- `sober_anchor` 当前会配合 `sober_check` 降低阅读的“沉浸式确定感”。

---

## 6. 设计边界

- 结构化输出是产品协议，不应退化回 markdown-only 返回
- 前端主展示应按字段分块渲染，而不是再把结构化结果重新拼回长 markdown
- 当前 LangGraph 节点必须收敛到本协议，不创造第二套 reading shape
- final 阶段只由前端提交 `initial_reading_id` 与答案；服务端按 subject claim 并恢复 canonical initial snapshot，客户端正文不具权威性
- `prior_session_capsule` 只表示显式 opt-in 的 continuity summary，不承载账号级 history replay、thread memory 或 long-term memory 语义；登录用户的持久化 thread 摘要由独立 `{ user_id, thread_id }` 作用域处理
- 前台展示 `question` 时应以“本次提问”呈现，不应把它高密度复述到 `themes`、`synthesis` 与 `guidance` 中，避免放大迎合错觉
- 前台应保留“牌面较近的层”和“综合推断层”的区分，而不是把所有字段融合成单一论断。当前 reading 页已将逐牌展示显式拆为“牌面线索 / 位置语义 / 综合推断”：牌面线索来自权威抽牌、正逆位与关键词；位置语义来自 `spread.positions[]` / `cards[].position_meaning`；综合推断来自 `cards[].interpretation` 与 `synthesis`
- 前台“此刻的核心讯息”是展示层派生摘要，不进入 `StructuredReading`。它可以帮助用户先抓重点，但不能替代后续逐牌证据、牌阵机制、完整综合与安全说明。
- 前台「当下之镜」本地即时分析同样是展示层派生内容：它可以使用牌名、正逆位、关键词、描述和 `symbolism` 给出轻量反馈，但不能替代 `/quick-reading` 或 `/reading` 对 `StructuredReading.cards[]`、`synthesis`、`reflective_guidance` 与边界说明的消费。
- 前台可折叠的“解读依据”应在展开后明确区分“你的问题 / 牌面线索 / 解读逻辑”。第三层只能称为解释推断，不应包装成神谕、确定预言或模型隐藏推理。
- 前台当前会在 `/reveal` 与 `/reading` 展示“牌阵如何组织随机”的说明。这属于展示层解释：随机决定牌面与正逆位，牌阵决定阅读顺序、位置语义与综合路径；它不新增 response 字段，也不改变 `cards[]` 的权威顺序语义
- 线下塔罗模式下，展示层应把上述说明改为“线下抽取决定牌面与正逆位，牌阵决定阅读顺序、位置语义与综合路径”。这仍不新增 response 字段，也不能暗示实体抽牌带来确定性预言。
- provider 当前需要在 `synthesis` 或 `reflective_guidance` 中保留至少一个建设性阻力观察。该观察仍写入既有字段，不新增 `counterpoint` / `tension` 等协议字段
- `sober_check` 与 `safety_note` 都属于产品协议的一部分，不能降级为可随意忽略的视觉装饰
- 生成内容验证器是服务端必经节点，不是由 agent 自主选择的 tool；它必须在 capsule 与 memory 写入之前执行
- Provider draft contract 会先规范用户可见字段中的空白与重复句号，并拒绝阶段说明、来源元数据、内部编排术语及单牌伪路径；不合格正文不得进入后续安全、capsule、memory 或 history
- P2 memory boundary 不新增 `session_id`、`user_id`、`memory_profile` 或 `memory_merge` 字段；账号级 `stored_readings` 只服务 completed reading replay，不进入 `StructuredReading` shape。未来若引入新的身份字段，必须先通过 ADR 或独立协议设计确定读写与删除边界
- P6 例外引入 request-side `thread_id`，但仅作为当前 reading thread 的短期 memory key；它不进入 `StructuredReading` response，不等同于 `session_id` / `user_id`，也不启用长期 memory merge
- P1 为 Final 请求新增 `initial_reading_id`。旧 `initial_reading` 仅兼容读取其中的 `reading_id`，正文会被 schema 丢弃；显式 ID 不一致时返回 `400 invalid_request`。成功响应 `StructuredReading` 不变
- `ReadingHistoryEntry` 增加可选 `threadId`，只用于历史延续与 memory 删除，不进入公开 Reading 成功响应

---

## 7. 待补充

- [ ] 字段长度限制
- [ ] 多语言兼容字段
- [ ] 流式输出拆分协议
- [ ] 面向评测的规范化版本
- [x] 前台“牌面线索 / 位置语义 / 综合推断”显式分层约定

## 8. P2 可选 Grounding 元数据

`StructuredReading` 新增向后兼容的可选 `grounding`：

```ts
type ReadingGrounding = {
  version: 1;
  status: "grounded" | "degraded";
  sources: Array<{
    ref: string;
    kind: "wiki" | "authority_card";
    title: string;
    card_id: string;
    orientation: "upright" | "reversed" | "unknown";
    chunk_id: string;
    source_ids: string[];
  }>;
  claims: Array<{
    path: `cards.${number}.interpretation` | "synthesis";
    source_refs: string[];
  }>;
};
```

旧历史可没有该字段。新 history、initial snapshot 与回放允许原样保存；正文不插入 `[K1]`，分享卡不消费 citation metadata。

Final 请求只提交 `initial_reading_id` 与用户答案。legacy `initial_reading` 只允许提供 `reading_id`，其余正文不可信且不会进入 prompt。

## 9. 内部 staged draft（非公共 schema）

Reading server 内部可以使用 `CardInsightDraft`、`SynthesisDraft`、
`FinalSynthesisDraft` 与 `CompactReadingDraft`。它们不进入
`packages/shared-types`，也不改变 `StructuredReading`。

服务端按 index 从 authority context 补回 cards 元数据，并把合法 evidence refs
映射为现有 `grounding_claims`。当已验证 staged 正文省略 optional refs 时，服务端按
authority card index 与当前正逆位确定性使用该牌允许的检索 refs；synthesis 只继承这些已绑定 refs
的并集。显式未知/跨牌 refs 仍拒绝，检索为空或正文被安全层改写时仍由 citation
finalizer 降级为 authority fallback，不能借此绕过 grounding。Generation stage、attempt、usage、subtype 与
repair payload 永远不是 API envelope 的一部分。

2026-07-31 的真实 paired A/B 与修复后 probe 没有为 shared types 增加任何 staged
字段。评测结果也不授权修改公共 schema：`adaptive_staged` 继续在配置开关后，
`monolithic` 继续为默认。中间失败仍不得产出可保存的 `StructuredReading`。

2026-08-01 的质量修复仍只调整内部 prompt、staged normalizer 与评测输入。服务端会拒绝
一种可确定的退化：多牌 synthesis 大比例逐字复制完整 card insights；该检查比较完整
正文，不使用关键词包含来假装证明语义整合。Final integration work order、评测用 Initial
对照和 conflict 标记都不进入 `StructuredReading`、API envelope、history、capsule 或
thread memory。
