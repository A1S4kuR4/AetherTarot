# P5 Eval Replay / Trace-based Evaluation — Review

**Date:** 2026-05-21
**Reviewer:** Claude (primary review)
**Previous reviews:** `p4-trace-review.md`, `p4.5-trace-hardening-review.md`
**Status:** PASS (0 blocking, 2 low findings, 4 observations)

---

## 1. Review Scope

Reviewed all 5 P5 source files plus supporting trace/graph/error infrastructure against the design spec at `docs/30-agent/reading-eval-replay.md`:

| File | Lines | Role |
|---|---|---|
| `apps/web/src/server/reading/evals/cases.ts` | 158 | Eval case types + 6 default cases |
| `apps/web/src/server/reading/evals/assertions.ts` | 158 | Deterministic assertion logic |
| `apps/web/src/server/reading/evals/runner.ts` | 180 | Eval runner (case→graph→report) |
| `apps/web/src/server/reading/evals/report.ts` | 60 | Report builder (case + aggregate) |
| `apps/web/src/server/reading/evals/assertions.spec.ts` | 228 | Assertion + integration tests |

Supporting files re-read for context:
- `trace.ts` (296 lines), `graph.ts` (1056 lines), `errors.ts` (34 lines), `reading-agent-core.ts` (236 lines)
- `graph.contract.spec.ts` (812 lines), `trace.spec.ts` (62 lines)
- `reading-eval-replay.md` (design doc)

Existing eval output: `outputs/evals/reading-eval-report.json` — 6/6 cases passing, confirmed the system runs end-to-end.

---

## 2. Architecture Assessment

The pipeline follows the design doc's spec exactly:

```
eval cases → run reading graph → collect reading/agentState/trace → deterministic assertions → JSON report
```

**Fixture injection** (`runner.ts:82-96`) is clean and minimal — two injection points:
- `empty_retrieval`: overrides `toolRegistry` with a stub tool that returns `{groundingStatus: "none", chunks: []}`
- `repeat_retrieve`: overrides `agentDecider` with a function that always returns `retrieve_knowledge`

This avoids polluting the graph with eval-only code paths. The production graph nodes are unaware of eval fixtures.

**Error path handling** (`runner.ts:104-120`) correctly extracts `diagnosticTrace` from `ReadingServiceError` for clarification and safety_stop paths. Non-`ReadingServiceError` exceptions produce a report with `trace: undefined`, and the assertion function returns `["No diagnostic trace was produced."]`.

---

## 3. Finding-by-Finding Analysis

### Finding #1 — buildPayload single-spread assumption (LOW)

**Location:** `runner.ts:28` — `const DEFAULT_SPREAD_ID = "single"`

**Issue:** `buildPayload` (L36-49) always uses the single-card spread with one position ("focus"). All 6 default cases use exactly 1 card, so this works. But if a multi-card case is added (e.g., a 3-card past-present-future spread), `hydrateCanonicalContext` in `graph.ts:275-371` would reject it because the number of drawn cards wouldn't match the spread's position count.

The eval case schema (`cases.ts:16-20`) supports multiple cards via `cards?: Array<{...}>`, so the type system allows multi-card cases. The runner just can't handle them yet.

**Mitigation:** The design doc explicitly scopes P5 as "最小可回放评测系统" (minimal replayable eval system). Multi-spread support is a reasonable P6+ extension. No action required now, but worth documenting as a known limitation.

**Verdict:** Acceptable for P5 scope. Consider adding a runtime check or expanding `DEFAULT_SPREAD_ID` selection when multi-card cases are added.

---

### Finding #2 — Integration test gaps in assertions.spec.ts (LOW)

**Location:** `assertions.spec.ts:94-227`

**Issue:** The test file has 5 tests: 3 unit tests for assertions (action path match, failure reasons, forbidden phrases), 1 report aggregation test, and 2 integration tests (passing clarification case, failing expectation case). Missing integration coverage:

1. **No `empty_retrieval` fixture integration test.** The `graph.contract.spec.ts` has tests for empty retrieval tool behavior (L212-266), but the eval runner's fixture wiring (`buildRunOptions` → `createEmptyRetrievalTool()`) isn't tested as an integrated path through `runReadingEvalCase`.

2. **No `repeat_retrieve` fixture integration test.** The `graph.contract.spec.ts` tests max step capping (L126-148), but not through the eval runner's `buildRepeatRetrieveDecider` fixture.

3. **No `safety_stop` integration test.** The contract tests verify safety_stop trace production (L292-316), but the eval runner's handling of safety_stop errors isn't integration-tested.

**Assessment:** The existing tests cover the core assertion logic well. The contract tests independently verify the graph behaviors that the eval cases depend on (retrieval, clarification, safety_stop, step guard, grounding none). The risk of a regression that breaks the eval runner but not the contract tests is low — it would require a change to `buildRunOptions` fixture wiring specifically.

**Verdict:** Acceptable. The test pyramid is sound: unit tests for assertions, contract tests for graph behavior, and the eval report itself (6/6 passing) confirms end-to-end correctness.

---

### Finding #3 — forbidden_phrases: substring matching sensitivity (OBSERVATION)

**Location:** `assertions.ts:47-49` — `phraseIsPresent` uses `String.includes()`

**Observation:** `text.includes(phrase)` is substring matching. If a forbidden phrase like "知识库" were in the list, it would match "知识库显示" even if the actual output used a different phrasing. However, the `DEFAULT_FAKE_GROUNDING_PHRASES` (cases.ts:38-45) are all complete, specific Chinese phrases ("根据知识库明确表明", "知识库明确表明", etc.), not short substrings. Substring matching is appropriate here — the risk of false positives is negligible given the phrase specificity.

**Relevance to P5:** This is the correct tradeoff for a minimal eval system. If the phrase list expands significantly in the future, consider switching to word-boundary-aware matching.

---

### Finding #4 — max_step_guard case uses real retrieval tool (OBSERVATION)

**Location:** `cases.ts:121-137`, `runner.ts:82-96`

**Observation:** The `max_step_guard` case only overrides the `agentDecider` (to always return `retrieve_knowledge`). It does NOT override the `toolRegistry`. Consequently, the real `retrieve_tarot_knowledge` tool runs twice, producing actual retrieval results. The report confirms: `retrieval_source_count: 10`, `grounding_status: "retrieved"`, `tool_calls: ["retrieve_tarot_knowledge", "retrieve_tarot_knowledge"]`.

This is correct behavior — the case only asserts on `action_path` and `max_agent_steps`, not on grounding. The fixture is testing "does the step guard work even when retrieval succeeds." A complementary case using `empty_retrieval + repeat_retrieve` combined could test the same guard with no grounding, but that's an enhancement, not a gap.

---

### Finding #5 — agentStepCount fallback chain in assertions (OBSERVATION)

**Location:** `assertions.ts:57`

```ts
const agentStepCount = result.agentState?.agent_step_count ?? trace?.agent_steps.length ?? 0;
```

**Observation:** The three-tier fallback (`agentState.agent_step_count` → `trace.agent_steps.length` → 0) is correct for three distinct scenarios:

1. Success path: `agentState.agent_step_count` is the authoritative value from the graph.
2. Error path with trace: `trace.agent_steps.length` counts the steps recorded before the error (e.g., clarification after 0 retrieves → 1 step).
3. Error path without trace: defaults to 0, which means `agentStepCount > expected.max_agent_steps` can never be true (since `max_agent_steps` is always positive). This silently passes the check, which is correct — if there's no trace, the "no trace" failure already covers it.

The `??` operator correctly handles `agent_step_count: 0` as a valid value (won't fall through to the next tier).

---

### Finding #6 — Deferred items from P4.5 still deferred (OBSERVATION)

**Status of P4.5 deferred LOW items in P5:**

| P4.5 Finding | Status in P5 | Assessment |
|---|---|---|
| `grounding_status: "stub"` variant (trace.ts:61) | Still unused | P5 eval system only checks "none"/"retrieved". No regression. |
| `prompt_hash` field (trace.ts:37) | Still unpopulated | P5 assertions don't reference it. No regression. |
| Heavy type assertions in trace.ts | Unchanged | P5 doesn't add new type assertions; existing ones are structurally sound. |

None of these affect P5 functionality. They remain reasonable to defer.

---

## 4. Design Doc vs Implementation Alignment

| Design Doc Claim | Implementation | Match? |
|---|---|---|
| 6 default eval cases | `cases.ts:47-158` — exactly 6 cases | ✓ |
| Deterministic assertions, no LLM judge | `assertions.ts` — pure logic, no LLM calls | ✓ |
| 8 assertion types listed | All 8 implemented in `assertReadingEvalCase` | ✓ |
| `forbidden_phrases` with auto-default when grounding=none | `assertions.ts:133-136` | ✓ |
| Report format (started_at, ended_at, total, passed, failed, cases[]) | `report.ts:16-23` — exact match | ✓ |
| `npm run eval:reading` script | `package.json:10` — `vite-node ... runner.ts` | ✓ |
| Report output to `outputs/evals/reading-eval-report.json` | `runner.ts:31-34` — correct path | ✓ |
| `exitCode: 1` on failures | `runner.ts:172-174` | ✓ |

No discrepancies found between the design document and the implementation.

---

## 5. Conventions Compliance

Checked against `aethertarot-conventions`:

- Tool names: `retrieve_tarot_knowledge` — snake_case ✓
- Graph state fields: `maxAgentSteps`, `toolCalls`, `agentStepCount` — camelCase ✓
- Report fields: `started_at`, `ended_at`, `action_path`, `tool_calls`, `grounding_status`, `retrieval_source_count`, `agent_step_count` — snake_case (API-facing) ✓
- Error codes: imported from shared types, not defined locally ✓
- File naming: `cases.ts`, `assertions.ts`, `runner.ts`, `report.ts` — descriptive kebab-case equivalent ✓

No convention violations.

---

## 6. Non-Regression Check

All P1-P4.5 code paths verified unchanged:

- `trace.ts` — untouched by P5; `buildReadingRunTrace` not modified
- `graph.ts` — untouched by P5; all 13 nodes unchanged
- `reading-agent-core.ts` — untouched
- `errors.ts` — untouched
- `tools/` — untouched
- `graph.contract.spec.ts` and `trace.spec.ts` — untouched

The eval system operates entirely at the `runReadingGraphWithDiagnostics` boundary — it consumes the trace/graph output without modifying any production code.

---

## 7. Conclusion

**Verdict: PASS**

The P5 eval replay system is a clean, minimal implementation that delivers exactly what the design doc specifies. The architecture is well-layered (cases → runner → assertions → report), fixture injection is surgically targeted at graph boundaries, and error paths correctly capture diagnostic traces for clarification/safety_stop/failure scenarios.

The two LOW findings are accepted within P5 scope:
- **Finding #1** (single-spread assumption): Documented limitation; multi-spread support is a natural P6+ extension.
- **Finding #2** (integration test gaps): Mitigated by contract test coverage + end-to-end report validation (6/6 passing).

The four observations document design choices and deferred items — none affect correctness.

**Confirmed by existing evidence:**
- `outputs/evals/reading-eval-report.json` — all 6 cases pass (generated 2026-05-21T13:28–13:30)
- `assertions.spec.ts` — 5 tests covering assertion logic + integration paths
- `graph.contract.spec.ts` — 8 trace-related tests validating trace production for all status variants

**Review history:**
- P4 review: 7 findings (0 blocking, 3 medium, 4 low)
- P4.5 hardening: 3/3 medium resolved, 1/4 low resolved, 3/4 low deferred
- P5 eval replay: 0 blocking, 0 medium, 2 low, 4 observations
- No regressions detected in any unchanged code path
