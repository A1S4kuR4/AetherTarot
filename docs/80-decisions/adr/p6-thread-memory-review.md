# P6 Thread-Level Memory Review

- `status`: Passed (with observations)
- `reviewed_at`: 2026-05-21
- `reviewer`: Codex
- `scope`: memory.ts, session-memory.ts, graph.ts, agent-core, executor, trace, types, schemas, shared-types, tests, docs

## 1. Summary

P6 introduces thread-level structured short-term memory (`SessionMemory`) through two P2-registered tools (`get_session_memory`, `write_session_memory`), a new graph node for reading memory (`get_session_memory` → `agent_decider` loop), and a post-completion write node (`write_session_memory`). The in-memory `SessionMemoryStore` is injectable, and the agent decider detects same-thread follow-up questions to route into the memory read loop.

The implementation is solid, well-tested, and faithfully follows ADR-0004 boundaries and the P6 design doc. No blocking issues. Four medium-severity observations and five minor ones are noted below.

## 2. ADR-0004 Boundary Compliance

| Rule | Verdict | Evidence |
|---|---|---|
| Current reading context always wins over memory | PASS | `generateDraftNode` injects `sessionMemory` as supplementary context; `priorSessionCapsule` and current question/cards still take precedence (`graph.ts:946-948`) |
| Safety rules always win over memory | PASS | Safety nodes execute before memory write; `safety_stop` and `request_clarification` go to END before `writeSessionMemoryNode` (`graph.ts:1140-1149`) |
| `reading_id` ≠ `thread_id`/`session_id`/`user_id` | PASS | `reading_id` is `crypto.randomUUID()` per reading artifact; `thread_id` is a separate payload field (`schemas.ts:85`, `graph.ts:1009`) |
| Stored reading remains replayable from `StructuredReading` | PASS | `writeSessionMemoryNode` writes derived summary, not raw transcript (`graph.ts:324-349`) |
| `session_capsule` stays `string \| null` | PASS | No change to `session_capsule` schema (`shared-types:123`) |
| Thread identity ≠ user identity | PASS | No `user_id` field; `SessionMemory` scoped to `thread_id` only (`shared-types:80-89`) |
| No service-side persistence | PASS | `defaultSessionMemoryStore` is in-memory only (`memory.ts:61-100, 102`) |
| No raw transcript persistence | PASS | Memory fields are all summary-level: topics, cards, constraints, questions, advice summary (`shared-types:80-89`) |

## 3. Design Doc Compliance

| P6 Spec Requirement | Verdict | Source Match |
|---|---|---|
| `get_session_memory` tool registered with `session` permission, `medium` risk | PASS | `session-memory.ts:43-58` — permission `"session"`, riskLevel `"medium"` |
| `write_session_memory` tool registered with `session` permission, `medium` risk | PASS | `session-memory.ts:61-87` — same |
| Agent action `get_session_memory` type | PASS | `reading-agent-core.ts:15` |
| `agent_decider → get_session_memory → agent_decider` loop | PASS | `graph.ts:1135, 1141` — conditional edge + return edge |
| Write only after safety review + capsule attachment | PASS | `graph.ts:1147-1149`: `build_structured_reading → apply_safety_review → attach_session_capsule → write_session_memory → END` |
| Failure/clarification/safety_stop do NOT write memory | PASS | Those paths route to END before `writeSessionMemoryNode` (`graph.ts:1142-1143`) |
| `tool_calls[]` audit records both memory tools | PASS | `graph.ts:875, 1108` — audit entries appended for both read and write |
| Trace: `get_session_memory` output exposes summary only (topics, card count, advice presence) | PASS | `trace.ts:163-186` — `summarizeActionOutput` for `get_session_memory` |
| Trace: no full user text in memory observation | PASS | Trace summaries only include `topics` (first 3), `card_count`, `has_last_advice` (`trace.ts:181-184`) |
| Eval: `thread_memory_followup` case | PASS | `cases.ts:74-93`, `runner.ts:78-92` — seeds memory then tests follow-up routing |
| `max_agent_steps` still limits memory loop | PASS | Same `agentDeciderNode` checks step count before any action (`graph.ts:732-736`) |
| No LLM memory summarization | PASS | `buildLastAdviceSummary` is deterministic (`graph.ts:309-322`) |
| No database, no schema migration | PASS | In-memory store only; future replacement documented (`reading-thread-memory.md:58`) |

## 4. Medium-Severity Issues

### M1 — Hardcoded domain rule in `buildLastAdviceSummary` (`graph.ts:309-322`)

The function embeds a fixed interpretation: reversed Hanged Man in career context → "先识别卡点，不要冲动行动。" This couples domain knowledge into graph logic rather than deriving it from the LLM output. If the LLM interprets reversed Hanged Man differently for a specific career scenario, the memory will not reflect that interpretation.

- **Risk**: Domain drift — the memory summary diverges from the actual reading content.
- **Mitigation in place**: The fallback path (`graph.ts:318-321`) uses `reflective_guidance` from the LLM output, so this only affects the specific card-type combination.
- **Recommendation**: Either (a) extract `last_advice_summary` from the LLM output (listed as future work in the P6 doc), or (b) guard this rule with a test that verifies the actual LLM output for reversed Hanged Man career readings matches the hardcoded summary.

### M2 — `writeSessionMemoryNode` step number may be off (`graph.ts:1103`)

Uses `(state.agentStepCount ?? 0) + 1`. For a direct-to-final_answer reading, `agentStepCount` is already 1 after the decider node, so the write step becomes 2. While not semantically wrong, this means tool call steps don't always match agent action steps (e.g., a reading with 1 agent step shows `write_session_memory` at step 2 in audit). This is cosmetic but could confuse debugging.

- **Recommendation**: Consider using a separate step counter for post-agent graph nodes, or document that tool call steps after the agent loop may exceed `agentStepCount`.

### M3 — `getSessionMemoryNode` has no graceful fallback for missing `threadId` (`graph.ts:843`)

`requireStateValue(state.threadId, "threadId")` throws a 500 if `threadId` is undefined. The decider guards this (`reading-agent-core.ts:167`), but if a future decider change routes to `get_session_memory` without checking `threadId`, the graph will throw a hard error instead of gracefully skipping.

- **Recommendation**: Add a defensive check at the top of `getSessionMemoryNode` — if `!state.threadId`, return an observation indicating "no thread id available" and route back to `agent_decider` gracefully.

### M4 — No test for `write_session_memory` tool failure (`graph.ts:1081-1110`)

If `executeReadingTool` for `write_session_memory` fails (timeout, execution error), the graph continues to END without propagating the error. This is probably the right behavior — a failed memory write shouldn't block the reading response — but it's untested.

- **Recommendation**: Add a contract test with a throwing `writeSessionMemoryTool` to verify that a failed write doesn't crash the graph and the reading is still returned correctly. The audit entry should reflect the failure.

## 5. Minor Observations

### O1 — `summary` field generated but not used deterministically (`memory.ts:333-336`, `shared-types:82`)

`buildSessionMemoryPatch` populates `summary`, and it's stored in memory, but the decider never reads it. The provider receives the full `SessionMemory` and *could* use it, but the deterministic code path relies on `topics`, `cards`, and `last_advice_summary`. The `summary` is forward-looking — useful when the LLM provider starts consuming memory context — but it's currently dead weight in the deterministic path.

### O2 — `THREAD_MEMORY_FOLLOWUP_PATTERN` is broad (`reading-agent-core.ts:71-72`)

The regex matches leading particles (那, 那么, 所以, 刚才, etc.) and keywords like 投简历, 要不要, 是不是应该. A standalone question like "那么我应该怎么规划职业？" would match. Since this is gated on `threadId` presence (the decider checks `threadId` before routing), the blast radius is limited to threads where the user explicitly opted into continuity.

### O3 — Module-level singleton `defaultSessionMemoryStore` (`memory.ts:102`)

All requests share the same in-memory store. This is documented as intentional for P6, but worth flagging for production-readiness: under concurrent requests with different threads, the store works correctly (keyed by `threadId`), but memory is lost on server restart. The `SessionMemoryStore` interface and injectable design make replacement with Redis/Postgres straightforward.

### O4 — `write_session_memory` writes for standard/sober initial readings too

Since the graph line is `attach_session_capsule → write_session_memory → END`, standard initial readings (which have `session_capsule: null`) still write to memory. This means the first turn of a two-stage reading populates thread memory with the initial reading's cards and themes. The second stage (final) then reads it back. This is consistent with the P6 doc's "write on completion" rule, but worth noting that "completion" here means any successful graph run, not just final-stage runs.

### O5 — Eval placeholder provider may not exercise `sessionMemory` end-to-end (`evals/runner.ts:49-57`)

`EvalPlaceholderReadingProvider` calls `buildPlaceholderInitialReadingDraft(context)` which receives `sessionMemory` in context. The eval case `thread_memory_followup` asserts `required_phrases: ["倒吊人逆位", "先识别卡点"]`. Whether this passes depends on the prompting package's placeholder builder incorporating memory content. If the placeholder is replaced with a real LLM provider later, the eval assertions may need updating. (The contract test at `graph.contract.spec.ts:203-242` does verify this with the same TestReadingProvider, so this is likely fine.)

## 6. Test Coverage Assessment

| Layer | Test | Status |
|---|---|---|
| Unit: Store | `tool-system.spec.ts` — stores, updates, reads, clears memory | ✅ |
| Unit: Tool execution | `tool-system.spec.ts` — get/write via executor, permission denial | ✅ |
| Contract: Graph routing | `graph.contract.spec.ts` — `get_session_memory` routing, write after success, two-round continuity | ✅ |
| Contract: Graph routing | `graph.contract.spec.ts` — memory content in provider output (倒吊人逆位, 先识别卡点) | ✅ |
| Semantic: Safety priority | `semantic-fixtures.spec.ts` — (existing tests unchanged, safety still wins) | ✅ |
| Eval: Replay | `cases.ts` — `thread_memory_followup` eval case | ✅ |
| Missing: Write failure | No test for failed `write_session_memory` | ❌ See M4 |
| Missing: Memory not written on safety_stop | Implicitly covered by graph structure, no explicit assertion | ⚠️ Low priority |

## 7. Code Quality Notes

- **Naming convention**: Adheres to project conventions — graph state uses camelCase (`sessionMemory`, `sessionMemoryStore`), agent state uses snake_case (`agent_step_count`), tool names use snake_case (`get_session_memory`, `write_session_memory`).
- **Schema validation**: All memory I/O goes through Zod schemas (`memory.ts:6-24`, `session-memory.ts:12-19, 23-27`); the executor validates input and output (`executor.ts:255-289, 298-333`).
- **Merge semantics**: `mergeStrings` uses `Set` dedup + trim; `mergeCards` deduplicates by `id:orientation` key. Clear and well-documented (`memory.ts:36-59`).
- **Privacy**: Executor summaries expose only `threadId` and `patch_keys` (not patch values) for memory write input; output summaries expose counts and boolean flags, not content (`executor.ts:34-48, 52-87`).
- **Error handling**: Graph-level errors (`getSessionMemoryNode`, `writeSessionMemoryNode`) propagate cleanly through `throwGenericFailureWithDiagnosticTrace`.

## 8. Conclusion

P6 is a well-executed implementation that correctly introduces thread-level structured memory within ADR-0004 boundaries. The tool system, graph routing, trace, and tests are all consistent with the design doc. No blocking issues.

The four medium-severity issues (M1–M4) are actionable but not release-blocking. M1 (hardcoded domain rule) is the most architecturally significant — it should be addressed when LLM-based summarization is introduced in a future phase. M4 (missing write-failure test) is the easiest to fix immediately.

**Verdict: PASS.**

## 9. Review History

| Date | Pass | Reviewer | Changes |
|---|---|---|---|
| 2026-05-21 | 1 | Codex | Initial review |
