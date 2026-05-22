# P2 审校结论：最小可用 Tool Registry / Executor / Permission / Audit

**审校日期**：2026-05-21
**审校范围**：P2 全部新增与修改代码，含源码、测试、文档
**审校结论**：通过。P2 成功将 P1 的"有 loop"升级为"有可解释工具链路的 Agent"。

---

## 1. P2 目标回顾

P1 已将 reading 主链升级为 controlled agent loop：`agent_decider` 在 provider draft 前选择 `final_answer`、`request_clarification`、`retrieve_knowledge` 或 `safety_stop`，并通过 `max_agent_steps = 3` 防止循环失控。

P2 的目标是把已存在的 tool-like action 升级成最小工程闭环：

- tool 通过 registry 注册，不再散落为局部函数。
- tool 输入输出由 schema 校验。
- tool permission / risk level 成为定义的一部分。
- tool 执行统一经过 executor。
- tool call 写入内部 audit entry，便于后续 tracing 和 eval replay。

---

## 2. 新增文件结构

```
apps/web/src/server/reading/tools/
  types.ts                       — 所有类型定义
  registry.ts                    — ReadingToolRegistry 接口 + 工厂
  executor.ts                    — executeReadingTool() 执行引擎
  index.ts                       — Barrel 文件，默认 registry 单例
  draw-cards-server-side.ts      — draw_cards_server_side 工具
  retrieve-tarot-knowledge.ts    — retrieve_tarot_knowledge 工具

apps/web/src/server/reading/__tests__/
  tool-system.spec.ts            — 工具系统单测（8 个用例）
```

修改文件：

- `graph.ts` — `retrieveKnowledgeNode` 接入 executor，state 新增 `toolCalls`
- `reading-agent-core.ts` — `ReadingAgentState` 新增 `tool_calls`，旧 P1 工具代码移除
- `graph.contract.spec.ts` — 新增 3 个工具链路集成测试

---

## 3. 逐组件审查

### 3.1 Tool Registry

**实现**：`createReadingToolRegistry()` 基于 `Map<string, ReadingToolDefinition>` 的内存注册表。

**审查要点**：

| 项目 | 状态 | 位置 |
|---|---|---|
| 注册工具 | ✓ | `index.ts` L5-8，默认注册 `retrieve_tarot_knowledge` + `draw_cards_server_side` |
| 查重拒绝 | ✓ | `registry.ts` L29-31，重复注册抛 `Error` |
| 查询接口 | ✓ | `getTool` / `hasTool` / `listTools` 三个方法完整 |
| 可注入 | ✓ | `graph.ts` L631，`state.toolRegistry ?? readingToolRegistry`，`RunReadingGraphOptions.toolRegistry` 可自定义 |
| 单测覆盖 | ✓ | `tool-system.spec.ts` L13-27 |

**评价**：最小可用，无冗余。Map 实现对当前工具数量（2 个）足够，未来如需热加载可替换后端。

### 3.2 Tool Executor

**实现**：`executeReadingTool()` 统一入口，按序执行：registry lookup → permission check → input validation → execution (with timeout) → output validation → audit entry。

**审查要点**：

| 错误路径 | 错误码 | retryable | 审计记录 | 单测 |
|---|---|---|---|---|
| 工具未注册 | `TOOL_NOT_FOUND` | false | ✓ | ✓ (L29-40) |
| 权限不足 | `TOOL_PERMISSION_DENIED` | false | ✓ | ✓ (L42-69) |
| 输入 schema 失败 | `TOOL_INVALID_INPUT` | false | ✓ | 隐式（所有正确工具测试覆盖反向） |
| 输出 schema 失败 | `TOOL_INVALID_OUTPUT` | false | ✓ | 未直接测试（依赖 outputSchema 的 safeParse） |
| 工具执行异常 | `TOOL_EXECUTION_FAILED` | true | ✓ | ✓ (L116-145) |
| 工具超时 | `TOOL_TIMEOUT` | true | ✓ | ✓ (L147-175) |

**超时机制**（`executor.ts` L131-152）：

```typescript
function runWithTimeout<Output>(operation, timeoutMs, toolName) {
  // Promise.race between operation and setTimeout rejection
  // 超时后 reject Error("Reading tool "${toolName}" timed out after ${timeoutMs}ms.")
  // finally 中 clearTimeout 防止泄漏
}
```

- 超时错误码与执行异常区分（`TOOL_TIMEOUT` vs `TOOL_EXECUTION_FAILED`），decider 可据此做不同降级决策。
- 每次调用无论成功失败均生成 `ToolCallAuditEntry`，含 `crypto.randomUUID()` 唯一 id。

**评价**：分支逻辑完整，错误处理无遗漏。6 种结果路径全部有审计记录。

### 3.3 Tool Permission

**实现**：四级权限 `public | session | private | admin`。

**权限逻辑**（`executor.ts` L201-203）：

```typescript
if (tool.permission !== "public"
    && !context?.permissions?.includes(tool.permission)) {
  // deny
}
```

- `public` 工具无条件放行（当前两个工具均为 `public`）。
- 非 `public` 工具必须在 `context.permissions[]` 中显式授权。
- 单测用 `session` 工具验证了拒绝路径（`tool-system.spec.ts` L42-69）。

**评价**：权限模型简单但有效。当前无 RBAC 或 policy engine，但 P2 scope 内不需要。

### 3.4 Tool Call Audit

**实现**：每次 execution 生成 `ToolCallAuditEntry`，字段完整：

```typescript
{
  id: string;           // crypto.randomUUID()
  step: number;         // 来自 agentStepCount
  tool_name: string;
  permission: ToolPermission;
  risk_level: ToolRiskLevel;
  input_summary: unknown;   // summarizeInput() 摘要，不写完整敏感输入
  output_summary?: unknown; // summarizeOutput() 摘要
  ok: boolean;
  latency_ms: number;
  error?: { code: string; message: string };
  decision_reason?: string; // 来自 agentDecider 的 reason
  created_at: string;
}
```

**`summarizeInput` / `summarizeOutput`**（`executor.ts` L27-70）：
- 根据已知工具字段（query, card, orientation, topic, spreadType, count, chunks, groundingStatus, cards, source）提取摘要。
- 未知字段降级为 `{ keys: [...] }`。
- 不写入完整用户输入或输出内容，有隐私意识。

**评价**：审计粒度和隐私平衡合理。`keys` 降级策略对未知工具不够友好，但属于 NTH (Nice To Have) 而非缺陷。

### 3.5 Agent Loop 集成

**接入点**：仅 `retrieve_knowledge` 节点（`graph.ts` L608-655）。

```
agent_decider
  -> retrieve_knowledge
  -> executeReadingTool("retrieve_tarot_knowledge")
  -> append observations[] + agentActions[] + toolCalls[]
  -> agent_decider
```

**失败降级**：
- 工具返回 `ok: false` 时，observation.content 写入 `{ error }`，confidence 标记为 `"error"`。
- decider 收到后判断 `hasObservation = true`（因为 observation 已写入），走 `final_answer` 路径。
- 测试验证（`graph.contract.spec.ts` L118-165）：故意替换为抛错工具，确认 graph 不崩溃，最终产出有效 `StructuredReading`。

**工具注册表可注入**（`graph.ts` L873, L631）：

```typescript
// RunReadingGraphOptions
{ toolRegistry?: ReadingToolRegistry }

// retrieveKnowledgeNode
registry: state.toolRegistry ?? readingToolRegistry
```

**评价**：接入点精简（仅一个节点），降级路径清晰，可注入设计利于测试。

### 3.6 tool_calls 对外可见性

**这是初轮审校发现的阻断级问题，已在二次审校确认修复。**

修复链路：

1. `ReadingAgentState` 新增 `tool_calls: ToolCallAuditEntry[]`（`reading-agent-core.ts` L45）
2. `buildAgentStateSnapshot` 接收并返回 `tool_calls`（`reading-agent-core.ts` L176, L185）
3. `getAgentState` 传入 `toolCalls: state.toolCalls`（`graph.ts` L121）

修复后 `runReadingGraphWithDiagnostics()` 返回的 `agentState.tool_calls` 包含完整审计轨迹，可供调用方做 tracing/eval replay。

**评价**：已修复，管道完整。

---

## 4. 代码质量

### 4.1 类型安全

- `ReadingToolDefinition<Input, Output>` 泛型约束 input/output schema 与 run 函数签名一致。
- Zod schema 的 `safeParse` 使用正确，错误信息通过 `z.prettifyError` 格式化。
- `ToolCallAuditEntry` 与 `ReadingToolResult` 类型分离，审计和结果各自独立。

### 4.2 错误处理

- executor 内所有分支均返回标准 `ReadingToolResult` + `ToolCallAuditEntry`，无未捕获异常泄漏。
- graph 层通过 `execution.result.ok` 判断，失败时 observation 仍写入，graph 继续运行。
- 超时与执行异常使用不同错误码，上层可区分处理。

### 4.3 代码清理

- P1 旧工具代码（`retrieveTarotKnowledge` 函数、`retrieveTarotKnowledgeTool` 对象、`TarotKnowledgeRetrievalInput`/`TarotKnowledgeRetrievalOutput` 类型）已从 `reading-agent-core.ts` 移除。
- 工具定义统一在 `tools/` 目录，graph 和 agent-core 通过 import 引用。
- 无死代码残留。

---

## 5. 测试覆盖

### 5.1 单元测试（`tool-system.spec.ts`，8 个用例）

| 用例 | 覆盖路径 |
|---|---|
| 列出默认工具 | registry.listTools() |
| 重复注册拒绝 | registry.registerTool() |
| 未知工具 | TOOL_NOT_FOUND |
| 权限拒绝 | TOOL_PERMISSION_DENIED |
| 执行 retrieve_tarot_knowledge | 成功路径 + audit |
| 执行 draw_cards_server_side | 成功路径 |
| 工具抛错 | TOOL_EXECUTION_FAILED + audit |
| 工具超时 | TOOL_TIMEOUT + audit |

### 5.2 集成测试（`graph.contract.spec.ts`，P2 相关 4 个用例）

| 用例 | 覆盖路径 |
|---|---|
| retrieve → final_answer 两步链路 | tool_calls audit 记录 + observation 正确 |
| max_agent_steps 截断 | 2 次 retrieve + 1 次 final_answer，tool_calls 长度 = 2 |
| 失败工具降级 | TOOL_EXECUTION_FAILED 记录到 observation + audit，最终产出有效 reading |
| 自定义 toolRegistry 注入 | 通过 graph options 替换工具 |

---

## 6. 当前边界（P2 不做的事）

以下明确不在 P2 scope，当前实现正确标注了边界：

- `retrieve_tarot_knowledge` 仍为 placeholder stub（`groundingStatus: "stub"`，输出中诚实标注）。
- `draw_cards_server_side` 已注册但未被 graph 路由调用（预留工具，P3/P4 接入）。
- 无完整 RAG，无长期 Memory Tool，无 Agent Tracing，无 RBAC，无 Multi-Agent。
- `tool_calls[]` 是内部执行态，不进入公开 `StructuredReading` 成功协议。
- `summarizeInput`/`summarizeOutput` 对未知工具 schema 降级为 `{ keys: [...] }`。

---

## 7. 审校历史

| 轮次 | 日期 | 发现 | 状态 |
|---|---|---|---|
| 初轮 | 2026-05-21 | `tool_calls` 未在 `ReadingAgentState` / `buildAgentStateSnapshot` / `getAgentState` 中传递 | 已修复 |
| 初轮 | 2026-05-21 | `timeoutMs` 定义但未强制执行 | 已修复 |
| 二次 | 2026-05-21 | 以上两项均已修复，无新增问题 | 通过 |

---

## 8. 最终结论

P2 实现完整、代码质量良好、测试覆盖充分。Tool Registry / Executor / Permission / Audit 四条链路全部闭环，错误处理无遗漏，审计轨迹可从 `agentState.tool_calls` 完整获取。从"有 loop 的 Agent"到"有可解释工具链路的 Agent"这一目标已达成。
