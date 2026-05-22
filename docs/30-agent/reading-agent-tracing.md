# Reading Agent Tracing

## 1. P4 目标

P4 为一次 `POST /api/reading` 的内部执行过程生成可回放 trace，让 diagnostics 能回答：

- Agent 每一步选择了什么 action。
- 为什么选择 `retrieve_knowledge`、`request_clarification`、`safety_stop` 或 `final_answer`。
- 调用了哪些 tool，以及调用是否成功。
- `retrieve_tarot_knowledge` 返回了哪些 knowledge chunks。
- 最终解读是否使用了检索 grounding sources。
- tool 失败或没有 grounding 时，系统如何降级到普通牌面 / 牌阵 / 反思框架。
- 每一步关键 state 如何变化。

本阶段只整理已有 execution state，不改写 P1/P2/P3 的 graph、tool registry、executor 或 knowledge retrieval 架构。

---

## 2. Event Logging 与 Agent Tracing 的区别

Event Logging 面向产品与运营观测，回答“这次请求成功了吗、耗时多久、用了多少 token、花费多少”。现有 `reading_events` 属于这一层。

Agent Tracing 面向内部诊断、回归与后续 eval replay，回答“Agent 为什么走这条路径、哪些依据进入了最终回答、失败时如何降级”。它比 event logging 更贴近 graph state，但仍不是原始 transcript 或完整 prompt dump。

---

## 3. Trace 数据结构

当前内部 trace 结构为：

```ts
type ReadingRunTrace = {
  run_id: string;
  started_at: string;
  ended_at?: string;
  status: "success" | "failed" | "clarification" | "safety_stop";
  agent_steps: AgentStepTrace[];
  tool_calls: ToolCallTrace[];
  retrieval_sources: RetrievalSourceTrace[];
  final_answer_grounding?: FinalAnswerGroundingTrace;
};
```

其中：

- `run_id` 是单次 graph diagnostics run 的内部 ID，不等同于 `reading_id`、`thread_id`、`session_id` 或 `user_id`。
- `status` 表示本次 graph 结果：成功、失败、澄清早停或安全早停。
- trace 仅在 diagnostics / internal output 中返回；公开 `StructuredReading` 协议不新增字段。

---

## 4. agent_steps

`agent_steps[]` 来自现有 `agentActions[]`，每一步记录：

- `step`：受控 agent loop 的步数。
- `node` / `action_type`：`retrieve_knowledge`、`request_clarification`、`safety_stop` 或 `final_answer`。
- `decision_reason`：decider 给出的简短原因。
- `state_summary`：摘要化 state，不保存完整用户输入。
- `output_summary`：该 action 的摘要结果，例如 retrieval chunk 数、tool error code、final answer grounding 状态。
- `created_at`：action 产生时间或 trace 汇总时间。

`state_summary` 当前只记录：

- `agent_step_count`
- `action_type`
- `grounding_status`
- `observation_count`
- `tool_call_count`
- `pending_clarification`
- `safety_status`

---

## 5. tool_calls

`tool_calls[]` 来自 P2 的 Tool Call Audit，当前映射字段包括：

- `tool_name`
- `step`
- `ok`
- `latency_ms`
- `error_code`
- `decision_reason`

trace 不复制 tool input 原文；公开响应也不会暴露 tool audit。

---

## 6. retrieval_sources

`retrieval_sources[]` 从 `retrieve_tarot_knowledge` observation 中提取。

每条 source 记录：

- `source_id`
- `chunk_id`
- `title`
- `score`
- `confidence`
- `used_by_final_answer`

如果 retrieval 返回 `groundingStatus = "none"`，`retrieval_sources` 必须保持空数组。系统不能伪造 source，也不能在最终解读中声称“基于知识库”。

---

## 7. final_answer_grounding

`final_answer_grounding` 说明最终解读的 grounding 状态：

- `grounding_status = "retrieved"`：存在 retrieved chunks，provider 收到这些 chunks 作为知识依据。
- `grounding_status = "none"`：没有 retrieved chunks，最终解读只能基于当前牌面、牌阵位置与一般反思框架降级生成。
- `used_source_ids`：最终回答可归因的 source ID；无 chunks 时为空数组。
- `retrieved_chunk_count`：实际 retrieved chunk 数量。
- `unsupported_claim_check`：当前固定为 `not_checked`，P4 不做复杂 unsupported claim 检查。

---

## 8. 隐私与不记录内容

trace 不记录：

- 完整用户问题原文或 follow-up answer 原文。
- 完整 prompt。
- provider 输出全文。
- `prior_session_capsule` 原文。
- tool input 原文。
- 用户身份字段，例如 `user_id`、`thread_id`、`session_id`。

trace 只保留可诊断的摘要字段、source metadata、tool 成败与 grounding 状态，避免把 diagnostics 变成新的隐私数据面。

---

## 9. 当前边界

当前 trace 只在 diagnostics 中返回，尚未持久化入库。

`runReadingGraphWithDiagnostics()` 成功时返回：

```ts
{
  reading: StructuredReading,
  agentState: ReadingAgentState,
  trace: ReadingRunTrace
}
```

`request_clarification` 与 `safety_stop` 仍按既有 graph 行为抛出 `ReadingServiceError`。内部 diagnostics trace 挂在错误对象的 `diagnosticTrace` 字段上；route 层不会把该字段序列化进公开 error payload。

---

## 10. 后续 P5

P5 可以基于 trace 做 eval replay，例如：

- 回放 agent action path 是否符合预期。
- 检查 final answer 是否只引用 retrieved sources。
- 对比 tool failure / grounding none 的降级表达是否稳定。
- 将 trace 与人工评分、fixture 回归或 future replay runner 连接。

这些能力不属于 P4。本阶段不实现 trace 持久化、LangSmith / OpenTelemetry 全量接入、Eval Replay、长期 Memory 或 Multi-Agent。
