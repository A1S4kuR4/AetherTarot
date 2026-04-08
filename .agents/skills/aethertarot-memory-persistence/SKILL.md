---
name: aethertarot-memory-persistence
description: Design and change AetherTarot's session capsule, history summary, and long-term memory boundaries. Use when Codex is implementing or revising `session_capsule`, history replay semantics, memory merge rules, thread or session persistence, or user-profile retention for readings. Do not use for generic database work, unrelated localStorage cleanup, or broad LangGraph persistence tutorials. This skill only serves memory and persistence tasks tied to `docs/30-agent/context-strategy.md`, `apps/web/src/context/ReadingContext.tsx`, `apps/web/src/server/reading/`, and the shared reading schema.
---

# AetherTarot Memory Persistence

Persist understanding, not raw clutter.

## Required Reads

Read these files before changing memory or persistence behavior:

1. `docs/30-agent/context-strategy.md`
2. `docs/30-agent/output-schema.md`
3. `docs/40-architecture/architecture.md`
4. `docs/50-safety/safety-principles.md`
5. `docs/60-evals/rubrics.md`
6. `packages/shared-types/src/index.ts`
7. `apps/web/src/server/reading/service.ts`
8. `apps/web/src/context/ReadingContext.tsx`

## Memory Layers

Keep these layers separate:

| Layer | Purpose | Current reality |
| --- | --- | --- |
| Current task state | Serve this reading only | request + canonical context + structured reading |
| Local history replay | Let the user reopen prior structured readings | `ReadingHistoryEntry[]` in `ReadingContext.tsx` via `localStorage` |
| Session capsule | Carry forward only the most useful summary from a prior exchange | schema field exists, currently `null` |
| Long-term memory | Retain stable preferences or repeat patterns across sessions | not yet implemented |

Do not collapse these layers into one "memory" bucket.

## Capsule Rules

When introducing or updating `session_capsule`, keep it compact and decision-useful. A good capsule preserves:

- the user's core question in normalized form
- the spread used
- the 2-4 most valuable themes or conclusions
- user feedback that changes later interpretation
- what should carry into the next turn
- what should be dropped as transient emotional noise

Do not store the whole chat transcript in `session_capsule`.

## Long-Term Memory Rules

Write to long-term memory only when the information is stable and useful across sessions, such as:

- language preference
- tone or style preference
- recurring topic categories
- user-authorized background facts

Do not write by default:

- acute emotional spikes
- self-harm or crisis details
- unverified claims about third parties
- time-sensitive event details that will quickly go stale

Promote information from capsule to long-term memory only after repeat evidence or explicit user authorization.

## Read and Write Policy

Use this order when deciding what to inject:

1. current question and current spread
2. current-round background the user just gave
3. session capsule summary
4. long-term preference memory

Keep memory additive to understanding, not dominant over the present reading. If memory conflicts with the current user message, trust the current message first.

## Persistence Design Rules

- Keep `reading_id` as a reading artifact identifier. Do not reuse it as a user identifier or thread identifier.
- Keep thread or session persistence scoped to one conversation or one reading thread.
- Keep long-term memory scoped to the user, not to a single reading record.
- Preserve replayability: a stored reading must still be renderable from the public structured payload and saved draw metadata.
- Change `session_capsule` shape carefully. It is currently `string | null`; if you want a richer object, update shared types, schema validation, docs, and consumers together.
- Keep local history replay separate from future server-side persistence. Do not force the front-end history cache to become the canonical memory system.

## LangGraph Adaptation Rules

If you borrow LangGraph persistence concepts:

- map short-term checkpointing to a thread-scoped reading session
- map store-backed memory to explicitly approved long-term user memory
- keep thread identity and user identity separate
- inject summaries, not raw checkpoint history, into downstream reading generation

Do not copy generic checkpointer examples into AetherTarot without first naming the product-level boundary they implement.

## Change Workflow

When you touch persistence or memory:

1. State which memory layer is changing.
2. Define what is allowed to be written there.
3. Define when it is read back into a future reading.
4. Define merge, overwrite, or eviction behavior.
5. Update `docs/30-agent/context-strategy.md` and `docs/40-architecture/architecture.md`.
6. Re-check `docs/30-agent/output-schema.md` and `ReadingContext.tsx` if replay or payload shape changes.

## Boundaries

Do not:

- persist raw multi-turn transcripts by default
- let memory override the current spread or current question
- write high-risk safety incidents into durable preference memory
- blur local history replay with long-term personalization
- introduce persistence behavior that consumers cannot inspect or replay from structured data

## Done Criteria

Before finishing, verify:

1. The changed memory layer has a clear write rule and read rule.
2. `session_capsule` semantics are documented if they changed.
3. Local history replay still works from saved `ReadingHistoryEntry`.
4. Long-term memory, if added, is bounded to stable user-approved data.
5. The final design still prioritizes current question, safety limits, and schema stability.
