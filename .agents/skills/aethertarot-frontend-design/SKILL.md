---
name: aethertarot-frontend-design
description: Design or modify AetherTarot web frontend surfaces within the Paper/Midnight dual-surface manuscript language. Use for work on apps/web routes (/, /new, /ritual/draw, /reveal, /reading), the quick-draw overlay, tarot spread altar geometry, orientation/arcana visual semantics, ritual motion and its reduced-motion degradation, and cross-route visual continuity. Do not use for reading backend or state-machine work (use aethertarot-reading-state), safety logic (use aethertarot-safety-escalation), generic editorial styling outside AetherTarot (use editorial-manuscript-frontend-design), or any unrelated visual style.
---

# AetherTarot Frontend Design

AetherTarot has one frontend design language with two surfaces: **Paper** (reading-oriented pages: `/`, `/new`, `/reading`, quick draw, history, encyclopedia) and **Midnight** (ritual theater: `/ritual/draw`, `/reveal`). The surface switch is route-level (`AppShell` `MIDNIGHT_ROUTES` + `.paper-surface` / `.midnight-surface`); never leak one surface's panel styling into the other. This skill encodes the design rules that production code, `DESIGN.md`, and the adopted HTML prototypes agree on.

## When this skill applies

- Creating or modifying pages, sections, or components under `apps/web/src/app` and `apps/web/src/components` that are user-facing.
- Judging whether a visual proposal (prototype, review finding, redesign) fits AetherTarot's established language.
- Extracting design rules from new prototypes into production-quality implementation.

Do not use it for: business logic, reading state machines, API design, safety review behavior, copywriting changes, or generic CSS/Tailwind questions unrelated to AetherTarot's visual language.

## Design fact priority

When sources conflict, resolve in this order:

1. `DESIGN.md` plus explicit product, safety, and accessibility boundaries.
2. Current production code in `apps/web` — the behavioral source of truth.
3. The adopted HTML prototypes — the source of visual intent and composition rationale only.
4. Historical task records and superseded prototypes — explain evolution, never override 1–3.

Adopted prototypes (may be git-ignored on other machines; this skill and its references are the durable record): `prototype/home-manuscript-a.html`, `prototype/new-manuscript.html`, `prototype/quick-draw-manuscript.html`, `scratch/ui-prototypes/ritual-draw-celestial-altar.html`, `scratch/ui-prototypes/reveal-manuscript.html`, `scratch/ui-prototypes/reading-manuscript.html`. Superseded files (`*-optimized`, `home-manuscript-b`, `new-manuscript-a`, `quick-draw-script`, `ritual-draw-desk-folio`, `prototype/index.html`) must not be treated as standards.

## Core design invariants

Violating any of these is a design error, not a preference:

1. **Dual surface discipline.** Paper = warm parchment reading surface; Midnight = dark ritual stage. Reading content never sits on midnight panels; ritual chrome never sits on paper.
2. **Color division of labor.** Terracotta carries decisive actions, completion, editorial emphasis, and Major Arcana; indigo carries progress, current position, focus, and reversed-orientation marks. Never both accents at equal intensity in one small component. Text-bearing controls and small colored text use the `*-ink` variants on Paper (WCAG AA).
3. **Three font tracks with fixed roles.** Serif = narrative and meaning; sans = UI chrome; mono = labels, indices, kickers (uppercase, 0.1–0.2em tracking, usually terracotta). Do not swap roles.
4. **Card frame language (layered).** (a) Every tarot frame keeps 1:1.7 aspect (`aspect-[1/1.7]`, `object-cover`) — the one global invariant. (b) Standard-size frames follow `DESIGN.md` corner radius 16–22px depending on size, warm-framed on Paper, cool-edged on Midnight. (c) The ritual stage's compact frames (deck fan, slots, fly-card clones) are an explicit exception: they use proportional geometry (outer radius ≈10%, inner ≈6.67%, padding ≈5% of width) so mid-flight interpolation stays consistent. (d) Reveal and reading-plate frames use their own fixed metrics (e.g. reveal frames use fixed 0.3rem padding) and are not required to match either (b) or (c).
5. **Spread positions are semantic data, not grids.** Each spread has hand-authored relative coordinates (celtic-cross challenge card rotated 90° over the core); unknown spreads fall back to a multi-row grid of up to 5 columns. Reading-page plates reuse reveal coordinates with deliberately wider vertical spacing.
6. **Composition by hierarchy, not containers.** Hairlines, whitespace, typographic scale, and margin notes build hierarchy. Cards appear only where content genuinely needs a boundary (input, saved state, disclosure, error, safety friction). Reject card grids, pill forests, glassmorphism, neon, and dashboard patterns.
7. **Ritual motion is a deliberate production contract.** Choreography timings/easings live in `RitualView.tsx` and are mirrored in the altar prototype; only the altar **geometry** (`ritual-layout.ts`) is covered by specs. Treat timings as frozen current production parameters: change them only as an intentional redesign and update/extend tests accordingly.
8. **Reduced motion is dual-layer.** A CSS blanket collapses durations, and JS switches behavior (scroll behavior `auto`, skipped phases, shortened flights). Both layers must exist for any new animation.
9. **Hold-to-confirm is never the only path.** The 700ms press-hold on the primary `/new` CTA is pointer-only; keyboard and assistive technology activate immediately.
10. **One authored surface transition.** The paper-burn handoff from `/new` to `/ritual/draw` is the single bridge between Paper and Midnight. It is continuity, not a reusable decoration, and must always degrade to direct navigation.
11. **Locked workspaces are desktop-only contracts.** `calc(100dvh - 4rem)` locked viewports (home snap sections, `/new` internal scroll, ritual stage) apply only above their width/height thresholds; mobile and low-height viewports always fall back to natural page scrolling.
12. **Action hierarchy is binary.** One primary action (terracotta outline that fills on hover, or solid terracotta-ink at the highest tier) plus quieter underline/text secondary actions. Never two competing filled CTAs.

## Before editing

1. Identify the surface (Paper or Midnight) and route contract for the page you touch; read its current component and CSS first.
2. Check `DESIGN.md` for the relevant section and confirm the change does not violate it; if the change alters confirmed colors, fonts, spacing, or the dual-surface language, that requires explicit redesign authorization.
3. For spread/altar geometry, read `ritual-layout.ts` (ritual), the `REVEAL_LAYOUTS` coordinates (reveal), and `spreadLayout.ts` (reading plate) — the same semantic layout exists in three places with intentionally different density.
4. For motion, find the existing timing constants and the reduced-motion path before adding or changing any animation.
5. Read [references/design-language.md](references/design-language.md) for token semantics, color roles, typography, structure, motion, and accessibility rules. Read [references/page-patterns.md](references/page-patterns.md) for the specific page's composition, hierarchy, mobile degradation, and prototype scaffolding to avoid copying.

## Behavior boundaries

This skill governs presentation only. While doing frontend design work:

- Preserve navigation paths, state transitions, data loading, safety friction (decision-boundary dialog, sober check, safety notes), and persistence behavior exactly.
- Never copy prototype scaffolding into production: mock data, simulated card pools, fixed questions/interpretations, prototype spread switchers, `alert()` stubs, fake save/feedback states, route placeholders, screenshot-only controllers, or copies of the ReadingContext/state machine.
- Do not fix accidental pixel values from prototypes into rules. Carry over only constraints, ratios, semantics, and responsive invariants that change future decisions.
- Product copy and business behavior changes require explicit user authorization beyond this skill.

## Implement and verify

1. Make the smallest component-local change that preserves behavior and DOM/visual source order.
2. Verify against [references/validation-matrix.md](references/validation-matrix.md): 1440px desktop and 390px mobile, keyboard and focus, reduced motion, all five spreads, upright/reversed, Major Arcana, loading/empty/error/done states, horizontal overflow, and sticky/fixed occlusion.
3. Run the project's targeted tests, typecheck, and lint/build for touched areas. Altar geometry has spec assertions — run them when touching layout math.
4. Manually inspect the built surface; the goal is one edited composition, not assembled widgets.

## Completion check

- The surface is correct (Paper vs Midnight) and consistent with neighboring routes.
- Color roles follow the terracotta/indigo division; `*-ink` variants used for text.
- Desktop asymmetry collapses into a single clean mobile reading column with intact DOM/focus order.
- Motion has both the full choreography and the reduced-motion path.
- All controls work with pointer and keyboard; touch targets ≥44px on Paper pages.
- No prototype scaffolding leaked into production; product behavior is unchanged.
