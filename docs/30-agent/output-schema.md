# 输出协议（Output Schema）

## 1. 文档目的

定义 AetherTarot reading backend 的标准成功输出，确保前端渲染、历史记录、日志记录、质量评测与回放分析使用同一套字段语义。

---

## 2. 当前约束

- `POST /api/reading` 成功时直接返回结构化 reading 对象，不再返回单一 `interpretation: string`
- 首轮默认 `locale = zh-CN`
- MVP 默认 `agent_profile = standard`、`phase = initial`
- `session_capsule` 在本阶段固定为 `null`
- `cards[]` 的顺序必须与牌阵位置顺序一致
- 两阶段 MVP 使用同一 API 入口：`initial` 返回牌面初读，`final` 返回整合深读
- 高风险问题时允许补充 `safety_note`，并收敛 `reflective_guidance` / `follow_up_questions`

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
  "agent_profile": "lite | standard | sober",
  "phase": "initial | final",
  "initial_reading": "StructuredReading | undefined",
  "followup_answers": [
    {
      "question": "string",
      "answer": "string"
    }
  ]
}
```

`phase = initial` 时，`initial_reading` 与 `followup_answers` 不需要提交。`phase = final` 时，两者都必须提交，且 `initial_reading` 必须来自同一牌阵、同一抽牌与同一 `agent_profile`。

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
  "session_capsule": null,
  "sober_check": "string | null",
  "presentation_mode": "standard | void_narrative | sober_anchor"
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

### `question_type`

用于帮助后端和前端理解问题类别，也可作为评测分桶字段。

### `spread`

返回运行时实际使用的权威牌阵快照，避免前端和历史记录依赖客户端自带的临时牌阵对象。

### `cards[].interpretation`

单张牌在当前问题与当前位置下的解释，不应只是基础牌义拼贴。

### `themes`

从整体牌阵中提炼出的主题标签，建议 2-4 个。`final` 阶段应保留 initial 阶段的核心主题。

### `synthesis`

整体综合段落。必须高于逐牌层级，不能只是逐牌解释的拼接。

### `reflective_guidance`

可执行但不命令式的建议列表。高风险场景下应优先收敛到现实支持与边界澄清。

### `follow_up_questions`

在 `initial` 阶段用于进入第二阶段的牌面锚定追问；在 `final` 阶段仅作为延伸反思问题，不再阻塞流程。Lite 允许为空数组。

### `safety_note`

当问题涉及常规安全边界时返回，通常作为后置补充说明。

### `confidence_note`

用于表达不确定性与解释范围，不应伪装成绝对结论。

### `sober_check`

用于重大决策外包场景（Tier 2 安全拦截）。当系统检测到用户存在重度依赖时，写入此字段。前端须通过阻滞型前置交互，要求用户手写反思此引导问题后，方可解锁解读内容。

### `presentation_mode`

呈现模式信标（`standard` | `void_narrative` | `sober_anchor`）。它是正式协议的一部分，将被记录与回放。

---

## 6. 设计边界

- 结构化输出是产品协议，不应退化回 markdown-only 返回
- 前端主展示应按字段分块渲染，而不是再把结构化结果重新拼回长 markdown
- 当前 LangGraph 节点必须收敛到本协议，不创造第二套 reading shape
- final 阶段由前端带回 initial reading 快照；MVP 不引入服务端会话存储

---

## 7. 待补充

- [ ] 字段长度限制
- [ ] 多语言兼容字段
- [ ] 流式输出拆分协议
- [ ] 面向评测的规范化版本