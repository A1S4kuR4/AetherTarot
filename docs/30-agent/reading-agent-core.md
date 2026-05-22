# Reading Agent Core（P1）

## 1. P1 改造目标

P1 的目标是把 reading 主链从固定单次 provider 调用，演进为一个受控的最小 agent loop。

当前核心变化：

- 在 provider draft 生成前新增 `reading_agent_core`。
- 由 `agent_decider` 基于当前 question、牌阵、抽牌、safety friction 与内部 agent state 选择下一步动作。
- 动作只允许落在 `final_answer`、`request_clarification`、`retrieve_knowledge`、`safety_stop` 四类。
- `retrieve_knowledge` 后会写入 observation，再回到 `agent_decider`。
- `max_agent_steps` 默认是 `3`，防止工具循环失控。

这一步不是重写 reading service，也不是引入多 Agent。它只把原本固定的 provider 调用点包进一个可条件路由、可观察、可限制步数的 agent core。

## 2. 为什么这是 controlled agent loop

P1 之前，reading graph 基本是：

```text
classify -> hydrate -> validate -> safety friction -> provider draft -> validate -> assemble -> safety review -> capsule
```

P1 之后，provider draft 前面增加了：

```text
agent_decider
  -> retrieve_knowledge -> observation -> agent_decider
  -> request_clarification -> END
  -> safety_stop -> END
  -> final_answer -> provider draft
```

这让系统具备最小的“判断下一步 -> 执行动作 -> 观察 -> 再判断”能力，但仍然受到明确边界约束：

- action set 是闭集，不允许自由工具调用。
- loop 有步数上限。
- safety hard stop 仍然不进入普通 provider reading。
- 最终成功结果仍然收敛到 `StructuredReading`。

## 3. 仍然是 deterministic workflow 的部分

以下部分没有交给 agent 自由决定：

- request schema validation
- question classification
- canonical spread/card hydration
- final phase consistency validation
- intent friction hard stop / sober check
- provider draft contract validation
- structured reading assembly
- post-generation safety review
- completed `session_capsule` generation

Agent core 只决定 provider 前是否需要澄清、是否触发 knowledge retrieval、是否停止安全路径，或是否进入 final answer 生成。

## 4. 当前 Tool 边界

P1 只实现一个最小 tool-like action。P2 已将它升级为正式 Reading Tool Registry + Tool Executor，并新增服务端抽卡工具。

当前默认 registry 包含：

```text
retrieve_tarot_knowledge
draw_cards_server_side
```

`retrieve_tarot_knowledge` 当前返回：

```json
{
  "chunks": [
    {
      "id": "major-arcana/the-hanged-man.md#3-核心牌义-逆位",
      "title": "倒吊人 (The Hanged Man) - 核心牌义（逆位）",
      "content": "...",
      "source": "knowledge/wiki/major-arcana/the-hanged-man.md",
      "source_id": "78W,YAT,CTB",
      "score": 128,
      "confidence": "high"
    }
  ],
  "groundingStatus": "retrieved"
}
```

P3 起它已经接入 `knowledge/wiki` 的本地 markdown 知识源，使用 keyword / metadata retrieval 返回 source-attributed chunks。找不到可靠 chunk 时返回 `groundingStatus = "none"`，最终输出必须诚实降级，不得伪装成知识库依据。它仍不是 embedding RAG。完整说明见 `docs/30-agent/reading-knowledge-grounding.md`。

`draw_cards_server_side` 复用运行时牌池，当前只作为服务端抽卡 tool 边界和后续接入点，不强行替换现有前端抽卡流程。

完整工具说明见 `docs/30-agent/reading-tools.md`。未来 P3 可把 retrieval tool 替换为 `knowledge/wiki` 或更完整的检索层，但需要保持来源、chunk、confidence 与安全边界可审计。

## 5. 当前 State 字段

P1 在 graph 内部维护以下 agent state：

- `agent_step_count`
- `max_agent_steps`
- `agent_actions[]`
- `observations[]`
- `tool_calls[]`
- `pending_clarification`
- `grounding_status`

这些字段当前是内部执行态、工具审计与测试诊断结构，不进入公开 `StructuredReading` 成功协议。这样可以保留前端、history 与 eval 对现有 schema 的兼容性。

## 6. Prompt 与 Decider

`reading-agent-core.ts` 中新增 `AGENT_DECIDER_PROMPT`，明确 decider 只能输出结构化 JSON，并只能选择：

- `retrieve_knowledge`
- `request_clarification`
- `final_answer`
- `safety_stop`

当前默认 decider 是最小规则实现，用于保持 P1 测试稳定、避免在同一阶段新增第二个外部 LLM 调用面。真实 LLM decider 可以在后续阶段接入，但必须继续遵守同一 action union、JSON 输出和 max step limit。

## 7. Memory 与 Tracing 现状

P1 不实现长期 memory。

当前 `session_capsule` 仍然只在 completed reading 生成，`prior_session_capsule` 仍然只是低优先级 continuity context。Agent observations 不会写入长期记忆，也不会改变 current question、current spread、current drawn cards 或 safety tier。

P1 / P2 也不实现完整 Agent tracing。`agent_actions[]`、`observations[]` 与 `tool_calls[]` 只是 P4 tracing 的预留骨架，用于测试和调试最小 loop。

## 8. 后续方向

P3 已完成：

- `retrieve_tarot_knowledge` 已接到真实 `knowledge/wiki` 检索。
- retrieval chunk 已带 `source_id`、`source`、`score` 与 `confidence`。
- `groundingStatus` 已收敛为 `retrieved | none`，不再返回 `stub`。

P4 可扩展：

- 在不改变 `StructuredReading` 的前提下，把 agent observations 更好地注入 provider context。
- 评估 LLM decider，但保留 closed action set。
- 建立完整 tracing、成本观测、tool latency 与失败归因。
- 为 future checkpoint / resume 设计可审计的中间态，但不把它混同于 memory。

明确暂不做：

- 完整 RAG
- 完整 Agent Tracing
- 长期 Memory
- Multi-Agent
