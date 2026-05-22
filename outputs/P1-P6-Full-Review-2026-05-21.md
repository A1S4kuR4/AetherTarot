# AetherTarot P1~P6 Full Review

**审查日期:** 2026-05-21
**审查者:** Claude (自动化架构审查)
**审查范围:** P1~P6.5 全部源码、测试、文档、ADR
**审查结论:** PASS WITH FINDINGS

---

## 1. 总体结论

**Verdict:** PASS WITH FINDINGS

**一句话判断:** P1~P6.5 每一阶段都真正闭环，跨阶段衔接一致、可追踪、可测试、无已知回归。4 个 MEDIUM 发现需要关注，0 个 Blocking 发现。

**当前最大风险 Top 3:**

1. **`get_session_memory` 跳过 executor 时 audit 缺失** — agent_actions 和 tool_calls 数量不同步会导致 trace 分析混淆（MEDIUM）
2. **Eval `max_step_guard` case 使用真实 retrieval tool** — 测试了"检索成功时 max step 也生效"，但未单独测试 "retrieve + step guard + grounding none" 的组合路径（MEDIUM）
3. **`buildLastAdviceSummary` 硬编码领域规则** — 倒吊人逆位职业场景的固定摘要可能偏离实际 LLM 输出，且标记为 P7 才修复（MEDIUM）

---

## 2. 阶段审校矩阵

| Phase | Goal | Implementation Evidence | Integration Evidence | Verdict | Findings |
|---|---|---|---|---|---|
| **P1** | Controlled Agentic Loop | `graph.ts:724-775` agentDeciderNode, `graph.ts:777-781` routeAgentAction, `graph.ts:1162-1168` addConditionalEdges | `graph.contract.spec.ts:21-109` 解码+检索+final_answer 全链路 | PASS | max_agent_steps 覆盖 retrieve + memory loop |
| **P2** | Tool Registry / Executor / Permission / Audit | `tools/registry.ts` map-based registry, `tools/executor.ts` 6 种错误路径, `tools/types.ts` 4 级权限+3 级风险, `tools/retrieve-tarot-knowledge.ts` 工具定义 | `graph.ts:799-809` retrieveKnowledgeNode 走 executor, `graph.ts:871-883` getSessionMemoryNode 走 executor, `graph.ts:1116-1133` writeSessionMemoryNode 走 executor | PASS | 所有 tool 均通过 registry/executor 执行 |
| **P3** | Knowledge Grounding | `retrieve-tarot-knowledge.ts:63-86` 真实 wiki 检索, `knowledge/loader.ts:42-46` AETHERTAROT_WIKI_ROOT, `knowledge/retrieval.ts:215-255` 元数据+关键词打分 | `graph.ts:269-286` buildKnowledgeGrounding, `graph.ts:1054-1058` applyGroundingNotice, `graph.contract.spec.ts:442-496` grounding none 测试 | PASS | groundingStatus 只为 retrieved/none |
| **P3.5** | Retrieval Hardening | `loader.ts:42-56` wiki 路径解析, `loader.ts:197-200` warn 函数, `knowledge/loader.spec.ts` 单元测试, `knowledge/retrieval.spec.ts` 单元测试 | `loader.ts:307-320` 缓存按 wikiRoot 隔离, `loader.ts:322-324` clear 函数 | PASS | TTL=60s 合理，缓存不污染测试 |
| **P4** | Agent Tracing | `trace.ts:20-29` ReadingRunTrace 完整结构, `trace.ts:97-120` retrieval_sources, `trace.ts:118-135` final_answer_grounding | `graph.contract.spec.ts:585-603` 隐私边界测试, `graph.contract.spec.ts:498-546` clarification/safety_stop trace | PASS | |
| **P4.5** | Trace Hardening | `trace.ts:247-253` observation_count ≠ tool_call_count, `graph.ts:228-242` throwGenericFailureWithDiagnosticTrace | `trace.spec.ts:5-61` 独立计数测试, `graph.contract.spec.ts:548-583` generic failure trace | PASS | 仍有 3 个 LOW 项目延后 |
| **P5** | Eval Replay | `cases.ts:50-182` 7 个 eval case, `assertions.ts:57-167` 确定性断言, `runner.ts:146-181` fixture injection | `runner.ts:155-160` memory seed for two-turn test, `runner.ts:226-235` direct run with exitCode | PASS | 2 LOW + 4 OBS |
| **P6** | Thread-Level Memory | `memory.ts:61-100` in-memory store, `session-memory.ts:39-87` get/write tools | `graph.ts:832-904` getSessionMemoryNode, `graph.ts:1108-1139` writeSessionMemoryNode, `graph.contract.spec.ts:111-213` memory routing + 降级 | PASS | |
| **P6.5** | Memory Hardening | `graph.ts:843-869` 优雅降级, `graph.ts:1130-1131` post-agent step 注释, `graph.contract.spec.ts:255-297` write failure 测试 | `reading-thread-memory.md:152-165` Known Limitation 文档化 | PASS | M1 硬编码规则标记为 P7 |

---

## 3. 跨阶段衔接审校

### P1 → P2: 是否闭环

**结论:** 闭环。

**证据:**
- `agentDeciderNode` (graph.ts:724-775) 产出 `AgentAction` 对象
- `routeAgentAction` (graph.ts:777-781) 将 `action.type` 映射到图节点
- `retrieveKnowledgeNode` (graph.ts:783-830) 调用 `executeReadingTool({ toolName: "retrieve_tarot_knowledge", ...})`，不绕过工具系统
- `agent_decider → retrieve_knowledge → agent_decider` 环路由 `graph.ts:1162-1168` 条件边 + `graph.ts:1169` 回边构成
- action 的 `reason` 字段作为 `decision_reason` 进入 audit entry (graph.ts:808)

**风险:** 无。

**建议:** P1 action type 与 tool name 一致（`retrieve_knowledge` → `retrieve_tarot_knowledge`），但有一个转换点：`getAgentActionInput` (graph.ts:150-164) 负责从 action 构建 tool input。这个转换是稳定的，不会引入破窗。

### P2 → P3: 是否闭环

**结论:** 闭环。

**证据:**
- `createKnowledgeRetrievalInput` (reading-agent-core.ts:213-232) 从 `AgentAction.query` 构建 `RetrieveTarotKnowledgeInput`
- executor 验证 input schema (executor.ts:255-289) — `retrieveTarotKnowledgeInputSchema` 定义在 retrieve-tarot-knowledge.ts:6-11
- retrieve_tarot_knowledge tool 的 run 函数 (retrieve-tarot-knowledge.ts:63-86) 调用 `loadTarotKnowledgeChunks()` → `retrieveTarotKnowledgeChunks()`
- `isRetrieveTarotKnowledgeOutput` (retrieve-tarot-knowledge.ts:36-48) 被 trace.ts 和 graph.ts 共享引用（P4.5 已 fix）
- observation.content 存储 `RetrieveTarotKnowledgeOutput` (graph.ts:820-825)

**风险:** 无。

**建议:** `isRetrieveTarotKnowledgeOutput` 使用 runtime duck-type 检查 (chunks 数组 + groundingStatus 两个值)，与 zod schema 不完全等价。如果未来在 `RetrieveTarotKnowledgeOutput` 增加新字段，zod 解析仍会通过（已知字段），但 `isRetrieveTarotKnowledgeOutput` 的鸭子检查仍然返回 true。这不是当前问题，但在 `RetrieveTarotKnowledgeOutput` 增加 breaking 字段时需要注意。

### P3 → P4: 是否闭环

**结论:** 闭环。

**证据:**
- `buildRetrievalSources` (trace.ts:102-116) 读取 `state.observations`，用 `isRetrieveTarotKnowledgeOutput` 过滤，用 `usedSourceIds` 标记 `used_by_final_answer`
- `buildFinalAnswerGrounding` (trace.ts:118-135) 读取同一 observations，构建 `grounding_status` / `used_source_ids` / `retrieved_chunk_count`
- `buildKnowledgeGrounding` (graph.ts:269-286) 在 generateDraftNode 中使用，决定传给 provider 的 grounding 数据
- 两者都使用 `isRetrieveTarotKnowledgeOutput`，口径一致
- retrieval tool output schema 与 trace 结构字段对齐：`chunks[].source_id` / `chunks[].title` / `chunks[].score` / `chunks[].confidence` 与 `RetrievalSourceTrace` 字段一致

**风险:** `buildKnowledgeGrounding` 和 `buildFinalAnswerGrounding` 是两个独立函数，分别解析 observations。`buildKnowledgeGrounding` 过滤 `groundingStatus === "retrieved"`，`buildFinalAnswerGrounding` 同样过滤。数据一致。

**建议:** 无。

### P4 → P5: 是否闭环

**结论:** 闭环。

**证据:**
- `runReadingEvalCase` (runner.ts:146-181) 调用 `runReadingGraphWithDiagnostics`，从返回值解构 `{ reading, agentState, trace }`
- `assertReadingEvalCase` (assertions.ts:57-167) 使用 `result.trace` 做所有断言：action_path、tool_calls、grounding_status、retrieval_source_count、agent_step_count
- assertions 不调用 LLM，不做额外推理，纯确定性检查
- `summarizeEvalResult` (assertions.ts:170-180) 从 trace 直接映射到 report 字段
- P4 trace 字段 `agent_steps[].action_type`、`tool_calls[].tool_name`、`final_answer_grounding.grounding_status` 等被 eval 直接消费

**风险:** 如果 trace 字段重命名（如 `agent_steps` → `agent_actions`），eval assertions 会自动断裂。当前 trace 和 eval 属于同一模块、同一 review 范围，风险可控。

**建议:** 增加一个 eval 专用类型映射层，解耦 trace 内部字段名与 eval 断言字段名。当前优先级低。

### P5 → P6: 是否闭环

**结论:** 闭环。

**证据:**
- `thread_memory_followup` eval case (cases.ts:74-93) 使用 `actions: get_session_memory → final_answer`，`required_phrases: ["倒吊人逆位", "先识别卡点"]`
- `runReadingEvalCase` (runner.ts:155-160) 当 fixture=thread_memory_followup 时，先 seed memory 再运行主 case
- eval case 的 `expected.should_get_memory: true` 在 assertions.ts:97-105 验证 agent_actions 和 tool_calls 都包含 memory
- graph.contract.spec.ts:299-338 覆盖两轮连续对话的集成测试

**风险:** `required_phrases: ["倒吊人逆位", "先识别卡点"]` 依赖 placeholder provider 将 sessionMemory 内容注入输出。如果 placeholder 被替换或 prompting 包变更，此断言可能断裂。合约测试已独立验证此路径。

**建议:** 在 eval 中区分 "structural assertion"（action_path, tool_calls）和 "content assertion"（required_phrases）。content assertion 的脆弱性高于 structural assertion。

### P6 → P6.5: 是否闭环

**结论:** 闭环。

**证据:**
- P6 review 的 4 个 MEDIUM finding 全部实现：
  - M3: `getSessionMemoryNode` 优雅降级 → `graph.ts:843-869`
  - M4: `write_session_memory` 失败合约测试 → `graph.contract.spec.ts:255-297`
  - M2: Post-agent step 注释 → `graph.ts:1130-1131`
  - M1: Known Limitation 文档化 → `reading-thread-memory.md:161-165`
- P6.5 review (p6.5-thread-memory-hardening-review.md) 确认全部通过

**风险:** 无。

**建议:** 无。

---

## 4. 发现列表

### Blocking
_（无阻断级发现）_

### Medium

#### M1 — `get_session_memory` 跳过 executor 时缺失 tool_calls audit

- **文件与行号:** `graph.ts:843-869`
- **问题说明:** 当 `threadId` 缺失时，`getSessionMemoryNode` 不调用 `executeReadingTool`，生成一个手动构造的 skipped observation 后直接 return。这导致该 action 的 audit entry 不出现在 `tool_calls[]` 中。agent_actions 有 2 条（`get_session_memory` + `final_answer`），但 tool_calls 只有 1 条（如果后续 write 成功则是 `write_session_memory`）。这意味着 action_path 和 tool_calls 的步数不会 1:1 对应。
- **影响:** trace 分析时无法从 tool_calls 推断 agent 是否有 memory read 尝试。eval 的 `hasMemoryToolCall()` 可能返回 false 即使 agent 尝试了 memory read。但这正是 P6.5 的设计意图——通过 agent_actions 和 observations 而非 tool_calls 来判断 memory 降级。
- **建议修复方式:** 保持当前行为，但在 `summarizeActionOutput` 的 `get_session_memory` 分支增加 `skipped_no_thread` 字段，让 trace 的 output_summary 明确反映降级原因（已通过 `skipped: true, skip_reason: "no_thread_id"` 实现，trace.ts:163-192）。**当前不需要修改。**
- **是否阻塞下一阶段:** 否。语义正确，trace 可解释。

#### M2 — `buildLastAdviceSummary` 硬编码领域规则

- **文件与行号:** `graph.ts:309-322`
- **问题说明:** `buildLastAdviceSummary` 对倒吊人逆位 + career 的组合硬编码返回 "先识别卡点，不要冲动行动。"。此规则耦合了领域知识到 graph 逻辑中。如果 LLM 对该牌面有不同的解读，memory 摘要会与实际输出偏离。
- **影响:** Memory summary 与 reading content 不一致时，下一轮追问的 memory 上下文可能误导 agent 决策。
- **建议修复方式:** P6.5 已将此项标记为 P7 (reading-thread-memory.md:161-165)。P7 应从 LLM output 提取 advice summary。
- **是否阻塞下一阶段:** 否。当前 mitigation 是：fallback 路径 (graph.ts:318-321) 使用 `reflective_guidance` 从 LLM 输出提取。hard-code 只影响特定 card + topic 组合。

#### M3 — Eval `max_step_guard` case 使用真实 retrieval tool

- **文件与行号:** `cases.ts:146-161`, `runner.ts:130-143`
- **问题说明:** `max_step_guard` eval case 只 override `agentDecider`（always `retrieve_knowledge`），不 override `toolRegistry`。导致该 case 在 test 时运行真实 wiki 检索，产生真实 retrieval_sources。虽然 case 只断言 `action_path` 和 `max_agent_steps`，但无法测试 "retrieve + step guard + grounding none" 的组合路径。
- **影响:** "重复检索但全部未命中知识库且被 max_step_guard 截断" 的场景未被 eval 覆盖。
- **建议修复方式:** 新增一个 eval case：`fixture: "repeat_retrieve"` + `fixture: "empty_retrieval"` 组合，让 repeat retrieve decider 配合空检索工具。需扩展 `ReadingEvalRuntimeFixture` 支持组合。
- **是否阻塞下一阶段:** 否。现有合约测试覆盖了独立场景：`graph.contract.spec.ts:356-378` 覆盖 real-retrieve + max_step_guard。

#### M4 — `grounding_status: "stub"` 类型变体死代码

- **文件与行号:** `trace.ts:61`
- **问题说明:** `FinalAnswerGroundingTrace.grounding_status` 类型声明为 `GroundingStatus | "stub"`，但 `buildFinalAnswerGrounding` (trace.ts:118-135) 只产出 `"retrieved"` 或 `"none"`。P3 已完成 stub→real wiki 升级，`"stub"` 变体已无生产路径可达。
- **影响:** 类型误导未来读者；运行时无害。
- **建议修复方式:** 移除 `| "stub"` 或添加注释说明为预留变体。
- **是否阻塞下一阶段:** 否。P4、P4.5 都已记录但延后。

### Low

#### L1 — `prompt_hash` 字段从未填充

- **文件与行号:** `trace.ts:37`
- **问题说明:** `AgentStepTrace` 声明了 `prompt_hash?: string` 但 `buildAgentSteps()` 从未赋值。
- **影响:** 无害但误导。
- **建议:** 移除或实现（P7 可考虑在 decider prompt 上做 hash）。
- **是否阻塞下一阶段:** 否。

#### L2 — trace.ts 中的 `as` 类型断言不稳健

- **文件与行号:** `trace.ts:163-167, 212-213`
- **问题说明:** `summarizeActionOutput` 对 `AgentActionTrace.output` 做了多层 `as` 类型断言。如果 action output shape 变更，断言静默通过 TS 但运行时产生 undefined。
- **影响:** 维护风险。当前所有 output shape 稳定。
- **建议:** 提取命名接口或用 Zod 验证 action output。
- **是否阻塞下一阶段:** 否。

#### L3 — Eval `required_phrases` content assertion 脆弱

- **文件与行号:** `cases.ts:88`, `assertions.ts:161-165`
- **问题说明:** `thread_memory_followup` 的 `required_phrases: ["倒吊人逆位", "先识别卡点"]` 依赖 placeholder provider 将 sessionMemory 注入 reading 输出。placeholder 变更时此断言断裂。
- **影响:** 未来维护成本。
- **建议:** 将 content assertion 标记为 "best-effort"，增加注释说明依赖关系。
- **是否阻塞下一阶段:** 否。

#### L4 — `defaultSessionMemoryStore` 模块级单例

- **文件与行号:** `memory.ts:102`
- **问题说明:** 所有请求共享同一个 in-memory store。服务重启时所有 memory 丢失。当前设计意图是 in-memory only，接口支持注入。
- **影响:** 生产环境 memory 不持久。
- **建议:** P7 考虑 Redis/Postgres backend。
- **是否阻塞下一阶段:** 否。

### Observations

#### O1 — `THREAD_MEMORY_FOLLOWUP_PATTERN` 正则较宽

- **文件与行号:** `reading-agent-core.ts:71-72`
- **说明:** 正则匹配 "那"、"那么"、"所以"、"刚才" 等中文高频连接词开头的问题。一个独立问题 "那么我应该怎么规划职业？" 也会匹配。但此路由被 `threadId` 门控（decider 检测 `threadId` 后才会进入 memory 路径），因此 blast radius 限于有效 thread 内。

#### O2 — `summarizeInput`/`summarizeOutput` 对未知字段降级为 `{ keys: [...] }`

- **文件与行号:** `executor.ts:84-86`
- **说明:** 如果注册了 schema 包含 executor 不知道的字段的新工具，audit 摘要会变成 `{ keys: ["newField1", "newField2"] }`。不如静默降级，但丢失了语义信息。

#### O3 — 合约测试 `skips get_session_memory gracefully` 使用自定义 decider 而非默认 decider

- **文件与行号:** `graph.contract.spec.ts:163-213`
- **说明:** 测试缺 thread_id 的优雅降级时注入自定义 decider 强制 `get_session_memory` action。默认 decider (reading-agent-core.ts:167) 在无 threadId 时不会路由到 `get_session_memory`。这意味着生产环境中此降级路径触发概率极低（仅在未来自定义 decider 变更时才可能触发）。但双重防护设计是正确的。

#### O4 — Eval `no_fake_grounding` case 与 `unknown_knowledge_none` case 有重叠

- **文件与行号:** `cases.ts:127-144` vs `cases.ts:163-181`
- **说明:** 两个 case 都测试 `groundingStatus: "none"` + `forbidden_phrases`。区别在于 `unknown_knowledge_none`（id: `unknown_knowledge_none`）测试的是无匹配知识库内容的情况（查询不存在的概念），`no_fake_grounding`（id: `no_fake_grounding`）测试的是空检索 fixture 下的已知牌面查询。两个 case 都使用 `fixture: "empty_retrieval"`，行为等价。可以合并。

---

## 5. 横向一致性审查

### 命名一致性

| 层级 | 约定 | 实例 | 一致性 |
|---|---|---|---|
| Graph state | camelCase | `agentStepCount`, `toolCalls`, `sessionMemory` | ✓ 全部符合 |
| Agent state | snake_case | `agent_step_count`, `tool_calls`, `grounding_status` | ✓ 全部符合 |
| Tool names | snake_case | `retrieve_tarot_knowledge`, `get_session_memory`, `write_session_memory` | ✓ 全部符合 |
| Trace fields | snake_case | `run_id`, `agent_steps`, `retrieval_sources`, `used_source_ids` | ✓ 全部符合 |
| Eval fields | snake_case | `action_path`, `tool_calls`, `grounding_status`, `agent_step_count` | ✓ 全部符合 |
| Action types | snake_case | `retrieve_knowledge`, `get_session_memory`, `request_clarification`, `final_answer`, `safety_stop` | ✓ 全部符合 |

**唯一不一致:** tool name `retrieve_tarot_knowledge` 与 action type `retrieve_knowledge` 不同。这是设计的正确区分——action 是 agent 决策产物，tool 是注册的可执行单元。`getAgentActionInput` (graph.ts:150-164) 负责这个映射。

### 状态流一致性

检查从 graph state → agent state snapshot → diagnostics trace → eval report 的字段流：

| 字段 | graph state | agent state | trace | eval report |
|---|---|---|---|---|
| agent_step_count | `agentStepCount` (camelCase) | `agent_step_count` (snake_case) | `agent_steps[].step` | `agent_step_count` |
| action types | `agentAction.type` | `agent_actions[].type` | `agent_steps[].action_type` | `action_path[]` |
| tool calls | `toolCalls` | `tool_calls` | `tool_calls[]` | `tool_calls[]` |
| grounding | `groundingStatus` | `grounding_status` | `final_answer_grounding.grounding_status` | `grounding_status` |
| retrieval sources | `observations[].content.chunks` | `observations[].content.chunks` | `retrieval_sources[]` | `retrieval_source_count` |

**字段完整性:** 无丢失。graph state → agent state 通过 `buildAgentStateSnapshot` 完整映射 (reading-agent-core.ts:185-211)。agent state → trace 通过 `buildReadingRunTrace` 完整映射 (trace.ts:308-327)。trace → eval report 通过 `summarizeEvalResult` 完整映射 (assertions.ts:170-180)。

**语义漂移:** trace 的 `agent_steps[].step` 和 `agent_step_count` 语义相同但类型不同（前者是每步的 step 编号，后者是总计数）。eval 通过 `trace.agent_steps.length` 计算 `agent_step_count` (assertions.ts:63)，fallback 到 `agentState.agent_step_count`。两层语义一致。

### 错误路径一致性

| 错误场景 | 是否可解释 | 证据 |
|---|---|---|
| Tool failure (retrieve) | ✓ | executor 返回 `ok: false` + error code → observation 写入 `{ error }` → decider 进入 final_answer (graph.ts:813-815) |
| Provider failure | ✓ | `generateDraftNode` try/catch → `throwGenericFailureWithDiagnosticTrace` → `diagnosticTrace.status: "failed"` → 公开消息不泄露错误细节 (graph.ts:228-242) |
| Retrieval none | ✓ | `groundingStatus: "none"` → `buildKnowledgeGrounding` 返回空 chunks → `confidence_note` 注入降级提示 (graph.ts:1054-1058) |
| Safety stop | ✓ | `throwWithDiagnosticTrace` → `status: "safety_stop"` → 公开消息包含安全提示和 referral_links (graph.ts:929-961) |
| Clarification | ✓ | `throwWithDiagnosticTrace` → `status: "clarification"` → 公开消息包含具体澄清问题 (graph.ts:906-927) |
| Memory read skip (no thread_id) | ✓ | skipped observation `{ memory: null, skipped: true, reason: "no_thread_id" }` → decider 后续 final_answer (graph.ts:843-869) |
| Memory write failure | ✓ | executor 返回 `ok: false` → audit entry 记录失败 → graph 继续 END (graph.ts:1108-1139, executor.ts:358-392) |

### 隐私边界

| 边界 | 检查结果 | 证据 |
|---|---|---|
| Trace 不含用户原文 | ✓ PASS | graph.contract.spec.ts:585-603 验证 `state_summary` 不含原始 question |
| Audit 不含完整 input/output | ✓ PASS | `summarizeInput`/`summarizeOutput` 只摘录已知字段 (executor.ts:27-87) |
| Memory 不含 transcript | ✓ PASS | `SessionMemory` 只存 topics, cards, constraints, questions, advice (memory.ts:12-21) |
| Session capsule 不含敏感细节 | ✓ PASS | `sanitizeIncomingSessionCapsule` 过滤自残/操控/第三方意图 (safety.ts:58-88) |
| Eval report 不含用户原文 | ✓ PASS | report 只含 action_path, tool_calls, 计数 (report.ts:6-14) |
| Public error 不含内部状态 | ✓ PASS | `ReadingServiceError` 公开 message 是固定中文文案，诊断数据在 `diagnosticTrace` (errors.ts:4-27) |

### 面试可信度

| 可能批评 | 状态 | 证据 |
|---|---|---|
| "只是 Pipeline" | **已解决** | P1 引入真正的 conditional edge + agent loop (graph.ts:1162-1168)，有 max_agent_steps 截断、clarification/safety_stop early exit |
| "没有 tool" | **已解决** | P2 引入完整 tool registry/executor/permission/audit 系统 (tools/)，所有工具执行均走 executor |
| "没有 RAG grounding" | **已解决** | P3 完成 stub→real wiki 升级，78 张牌 + 概念 + 牌阵共 80+ 知识文件，元数据+关键词打分，有 `groundingStatus: "retrieved"/"none"` |
| "没有 tracing" | **已解决** | P4 引入 `ReadingRunTrace`（agent_steps/tool_calls/retrieval_sources/final_answer_grounding），成功/失败/安全停止/澄清四种状态 |
| "没有 eval" | **已解决** | P5 引入 7 个 eval case，确定性断言，trace-based report，`eval:reading` 可运行 |
| "memory 只是 template" | **部分成立** | P6 引入了 thread-level 结构化短期记忆，但 `last_advice_summary` 仍依赖硬编码规则而非 LLM 摘要。P6.5 已标记此限制，P7 规划升级 |

---

## 6. 面试官视角评估

### 1. 现在是否可以称为 controlled agent workflow？

**可以。** 项目有真实的 conditional edge、max_agent_steps 截断、early exit（clarification/safety_stop）、tool-call loop。不是 linear pipeline。

面试时可用这些点证明：
- `addConditionalEdges("agent_decider", routeAgentAction, { final_answer, retrieve_knowledge, get_session_memory, request_clarification, safety_stop })` (graph.ts:1162-1168)
- `retrieve_knowledge → agent_decider` 和 `get_session_memory → agent_decider` 两条回环 (graph.ts:1169-1170)
- `max_agent_steps = 3` 截断在 `agentDeciderNode` 中强制执行 (graph.ts:732-755)

### 2. 还有哪些地方不能夸大？

- **不是 multi-agent** — 只有一个 agent decider，没有 agent-to-agent 通信。
- **没有 real LLM summarization for memory** — `last_advice_summary` 是 deterministic extraction + 硬编码规则。
- **没有持久化 trace/memory** — trace 只在 error 中附带，memory 是 in-memory store。
- **没有 RL-based 或 learned policy** — agent decider 是规则匹配 + 正则，不是 RL policy。
- **没有 true multi-turn conversation memory** — thread memory 局限于同一 thread 内的卡片/主题/建议摘要，不记录对话历史。
- **eval 不是 production-grade** — 只有 7 个 case，没有 CI 集成，placeholder provider 而非真 LLM。
- **没有 multi-spread support** — eval runner 只支持 single-card spread。

### 3. 简历项目描述应该如何表述？

**推荐表述:**

> 从 pipeline-based tarot reading system 重构为 LangGraph-based controlled agent workflow (TypeScript)。
> 引入 agent decider（5 种 action type）、conditional edge routing、max_agent_steps 防死循环。
> 设计并实现 Tool Registry / Executor / Permission / Audit 四项基础设施，支持可替换工具和全链路审计。
> 将知识检索从 stub 升级为真实 RAG：78 张牌 + 10+ 概念 + 6 种牌阵，元数据+关键词打分，source attribution。
> 实现 agent tracing（4 种运行状态、隐私保护诊断追踪）、deterministic eval replay（7 个 case、trace-based assertions）。
> 引入 thread-level 结构化短期记忆（capped topics/cards/advice，边界明确的读/写语义）。

**关键数字:** 5 种 agent action、4 种 tool、4 种 trace status、7 个 eval case、80+ 知识文件、~1200 行 graph.ts、~300 行 trace.ts。

### 4. 面试时最容易被追问的 5 个问题

**Q1: Agent decider 是 LLM-based 还是 rule-based？为什么选这个？**

A: 当前实现是 rule-based（正则匹配 + 规则链，`reading-agent-core.ts:126-182`）。选择 rule-based 是因为：(1) agent 动作空间小（5 种），规则可枚举且确定性高；(2) 不需要额外 LLM 调用（省延迟 + 成本）；(3) eval replay 依赖确定性决策，rule-based 保证可复现。decider 是可注入的 `ReadingAgentDecider` 接口，未来可以替换为 LLM-based decider。

**Q2: max_agent_steps = 3，为什么是 3？如果知识检索未命中且步数已满怎么办？**

A: 3 步是目前场景下的合理上限：正常路径需要 retrieve_knowledge → final_answer（2 步），get_session_memory → final_answer（2 步），retrieve → not enough → retrieve again → final_answer（3 步）。如果检索未命中且步数已满（`nextStep >= maxAgentSteps && action.type === "retrieve_knowledge"`），在 agentDeciderNode 中强制替换为 `final_answer` (graph.ts:750-755)，`buildKnowledgeGrounding` 返回空 chunks，`confidence_note` 注入"本地知识库没有返回足够可靠牌义片段"降级提示 (reading-agent-core.ts:245)。

**Q3: tool permission 和 risk level 之间的 tradeoff 是怎样的？**

A: permission 控制 access（public/session/private/admin），risk level 控制 trust（low/medium/high）。`retrieve_tarot_knowledge` 是 public + low（读本地 wiki，无副作用），`draw_cards_server_side` 是 public + low（纯计算），`get_session_memory` / `write_session_memory` 是 session + medium（读/写 thread 状态，有状态副作用）。permission check 在 executor 执行前（executor.ts:218-253），不通过直接返回 `TOOL_PERMISSION_DENIED`。这个模型简单但覆盖当前需求。

**Q4: trace 如何保证不泄露用户隐私？**

A: 四个层次：(1) `state_summary` 只含 numeric/boolean 字段（agent_step_count, action_type, grounding_status, observation_count, tool_call_count, pending_clarification, safety_status）——不含 question、cards、synthesis (trace.ts:67-75)；(2) audit `input_summary`/`output_summary` 只摘录已知字段名（query/card/orientation/topic 的 key presence，chunk_count/grounding_status 的 aggregate values）——不含 query 内容、chunk content 等 (executor.ts:27-87)；(3) session memory trace 只暴露 topics(前3)、card_count、has_last_advice 等 boolean/count——不含 advice 内容 (trace.ts:181-184)；(4) public error message 是固定中文文案，诊断数据在 `diagnosticTrace` 而非 public response (errors.ts:10)。

**Q5: 如果换成真实 LLM provider，现有 eval 是否还能工作？**

A: 不能。当前 eval 使用 `EvalPlaceholderReadingProvider`（runner.ts:49-57），它是 deterministic 的。换真实 LLM 后：(1) structural assertions（action_path, tool_calls, grounding_status）应该仍然通过，因为 agent 决策不依赖 LLM；(2) content assertions（required_phrases）大概率断裂，因为真实 LLM 输出不可预测。解决方案：区分 structural eval（始终可运行）和 content eval（需要 mock/fixture），或者引入评分型 eval（LLM-as-judge），这是 P7 的规划方向。

### 5. 每个问题应该如何回答？

_（见上面 Q1-Q5 的回答）_

---

## 7. 下一步建议

### P7 必做

1. **LLM-based memory summarization** — 替换 `buildLastAdviceSummary` 的硬编码规则，从真实 LLM 输出中提取 advice summary（P6.5 已标记）
2. **CI eval integration** — 将 `eval:reading` 接入 CI pipeline，每次 PR 自动运行
3. **移除 `"stub"` 类型变体和 `prompt_hash` 空字段** — 清理 trace.ts 中的死代码，或标记为预留
4. **extract `summarizeActionOutput` 类型断言** — 从 `as` 断言重构为 Zod 验证或 named interface

### P7 可选

5. **Multi-spread eval support** — runner 当前只能构建 single-card spread 的 payload (runner.ts:28)
6. **组合 eval fixture** — 支持 `repeat_retrieve + empty_retrieval` 同时作用的场景
7. **trace unit tests for edge cases** — `buildReadingRunTrace` 的空 observation、空 agentActions 等边界
8. **Persistent SessionMemoryStore** — Redis/Postgres backend，服务重启不丢 memory

### 暂缓事项

9. **Multi-agent** — 当前 single-agent 架构满足需求，无 multi-agent 场景
10. **RL-based policy** — 规则 decider 覆盖当前 5 种 action，LLM-based decider 先于 RL
11. **LangSmith/OTel integration** — 当前 trace 已足够诊断，外部 tracing 优先级不高
12. **Long-term user memory** — ADR-0004 明确排除，需先有 user identity 和 explicit authorization
