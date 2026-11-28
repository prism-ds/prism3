## (2026-11-28) — Motion editor PR 3: the motion stage and the plays-the-data gate (#4571)

The third of the motion editor's build PRs (`docs/superpowers/motion-editor-proposal.md` §5, §3.1 and §3.2), on the
owner's decisions on #4571 (all A). Motion's preview gains a **Stage**: the chosen preset playing on a component
motion that names it, over a small page in the brand's colors, with a timeline of its tracks.

### What it adds

- **`patternPlayback` (engine, `motion-editor.ts`).** For each track of a pattern, in a mode: its preset half's
  duration (the mode's tempo applied), its easing as CSS (a role followed to the mode's curve, or a spring's `linear()`),
  its delay, and a slide's distance in px. Exported through `@prism3/engine`.
- **The stage (`preview/sections/motion-stage.ts`).**
  - **Choosing what plays.** A Preset select, then a "Used by" chip per pattern that names the preset (both halves). A
    preset no pattern names (reveal, draw, step, settle) plays on a plain specimen (§3.1).
  - **Playing.** One element per element the pattern moves, painted in the brand's roles for the mode. Play sets each
    element to its start, then writes the transition the data gives and the end state.
  - **The timeline (§3.2).** One bar per track, its length the duration, offset by its delay.
  - It plays once after a Motion edit, with the traces, and never by itself under reduced motion (D9 A). The choice
    and Slow motion are view state.
- **The plays-the-data gate (`test:chrome` section `4571-play`).** It covers every preset, on every pattern that names
  it and on the four specimens. Each moving element's computed transition (property, duration, timing function, delay)
  must equal what its track's preset resolves to in the committed `out/prism3.tokens.json`. Which tracks a pattern has
  comes from the committed `out/prism3.ai.json`. Neither source is the preview's helper, so a timing typed into the stage
  fails by the pattern and track it plays.

### The tradeoffs

- **Stand-ins, not the components.** The proposal asks for Studio's own rendered components. The stage draws
  brand-colored blocks in their places (scrim, panel, toast, tooltip, popover, the in-place parts), which play the same
  data and read at the preview's width. Swapping in the components is a follow-up, and their shapes are DRAFT for the
  owner.
- **Specimens are DRAFT.** The proposal leaves each specimen's look to the owner: a square that fades and rises for
  reveal and settle, a line drawn on for draw, a card that advances for step.
- **A spring is compared as CSS can play it.** A spring-eased preset plays its `linear()` curve. No preset in the
  committed brand is spring-eased, so the gate's spring comparison runs only on a brand that sets one.

### Verified

- Mutation, committed first: the content element's duration typed as 250ms in the stage → `#4571 plays the data: …
  dialog/enter content.opacity plays 250ms, the emission's motion.preset.fade.duration is 200ms`.
