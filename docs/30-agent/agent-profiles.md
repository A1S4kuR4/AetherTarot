# Agent Profiles

## 1. 目的

MVP 使用一个统一 Tarot Core，通过 Agent Profile 调整咨询深度。Profile 不应只是文风差异，而应影响追问数量、输出深度、现实校验强度与历史写入路径。

---

## 2. MVP Profiles

| Profile | 定位 | 阶段规则 | 追问数量 | 输出重点 |
| --- | --- | --- | --- | --- |
| `lite` | 快速塔罗师 | 弱两阶段，可 initial-as-final | 0-1，MVP 默认 0 | 当前倾向、核心张力、简短建议 |
| `standard` | 标准塔罗师 | 完整两阶段 | 1-2 | 主题判断、情境映射、核心阻碍、行动建议 |
| `sober` | 清醒塔罗师 | 完整两阶段，现实校验更强 | 1-2 | 当前处境、风险提醒、现实边界、可验证行动 |

---

## 3. 共享内核

所有 Profile 共享：

- 问题分类
- canonical spread/card hydration
- intent friction
- provider draft generation
- structured reading assembly
- safety review
- schema validation

Profile 差异不能绕过 safety layer，也不能改变 `StructuredReading` 的公共字段。

---

## 4. MVP 默认值

- 未提交 `agent_profile` 时默认 `standard`。
- `lite` 允许 `follow_up_questions = []` 且 `requires_followup = false`。
- `standard` 与 `sober` 的 initial reading 默认 `requires_followup = true`。
- `sober` 不代表更神秘，而是更克制、更现实校验。