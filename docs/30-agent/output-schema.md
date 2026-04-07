# 输出协议（Output Schema）

## 1. 文档目的

定义 AetherTarot 结果输出的标准结构，确保前端渲染、日志记录、质量评测与回放分析使用同一套字段语义。

---

## 2. 设计原则

- 对用户可读
- 对系统可解析
- 对评测可比较
- 对多语言可扩展
- 对安全检查可拦截

---

## 3. 建议字段

```json
{
  "reading_id": "string",
  "locale": "zh-CN",
  "question": "string",
  "question_type": "relationship | career | self_growth | decision | other",
  "spread": {
    "name": "string",
    "positions": []
  },
  "cards": [
    {
      "name": "string",
      "orientation": "upright | reversed",
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
  "session_capsule": "string | null"
}
```

---

## 4. 字段解释

### `question_type`

用于帮助模型与前端理解问题类别，也可用于评测分桶。

### `cards[].interpretation`

单张牌在当前问题与当前位置下的解释，不应仅复制基础牌义。

### `themes`

从整体牌阵中提炼出的核心主题标签，建议 2-4 个。

### `synthesis`

整体综合段落。必须高于逐牌层级，不能只是逐牌解释的拼接。

### `reflective_guidance`

可执行但不命令式的建议。建议以短句列表形式表达。

### `follow_up_questions`

帮助用户继续反思或进入下一轮的追问问题。

### `safety_note`

当问题涉及敏感边界或需要提醒时出现。

### `confidence_note`

用于表达不确定性与解释范围，不应伪装成绝对结论。

---

## 5. 待补充约束

- [ ] 字段长度限制
- [ ] 多语言兼容字段
- [ ] 富文本 / markdown 策略
- [ ] 面向评测的规范化版本
- [ ] 流式输出拆分协议
