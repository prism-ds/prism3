## (2026-11-26) — Motion phase 3: Figma animation styles, bound to the preset variables (#2857)

Phase 1 (#4597) published the presets as TIMING and EASING variables, and phase 2 (#4601) named which presets each motion
pattern plays on. Phase 3 writes the patterns into Figma as **animation styles**, so a designer applies "dialog/enter/panel"
to a layer and it plays the brand's timing. The decisions are #2857's: Q-MS1 A (styles bind preset variables, never
primitives), Q-PT17–Q-PT22 A, and the 2026-11-24 app check (an entry's props can't be edited once added; `Position` is the
move).

### What it writes

- **The plan (`figma-animation-styles.ts`, pure).** For every pattern the brand resolved, a style per moving element where
  the pattern moves several, and one style where it moves one. Each entry names the preset's published variables:
  `<root>/motion/preset/<name>[/exit]/{duration,easing,delay}`.
  - **The reduced sibling** plays each track as its reduced kind says: `keep` on the preset's `duration-reduced`, `fade` as
    an opacity entry on it, `off` not at all. A sibling with no entry is not written.
  - **A distance** is written as the px its token resolves to (8 for `distance.nudge`). There is no motion distance
    variable in Figma yet (#4589). A self-sized slide writes none.
  - **Names** follow the pattern names, lowercase like every Prism3 style (`dialog/enter/panel`, `toast/enter/reduced`),
    with hover and press under `state/` (Q-PT19 A).
  - **Descriptions** say what moves, in plain words that name no token (Q-PT21 A), from the same clause builder as the
    components' motion prose, with a `plain` flag that leaves that prose byte-identical.
- **The executor (`apps/plugin/src/write-animation-styles.ts`).** It runs in Apply Theme's `motion` stage, after the preset
  variables exist, so the panel still counts seven stages.
  - **Replace, never edit.** A style is found by name, and keeps its id and key, so every layer using it keeps it. Its
    entries are removed and the plan's added, because an entry's props can't change once added.
  - A host without the API (an older Figma, the paste harness) skips the styles and says so.
- **The style guide (Q-PT22 A).** An "Animation styles" table:
  - one row per style, its reduced sibling's words in the same row;
  - a card playing the style as the specimen;
  - a row for each style-guide-only pattern.

  Studio lists the table kind.

### Waiting on JOB 102 (the Mac check), each in one place

- **The TIMING unit:** `FIGMA_TIMING_UNIT` in `emit-figma-dims.ts`, `'s'` as phase 1 wrote it.
- **The entry kinds' Figma names and their props:** `FIGMA_ENTRY_KINDS` and `FIGMA_ENTRY_PROPS` in
  `write-animation-styles.ts`. The delay and a self-sized slide's direction write nothing until the check names their
  props.
- **Whether a style can carry a fill color:** `ANIMATION_STYLE_SWITCHES.colorEntries`, false for now. Hover and press are
  style-guide rows only, and so is the switch's and the segmented control's reduced cue, which is their color.
- **Whether "X/enter" and "X/enter/reduced" coexist in the picker:** `ANIMATION_STYLE_SWITCHES.reducedName`, the folder
  form for now.

### Held for the owner (on #2857)

- **The grain:** a Figma animation style plays on the one layer it is applied to, so as built a multi-element pattern is a
  style per element (`ANIMATION_STYLE_SWITCHES.grain`).
- **The style names' casing.**
- **The drafted descriptions.**
- **The table's copy.**

### Checked

- `test-write-animation-styles.ts` (21, the floor) drives the real executor against a shim of the host:
  - every one of the 59 expected styles is written, and nothing else;
  - every pattern has a style and a reduced style, but the typed style-guide-only ones;
  - every entry binds a duration and an easing, both published preset variables, none hidden;
  - a second apply keeps every style's id and key, and replaces every entry;
  - a re-pointed preset writes the same bindings.
- `test.ts` holds every example brand's plan to the variables its own emitted Figma `motion.json` publishes.
- **Mutations, each failing by name:**

  | Mutation | Fails |
  |---|---|
  | one style dropped | `missing: toast/exit/reduced` |
  | the easing bound to the hidden `motion/easing/standard` | `no entry binds a hidden primitive` |
  | entries edited, not replaced | `a second apply replaces every entry …` |
  | the style guide without the reduced sibling | `… carries its reduced sibling's words in the same row` |

**Trap.** An animation style has no idea of child layers: every entry plays on the node the style is applied to. A
pattern's own grouping (scrim, panel, content) can't live in one style, which is why the grain is a switch, not a
detail.
