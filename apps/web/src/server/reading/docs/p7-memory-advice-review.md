# P7: Memory Summarization / Advice Extraction — Code Audit

**Date:** 2026-05-22
**Scope:** Full P7 feature across 6 files + 1 spec file + graph integration
**Method:** Line-level analysis of each module, cross-referencing types, schemas, and graph wiring

---

## Feature Summary

P7 introduces structured short-term (session-scoped) memory and automated advice summarization. It enables the reading agent to recall prior turns in a multi-turn thread and writes a compact memory patch after each completed reading, including an extracted `last_advice_summary`.

**Files changed/added:**
- `memory.ts` — Session memory store (schema, in-memory impl, merge helpers)
- `memory-advice.ts` — Advice text extraction from reading output
- `tools/session-memory.ts` — `get_session_memory` and `write_session_memory` tool definitions
- `graph.ts` — Two new nodes (`getSessionMemoryNode`, `writeSessionMemoryNode`), one new conditional edge, integration helpers
- `reading-agent-core.ts` — New `get_session_memory` action type, decider rule and pattern
- `__tests__/memory-advice.spec.ts` — 5 tests covering extraction, fallback, and integration

---

## Findings

### P1 — extractLastAdviceSummary accepts unused parameters

**File:** `memory-advice.ts`, lines 15–23, 63–73
**Severity:** P1 (high)

The `ExtractLastAdviceSummaryInput` interface defines `topic` and `cards` fields:

```ts
export interface ExtractLastAdviceSummaryInput {
  reading: StructuredReading;
  topic?: string;
  cards?: Array<{ id: string; name?: string; orientation?: CardOrientation }>;
}
```

The implementation `extractLastAdviceSummary` destructures only `reading` and never uses `topic` or `cards`. The caller `buildLastAdviceSummary` in `graph.ts` (line 313–323) passes both, so this is dead parameter plumbing — 8 lines of argument construction that have zero effect on output.

**Why it matters:** The interface suggests card/topic-aware advice selection exists but it doesn't. Someone reading the interface will assume those parameters matter. If a future refactor adds branching logic based on them, existing callers silently produce different results.

**Recommendation:** Either implement the intended card/topic-aware logic (e.g., select guidance items whose position aligns with the card context), or remove the unused fields from the interface and the call site. The second option is safer for now given the test suite validates the current behavior.

---

### P2 — ExtractLastAdviceSummary called with cards/topics it ignores

**File:** `graph.ts`, lines 313–323
**Severity:** P2 (medium — consequence of P1)

```ts
export function buildLastAdviceSummary(reading: StructuredReading) {
  return extractLastAdviceSummary({
    reading,
    topic: reading.question_type,
    cards: reading.cards.map((card) => ({
      id: card.card_id,
      name: card.name,
      orientation: card.orientation,
    })),
  }) ?? GENERIC_LAST_ADVICE_FALLBACK;
}
```

The `topic` and `cards` arguments are computed but never consumed. This is waste, but not a functional bug because the fallback path still works.

**Recommendation:** Resolve together with P1.

---

### P3 — No sanitization guard in buildSessionMemoryPatch (defense-in-depth)

**File:** `graph.ts`, lines 334–347
**Severity:** P3 (low)

```ts
summary: normalizeMemoryText(
  `主题：${reading.themes.join("、")}；建议：${lastAdviceSummary}`,
  180,
),
// ...
open_questions: reading.follow_up_questions.map((item) =>
  normalizeMemoryText(item, 96),
),
```

The `StructuredReading` is validated upstream by `structuredReadingSchema.parse()` in `buildStructuredReadingNode` (schemas.ts lines 67, 70), which enforces `themes: z.array(z.string().min(1)).min(2)` and `follow_up_questions: z.array(z.string().min(1)).max(3)`. So empty themes arrays and empty follow-up question strings are impossible in practice.

However, `buildSessionMemoryPatch` is a standalone utility that takes a `StructuredReading` by type annotation — it doesn't re-validate. If it were ever called with a non-validated reading (e.g., from a future caller that skips the graph node), it would silently produce a malformed memory patch.

**Recommendation:** Document the validation dependency, or add lightweight guards (`.filter(Boolean)` on `open_questions`, fallback text for empty themes) as defense-in-depth.

---

### P2 — THREAD_MEMORY_FOLLOWUP_PATTERN has overly broad `should i` match

**File:** `reading-agent-core.ts`, lines 71–72
**Severity:** P2 (medium)

```ts
const THREAD_MEMORY_FOLLOWUP_PATTERN =
  /^(那|那么|所以|刚才|上次|上一轮|继续|如果这样|这样的话)|上一轮|上次|刚才|前面|之前|接着|马上|立刻|投简历|要不要|是不是应该|should i/i;
```

The `should i` pattern with `case-insensitive` flag matches strings like "I should inform my partner" or "Why should I wait". This is a false positive risk for English-language questions. However, the subsequent check `!hasMemoryObservation` prevents repeated memory reads, so the impact is limited to one unnecessary `get_session_memory` call per thread session — not catastrophic, but wasteful.

**Recommendation:** Anchor or contextualize the English patterns. For example, restrict to sentence-start: `/(?:^(?:should i)|...)/i`, or add word boundaries.

---

### P3 — No test for mergeStrings / mergeCards merge semantics

**File:** `memory.ts`, lines 36–59
**Severity:** P3 (low)

`mergeStrings` deduplicates with `Set`, `mergeCards` merges by `card.id:card.orientation` key with spread precedence. Both are untested directly — they're only exercised through the `memory_advice_extraction_prefers_reading_output` integration test which hits the write path.

**Recommendation:** Add unit tests for:
- Duplicate topics deduplication
- Card merge with partial updates (name + orientation)
- Card merge with conflicting orientation keys
- Merge when existing memory is null (upsert creates fresh)

---

### P3 — No test for get_session_memory returning null

**File:** `tools/session-memory.ts`, lines 52–57
**Severity:** P3 (low)

When `store.get(threadId)` returns `null` (no prior memory in store), the tool returns `{ memory: null }`. The graph node handles this correctly (line 893–899), but there's no direct test verifying the null path.

**Recommendation:** Add a test that calls `get_session_memory` on a threadId with no prior writes, and asserts `memory: null`.

---

### P3 — Skipped get_session_memory (no threadId) produces no audit entry

**File:** `graph.ts`, lines 846–869
**Severity:** P3 (low)

When `threadId` is missing, `getSessionMemoryNode` creates a synthesized observation but skips the tool executor entirely. No `ToolCallAuditEntry` is produced for this path, so the trace won't show that `get_session_memory` was considered but skipped.

This is an intentional design choice — no tool was invoked, so no audit entry — but it creates an asymmetry: the trace has a `get_session_memory` agent action but no corresponding tool call.

**Recommendation:** Either add a "skipped" audit entry or document this asymmetry explicitly.

---

### P3 — In-memory store resets on server restart

**File:** `memory.ts`, line 102
**Severity:** P3 (low — architectural choice, not a bug)

```ts
export const defaultSessionMemoryStore = createInMemorySessionMemoryStore();
```

The store is a `Map` and loses all data on process restart. This is fine for P7's "short-term" scope but worth noting as a limitation. The `SessionMemoryStore` interface allows swapping in a Supabase-backed store later.

---

### P3 — No change detection on write: always writes even if unchanged

**File:** `graph.ts`, lines 1109–1140
**Severity:** P3 (low)

`writeSessionMemoryNode` always calls `write_session_memory` after every completed reading, regardless of whether the memory changed. For `initial → final` flows, this writes twice (once after initial reading, once after final). The second write may have identical `last_advice_summary`. Not a correctness issue, but wasteful for audit log volume.

**Recommendation:** Consider comparing the patch against existing memory before writing, or document that every completed reading produces a write.

---

## What's Well Done

**Type architecture is consistent.** The `SessionMemory` type in `@aethertarot/shared-types` maps cleanly to the Zod schema in `memory.ts`. Tool input/output schemas are explicit and validated through the executor.

**Graph integration is clean.** The two new nodes follow the established pattern: conditional edge from `agent_decider`, loop-back edge from `get_session_memory` to `agent_decider`, linear post-generation write. The node is properly registered in the tool registry (four tools total now).

**Advice extraction is deterministic and safe.** No LLM calls in the extraction path — pure text processing. The sentence-boundary extraction avoids leaking full reading text into the compact summary. The `normalizeAdviceText` function enforces a hard character cap at every stage.

**Fallback chain is robust.** `extractGuidanceSummary` → `extractFirstSentence(synthesis)` → `GENERIC_LAST_ADVICE_FALLBACK`. Every path produces something reasonable.

**Session memory is scoped and merge-safe.** The `upsert` function uses union semantics for topics, cards, and constraints. Individual fields like `summary` and `last_advice_summary` are overwritten (not merged), which is correct — they represent the latest reading.

**Test integration test verifies end-to-end flow.** `memory_advice_extraction_prefers_reading_output` runs the full graph with a custom provider and store, asserting the written memory and the trace isolation. The trace non-leak check (`JSON.stringify(result.trace)` not containing advice text) is a good security pattern.

**Security posture is appropriate.** `get_session_memory` requires `"session"` permission (not public). The `session_capsule` sanitization (in `safety.ts`) removes high-risk content before it enters memory scope. Memory is thread-scoped — no cross-thread leakage.

---

## Test Coverage Gap Analysis

| Area | Covered? | Notes |
|------|----------|-------|
| `extractLastAdviceSummary` with guidance | Yes | Test 1 |
| Fallback to synthesis | Yes | Test 2 |
| Undefined on unusable text | Yes | Test 3 |
| Generic fallback | Yes | Test 4 |
| Full graph → store write | Yes | Test 5 |
| `mergeStrings` dedup | No | |
| `mergeCards` merge semantics | No | |
| `get_session_memory` null return | No | |
| `write_session_memory` upsert merge | No | Implicitly via test 5 |
| English text sentence extraction | No | SENTENCE_BOUNDARY_PATTERN may not match English period |
| `normalizeAdviceText` truncation (>120 chars) | No | Implicitly via tests 1–3 at under-limit lengths |

---

## Verdict

**P7 is functionally complete and architecturally sound.** The session memory pipeline is correctly wired into the graph, the tool system, and the agent decider. The advice extraction is a simple deterministic pipeline with reasonable fallback behavior. No blocking issues were found.

The P1 finding (unused parameters in `extractLastAdviceSummary`) should be resolved before shipping — either implement the intended logic or remove the dead code. The remaining P2 findings (unused parameter plumbing in `buildLastAdviceSummary`, overly broad `should i` followup pattern) are edge cases with limited production impact. The P3 findings are documentation/tooling polish.
