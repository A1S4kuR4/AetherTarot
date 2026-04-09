# DESIGN.md — AetherTarot

## 1. Visual Theme & Atmosphere

AetherTarot is not a fortune-telling dashboard and not a neon “mystic app.”
It should feel like a **quiet reflective studio for symbolic reading**:
part editorial essay, part ritual theater, part personal notebook.

The emotional center is:
- calm, inward, trustworthy
- warm rather than cold
- mystical without becoming kitsch
- structured without feeling bureaucratic
- cinematic only at key moments, not everywhere

This design system uses a **dual-surface language**:

1. **Paper Mode** — for home, question input, reading results, history, encyclopedia  
   A warm parchment-like environment with soft contrast, reading-first typography, generous spacing, and tactile card surfaces.

2. **Midnight Mode** — for ritual, shuffle, reveal, transitions, and focused choice moments  
   A dark atmospheric stage where interface chrome recedes and the cards become the visual center.

The product should feel like:
- a thoughtful companion, not an oracle machine
- a well-designed reading journal, not a game lobby
- a modern symbolic tool, not a fake occult simulator

### Core mood keywords
- editorial
- contemplative
- warm parchment
- midnight ceremony
- precise structure
- symbolic restraint
- cinematic reveal
- readable depth

---

## 2. Color Palette & Roles

### Primary Brand Colors
- **Aether Ink** (`#181713`)  
  Main text on light surfaces. Warm near-black, never pure black.
- **Aether Paper** (`#F5F2E8`)  
  Primary page background for reading-oriented pages.
- **Terracotta Flame** (`#C96442`)  
  Primary call-to-action, key emphasis, selected interactive state.
- **Night Veil** (`#0B0D12`)  
  Primary dark background for ritual/reveal pages.
- **Moon Indigo** (`#7170FF`)  
  Secondary accent for progress, focus, active steps, and subtle magical energy.
  Use sparingly.

### Surface Colors
- **Paper Raised** (`#FBF8F1`)  
  Elevated cards on light pages.
- **Paper Border** (`#E6E0D4`)  
  Default border on light surfaces.
- **Paper Muted** (`#ECE7DB`)  
  Subtle sections, chips, soft dividers.
- **Midnight Panel** (`#12151D`)  
  Panels over dark backgrounds.
- **Midnight Elevated** (`#1A1E28`)  
  Hovered/raised dark containers.
- **Midnight Border** (`rgba(255,255,255,0.08)`)  
  Standard border in dark mode.
- **Midnight Border Subtle** (`rgba(255,255,255,0.05)`)  
  Quiet structure in dark mode.

### Text Colors
- **Text Strong** (`#181713`)  
  Primary text on light surfaces.
- **Text Body** (`#35322C`)  
  Standard paragraph text.
- **Text Muted** (`#6E685D`)  
  Secondary metadata, helper copy.
- **Text Inverse** (`#F4F6F8`)  
  Primary text on dark surfaces.
- **Text Inverse Muted** (`#A7AFBC`)  
  Secondary text on dark surfaces.
- **Text Accent** (`#A24E33`)  
  Warm emphasis in editorial contexts.

### Semantic Colors
- **Success Moss** (`#58734F`)  
  Gentle confirmation, completion, saved state.
- **Warning Amber** (`#A36A1F`)  
  Caution, edge-case messaging, sensitive reading note.
- **Safety Rose Clay** (`#B86A5B`)  
  Safety note highlight; softer than error red.
- **Error Ember** (`#B4432C`)  
  Only for actual system or form errors.
- **Info Mist** (`#DCE3F7`)  
  Soft informational tint on light surfaces.
- **Focus Halo** (`rgba(113,112,255,0.28)`)  
  Keyboard focus ring and selected-state glow.

### Usage Rules
- Terracotta Flame is the emotional brand accent.
- Moon Indigo is the structural/interactive accent.
- Do not use both accents at equal intensity in the same small component.
- On reading pages, prefer terracotta.
- On ritual/reveal pages, prefer indigo for progress and terracotta for decisive actions.
- Avoid bright gold, neon purple, saturated cyan, or “fantasy game” palettes.

---

## 3. Typography Rules

### Typography Philosophy
Typography carries trust.
Reading content must feel composed, literary, and deeply legible.
UI chrome must feel modern and precise.
Chinese text support is mandatory.

### Font Families

#### Heading / Longform Serif
Use for major page titles, reading section headings, selected pull quotes, ritual headlines.

Preferred stack:
`"Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", ui-serif, serif`

English fallback:
`"Fraunces", "Iowan Old Style", "Georgia", serif`

#### Primary UI Sans
Use for buttons, navigation, labels, chips, controls, metadata, cards.

Preferred stack:
`"Inter", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif`

#### Monospace
Use for IDs, structured debug info, schema snippets, timestamps in developer contexts only.

Preferred stack:
`"Berkeley Mono", "SFMono-Regular", "JetBrains Mono", ui-monospace, monospace`

### Hierarchy

#### Display 1
- Size: 48–64px desktop, 32–40px mobile
- Weight: 600 serif or 650 display serif equivalent
- Line-height: 1.08–1.18
- Letter-spacing: -0.02em to -0.04em
- Use: home hero, reveal heading, major editorial section openers

#### Display 2
- Size: 36–44px desktop, 28–34px mobile
- Weight: 600 serif
- Line-height: 1.10–1.20
- Use: reading page headline, encyclopedia article title

#### H1
- Size: 28–32px
- Weight: 600 serif
- Line-height: 1.18–1.26

#### H2
- Size: 22–26px
- Weight: 600 serif or 590 sans when more structured
- Line-height: 1.22–1.30

#### H3
- Size: 18–20px
- Weight: 590 sans or 600 serif
- Line-height: 1.28–1.34

#### Body Large
- Size: 17–18px
- Weight: 400
- Line-height: 1.75–1.90
- Use: main interpretation paragraphs

#### Body
- Size: 15–16px
- Weight: 400
- Line-height: 1.70–1.85
- Use: default reading copy and encyclopedia content

#### UI Label
- Size: 13–14px
- Weight: 510 equivalent
- Line-height: 1.35–1.50
- Use: navigation, chips, cards, section labels

#### Micro Label
- Size: 11–12px
- Weight: 510
- Letter-spacing: 0.03em–0.08em
- Optional uppercase for dark-mode structural labels only

### Typographic Rules
- Long reading text should never be center-aligned.
- Serif is for meaning and atmosphere, not for dense control surfaces.
- Sans is for navigation, structure, and speed.
- Avoid very long paragraphs; prefer visible section rhythm.
- For Chinese content, prioritize line-height and paragraph spacing over aggressive tracking tricks.
- Use tighter tracking only on large English display text, not on dense Chinese body text.

---

## 4. Component Stylings

### 4.1 Buttons

#### Primary Button
Use for “开始抽牌”, “生成解读”, “查看完整解读”, and other decisive actions.
- Background: `#C96442`
- Text: `#FFF9F5`
- Radius: 12px
- Padding: 12px 18px
- Border: none or `1px solid rgba(0,0,0,0.04)`
- Hover: slightly darker fill, subtle lift
- Focus: warm ring or indigo halo depending on page mode
- Tone: grounded, confident, human

#### Secondary Button
Use for safe alternatives, preview, back, save, replay.
- Light mode: `#FBF8F1` background, `#181713` text, `1px solid #E6E0D4`
- Dark mode: translucent panel background, `#F4F6F8` text, `1px solid rgba(255,255,255,0.08)`
- Radius: 12px

#### Ghost Button
Use for toolbar or contextual actions.
- Background: transparent
- Border: subtle
- Hover: tinted background only
- Never the loudest CTA in the row

#### Ritual CTA
Use on midnight pages only.
- Background: `linear-gradient(180deg, rgba(113,112,255,0.16), rgba(113,112,255,0.10))`
- Border: `1px solid rgba(113,112,255,0.28)`
- Text: `#F4F6F8`
- Radius: 14px
- Should feel luminous, not neon

---

### 4.2 Inputs

#### Question Textarea
This is one of the most important surfaces in the product.
It should feel safe, spacious, and reflective.
- Light mode background: `#FBF8F1`
- Border: `1px solid #E6E0D4`
- Radius: 16px
- Padding: 16px 18px
- Text: `#181713`
- Placeholder: `#8A8377`
- Focus: paper remains stable; border deepens slightly; ring appears softly
- Height: generous by default

#### Search Input
For encyclopedia/history.
- Quiet, clean, slightly document-like
- Never overly glossy
- Add icon but keep it understated

#### Selectors / Spread Picker
- Prefer card-radio or pill selection, not default browser dropdown feel
- Selected state may use terracotta tint on light pages and indigo tint on dark pages

---

### 4.3 Cards & Containers

#### Reading Section Card
Use for “问题聚焦 / 牌阵结构 / 综合解读 / 可执行建议 / safety note”.
- Background: `#FBF8F1`
- Border: `1px solid #E6E0D4`
- Radius: 20px
- Padding: 20–28px
- Shadow: extremely soft, mostly ring-like
- Heading often serif, body always highly readable

#### Dark Ritual Panel
Use for shuffle stage, step panels, reveal overlays.
- Background: `rgba(255,255,255,0.03)` or `#12151D`
- Border: `1px solid rgba(255,255,255,0.08)`
- Radius: 18px
- Shadow: low, cool, diffused
- Purpose: hold controls without stealing attention from cards

#### Encyclopedia Card
Use for card list/grid and wiki previews.
- Light surface with image/illustration region on top
- Structure should favor scanning
- Include subtle taxonomy cues:
  - Arcana type
  - suit
  - keywords
  - orientation-aware metadata if needed

#### History Entry Card
Use for saved readings.
- Emphasize date, spread, question excerpt, and primary takeaway
- The question should read like a journal prompt, not a technical record
- Hover should suggest “reopen memory,” not “open database row”

---

### 4.4 Tarot Card Presentation

This is the product’s visual centerpiece.

#### Card Frame
- Ratio: preserve authentic tarot proportions
- Radius: 16px–22px depending on size
- Border: warm light frame on paper pages, cool subtle edge on midnight pages
- Surface: allow detailed illustration to dominate
- Avoid loud ornamental chrome around the card

#### Card Back
- Elegant, symbolic, restrained
- Symmetry is encouraged
- Metallic, gold-foil, or overly ornate fantasy styling is discouraged unless intentionally minimalized

#### Card Stack / Spread Layout
- Cards should have enough breathing room to read as symbolic objects
- Overlap can be used slightly during ritual, but final reveal should prioritize clarity
- Reversed cards must be visually obvious but not comedic

#### Reveal State
- Motion should feel ceremonial:
  - pause
  - turn
  - settle
  - then interpretation
- Do not use slot-machine, casino, or arcade motion language

---

### 4.5 Navigation

#### Global Navigation
- Minimal, quiet, trustworthy
- Desktop: horizontal nav with restrained spacing
- Mobile: sheet/drawer with clear hierarchy
- Use sans labels at 13–14px
- Home / Reading / History / Encyclopedia should be easy to scan

#### Step Navigation
For `question -> ritual -> reveal -> reading`
- Borrow precision from productivity software, but soften the emotional tone
- Use compact step pills or progress dots
- Active step can use Moon Indigo
- Completed step may use muted moss or softened terracotta
- Never use childish wizard-step styling

---

### 4.6 Badges, Chips, and Labels

Use for:
- spread type
- suit
- arcana
- safety category
- saved state
- interpretation facets

Rules:
- Rounded pills, not sharp tags
- Light mode chips: warm neutral backgrounds
- Dark mode chips: translucent panels with subtle borders
- Accent chips should be rare
- Metadata should support scanning, not become decorative clutter

---

### 4.7 Safety & Boundary Messaging

Safety notes are product-critical.
They must feel calm, credible, and distinct from generic error alerts.

#### Safety Note Block
- Background: warm rose-clay tint or amber parchment tint
- Border: slightly stronger than default card border
- Iconography: optional, subtle
- Tone: grounded, non-alarmist, direct
- Typography: sans heading + readable body
- Never stylize as mystical warning sigil

---

## 5. Layout Principles

### General Structure
- Prefer strong vertical rhythm and readable width over dense dashboard composition
- Longform reading content should sit in a centered column
- Ritual/reveal pages may expand wider for drama
- Encyclopedia/listing pages can use multi-column responsive grids

### Width Strategy
- Reading text column: ~680–760px ideal
- Mixed media reading layout: up to 1100–1200px
- Ritual/reveal stage: can stretch wider, but content still needs compositional center
- Avoid overly narrow mobile text blocks caused by excessive nesting

### Spacing Scale
Base spacing rhythm:
- 4
- 8
- 12
- 16
- 20
- 24
- 32
- 40
- 48
- 64

Use spacing generously between major interpretation sections.
The product should breathe.

### Page Rhythm by Route

#### Home / Ask
- calm hero
- central question input
- spread selection
- supportive microcopy
- low clutter

#### Ritual
- dark immersive field
- very few controls
- card action centered
- supporting text fades behind the action

#### Reveal
- hero moment for the spread
- card imagery first, labels second
- the interface should step back

#### Reading
- return to paper-mode readability
- clear sectional anatomy
- scannable structure for replay

#### History
- journal/library feeling
- filters and search should be lightweight

#### Encyclopedia
- blend of library and visual archive
- card browsing should feel inviting, not academic-only

---

## 6. Depth & Elevation

### Light Mode Depth
Use subtle rings and paper-shadow rather than modern glassmorphism.
Preferred shadows:
- `0 0 0 1px rgba(0,0,0,0.03)`
- `0 8px 24px rgba(24,23,19,0.05)`
- `0 2px 6px rgba(24,23,19,0.04)`

The goal is tactile containment, not visible “drop shadow design.”

### Dark Mode Depth
Use translucency, edge contrast, and restrained glow.
Preferred depth cues:
- `0 0 0 1px rgba(255,255,255,0.06)`
- `0 12px 32px rgba(0,0,0,0.28)`
- soft indigo halo only on selected/active/focus states

### Elevation Rules
- Most surfaces should differ by border and tone before shadow
- Do not stack multiple dramatic effects
- Glow is reserved for ritual emphasis, selection, and focus
- Reading pages should feel materially grounded; ritual pages may feel slightly atmospheric

---

## 7. Motion & Interaction Behavior

Motion is essential, but it must be emotionally aligned.

### Motion Characteristics
- smooth
- quiet
- intentional
- ceremonial
- no bounce-heavy toy feel

### Recommended Timing
- hover transitions: 120–180ms
- standard UI transitions: 180–240ms
- card reveal / stage transitions: 280–500ms
- major page entrance: 300–450ms

### Motion Rules
- Use fade + slight lift for cards and content sections
- Use opacity + blur reduction for ritual emergence
- Use rotate/flip with restraint for card reveal
- Avoid springy overshoot on serious reading content
- Avoid constant ambient movement that competes with interpretation

---

## 8. Do’s and Don’ts

### Do
- make the product feel literary, trustworthy, and reflective
- keep longform interpretation highly readable
- use dark mode selectively for ritual intensity
- let tarot cards be the visual hero
- separate symbolic atmosphere from actual safety messaging
- preserve structural clarity in every reading result
- treat history like a personal archive, not analytics
- use accent colors sparingly and meaningfully

### Don’t
- don’t turn the product into a neon occult game
- don’t use crystal-ball clichés, zodiac overload, or generic “mystic app” visuals
- don’t make every surface dark just to look premium
- don’t sacrifice reading clarity for atmosphere
- don’t over-ornament cards with decorative frames or fake gold UI
- don’t use harsh red for non-error content
- don’t make safety notes feel dramatic or supernatural
- don’t let the UI look like a productivity dashboard with tarot pasted on top

---

## 9. Responsive Behavior

### Mobile Principles
- Prioritize question input, primary CTA, and card visuals
- Keep text blocks comfortably padded
- Avoid tiny chips and compressed metadata rows
- Preserve card legibility above all

### Breakpoint Guidance
- **Mobile (< 768px)**  
  Single-column layouts dominate.  
  Reading sections stack.  
  Card spreads may switch to scrollable or staged reveal layouts.

- **Tablet (768px – 1024px)**  
  Two-zone layouts become possible.  
  Reading + card summary can coexist.  
  Encyclopedia grid expands carefully.

- **Desktop (1024px+)**  
  Full editorial layouts, side summaries, wide ritual stage, richer hover states.

### Mobile-Specific Notes
- Button height should remain generous
- Touch targets: minimum 44px
- Stepper should simplify into concise progress labeling
- Large spread layouts must degrade gracefully
- Long readings should include clear sectional anchors or sticky mini-nav when appropriate

---

## 10. Page-Specific Guidance

### Home
- warm editorial hero
- one strong question field
- one clear primary action
- supporting copy should reduce pressure, not hype prediction

### Ritual
- fullscreen or near-fullscreen midnight environment
- visible UI chrome reduced by 30–50%
- cards, gesture, and progression dominate

### Reveal
- strongest cinematic moment in the whole product
- large cards, restrained metadata, delayed explanatory copy
- let the moment land before analysis begins

### Reading
- paper-mode by default
- sectioned anatomy:
  - question
  - spread overview
  - card positions
  - synthesis
  - advice / reflection
  - safety note
- keep schema structure visually legible

### History
- emphasize memory and revisitation
- previews should be meaningful without opening the full reading
- sorting/filtering UI should be quiet and utilitarian

### Encyclopedia
- visual archive + deep reading hybrid
- browsing first, dense reference second
- card pages should feel authored, not database-generated

---

## 11. Agent Prompt Guide

### One-line Identity
Build AetherTarot as a **warm editorial tarot reflection product** with **paper-like reading surfaces**, **precise dark ritual flows**, and **cinematic card reveal moments**.

### Primary Style Mix
- 40% warm editorial calm
- 25% reading-first document clarity
- 20% dark precision for flow states
- 15% cinematic reveal atmosphere

### When generating UI
Always ask:
1. Is this page for reflection or for ritual?
2. Should the interface lead, or should the card/art lead?
3. Is readability still excellent after the atmospheric styling?
4. Does the layout support structured replay of a reading?
5. Does this feel trustworthy rather than theatrical?

### Route-Level Prompt Shortcuts

#### Home / Ask
“Use warm parchment surfaces, serif hero typography, soft bordered cards, and a centered reflective question composer.”

#### Ritual
“Switch to midnight mode with minimal chrome, subtle indigo focus states, large centered tarot cards, and restrained cinematic motion.”

#### Reveal
“Create a ceremonial card reveal scene with the cards as the focal point, sparse supporting UI, and strong visual hierarchy before analysis.”

#### Reading
“Return to paper-mode editorial readability with structured interpretation sections, serif headings, longform-friendly spacing, and soft tactile cards.”

#### History
“Design a calm journal archive with warm list cards, subtle metadata chips, strong scanability, and low visual noise.”

#### Encyclopedia
“Blend visual browsing and library-like reading with inviting card previews, warm neutral surfaces, and deeply readable article layouts.”

### Hard Guardrails for Agents
- Do not use neon magic aesthetics.
- Do not use glassmorphism as the main visual language.
- Do not make every page equally dramatic.
- Do not make the interface feel like a generic AI SaaS dashboard.
- Do not reduce interpretation pages to dense boxed widgets.
- Do not use more than two accent colors in a single screen.
- Do not let atmosphere weaken trust or comprehension.

### Success Criteria
A successful AetherTarot UI should make users feel:
- safe to ask
- willing to reflect
- impressed during reveal
- comfortable while reading
- able to revisit and understand their past readings