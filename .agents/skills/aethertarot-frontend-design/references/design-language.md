# AetherTarot Design Language

The durable rules behind the Paper/Midnight dual-surface system. Tokens live in `apps/web/src/app/globals.css` (`@theme`, Tailwind v4); `DESIGN.md` is the governing document. This file explains *why* the rules exist and *when* to apply them — consult the code for exact current values.

Contents: surfaces · color roles · typography · structure & spacing · card frames · allowed/forbidden patterns · motion · accessibility.

---

## 1. Dual surfaces

| | Paper | Midnight |
| --- | --- | --- |
| Routes | `/`, `/new`, `/reading`, quick draw overlay, history, encyclopedia | `/ritual/draw`, `/reveal` |
| Role | calm reflective studio, reading-first | ritual theater; chrome recedes, cards lead |
| Base | `--color-paper #F5F2E8` | `--color-night #0B0D12` |
| Text | ink/body/muted ramp on light | inverse ramp (`#F4F6F8` / `#A7AFBC`) |

- Switching is **route-level**: `AppShell` `MIDNIGHT_ROUTES` (`/ritual`, `/ritual/draw`, `/reveal`) applies `.midnight-surface` vs `.paper-surface`; `app/ritual/layout.tsx` sets `colorScheme: dark`. Ritual and reveal views additionally paint their own night backgrounds (radial gradient `ellipse 70% 60% at 50% 46%`, panel → night) for page-level immersion.
- Paper surface tones form a quiet stack: `paper` (page) → `paper-raised` (elevated sheets, plates) → `paper-muted` (footer, recessed fills), separated by 1px `paper-border` hairlines. Midnight panels use `midnight-panel #12151D` / `midnight-elevated #1A1E28` with `rgba(255,255,255,0.08/0.05)` borders.
- **Why two surfaces:** reading needs warmth and trust; ritual needs the interface to step back so cards become the visual center. The product alternates Paper → Midnight → Paper across the user journey; that alternation is the drama. Making everything dark (or everything paper) destroys it.
- The only sanctioned crossing is the **paper-burn transition** on desktop `/new → /ritual/draw` (digital draws, capable WebGL2 only). It must degrade to direct navigation for reduced-motion, mobile, low-height, snapshot/shader failure, and the offline card-entry path. Never reuse the burn as decoration elsewhere.

## 2. Color roles

### The double-needle: terracotta vs indigo

| Role | Terracotta (`#C96442` family) | Indigo (`#7170FF` family) |
| --- | --- | --- |
| Semantic | decisive action, readiness, completion, editorial emphasis, **Major Arcana** | progress, current position, focus, **reversed orientation** |
| Ritual/reveal | draw/reveal CTAs, ready states, major-card frame + glow | status dot, current slot border/wash, progress ticks, focus outline, reversed badge |
| Paper pages | primary CTA, chapter numbers, kicker labels, margin-note rules, synthesis left-rule | focus halo, reversed badge text (`indigo-ink`) |
| Text-safe variants | `terracotta-ink #A64C2E`, active `#9A4327` | `indigo-ink #4B499F` |

- The base brand hues are decorative tokens; **small text and text-bearing controls on Paper must use the `*-ink` variants** (WCAG AA). White labels sit on `terracotta-ink`/`#9A4327` fills.
- Never use both accents at equal intensity inside one small component. On reading pages terracotta leads; on ritual pages indigo structures and terracotta closes the decision.
- The reversed/major pairing is fixed **visual identification** semantics: Major Arcana cards take a terracotta frame + radial glow; reversed cards take a 180°-rotated image + indigo badge. Do not swap or merge the two encodings. These are recognition cues only — they must not be presented as destiny weight, good/bad valuation, or any deterministic claim, consistent with the product's "thoughtful companion, not an oracle machine" boundary.

### Semantic colors

- Success moss `#58734F` — completion, saved states, done status dots.
- Safety rose clay `#B86A5B` / `safety-ink #8C453A` on `#FDF0ED` — safety notes and boundary reminders. Calm, credible, non-alarmist; never styled as mystical sigils, never error red.
- Error ember `#B4432C` — actual system/form errors only.
- Warning amber `#A36A1F` — caution, edge-case messaging.
- Forbidden palette directions: bright gold, neon purple, saturated cyan, "fantasy game" palettes.

## 3. Typography

Three tracks with fixed roles — swapping them is a design error:

1. **Serif** (Noto Serif SC stack) — narrative, titles, reading body, interpretation, plaque names, editorial buttons. Carries trust and atmosphere.
2. **Sans** (Inter stack) — navigation, controls, chips, compact metadata. Carries speed and precision.
3. **Mono** (Berkeley Mono stack) — **labels and indices**: chapter numbers (`CHAPTER I`), kickers (`PRESENT STATE`, `READING FOLIO`), position indices, counts (tabular-nums), deck hints. Uppercase, letter-spacing 0.1–0.2em, usually terracotta at 11–13px. This mono-kicker voice is the most recognizable signature of the language — but it is a label voice, never body text and never decorative filler.

Rules that matter:

- Reading measure ~680–760px; longform line-height 1.7–1.9 (body), 1.65–1.75 (leads). Reading text is never center-aligned.
- Display serif uses tight tracking (-0.02 to -0.035em) and `text-wrap: balance`; Chinese body copy prioritizes line-height and paragraph spacing over tracking tricks.
- Section rhythm: reading flow separates chapters with ~3.5rem vertical gaps; tight within a semantic group, generous between sections, more space before a heading than after.
- Editorial devices with fixed meanings: **drop cap** (serif ~3rem, terracotta, opens the core message), **terracotta left rule** (synthesis, question block, margin notes, evidence = high-priority reading), **dashed hairline** (editorial marks such as position notes), **margin note** (small serif italic aside with mono header).

## 4. Structure, elevation, spacing

- **Hairlines first.** 1px `paper-border` on Paper; `rgba(255,255,255,0.05–0.10)` on Midnight. Build hierarchy with scale, alignment, measure, and whitespace before any container.
- **Cards are exceptional.** Wrap content in a bounded card only for: interactive input, saved state, disclosure, error/recovery, or safety friction (sober check, safety note). Reading sections default to open editorial flow. Midnight ritual controls sit on quiet `rgba(255,255,255,0.03)`/`#12151D` panels whose styling must not leak into the reading document.
- **Elevation is tactile, not dramatic.** Paper: ring + soft paper shadows (e.g. `0 8px 24px rgba(24,23,19,0.05)`). Midnight: edge contrast + low cool shadow; indigo glow only on selected/active/focus. Never stack effects.
- **Spacing rhythm** uses the 4→64 scale; `--spacing-page-inline/block` and `--spacing-manuscript-section` are fluid `clamp()` tokens — prefer them over ad-hoc values in manuscript workspaces.
- **Midnight chrome is rectilinear.** Plaques, ticks, status squares, and slot frames on the ritual stage are right-angled with hairline strokes — no capsules, no glassmorphism, no glow ornaments beyond the sanctioned focus/major-card halos. (Paper-side chips may keep gentle rounding per `DESIGN.md`.)
- Horizontal page overflow is a defect: `html` clips overflow-x; large spreads use contained internal tracks or scale-down, never body-level horizontal scroll.

## 5. Card frames (the visual centerpiece)

- Aspect **1:1.7** always (`aspect-[1/1.7]`, `object-cover`; runtime assets are 1000×1700 full-bleed PNGs registered in the asset manifest).
- Standard-size frames follow `DESIGN.md` corner radius 16–22px depending on size; warm light frame on Paper, cool subtle edge on Midnight.
- Ritual compact frames are an explicit exception to that radius range: the deck fan, slots, and fly-card clones use proportional geometry (outer radius ≈10%, inner ≈6.67%, padding ≈5% of card width), and the fly-card animates these as percentages so the frame never breaks mid-flight. Reveal and reading-plate frames use their own fixed metrics (e.g. reveal `.cardFrame` uses fixed `0.3rem` padding and no proportional radius) — do not "unify" any of the three layers onto one rule.
- Let the illustration dominate; no ornamental chrome or fake gold around the card.
- Reversed = image rotated 180° + indigo badge; Major = terracotta frame + radial glow. Reveal motion is ceremonial (pause → turn → settle), never slot-machine or arcade.
- Card backs: elegant, symmetrical, restrained.

## 6. Allowed / forbidden

Allowed: continuous paper reading sequences with named chapters; asymmetric spreads (one dominant reading/action area balanced by a smaller note or secondary path); hairline rules; mono kicker labels; margin notes and drop caps used sparingly; contained internal scroll regions with scroll-hint fades; one authored cinematic moment per flow.

Forbidden: card grids of equal tiles, pill forests, dashboard metric blocks, glassmorphism, neon/glow aesthetics, crystal-ball clichés, zodiac overload, decorative gradients, constant ambient motion competing with reading, mono type as a substitute for editorial hierarchy, more than two accent hues per screen, atmosphere that weakens trust or comprehension.

## 7. Motion

Timing bands (from `DESIGN.md` and production):

| Context | Duration | Notes |
| --- | --- | --- |
| hover / micro | 120–180ms | buttons, chips |
| standard UI | 180–240ms | transitions, borders |
| stage / reveal | 280–500ms | section entrances use ~550ms easeOut + small y-lift |
| brand moments | 800ms flip `cubic-bezier(0.4,0,0.2,1)`; draw flight 1050ms | the only "heavy" motion |

- Signature easing: emphasized-out `[0.16,1,0.3,1]` for entrances and the draw flight; ritual springs (stiffness 140–220 / damping 17–22) for fan/shuffle.
- **Ritual choreography parameters**: deck shows 22 visible backs; intro stagger 50ms/flight 480ms, fan stagger 12ms/settle 650ms; shuffle gather 400 / split 200 / riffle 420 / refan 650; draw pop 200 / flight 1050 (200 when reduced). Only the altar **geometry** (`ritual-layout.ts`) is covered by specs; the timings are current production parameters with no dedicated test lock — treat them as frozen unless deliberately redesigning, and add/update tests when they change.
- Draw flight is a 3-keyframe arc (start → midpoint lifted ~84px → slot) with proportional frame interpolation and Major-Arcana scale 1.16 + glow.
- Reveal/reading plates use staggered slot entrances (~0.55–0.7s, 80–90ms stagger), then stillness — those pages are presentation states, not animated stages.
- **Reduced motion is dual-layer everywhere**: CSS blanket (`animation/transition-duration: 0.01ms !important`, iteration 1, `scroll-behavior: auto`) *plus* JS behavior switches (`useReducedMotion` → skip intro phases, 350ms shuffle, 200ms draw, `getPreferredScrollBehavior()` → `auto`, wheel-lock shortened). New animation without both layers is incomplete.
- The 700ms hold-to-confirm progress fill on `/new` is functional feedback culminating in the burn ignition; keyboard/AT activation bypasses it entirely (`click` with `detail === 0` path), and the button carries an sr-only explanation of both paths.

## 8. Accessibility

- Global focus ring: `:focus-visible { outline: 2px solid var(--color-focus-halo); offset 2px }` (indigo halo; Paper pages may use terracotta outlines in local components — match the surrounding code).
- Touch targets ≥44px on Paper pages; primary CTAs are taller (48px+). Midnight stage controls keep generous hit areas (deck card extends its hit zone).
- Overlays/dialogs follow the production contract: `role="dialog"` + `aria-modal`, initial focus inside, Tab trapped within, Escape closes, focus restored to the trigger on close (with `isConnected` guard and `preventScroll`), body scroll locked while open, revealed content focuses its heading (`tabIndex={-1}` + `aria-labelledby`).
- Progress and state changes announce via `aria-live="polite"` on the *narrow* region (e.g. the plaque count, status text) — not whole regions.
- Interactive lists are semantic: spreads/positions use `ol/li` with `aria-current`, option groups use `role="group"` + `aria-pressed`, decorative layers (`rings`, flight clones, ambient pages) are `aria-hidden`.
- Card images carry meaningful alt (`"{position}: {card name}, reversed"`) or empty alt when purely decorative; above-the-fold card images eager/priority, the rest lazy.
- DOM order matches visual order; mobile degradation never reorders content away from focus order.
