# Memory Persistence Roadmap

- `last_updated`: `2026-04-26`
- `owner`: `Codex`
- `scope`: P2 implementation readiness for continuity, thread/session persistence, and long-term memory

## 1. Purpose

This document turns `ADR-0004 Memory and Persistence Boundaries` into an implementation-ready roadmap. It does not approve service-side persistence by itself.

The goal is to define the order of future work so AetherTarot can improve continuity without blurring:

- completed reading replay
- `session_capsule` continuity
- future thread/session persistence
- future long-term user memory
- future memory merge

## 2. Current Baseline

Current implemented behavior:

- `StructuredReading.session_capsule` is `string | null`.
- Only completed readings generate a non-null capsule.
- Standard/Sober initial readings do not enter history and keep `session_capsule = null`.
- Lite completed initial readings and Standard/Sober final readings enter local history.
- `ReadingHistoryEntry[]` lives in localStorage and is a replay cache.
- A prior capsule is sent to `POST /api/reading` only when the user explicitly chooses a continuity source.
- The service sanitizes incoming `prior_session_capsule` before provider injection.

Current non-goals:

- no service-side history persistence
- no `thread_id`
- no `session_id`
- no `user_id`
- no long-term user profile
- no memory merge
- no LangGraph checkpointing
- no raw transcript persistence

## 3. Phase Plan

### P2.0 Boundary Foundation

Status: completed.

Artifacts:

- `docs/80-decisions/adr/0004-memory-and-persistence-boundaries.md`
- `docs/30-agent/context-strategy.md`
- `docs/40-architecture/architecture.md`
- `docs/30-agent/output-schema.md`
- `docs/60-evals/rubrics.md`

Completion standard:

- All persistence layers are named separately.
- `reading_id` is explicitly not a thread/session/user id.
- `session_capsule` remains `string | null`.
- Future persistence remains paused until identity and tests are designed.

### P2.1 Capsule Contract Hardening

Status: completed for the current `string | null` capsule baseline.

Scope:

- Keep `session_capsule` as `string | null`.
- Strengthen tests around capsule generation, redaction, and injection priority.
- Do not add service-side storage.

Allowed changes:

- Add focused tests for completed capsule format and maximum length.
- Add focused tests that Standard/Sober initial readings keep `session_capsule = null`.
- Add focused tests that high-risk details, raw follow-up answers, and third-party intent claims do not survive into completed capsule.
- Add focused tests that incoming capsules cannot override current question, spread, drawn cards, safety tier, or current phase.

Not allowed:

- changing `StructuredReading.session_capsule` shape
- adding `thread_id`, `session_id`, or `user_id`
- persisting server-side history
- using local history as implicit memory

Suggested verification:

- `npm run test:contract -w @aethertarot/web -- src/server/reading/__tests__/graph.contract.spec.ts`
- `npm run test:contract -w @aethertarot/web -- src/server/reading/__tests__/semantic-fixtures.spec.ts`
- selected Playwright history replay / continuity smoke if front-end flow changes

Current verification baseline:

- Graph contract tests cover capsule section format, maximum length, identity-field absence, timing, incoming capsule sanitization, hard-stop priority, final raw follow-up redaction, and unsafe provider guidance redaction.
- Semantic fixtures cover compactness, safe capsule content, current-question priority, and realistic high-risk prior detail redaction.

### P2.2 Thread / Session RFC

Status: draft completed.

Trigger:

- User-visible need to resume a multi-reading line across devices or browser sessions.
- P1/P2 validation shows local history is too fragile for the intended product experience.

Required decisions before implementation:

| Decision | Required answer |
| --- | --- |
| Identity | Is the first server-side identity `thread_id`, `session_id`, or both? |
| Scope | Does it represent one reading line, one browser session, or one user conversation? |
| Write rule | Which completed readings, summaries, and metadata are stored? |
| Read rule | When is thread/session context injected into a new reading? |
| Redaction | Which fields are removed before storage and before injection? |
| Replay | Can the reading still render from `StructuredReading` plus draw metadata? |
| Deletion | How can the user clear or abandon the thread/session? |

RFC artifact:

- `docs/30-agent/thread-session-rfc.md`

Recommended first design:

- `thread_id` should represent one user-selected reading line.
- `session_id` should remain paused unless the product needs short-lived in-progress flow recovery.
- Neither should imply `user_id`.
- Thread storage should keep completed reading references and compact summaries, not raw transcript by default.
- Provider injection should use a thread summary, not checkpoint history.

Not allowed:

- adding LangGraph checkpointing as the product memory model
- storing raw messages by default
- auto-linking unrelated local history into one thread
- treating a thread as a user profile

### P2.3 Long-Term User Memory RFC

Status: design only.

Trigger:

- User accounts or explicit user-level persistence become part of the product plan.
- There is a concrete UX need for stable preferences or recurring pattern reminders.

Allowed memory candidates:

- language preference
- tone/style preference
- user-authorized stable background
- repeated high-level topic categories
- user-approved recurring reflection themes

Disallowed by default:

- self-harm, harm-to-others, crisis, abuse, or urgent health details
- acute emotional spikes
- unverified third-party motives or intentions
- time-sensitive event details
- raw follow-up answers
- raw transcript excerpts

Promotion rule:

- A capsule detail may become long-term memory only after repeat evidence or explicit user authorization.
- Long-term memory must remain lower priority than current question, current spread, current cards, and safety.

Required controls:

- user-visible memory review or deletion path
- source attribution from the reading or user confirmation that created the memory
- redaction before write and before read
- tests proving memory cannot change safety tier or card/spread authority

### P2.4 Memory Merge Design

Status: backlog.

Do not implement merge until long-term memory exists and has deletion/review controls.

Required merge behavior:

- Merge must be explicit and inspectable.
- New memory cannot silently overwrite user-confirmed memory.
- Conflicting memories must preserve provenance or require user confirmation.
- High-risk details must be discarded or quarantined before merge.
- Eviction rules must exist before automatic accumulation starts.

Suggested merge categories:

| Category | Merge behavior |
| --- | --- |
| Language / tone preference | overwrite only after explicit user change |
| Recurring topic category | aggregate counts or recency, not raw details |
| Stable background | require user confirmation |
| High-risk safety detail | do not store as long-term memory |
| Third-party claim | do not store unless reframed as user's stated concern |

## 4. Identity Rules

Future identity fields must stay separate:

| Field | Meaning | Must not mean |
| --- | --- | --- |
| `reading_id` | One generated reading artifact | thread, session, or user |
| `thread_id` | One user-selected reading line | user profile |
| `session_id` | One short-lived interaction session | durable memory |
| `user_id` | One authenticated user boundary | reading artifact |

No identity field should be added to the public reading contract until its storage, deletion, and test rules are defined.

## 5. Test Matrix

Any future persistence implementation must add tests in the lowest practical layer.

| Risk | Preferred test layer |
| --- | --- |
| initial readings accidentally persisted | graph / contract |
| completed capsule missing or too long | graph / contract |
| capsule leaks raw follow-up answers | semantic fixture |
| incoming capsule overrides current question | semantic fixture |
| incoming capsule bypasses safety intercept | contract / safety test |
| history replay no longer reconstructs cards | Playwright smoke |
| thread summary injects raw transcript | unit / semantic fixture |
| long-term memory changes safety tier | safety regression |
| user memory overrides spread/card authority | graph / semantic fixture |

## 6. Backlog Gates

The following remain paused until their gate is met:

| Backlog item | Gate |
| --- | --- |
| Service-side history persistence | Thread/session RFC accepted |
| `thread_id` in request/response | Identity and deletion policy accepted |
| `user_id` / accounts | Product/account boundary accepted |
| Long-term user memory | User authorization and review/deletion UX accepted |
| Memory merge | Long-term memory schema and deletion controls accepted |
| LangGraph checkpointing | Product-level checkpoint purpose accepted |

## 7. Next Recommended Step

The next P2 step should be design-only unless there is a concrete product need for cross-device or server-side continuity.

Recommended order:

1. Observe the current local continuity behavior with the hardened capsule contract.
2. If continuity remains too shallow, draft P2.2 Thread / Session RFC.
3. Keep long-term user memory and memory merge paused until a user authorization and deletion model exists.
