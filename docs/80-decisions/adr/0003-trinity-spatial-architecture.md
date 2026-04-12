# ADR 0003: Trinity Spatial Architecture

## Status
Accepted

## Context
As AetherTarot evolved from a simple tool into an immersive reading experience, the homepage (`/`) became overloaded with conflicting intents: narrative introduction (discovery), ritual setup (action), and history review (reflection). 

During the "Spring Redesign" phase (`memory/work-log-2026-04-11.md`), we identified that a monolithic long-scroll home view was perceived as "stiff" and failed to provide the necessary psychological transitions between different stages of the user journey. Power users felt the narrative was in their way, while new users were overwhelmed by seeing the complex ritual form before understanding the product's reflective depth.

## Decision
We are adopting the **Trinity Spatial Architecture**—a tripartite division of the application's core functions into distinct physical and psychological spaces.

### 1. The Narrative Hub (`/`)
- **Intent**: Brand discovery, education, and interest calibration.
- **Interaction**: Implements **Snap Scrolling** (CSS `scroll-snap-type`) to create a "digital book" feel. Each section (Intro, Symbolism, Mindset) occupies exactly one viewport.
- **Terminal State**: The scrolling ends at a "Bifurcation Gate"—a visual fork allowing the user to choose their next destination based on their current intent.

### 2. The Ritual Sanctuary (`/new`)
- **Intent**: High-focus task execution (setting up and starting a reading).
- **Mode**: Forced **Midnight Mode** (Dark Surface). The UI transition from light (narrative) to dark (ritual) creates a "liminal space" effect that anchors the user's attention.
- **Payload**: Standalone `RitualInitializer` component.

### 3. The Consciousness Archive (`/journey`)
- **Intent**: Long-term reflection and retrospective analysis.
- **Mode**: Default **Paper Mode** (Light Surface).
- **Payload**: Dedicated `JourneyView`. New users without history see an evocative empty state with a call to action to start their first reading.

## Consequences
### Positive
- **Clear Intent Separation**: Users are never confused about "what to do here."
- **Reduced Cognitive Load**: No longer forced to ignore the ritual form while reading the intro.
- **Enhanced Immersion**: The Midnight Mode for `/new` creates a distinct "sacred space" for the actual reading setup.
- **Simplified Maintenance**: Each route has a single responsibility, making CSS and state management cleaner.

### Negative
- **Increased Inter-page Navigation**: Users must click to transition from discovery to action (though mitigated by the final gate on the home page).
- **Routing Dependency**: The `AppShell` must now manage global mode switching based on more complex route patterns.
- **State Hydration**: Requires stable `ReadingContext` hydration to prevent layout shifts when detecting existing history for the bifurcation gate on the index page.
