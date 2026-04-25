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
- 前端当前按“问题 / 主题 / 逐牌 / 综合 / 指引 / 延伸 / 安全说明”的顺序消费结果，不应把结构化结果重新折叠为单段长文

---

## 3. Request 字段

```json
{
  "question": "string",
  "spreadId": "string",
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
  "initial_reading": "StructuredReading | undefined",
  "followup_answers": [
    {
      "question": "string",
      "answer": "string"
    }
  ]
}
```

`phase = initial` 时，`initial_reading` 与 `followup_answers` 不需要提交。`phase = final` 时，两者都必须提交，且 `initial_reading` 必须来自同一牌阵、同一抽牌与同一 `agent_profile`。`prior_session_capsule` 为显式 opt-in 的上一轮摘要，只作为低优先级 continuity context。

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

---

## 5. 字段解释

### `agent_profile`

本次 reading 使用的塔罗师 profile。MVP 支持 `lite`、`standard`、`sober`。它影响追问数量、输出深度与现实校验强度，不应只是文风开关。

### `reading_phase`

`initial` 表示第一阶段独立初读；`final` 表示结合用户追问回答后的整合深读。第二阶段必须延续第一阶段主题，不能推翻牌面主轴。

### `requires_followup`

前端流程信标。`standard` 与 `sober` 的 initial reading 默认应为 `true`；`lite` 可为 `false` 并直接作为 completed reading 写入历史。

### `initial_reading_id`

`final` reading 指向其来源 initial reading。`initial` 阶段固定为 `null`。

### `followup_answers`

`final` reading 记录用户针对第一阶段追问提交的现实补充。`initial` 阶段固定为 `null`。

### `prior_session_capsule`

请求侧 continuity hook。它用于把上一轮 completed reading 产出的紧凑摘要带入当前 reading，但优先级低于当前问题、当前牌阵与当前抽牌。它不是 history replay，也不是长期记忆容器。

当前实现补充：

- provider 实际收到的是服务层净化后的 `prior_session_capsule`
- `用户补充` 类原始细节不会被直接转发
- 自伤/他伤、操控、第三方意图猜测、紧急健康等高风险内容若出现在 incoming capsule 中，会被移除；若移除后失去有效信息，则按 `null` 处理

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

当前前台补充：

- `safety_note` 应以显式边界区块展示，不应藏在普通正文里。
- 它的作用是校正理解边界，而不是成为另一个可被忽略的小脚注。

### `confidence_note`

用于表达不确定性与解释范围，不应伪装成绝对结论。

### `session_capsule`

本轮 completed reading 的紧凑摘要。当前保持 `string | null`，只在以下状态产出非空值：

- `lite` 的 completed initial reading
- `standard / sober` 的 completed final reading

`standard / sober` 的 `initial` 阶段固定为 `null`，避免把未完成中间态误当成可复用记忆。

当前模板补充：

- capsule 只保留当前问题、牌阵、核心主题与 1-2 条延续主轴
- capsule 不直带 `followup_answers` 原文，不承载原始 transcript
- capsule 必须避免泄露高风险安全细节、急性情绪细节与未验证的第三方意图

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
- final 阶段由前端带回 initial reading 快照；MVP 不引入服务端会话存储
- `prior_session_capsule` 只表示本地线程级 continuity，不引入 user id、thread id 或服务端 persistence 语义
- 前台展示 `question` 时应以“本次提问”呈现，不应把它高密度复述到 `themes`、`synthesis` 与 `guidance` 中，避免放大迎合错觉
- 前台应保留“牌面较近的层”和“综合推断层”的区分，而不是把所有字段融合成单一论断。当前 reading 页已将逐牌展示显式拆为“牌面线索 / 位置语义 / 综合推断”：牌面线索来自权威抽牌、正逆位与关键词；位置语义来自 `spread.positions[]` / `cards[].position_meaning`；综合推断来自 `cards[].interpretation` 与 `synthesis`
- 前台当前会在 `/reveal` 与 `/reading` 展示“牌阵如何组织随机”的说明。这属于展示层解释：随机决定牌面与正逆位，牌阵决定阅读顺序、位置语义与综合路径；它不新增 response 字段，也不改变 `cards[]` 的权威顺序语义
- 线下塔罗模式下，展示层应把上述说明改为“线下抽取决定牌面与正逆位，牌阵决定阅读顺序、位置语义与综合路径”。这仍不新增 response 字段，也不能暗示实体抽牌带来确定性预言。
- provider 当前需要在 `synthesis` 或 `reflective_guidance` 中保留至少一个建设性阻力观察。该观察仍写入既有字段，不新增 `counterpoint` / `tension` 等协议字段
- `sober_check` 与 `safety_note` 都属于产品协议的一部分，不能降级为可随意忽略的视觉装饰

---

## 7. 待补充

- [ ] 字段长度限制
- [ ] 多语言兼容字段
- [ ] 流式输出拆分协议
- [ ] 面向评测的规范化版本
- [x] 前台“牌面线索 / 位置语义 / 综合推断”显式分层约定
