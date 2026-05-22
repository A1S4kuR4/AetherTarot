# Reading Tools（P2）

## 1. 为什么引入 Tool Registry

P1 已经把 reading 主链升级为 controlled agent loop：`agent_decider` 在 provider draft 之前选择 `final_answer`、`request_clarification`、`retrieve_knowledge` 或 `safety_stop`，并通过 `max_agent_steps = 3` 防止循环失控。

P2 的目标不是继续增加 agent 行为，而是把已存在的 tool-like action 升级成最小工程闭环：

- tool 通过 registry 注册，不再散落为局部函数。
- tool 输入输出由 schema 校验。
- tool permission / risk level 成为定义的一部分。
- tool 执行统一经过 executor。
- tool call 写入内部 audit entry，便于后续 tracing 和 eval replay。

当前这些字段仍是 reading graph 的内部执行态，不进入公开 `StructuredReading` 成功协议。

## 2. 当前注册工具

### `retrieve_tarot_knowledge`

- permission: `public`
- riskLevel: `low`
- input:

```ts
{
  query: string;
  card?: string;
  orientation?: "upright" | "reversed" | "unknown";
  topic?: string;
}
```

- output:

```ts
{
  chunks: Array<{
    id: string;
    title: string;
    content: string;
    source: string;
    source_id: string;
    score: number;
    confidence: "low" | "medium" | "high";
  }>;
  groundingStatus: "retrieved" | "none";
}
```

P3 起该工具从 `knowledge/wiki` 读取本地 markdown 知识源，按 card / orientation / topic / keyword 做 metadata retrieval，并返回带 `source_id`、`source`、`score` 与 `confidence` 的 chunks。它仍不是 embedding RAG；找不到可靠 chunk 时必须返回 `groundingStatus = "none"`，不能伪造来源。

完整 grounding 规则见 `docs/30-agent/reading-knowledge-grounding.md`。

### `draw_cards_server_side`

- permission: `public`
- riskLevel: `low`
- input:

```ts
{
  spreadType: "single" | "three_card" | "custom";
  count?: number;
  allowReversed?: boolean;
  seed?: string;
}
```

- output:

```ts
{
  cards: Array<{
    id: string;
    name: string;
    orientation: "upright" | "reversed";
    position?: string;
  }>;
  source: "server_side_tool";
}
```

该工具复用运行时 Rider-Waite-Smith 牌池，用于建立服务端抽卡 tool 边界。P2 不强行替换现有前端抽卡路径；当前只保证它能通过 registry + executor 调用。

当前状态：`draw_cards_server_side` 已注册，但暂未进入主 reading graph 的 action route。现有主流程仍由前端完成线上随机抽牌或线下实体牌录入，再把 `drawnCards[]` 提交给 `POST /api/reading`。

### `final_reading_validator`

未在 P2 实现。它是推荐 follow-up：未来可作为低风险校验工具，检查最终输出中的绝对化断言、宿命化表达、医疗 / 法律 / 财务确定性建议，以及 grounding 状态与可见表述是否一致。

## 3. Tool Executor 职责

`executeReadingTool()` 负责：

- 查找 registry 中的 tool。
- 校验 permission；`public` 默认允许，非 public 必须出现在 `context.permissions` 中。
- 校验 input schema。
- 按 tool 定义的 `timeoutMs` 执行 tool，并捕获异常。
- 可选校验 output schema。
- 计算 latency。
- 返回标准 `ReadingToolResult`。
- 生成 `ToolCallAuditEntry`。

未注册工具会返回 `TOOL_NOT_FOUND`；权限不足会返回 `TOOL_PERMISSION_DENIED`；工具超时会返回 `TOOL_TIMEOUT`；工具抛错会返回 `TOOL_EXECUTION_FAILED`。这些失败不会默认变成未捕获异常。

## 4. Tool Call Audit

内部 `tool_calls[]` 记录：

```ts
{
  id: string;
  step: number;
  tool_name: string;
  permission: string;
  risk_level: string;
  input_summary: unknown;
  output_summary?: unknown;
  ok: boolean;
  latency_ms: number;
  error?: {
    code: string;
    message: string;
  };
  decision_reason?: string;
  created_at: string;
}
```

审计只记录 input / output summary，不默认写入完整敏感输入。P2 的 audit 比普通 event logging 更接近 tool call 事实记录，但仍不是完整 tracing span。

## 5. Agent Loop 接入方式

当前接入点只有 `retrieve_knowledge` 节点：

```text
agent_decider
  -> retrieve_knowledge
  -> executeReadingTool("retrieve_tarot_knowledge")
  -> append observations[]
  -> append tool_calls[]
  -> agent_decider
```

如果工具失败，graph 会把失败结果写入 observation 和 tool call audit，然后回到 decider，由 decider 优雅降级到 `final_answer` 或后续澄清路径；它不会让整次 reading 因未捕获工具异常崩溃。

## 6. 当前边界

P2 仍然不是完整 Tool Ecosystem：

- 没有完整 RAG。
- 没有长期 Memory Tool。
- 没有完整 Agent Tracing。
- 没有复杂 RBAC / policy engine。
- 没有 Multi-Agent。
- 没有把所有 reading 节点都改成 tool。
- `draw_cards_server_side` 已注册但尚未接入主 graph。

## 7. P3 / P4 后续方向

- 将 `retrieve_tarot_knowledge` 接入真实 `knowledge/wiki` 或 RAG，并保留 source / confidence / grounding status。
- 增加 `get_session_memory` / `write_session_memory`，但必须先完成 memory identity 与写入边界设计。
- 决定是否把线上抽卡从前端迁移到服务端 tool；迁移前必须评估前台仪式体验、history 兼容、离线实体牌录入和可回放随机性。
- 把 `tool_calls[]` 升级为 tracing spans，与 provider latency、cost、token usage 和 eval replay 对齐。
- 建立 tool failure replay 与 eval 回放样例，验证失败时不会越过 safety、schema 或 reading contract。
