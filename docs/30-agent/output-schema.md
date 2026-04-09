# 输出协议（Output Schema）

## 1. 文档目的

定义 AetherTarot reading backend 的标准成功输出，确保前端渲染、历史记录、日志记录、质量评测与回放分析使用同一套字段语义。

---

## 2. 当前约束

- `POST /api/reading` 成功时直接返回结构化 reading 对象，不再返回单一 `interpretation: string`
- 首轮默认 `locale = zh-CN`
- `session_capsule` 在本阶段固定为 `null`
- `cards[]` 的顺序必须与牌阵位置顺序一致
- 高风险问题时允许补充 `safety_note`，并收敛 `reflective_guidance` / `follow_up_questions`

---

## 3. 标准字段

```json
{
  "reading_id": "string",
  "locale": "zh-CN",
  "question": "string",
  "question_type": "relationship | career | self_growth | decision | other",
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

## 4. 字段解释

### `question_type`

用于帮助后端和前端理解问题类别，也可作为评测分桶字段。

### `spread`

返回运行时实际使用的权威牌阵快照，避免前端和历史记录依赖客户端自带的临时牌阵对象。

### `cards[].interpretation`

单张牌在当前问题与当前位置下的解释，不应只是基础牌义拼贴。

### `themes`

从整体牌阵中提炼出的主题标签，建议 2-4 个。

### `synthesis`

整体综合段落。必须高于逐牌层级，不能只是逐牌解释的拼接。

### `reflective_guidance`

可执行但不命令式的建议列表。高风险场景下应优先收敛到现实支持与边界澄清。

### `follow_up_questions`

帮助用户继续反思或进入下一轮追问的问题列表。

### `safety_note`

当问题涉及常规安全边界时返回，通常作为后置补充说明。

### `confidence_note`

用于表达不确定性与解释范围，不应伪装成绝对结论。

### `sober_check`

用于重大决策外包场景（Tier 2 安全拦截）。当系统检测到用户存在重度依赖时，写入此字段。前端须通过阻滞型前置交互，要求用户手写反思此引导问题后，方可解锁解读内容。

### `presentation_mode`

呈现模式信标（`standard` | `void_narrative` | `sober_anchor`）。它是正式协议的一部分，将被记录与回放。前端根据该信标调取不同的视觉布局范式，在形式与留白上配合语义张力，绝不仅是虚假的前置 UI Hint。

---

## 5. 设计边界

- 结构化输出是产品协议，不应退化回 markdown-only 返回
- 前端主展示应按字段分块渲染，而不是再把结构化结果重新拼回长 markdown
- 若后续引入 LangGraph，节点输出也应收敛到本协议，而不是创造第二套 reading shape

---

## 6. 待补充

- [ ] 字段长度限制
- [ ] 多语言兼容字段
- [ ] 流式输出拆分协议
- [ ] 面向评测的规范化版本
