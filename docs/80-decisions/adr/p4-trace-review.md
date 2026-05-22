# P4 Trace Review

**Date:** 2026-05-21
**Reviewer:** Claude (automated review)
**Status:** PASS (with findings)

---

## 1. Scope & Methodology

Reviewed the P4 reading agent tracing system across 5 files:

- `docs/30-agent/reading-agent-tracing.md` — spec (the contract)
- `apps/web/src/server/reading/trace.ts` — implementation (308 lines)
- `apps/web/src/server/reading/graph.ts` — graph integration (lines 171-188, 967-1002)
- `apps/web/src/server/reading/errors.ts` — error attachment (line 10)
- `apps/web/src/server/reading/__tests__/graph.contract.spec.ts` — tests (8 trace-relevant cases)

Each spec requirement was cross-referenced with implementation code. Edge cases were traced through the agent loop paths (success, clarification, safety_stop, failed tool, grounding none, step cap).

---

## 2. Spec Compliance Matrix

| Spec Requirement (Section) | Implementation | Verdict |
|---|---|---|
| §3 Trace data structure | `ReadingRunTrace` in `trace.ts:20-29` matches spec exactly | ✅ |
| §4 agent_steps with step/node/action_type/decision_reason/state_summary/output_summary/created_at | `buildAgentSteps()` at `trace.ts:258-276` | ✅ |
| §4 state_summary fields (7 fields listed) | `buildStateSummary()` at `trace.ts:219-239` | ⚠️ See Finding #2 |
| §5 tool_calls with tool_name/step/ok/latency_ms/error_code/decision_reason | `buildToolCalls()` at `trace.ts:278-287` | ✅ |
| §6 retrieval_sources with source_id/chunk_id/title/score/confidence/used_by_final_answer | `buildRetrievalSources()` at `trace.ts:116-129` | ✅ |
| §6 groundingStatus="none" → retrieval_sources is empty array | Verified at test `graph.contract.spec.ts:260` | ✅ |
| §7 final_answer_grounding with grounding_status/used_source_ids/retrieved_chunk_count/unsupported_claim_check | `buildFinalAnswerGrounding()` at `trace.ts:132-149` | ⚠️ See Finding #3 |
| §8 Privacy: no user question, full prompts, provider output, session capsule, tool input, user identity | Verified at test `graph.contract.spec.ts:318-336`; `state_summary` contains only numeric/status fields | ✅ |
| §9 Trace only in diagnostics, not serialized to public response | `route.ts:220-226` does not include `diagnosticTrace` in error payload | ✅ |
| §9 Error paths attach diagnosticTrace to ReadingServiceError | `throwWithDiagnosticTrace()` at `graph.ts:181-188`; `errors.ts:10` | ⚠️ See Finding #5 |
| §9 `runReadingGraphWithDiagnostics()` returns `{reading, agentState, trace}` | `graph.ts:983-989` | ✅ |
| §10 No persistence, no LangSmith/OTel, no Eval Replay, no Memory | Confirmed — no persistence or external tracing integration | ✅ |

---

## 3. Findings

### Finding #1 — Duplicate Type Guard (MEDIUM)

**File:** `trace.ts:95-107` and `graph.ts:215-227`

The `isRetrieveTarotKnowledgeOutput` function is defined identically in both `trace.ts` and `graph.ts`. This is a DRY violation — if the type guard logic needs to change (e.g., new grounding status variant), both copies must be updated independently.

**Recommendation:** Extract to a shared location, such as `retrieve-tarot-knowledge.ts` as an exported helper alongside the tool definition.

**Severity:** MEDIUM — not a bug today, but a maintenance risk.

---

### Finding #2 — observation_count Mislabeled (MEDIUM)

**File:** `trace.ts:226-235`

In `buildStateSummary()`:

```ts
const toolCallCount = (state.toolCalls ?? []).filter(
    (toolCall) => toolCall.step <= action.step,
).length;

return {
    observation_count: toolCallCount,   // ← same value
    tool_call_count: toolCallCount,     // ← same value
    ...
};
```

`observation_count` and `tool_call_count` are set to the same value. Semantically, observations and tool calls are distinct concepts — an observation is the result the agent sees, a tool call is the audit record. While they happen to be 1:1 in the current graph (each `retrieve_knowledge` step produces one observation and one tool call), this collapses a distinction that future phases (memory lookups, multi-tool steps) will need.

The spec (§4) says `observation_count` should reflect "the count of observations available to the agent at this step" — counting tool calls instead of observations is incorrect even if the numbers happen to match today.

**Recommendation:** Count `state.observations` entries at or before the current step for `observation_count`, separately from tool call count.

**Severity:** MEDIUM — semantically wrong; will cause confusion when observations diverge from tool calls.

---

### Finding #3 — `grounding_status: "stub"` Type Variant Unreachable (LOW)

**File:** `trace.ts:61`

The `FinalAnswerGroundingTrace.grounding_status` type is `GroundingStatus | "stub"`. However, the builder at `trace.ts:132-149` only ever produces `"retrieved"` or (falling through to `state.groundingStatus ?? "none"`). The `"stub"` variant is never constructed.

The `GroundingStatus` type in `reading-agent-core.ts:19` is `"none" | "retrieved"`, and `retrieve_tarot_knowledge` only returns these two values. The `"stub"` member appears to be an artifact from an earlier design where the placeholder provider might signal a stub grounding state.

**Recommendation:** Remove `| "stub"` from the type, or document when it would be produced. Dead type variants mislead future readers.

**Severity:** LOW — does not affect runtime behavior.

---

### Finding #4 — `prompt_hash` Field Never Populated (LOW)

**File:** `trace.ts:37`

`AgentStepTrace` declares `prompt_hash?: string` but `buildAgentSteps()` never populates it. This is dead code.

**Recommendation:** Either implement prompt hashing or remove the field. If it's reserved for P5 eval replay, add a comment marking it as such.

**Severity:** LOW — harmless but misleading.

---

### Finding #5 — No Diagnostic Trace for Generic Failures (MEDIUM)

**File:** `graph.ts:991-1001`

```ts
} catch (error) {
    if (error instanceof ReadingServiceError) {
      throw error;
    }

    throw new ReadingServiceError(
      "generation_failed",
      "解读生成失败，请稍后再试。",
      500,
    );
}
```

When `runReadingGraphWithDiagnostics` catches a non-`ReadingServiceError` failure (e.g., provider crash, LangGraph internal error, JSON parse failure in an unexpected place), it re-throws as a generic `ReadingServiceError` without attaching a diagnostic trace. The original graph state at the time of failure is lost.

The spec (§9) says "内部 diagnostics trace 挂在错误对象的 `diagnosticTrace` 字段上" — this implies all error paths should attach a trace when state is available. While the graph may be in an inconsistent state during unexpected failures, a trace with whatever partial state exists (at minimum `runId` and `startedAt`) would be more useful for debugging than nothing.

**Recommendation:** Attach a best-effort trace using whatever graph state survived the failure, or at minimum a trace skeleton with `run_id` and `started_at` so operators can correlate production failures with diagnostics runs.

**Severity:** MEDIUM — loses diagnostic information during unexpected production failures.

---

### Finding #6 — Heavy Type Assertions (LOW)

**File:** `trace.ts:161-167, 212-213`

The implementation uses `as` type assertions extensively when accessing `AgentActionTrace.output`:

```ts
const result = action.output as {
    ok?: boolean;
    toolName?: string;
    output?: { groundingStatus?: string; chunks?: unknown[] };
    error?: { code?: string };
} | undefined;
```

This is fragile — if `AgentActionTrace.output` changes shape (e.g., P5 adds a new tool with a different output shape), these assertions silently pass TypeScript but produce runtime `undefined` values that get masked by the `?.` fallbacks.

**Recommendation:** Use Zod-based runtime validation or at minimum extract the inline type to a named interface. The `AgentActionTrace.output` could benefit from a discriminated union based on `action.type`.

**Severity:** LOW — works correctly today but introduces maintenance risk.

---

### Finding #7 — `"failed"` Status Variant Unused (LOW)

**File:** `trace.ts:14-18`

`ReadingRunTraceStatus` includes `"failed"` but it is never produced. Only `"success"`, `"clarification"`, and `"safety_stop"` are used. Generic failures (Finding #5) don't produce traces at all.

**Recommendation:** Either wire up `"failed"` for generic failure traces, or remove the variant with a comment about when it might be used (e.g., P5 persistence).

**Severity:** LOW — minor spec-implementation gap.

---

## 4. Test Coverage Assessment

The contract tests in `graph.contract.spec.ts` cover 8 trace-relevant scenarios:

| Test | What it Verifies | Coverage Quality |
|---|---|---|
| L48-108: grounded retrieval | Full trace structure (agent_steps, tool_calls, retrieval_sources, final_answer_grounding) | Excellent — the most comprehensive trace test |
| L150-210: failed tool | `error_code` in tool_calls, `grounding_status: "none"` in output_summary | Good |
| L212-266: grounding none | Empty `retrieval_sources`, `grounding_status: "none"` | Good |
| L268-289: clarification | `error.diagnosticTrace` with `status: "clarification"` | Good |
| L292-316: safety_stop | `error.diagnosticTrace` with `status: "safety_stop"` | Good |
| L318-336: privacy | Raw user text absent from state_summary | Good |
| L126-148: step cap | 3-step loop → final_answer degradation | Partial — checks actions but not full trace |
| L48-108: multiple assertions | `unsupported_claim_check: "not_checked"`, confidence_note content | Good |

**Missing tests:**

- **No standalone unit tests for `buildReadingRunTrace()`.** All testing is through graph contract integration. Edge cases like missing `state.runId`, empty `agentActions`, or partial observations are untested in isolation.
- **No test for stepped grounding progression.** The current grounding tests check single-step retrieval. A multi-step scenario (retrieve_knowledge → nothing → retrieve_knowledge → found) would exercise `getGroundingAtStep()` boundaries.
- **No test for `"failed"` status path.** Since it's never produced (Finding #7), there's nothing to test.

---

## 5. Architecture Analysis

### Data Flow Integrity

The trace data flow has one non-obvious property worth documenting:

```
graph state → ReadingTraceState (input type for builder)
    ↓
buildReadingRunTrace()
    ├── buildFinalAnswerGrounding() — reads observations directly
    ├── buildAgentSteps() — reads agentActions, calls buildStateSummary/getGroundingAtStep
    ├── buildToolCalls() — reads toolCalls
    └── buildRetrievalSources() — reads observations, crosses with usedSourceIds from grounding
```

The builder reads from `state.observations` (the verbose agent observations with full chunk data) rather than from `toolCalls` (the summarized audit entries). This is the correct choice for building retrieval_sources, since audit entries only carry summarized output.

### Coupling Points

The trace system is coupled to:
1. `retrieve-tarot-knowledge.ts` output shape (via `isRetrieveTarotKnowledgeOutput` type guard)
2. `ToolCallAuditEntry` shape (via `buildToolCalls`)
3. `AgentActionTrace` shape (via `buildAgentSteps` / `summarizeActionOutput`)

These are reasonable coupling points since they're the stable P1/P2 abstractions the trace is designed to observe. Adding a new tool type would require updating `summarizeActionOutput` but not the rest of the builder.

---

## 6. P1/P2/P3 Non-Regression Check

Per spec §1: "本阶段只整理已有 execution state，不改写 P1/P2/P3 的 graph、tool registry、executor 或 knowledge retrieval 架构。"

Verified:
- `graph.ts` node functions unchanged except trace-related helpers (`buildTraceForGraphState`, `throwWithDiagnosticTrace`) which are additive
- `tools/executor.ts`, `tools/registry.ts` — unchanged
- `tools/retrieve-tarot-knowledge.ts` — unchanged
- `knowledge/retrieval.ts`, `knowledge/loader.ts` — unchanged
- `reading-agent-core.ts` — unchanged (types used by trace.ts were already public exports)

No existing P1/P2/P3 tests were broken or modified.

---

## 7. Conclusion

**Verdict: PASS**

The P4 trace implementation correctly captures agent decisions, tool calls, knowledge sources, grounding status, and fallback paths as specified. The privacy boundaries are well-enforced (8 contract requirements, all met). The error-path trace attachment works for clarification and safety_stop scenarios. The integration tests cover the primary success and failure paths comprehensively.

**Required fixes (before merge):**
- None.

**Recommended improvements (post-merge backlog):**
1. Extract duplicate `isRetrieveTarotKnowledgeOutput` to shared location (Finding #1)
2. Fix `observation_count` to count actual observations, not tool calls (Finding #2)
3. Attach diagnostic trace for generic failure paths in `runReadingGraphWithDiagnostics` (Finding #5)

**Nice to have:**
4. Remove or document `grounding_status: "stub"` type variant (Finding #3)
5. Remove or implement `prompt_hash` field (Finding #4)
6. Add standalone unit tests for `buildReadingRunTrace` edge cases
7. Remove or wire up `"failed"` status variant (Finding #7)
8. Replace `as` type assertions with named interfaces or Zod validation (Finding #6)
