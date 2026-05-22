# P6 Reading Thread Memory

## 1. 目标

P6 为同一条 reading thread 引入可读写的结构化短期记忆，让追问可以继承上一轮的主题、牌面与建议摘要。

典型路径：

1. 第一轮围绕职业或离职问题完成解读，并在 `reflective_guidance` / `synthesis` 中给出本轮实际建议。
2. 第二轮同一 `thread_id` 追问“那我是不是应该马上投简历？”
3. Agent 通过 `get_session_memory` 读取上一轮 thread memory，再把追问解释为同一条议题上的行动校准，而不是要求用户重复背景。

## 2. 边界

这是 thread-level memory，不是长期用户画像。

- 只服务当前 reading thread。
- 不跨用户、不跨 thread 自动共享。
- 不记录完整用户原文。
- 不保存敏感长期画像。
- 不作为稳定偏好、人格标签或长期 personalization 来源。
- 当前问题、当前牌阵、当前抽牌和安全边界始终高于 memory。

## 3. SessionMemory Schema

```ts
type SessionMemory = {
  thread_id: string;
  summary?: string;
  topics: string[];
  cards: Array<{
    id: string;
    name?: string;
    orientation?: "upright" | "reversed";
  }>;
  stated_constraints: string[];
  open_questions: string[];
  last_advice_summary?: string;
  updated_at: string;
};
```

字段只保留可复用摘要：主题、牌面、限制、开放问题和上一轮建议摘要。

## 4. Memory Store

当前实现为可注入的 in-memory store：

```ts
type SessionMemoryStore = {
  get(threadId: string): Promise<SessionMemory | null>;
  upsert(threadId: string, patch: Partial<SessionMemory>): Promise<SessionMemory>;
  clear?(threadId?: string): Promise<void>;
};
```

默认 store 位于 reading server 内存中，测试可注入独立 store。未来可以替换为 Redis 或 Postgres，但 P6 不引入数据库、不做 schema migration。

## 5. Memory Tools

P6 通过 P2 Tool Registry 注册两个工具：

- `get_session_memory`
- `write_session_memory`

两者权限均为：

```ts
permission: "session";
riskLevel: "medium";
```

工具必须通过 Tool Executor 调用，因此会走输入校验、权限检查、timeout、结果校验与 `tool_calls` audit。权限不足时返回 `TOOL_PERMISSION_DENIED`，不会绕过 registry/executor 直接读写 store。

## 6. Graph 读取

Agent action 新增：

```ts
{ type: "get_session_memory"; reason: string }
```

当当前问题明显像同一 thread 内追问，且还没有读取过 memory 时，默认 decider 可以选择：

```text
agent_decider -> get_session_memory -> agent_decider
```

`get_session_memory` 的工具输出会写入 `observations[]`，随后 decider 再进入 `final_answer`、`retrieve_knowledge` 或其他既有路径。该回环仍受 `max_agent_steps` 限制，不破坏 `retrieve_knowledge` 回环。

P6.5 hardening 后，`get_session_memory` node 自身也会检查 `thread_id`。如果 decider 被测试或未来策略强制路由到该节点，但 state 中没有 `thread_id`：

- 不调用 `get_session_memory` tool。
- 不写入伪造的 `tool_calls[]`。
- 追加 `observations[]`，内容为 `{ memory: null, skipped: true, reason: "no_thread_id" }`，`confidence` 为 `none`。
- 给对应 agent action 附加 skipped output summary，便于 trace 解释。
- 返回 `agent_decider`，由 decider 继续优雅降级到 `final_answer` 或 `request_clarification`。
- 不修改 `grounding_status`，避免把 memory 降级误解释为知识 grounding 变化。

## 7. Graph 写入

成功组装并通过 safety review / capsule attachment 后，graph 进入 `write_session_memory` node。

写入 patch 来自结构化 reading state：

- `question_type` 和 `themes` -> `topics`
- `cards[]` -> `cards`
- safety / sober 标记 -> `stated_constraints`
- `follow_up_questions` -> `open_questions`
- `extractLastAdviceSummary(...)` 从 `reflective_guidance` 优先、其次 `synthesis` 提取短建议摘要 -> `last_advice_summary`
- 当前时间 -> `updated_at`

失败、clarification、safety_stop 不写入完整 memory。`write_session_memory` 是 post-agent graph node，memory 写入失败不会阻塞已经完成的 reading：tool executor 会把失败记录到 `tool_calls[]` audit 与 trace，`ok=false`，并保留 `TOOL_EXECUTION_FAILED` / `TOOL_TIMEOUT` / `TOOL_INVALID_OUTPUT` 等错误码；graph 继续 END，返回当前 reading。

`write_session_memory` 的 audit `step` 使用 `agent_step_count + 1`。这里的 `agent_step_count` 只统计 controlled agent loop 内的决策步骤；memory write 发生在 final answer、safety review 与 capsule attachment 之后，是 post-agent 持久化节点。因此 `write_session_memory` 的 tool-call step 可能大于 `agent_step_count`，这是审计排序语义，不表示 agent loop 多执行了一步。

## 8. 权限与隐私

Graph 运行时只给当前 thread 的 memory tool 授予 `session` permission。memory tool 输入显式使用 `threadId`，store 以 thread 为边界合并摘要。

P6 不做：

- user id 绑定
- 长期 profile
- 跨用户 memory
- 原始 transcript 持久化
- LLM memory summarization

## 9. Trace

P4 trace 会体现 memory：

- `tool_calls[]` 记录 `get_session_memory` 与 `write_session_memory`
- `agent_steps[]` 记录 `get_session_memory` action
- `get_session_memory` 的 `output_summary` 只暴露摘要，例如是否命中 memory、topics、card count、是否有 advice summary
- 缺少 `thread_id` 时，`get_session_memory` action 的 `output_summary` 会显示 `skipped=true` 与 `skip_reason="no_thread_id"`，但不会出现成功的 memory tool call
- `write_session_memory` 失败时，trace 的 `tool_calls[]` 保留该 tool call，`ok=false` 并记录 `error_code`
- `observations[]` 内部保留 memory observation，用于 graph 继续决策和测试诊断

Trace 不记录完整用户原文，也不把 memory 变成公开 response 字段。

## 10. Eval Replay

P5 eval replay 新增 `thread_memory_followup`：

1. 用同一 `thread_id` 先运行职业 / 离职问题，倒吊人逆位，写入 memory。
2. 第二轮同 thread 追问“那我是不是应该马上投简历？”
3. 断言第二轮 action path 为 `get_session_memory -> final_answer`。
4. 断言 `tool_calls` 包含 `get_session_memory`。
5. 断言最终回答结合上一轮牌面 / thread memory context；内容断言保持 best-effort，不再依赖固定建议短语。

## 11. P6.5 Hardening

P6.5 对 P6 thread-level memory 做收口，不改变 memory store、tool schema 或 agent graph 架构：

- `get_session_memory` 缺少 `thread_id` 时优雅降级为 skipped observation。
- `write_session_memory` 失败时不阻塞 reading，但失败会进入 `tool_calls[]` audit 与 trace。
- 明确 post-agent `write_session_memory` step 与 `agent_step_count` 的关系。
- 增加 contract coverage，保护 no-thread memory read 降级与 memory write failure audit/trace。

## 12. P7 Advice Extraction

P7 已完成 `last_advice_summary` 的 reading-derived deterministic extraction：

- 新增 `extractLastAdviceSummary(...)`，从本轮已经生成的 `StructuredReading` 中提取摘要。
- 提取优先级为 `reflective_guidance`，其次 `synthesis`；二者都不可用时，graph 使用通用 fallback。
- 不再用“特定牌 + 特定主题”的固定牌义规则覆盖实际 reading output。
- 当前仍是 deterministic extraction，不调用 LLM，也不是复杂 LLM-as-judge。
- 不保存完整 transcript、不保存完整用户原文，只写入短建议摘要。
- 当前 reading context、当前牌阵与 safety 边界仍高于 memory；memory 只能作为同一 thread 内的辅助上下文。

后续如果需要更强的摘要质量，可以新增受控 `memory_summarizer`，但必须先定义输入字段、长度限制、隐私 redaction、失败 fallback 与评测边界。

## 13. 当前未做

- 长期 memory
- 用户画像
- 数据库存储
- memory summarization by LLM
- cross-session personalization
- Multi-Agent
