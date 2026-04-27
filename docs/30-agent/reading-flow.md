# 两阶段 Reading Flow

## 1. 目的

本文件定义 MVP 阶段的 reading 状态机。它约束代码结构、API 阶段字段、前端历史写入时机与评测方式。

如果你需要查看当前最小 LangGraph 的真实节点、provider、prompt 与 LLM 接入方式，请继续阅读 `docs/30-agent/langgraph-reading-workflow.md`。

---

## 2. 状态机

1. `draft_input`
   - 用户输入问题、选择 `agent_profile`、选择牌阵并完成抽牌。
   - 若用户从 history / journey 显式选择“延续这条线”，前端可额外挂载 `prior_session_capsule` 作为 continuity source。
   - 前端只保存本地运行态，不写入 history。

2. `quick_input`
   - `/new` 允许用户只输入问题后点击“快速解读”。
   - 快速解读默认使用 `agent_profile = lite` 与 `draw_source = digital_random`。
   - 若用户未选择牌阵，前端默认使用 `single`；若已选择牌阵，则尊重当前牌阵。
   - 前端用同一抽牌 helper 自动生成唯一牌、按牌阵位置排列，并约保留 20% 逆位概率。
   - 快速解读仍必须先通过重大现实决策前置确认；它不能绕过服务端 Tier 1 hard stop、Tier 2 `sober_check` 或 post-generation safety review。
   - 快速解读不新增 reading schema、agent profile、provider contract 或第二套 API。

3. `initial_read`
   - 前端调用 `POST /api/reading`，提交 `phase = initial`。
   - 后端完成问题分类、canonical context、intent friction、provider 初读生成、安全复核与 schema validate。
   - 返回 `reading_phase = initial`。
   - `standard / sober` 的 initial reading 固定 `session_capsule = null`。
   - 若命中 Tier 2 决策外包摩擦，payload 会同时带回 `sober_check` 与 `presentation_mode = sober_anchor`。
   - 快速解读路径会在本状态返回 `lite` initial reading；若 `requires_followup = false`，前端直接把它视为 completed reading。

4. `awaiting_followup`
   - 当 `requires_followup = true` 时，前端展示初读和追问输入区。
   - 追问必须锚定牌面矛盾、牌阵位置或牌与牌之间的张力。
   - 前端仍应先展示主题、逐牌与综合，不应只把 initial reading 隐藏成“先填表再看结果”。
   - 用户回答前，不把 reading 写入 history。

5. `sober_gate`
   - 当 payload 含有 `sober_check` 且用户尚未完成手写反思时，前端必须先展示降温与检视交互。
   - 用户至少写下最基本的现实顾虑或底线计划后，才解锁 reading 内容主体。
   - `sober_gate` 是前台流程状态，不改变后端 `StructuredReading` shape，也不额外写入 history。

6. `final_read`
   - 前端调用同一 API，提交 `phase = final`、`initial_reading` 与 `followup_answers`。
   - 后端验证 final 请求与 initial reading 的 `agent_profile`、牌阵、抽牌一致。
   - Provider 生成整合深读，必须延续初读主题。

7. `completed`
   - `final` 成功后写入 history。
   - Lite 若 `requires_followup = false`，可把 initial reading 直接视为 completed 并写入 history。
   - 只有 completed reading 生成非空 `session_capsule`，并可在下一轮被显式带回为 `prior_session_capsule`。
   - completed reading 当前也允许用户在前台补写 `user_notes`，但这仍属于本地历史附属信息，不进入 reading contract。

8. `hard_stop`
   - Tier 1 风险在 provider 生成前返回 `403 safety_intercept`。
   - 不返回 `StructuredReading`，不写入 history。

---

## 3. 不变规则

- `runReadingGraph()` 仍是 reading backend 唯一编排入口。
- Route 只做 request parse、schema validation 与 HTTP error mapping。
- Safety friction 必须在 provider 前执行；post-generation safety review 必须独立执行。
- 快速解读只是前台路径缩短，不改变 `/api/reading` contract、safety layer、provider draft contract 或 completed history 规则。
- `prior_session_capsule` 只作为低优先级 continuity context，不得覆盖当前问题、当前牌阵与当前抽牌。
- `session_capsule` 不再固定为 `null`；它只在 completed reading 产出，未完成中间态保持 `null`。
- 第二阶段不得推翻第一阶段主轴，只能校正、收束、深化。
- 前台应保留“主题 / 逐牌 / 综合 / 指引 / 延伸”的分层消费，不应把结构化结果重新折叠成单段顺滑长文。
- `question_type` 与 `spread` 是阅读镜头和容器，不是压过牌面的新主结论。
- `sober_check` 若存在，必须先完成前台摩擦，再进入 reading 内容主体。
- history 只保存 completed reading；history replay 与 continuity source 是两个动作，不应混为一谈。
