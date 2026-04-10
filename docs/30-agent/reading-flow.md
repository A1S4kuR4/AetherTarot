# 两阶段 Reading Flow

## 1. 目的

本文件定义 MVP 阶段的 reading 状态机。它约束代码结构、API 阶段字段、前端历史写入时机与评测方式。

---

## 2. 状态机

1. `draft_input`
   - 用户输入问题、选择 `agent_profile`、选择牌阵并完成抽牌。
   - 前端只保存本地运行态，不写入 history。

2. `initial_read`
   - 前端调用 `POST /api/reading`，提交 `phase = initial`。
   - 后端完成问题分类、canonical context、intent friction、provider 初读生成、安全复核与 schema validate。
   - 返回 `reading_phase = initial`。

3. `awaiting_followup`
   - 当 `requires_followup = true` 时，前端展示初读和追问输入区。
   - 追问必须锚定牌面矛盾、牌阵位置或牌与牌之间的张力。
   - 用户回答前，不把 reading 写入 history。

4. `final_read`
   - 前端调用同一 API，提交 `phase = final`、`initial_reading` 与 `followup_answers`。
   - 后端验证 final 请求与 initial reading 的 `agent_profile`、牌阵、抽牌一致。
   - Provider 生成整合深读，必须延续初读主题。

5. `completed`
   - `final` 成功后写入 history。
   - Lite 若 `requires_followup = false`，可把 initial reading 直接视为 completed 并写入 history。

6. `hard_stop`
   - Tier 1 风险在 provider 生成前返回 `403 safety_intercept`。
   - 不返回 `StructuredReading`，不写入 history。

---

## 3. 不变规则

- `runReadingGraph()` 仍是 reading backend 唯一编排入口。
- Route 只做 request parse、schema validation 与 HTTP error mapping。
- Safety friction 必须在 provider 前执行；post-generation safety review 必须独立执行。
- `session_capsule` 保留为显式扩展点，MVP 固定为 `null`。
- 第二阶段不得推翻第一阶段主轴，只能校正、收束、深化。