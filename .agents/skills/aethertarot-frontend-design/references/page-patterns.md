# AetherTarot Page Patterns

Per-route design facts along the user journey `/ → /new → /ritual/draw → /reveal → /reading`, plus the quick-draw overlay. Each entry gives: role · surface · composition · content hierarchy · primary actions · mobile degradation · visual semantics to preserve · prototype scaffolding to avoid.

Production anchors: home = `components/home/HomeView.tsx` + `home/sections/` + `PaginationDots.tsx`; new = `components/new-reading/`; quick draw = `components/home/QuickDrawOverlay.tsx`; ritual = `components/ritual/RitualView.tsx` + `ritual-layout.ts`; reveal = `components/reveal/RevealView.tsx` + `.module.css`; reading = `components/reading/InterpretationView.tsx` + `reading/interpretation/`.

---

## `/` — Home

- **Role:** calm narrative hub; establishes intent before handing off to `/new`. No question composer here.
- **Surface:** Paper.
- **Composition:** four full-viewport chapters (`CHAPTER I` intro → `II` symbolic knowledge → `III` reflective mindset → `IV` final gate), each `min-height: calc(100dvh - 4rem)` and vertically centered, inside a snap scroll container. Chapter skeleton: mono chapter numeral → serif chapter title → asymmetric two-column grid (reading body `max-w-44rem` + right margin-note aside). Grid ratios: `2.2fr / 1fr` for chapters I–III, `1.6fr / 1.1fr` (~60/40) for the final gate's dual entries.
- **Content hierarchy:** mono numeral (terracotta, ls 0.2em) → serif title → justified serif body (drop cap on openers) → margin note (terracotta left rule, serif italic + mono header).
- **Primary actions:** chapter IV dual gate — "开启崭新仪式" (primary outline→fill button to `/new`) vs "回溯过往旅程" (quiet underlined link to `/journey`). The visual gap between the two entries is intentional: starting a reading and revisiting history must not compete. A floating mobile CTA pill ("进入仪式场域") appears only while `activeSection < 3`.
- **Desktop contract:** at `≥1024px × ≥860px` the workspace locks to `calc(100dvh - 4rem)` with mandatory-y snap and JS wheel-hijack (one section per gesture, 700ms wheel lock, 100ms when reduced-motion). `PaginationDots` (fixed right, 4 dots, active = terracotta + halo ring, hover label bubble) is driven by `IntersectionObserver` (threshold 0.5, `-64px` root margin); sections carry `data-index`.
- **Mobile degradation:** below the lock threshold → natural page scrolling with 64px topbar compensation; two-column grids collapse to a single column; dots hidden below `lg`.
- **Preserve:** four-chapter full-screen narrative; mono numeral + serif title + margin-note skeleton; dual-entry hierarchy in the final gate; outline→fill button language.
- **Do not copy from prototype:** fixed mock card ("IX · 隐士") and canned interpretation in the demo modal; route placeholder hrefs; demo scroll-highlight JS; accidental pixel values (dot size, modal width). Production replaced the prototype modal with the real `QuickDrawOverlay`.

## `/new` — Inquiry workspace

- **Role:** focused ritual initializer — question first, configuration second, safety friction always on the path.
- **Surface:** Paper (reserve Midnight for the following ritual; the paper-burn is the bridge out).
- **Composition:** natural page scroll at root; a "desk" folio sheet (`folio-sheet`: paper-raised + hairline + very soft shadow) holding an asymmetric two-column desk: inquiry manuscript (left, `1.25fr`) vs configuration catalogue (right, `1fr`). Desktop ≥960px runs the columns as an **internal scroll region** inside a `calc(100dvh - 4rem)` locked page, with a sticky-bottom scroll-hint fade — production deliberately replaced the prototype's sticky inquiry pane with whole-column internal scrolling.
- **Content hierarchy (left):** mono section mark ("问询") → serif title → borderless textarea with a 2px bottom rule (focus deepens to terracotta) → meta bar (draft status + character count, `aria-live`) → inline feedback strips (repeated-theme notice, decision rephrasing, prompt guidance) → inspiration prompt pool (category pills + refresh + chips). Feedback is inline and non-interrupting.
- **Content hierarchy (right):** three catalogue sections numbered `I. 选择牌阵 / II. 塔罗师风格 / III. 洗牌与抽牌` (mono heads). De-carded catalogue rows: mono index + serif name + description + mini spread line-diagram / profile badge; selected = 3px terracotta left bar + faint terracotta wash. Draw source = segmented control. This list-catalogue idiom (never card grids) is a global pattern for pickers.
- **Primary actions:** binary pair — full-width outline hold-to-confirm "确认问询，进入抽牌" (700ms pointer hold with terracotta progress fill; keyboard/AT immediate) vs underlined "当下之镜" (quick path, not gated on having a question). Desktop renders actions at the foot of the settings column (`margin-top:auto`); below 960px a **fixed bottom action bar** (with `safe-area-inset`) takes over — the two never render together.
- **Gate conditions:** ritual start requires non-empty question + selected spread + not navigating; quick draw only requires not navigating. Major-decision questions must pass the decision-boundary dialog (判定式 vs 启发式 comparison; Escape = return to edit + refocus textarea) — this friction cannot be bypassed by either path.
- **Mobile degradation:** <960px single column, internal-scroll lock released, fixed action bar; <640px catalogues go single-column and category pills scroll horizontally; desktop heights ≤700px fall back to natural page scrolling. Breakpoints here are hand-written 960/640/389px — deliberately not Tailwind's md/lg.
- **Preserve:** manuscript textarea idiom; catalogue (de-carded) selection; binary action hierarchy; dual action-bar instances rule; boundary-dialog flow.
- **Do not copy from prototype:** `PROMPT_POOL` mock copy, localStorage demo draft logic, telemetry mock, decision/major-decision regexes with canned warnings, `alert()` submission, prototype-to-prototype links, the sticky-pane layout (superseded).

## Quick Draw overlay (当下之镜)

- **Role:** a 30-second mirror — draw one card, see its meaning, choose depth or stop. Shared by home intro and `/new`.
- **Surface:** Paper folio over a dimmed veil (`rgba(24,23,19,0.58)` + blur), i.e. a mounted sheet, not a midnight stage.
- **Composition:** desktop folio `min(1120px)` wide × `min(760px, calc(100dvh - 72px))` high, 5px terracotta top edge, deep soft shadow; two columns `0.86fr / 1.14fr` (card vs reading), reading column capped at ~545px measure.
- **State machine is the design:** `entering (600ms) → card-back → flipping (850ms) → revealed`. Before reveal the reading column is **not rendered** (AnimatePresence removal, not the prototype's `opacity:.18` dimming) and layout is single-column centered; the card back invites the turn ("请在安静里停留片刻。" / "点击卡牌，翻开牌面"). The flip is the brand moment: 3D `rotateY(180deg)`, 800ms `cubic-bezier(0.4,0,0.2,1)`, perspective 1500px.
- **Revealed hierarchy (fixed):** `PRESENT STATE` folio number → `THE DRAWN IMAGE` mono label → serif card name → English name → orientation mark (underline; reversed moves the rule above) → ≤4 keywords clamped by hairlines → core paragraph → `ONE SMALL STEP` margin-note action → binary actions: solid terracotta-ink "开启深度解读" (primary) vs underlined "先停在这里".
- **Mobile degradation:** ≤760px the veil becomes a plain full-screen paper scroll container; folio loses frame and shadow (`min-height:100dvh`), card column takes ~54dvh on top, reading below, actions stack.
- **Accessibility contract (production-complete, keep intact):** dialog + focus trap + Escape + scroll lock; focus the close button on open, the card title on reveal, and restore trigger focus on close (350+50ms after exit, `isConnected` guard, `preventScroll`); trigger buttons are explicitly focused on pointer click for Safari/WebKit.
- **Do not copy from prototype:** fixed card/canned interpretation, `?orientation=reversed` demo switch, `alert()` close stub, the `aria-hidden` ambient background page (screenshot scaffolding), dead tokens (`--terracotta-soft`, `--night`), and the 760ms timing (production uses 800ms + standard ease).

## `/ritual/draw` — Ritual

- **Role:** the ceremony — shuffle, draw, and seat cards. Chrome recedes; the altar leads.
- **Surface:** Midnight, locked stage `calc(100dvh - 4rem)` on desktop (≥900px), radial-gradient focus behind the altar.
- **Composition (vertical stack):** plaque → altar → actions → table note. The **plaque** (rectilinear three-segment plate: status dot + "仪式 · RITUAL" kicker | serif spread name | mono `NN / NN` count with `aria-live`) stays above the positions (z-order). The **altar** centers a 22-back card fan (`transform-origin 50% 150px` desktop / 112px mobile) inside an etched ring (radius = origin + 36) with 22 ticks aligned to the fan's resting angles, cardinal ticks elongated, crosshair axes, and a center square. Position slots orbit the fan per spread.
- **Altar geometry is data-driven with two regimes** (`ritual-layout.ts`, spec-asserted):
  - ≤5 positions — **deep arc**: `arcSpan = min(140 + (n-3)·10, 170)`, `baseRadius = 228 + max(0, n-3)·5`, radius grows by `36·cos` toward the arc top to clear the plaque; labels below.
  - ≥6 positions — **shallow arch**: fixed `x` step 120, parabola `y = -280 + 136·normX²`, labels alternate above/below on odd/even indices.
  - Slot size never shrinks with card count.
- **Choreography (frozen production parameters; only the layout geometry in `ritual-layout.ts` is spec-covered):** intro fly-in (50ms stagger, 480ms flight, `[0.16,1,0.3,1]`) → fan settle (12ms stagger, 650ms spring); shuffle gather 400 / split 200 / riffle 420 / refan 650; draw = pop 200ms then a fly-card clone arcs to its slot (1050ms, 3 keyframes, midpoint lifted 84px, proportional frame interpolation; Major Arcana scale 1.16 + terracotta glow). Click-anywhere skips the intro. When the last card seats, the flow auto-completes — the reveal CTA does not rely on the user noticing it.
- **Color roles in action:** indigo = status dot, current slot border/wash, current/drawn indices, note tick; terracotta = draw/reveal CTA, ready state; success moss = done dot.
- **Actions:** shuffle / draw / reveal row; draw is terracotta-outlined, final reveal is solid terracotta-ink — the only filled button on the stage.
- **Accessibility:** only the top deck card is focusable (`tabIndex=0`, `aria-label="从牌堆抽牌"`; the rest `aria-hidden`); positions are an `ol` with `aria-current="step"`; plaque count is the live region; rings and fly clones are `aria-hidden`.
- **Mobile degradation (≤899px):** etched rings **exit entirely** (`display:none`); positions become a centered flex-wrap grid (4 per row at count=4, 56px slots); deck becomes a relative block; stage switches to natural vertical scroll. Production deliberately replaced the prototype's horizontal scroll track with wrapping.
- **Do not copy from prototype:** the `?spread=` review switcher, `Math.random()` draw, `alert()` reveal stub, `drawnCount===1` fake-major demo, and mobile horizontal scrolling. Geometry constants (arcSpan/baseRadius/parabola coefficients) are intentional parameters, not accidents — but change them only with the specs.

## `/reveal` — Reveal

- **Role:** the strongest cinematic moment — the seated spread, fully shown, before analysis begins.
- **Surface:** Midnight (same night tokens as ritual, so draw → reveal reads as one continuous space).
- **Composition:** ≥1024px two columns — altar pane `1.35fr` (night + radial gradient, etched double ring + crosshair + 24 ticks at 15°) and reading folio `minmax(21.25rem, 26.25rem)` (midnight-panel, hairline divider, independently scrollable within `calc(100dvh - 4rem)`). The altar keeps ritual's spatial language so the cards "land" where they were drawn.
- **Spread positions are hand-authored semantic coordinates** (`REVEAL_LAYOUTS`): single `[0,0]`; holy-triangle inverted triangle (present on top); four-aspects 2×2; seven-card baseline row of five + vertical pair at x=110; celtic-cross core + challenge rotated 90° over it (z-boosted) + cross arms + staff column at x=260. Labels go above when `y < 0` or rotated. Unknown spreads fall back to a multi-row grid of up to 5 columns (`getFallbackLayout`).
- **Adaptive strategy:** field bounds = `(maxAbs + cardHalf + 44px label pad) × 2`; the whole track scales down (`min(1, altarWidth/fieldWidth)`, ResizeObserver) instead of reflowing. Card width steps by count (1→8.5rem, 4→6.25rem, 7→5.125rem, 10→4.625rem); at 7/10 cards position labels hide — overlap prevention is a hard constraint.
- **Folio hierarchy:** `揭示 · REVEAL` plaque (success dot, `NN / NN`) → altar note ("牌阵已揭示" + terracotta tick) | folio: `READING FOLIO / 解读卷宗` kicker → spread name → question block (terracotta left rule) → reading path (indigo square + steps + mono tags) → `POSITION MEANINGS` list (mono indigo index + serif position + terracotta card name + muted description; current item takes an indigo left border).
- **Primary actions:** single primary exit "带着整组气候进入深读" (solid terracotta-ink → `/reading`) vs quiet "保存或分享本次牌阵" (Web Share API → clipboard fallback, `aria-live` status). Both available only when cards are seated.
- **Visual semantics:** Major Arcana = terracotta frame + glow; reversed = rotated image + indigo badge; entrance is one staggered settle (0.55s, 80ms stagger), then stillness.
- **Mobile degradation:** <1024px stacks altar over folio (hairline becomes a top border); altar height comes from field height × scale (`--mobile-spread-height`); rings scale 0.56; <640px plaque and paddings tighten.
- **Do not copy from prototype:** `SAMPLE_CARDS` pool + deterministic pseudo-random, the review switcher, dead CTA buttons, canned summary/focus/tag copy (the reading-path content model is real, its demo strings are not), fixed `?spread=` tooling.

## `/reading` — Deep reading

- **Role:** return to Paper — the structured, replayable longform document of the reading.
- **Surface:** Paper. Terracotta is the single lead accent; indigo appears only as reversed-badge semantics; safety notes use their own rose-clay/gold-brown register.
- **Composition:** `max-w-1200px` layout; main flow `max-w-760px` + sticky 300px sidebar (`lg:` and up). Flow is a continuous chapter sequence with ~3.5rem inter-chapter gaps: hero (mono meta + quoted question h1, `text-balance`) → `CHAPTER` spread plate → core message → card-by-card → synthesis → evidence → guidance → follow-up → energy radar → feedback → boundary note → journal notes → footer CTA.
- **Chapter numbering is dynamic:** visible sections are filtered by reading state, then numbered `CHAPTER I..X` in order; sidebar/mobile indices use `01..10`. Never hardcode numerals — anchors and numbering derive from `READING_NAV_ITEMS`.
- **Key sections:** core message opens with a 3rem terracotta drop cap + twin asides ("试着问自己" / "一个小前提"); card-by-card entries are `article` grids (thumbnail 84→132→152px by breakpoint, meta `01 · 位置 · 逆位`, card names link to encyclopedia, keywords in mono terracotta, position note under a dashed rule); **synthesis carries a terracotta left rule marking it the highest-priority reading**; evidence and energy radar are **collapsed by default** with a hint line (long pages don't sprawl open); follow-up has two states (awaiting = form, final = read-only blockquote); feedback is 4 `aria-pressed` labels + optional note + de-identified consent; journal notes save on blur with an `aria-live` status (`saved` / `saved-local`).
- **Reading plate (纸色牌阵图版):** the reveal layout re-rendered on paper-raised with warm radial tint — same semantic coordinates but deliberately wider vertical spacing (seven-card ±176 vs reveal ±140; celtic staff ±264 vs ±168) so labels never collide; decorative rings follow the field bounds (0.72/0.94); the whole field scales down to fit rather than reflowing.
- **Sidebar/mobile nav:** desktop sticky `READING INDEX` (spread used + core excerpt + anchor list, IntersectionObserver `-25%/-60%` highlighting); mobile replaces it with a sticky top horizontal anchor strip.
- **Safety funnel order:** loading (3-stage) → safety intercept → error (retry) → sober check (≥5 chars to unlock) → content. This order and its gates are product behavior — presentation work must not reorder or restyle them into invisibility.
- **Primary actions:** footer "开启新的解读" (resets + home) + quiet share / back-to-journey / back-to-top (reduced-motion aware scroll).
- **Mobile degradation:** single linear column, sidebar hidden, sticky anchor strip; plate and paddings tighten <640px; chapter gaps reduce to ~2.75rem.
- **Do not copy from prototype:** `CARDS`/`MOCK`/`CLOSERS` demo data, seeded shuffle, simulated save/feedback timers, the review spread-switcher, hardcoded `CHAPTER` numerals, inline-style asides, fake continuity lines. Production also changed defaults the prototype didn't have: collapsed evidence/radar, 4-label feedback with consent, real persistence, safety intercept and sober check.

---

## Cross-page continuity rules

- Surface sequence Paper → Paper → Midnight → Midnight → Paper is the journey's dramatic arc; keep transitions legible (the authored burn; otherwise direct navigation).
- The plaque idiom (kicker + serif name + mono count) recurs on ritual and reveal with the same structure and rectilinear language.
- The double-needle color contract (indigo = in-progress, terracotta = decision/done) holds on every route; success moss marks completion.
- Card frames keep 1:1.7 aspect on every route; the proportional radius/padding geometry applies only to the ritual stage (fan, slots, fly clones).
- Spread coordinates are one semantic dataset expressed three times (ritual orbit, reveal altar, reading plate) with intentionally different density — keep them in sync when a spread changes.
