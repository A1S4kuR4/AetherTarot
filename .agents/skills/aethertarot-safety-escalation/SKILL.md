---
name: aethertarot-safety-escalation
description: Handle AetherTarot safety escalation, output restriction, and reality-based referral for high-risk readings. Use when Codex is changing crisis handling, self-harm or violence responses, health or legal or financial boundary logic, manipulation or abuse-related guidance, `safety_note` generation, or future human-review interruption paths. Do not use for routine tarot tone tuning, ordinary reading synthesis work, or generic human-in-the-loop tutorials. This skill only serves high-risk output control in `apps/web/src/server/reading/safety.ts`, the reading contract, safety docs, and the structured output schema.
---

# AetherTarot Safety Escalation

Escalate risk before you optimize fluency.

## Required Reads

Read these files before changing safety behavior:

1. `docs/20-domain/reading-contract.md`
2. `docs/30-agent/output-schema.md`
3. `docs/40-architecture/architecture.md`
4. `docs/50-safety/safety-principles.md`
5. `docs/60-evals/rubrics.md`
6. `apps/web/src/server/reading/safety.ts`
7. `apps/web/src/server/reading/service.ts`
8. `packages/shared-types/src/index.ts`

## Safety Position

Treat safety as explicit service-layer control, not as prompt flavor. Preserve the current Dual-Tier rule:

1. run intent friction before provider generation
2. return `403 safety_intercept` for Tier 1 hard-stop cases
3. generate a structured reading draft for pass-through and Tier 2 cases
4. inject `sober_check` and `presentation_mode = "sober_anchor"` for Tier 2 decision-outsourcing cases
5. run post-generation safety review for ordinary sensitive topics
6. add `safety_note` and tighten output when needed
7. validate the final structured payload

Do not rely on prompt wording alone to hold the boundary.

## Escalation Ladder

Use a stricter response mode as risk increases:

| Level | Typical cases | Expected behavior |
| --- | --- | --- |
| Standard reflection | ordinary relationship, career, self-growth questions | return normal structured reading |
| Bounded-risk reading | ordinary health, legal, financial, or coercive relationship signals that do not trigger hard stop | add explicit `safety_note`; narrow guidance and follow-up toward reality checks and boundaries |
| Sober Check | major decision outsourcing, such as divorce, resignation, litigation, or investment decisions | return `200` with `sober_check`; front-end must require a written reality reflection before revealing the reading |
| Hard Stop | self-harm, immediate danger, urgent health risk, or manipulation/control attempts | return `403 safety_intercept` before provider generation; do not produce a tarot reading |
| Human review path | future reviewer workflow or cases requiring external escalation | pause before irreversible output or persistence, or return the safest limited response if no reviewer exists |

## Output Restriction Rules

When a bounded-risk reading proceeds:

- populate `safety_note` explicitly
- shrink `reflective_guidance` and `follow_up_questions` toward safety, boundaries, and professional support
- keep `confidence_note` honest about uncertainty
- remove or soften any line that reads as prediction, diagnosis, instruction, or permission

For Tier 2 decision outsourcing, populate `sober_check` and keep the reading framed as reflection rather than instruction.

For Tier 1 hard stops, do not generate or return a `StructuredReading`; return the structured error payload that the route maps to `403`.

## Topic-Specific Rules

### Self-harm or immediate danger

- prioritize emergency or trusted-person support
- hard-stop before provider generation
- avoid deepening mystical interpretation before basic safety is addressed
- do not output language that romanticizes despair or frames harm as fate

### Manipulation, stalking, revenge, coercion, abuse

- refuse to help control, test, track, or retaliate against another person
- hard-stop when the user is asking for monitoring, control, retaliation, or manipulation
- redirect toward the user's own safety, boundaries, and support options
- do not claim certainty about a third party's hidden intent

### Health

- allow emotional support and reflective framing
- do not diagnose, predict outcomes, or advise against treatment
- point the user back to qualified medical support for symptoms, pregnancy, medication, or disease concerns

### Legal and financial

- allow decision framing and risk reflection
- do not replace professional advice or give deterministic action calls
- encourage reality-based fact gathering before major decisions

## Future Human-Review Rules

If you later introduce LangGraph interrupts or reviewer approval:

- interrupt before irreversible side effects or persistence writes
- keep any pre-interrupt side effects idempotent
- resume with the same thread identity
- avoid storing unnecessary sensitive details until the escalation path is clear

Use human review to strengthen safety control, not to bypass the documented contract.

## Change Workflow

When you touch safety escalation:

1. name the risk category and escalation level
2. specify whether it returns `403`, `200 + sober_check`, or `200 + safety_note`
3. specify how `safety_note` changes when the reading still proceeds
4. specify how guidance and follow-up are restricted
5. decide whether ordinary tarot interpretation still appears, and how much
6. update `docs/20-domain/reading-contract.md`, `docs/50-safety/safety-principles.md`, and `docs/60-evals/rubrics.md`
7. add or revise an ADR if the boundary changes materially

## Boundaries

Do not:

- turn tarot language into deterministic prediction
- leave safety warnings implicit or UI-only
- encourage surveillance, coercion, revenge, or emotional control
- substitute for medical, legal, financial, or crisis professionals
- preserve pleasant tone at the expense of clear limits

## Done Criteria

Before finishing, verify:

1. Tier 1 hard-stop paths still return `403 safety_intercept` before generation.
2. Tier 2 decision-outsourcing paths still return `200` with `sober_check`.
3. `safety_note` appears whenever a bounded-risk reading proceeds.
4. Guidance and follow-up become narrower as risk rises.
5. The output never authorizes manipulation, diagnosis, or certainty claims.
6. Docs and eval expectations match the implemented escalation behavior.
