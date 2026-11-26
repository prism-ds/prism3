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
  - **Names** (Q-PT20, as revised by the owner on 2026-11-26). Every pattern is a folder holding its `default` and
    `reduced` styles, with nothing loose beside it: "Dialog / enter / default" and "Dialog / enter / reduced", the
    component capitalized, hover and press under "State /" (Q-PT19 A). With this build's grain, each element of a
    pattern that moves several is a folder inside the pattern's ("Dialog / enter / panel / default").
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

### Settled by the 2026-11-26 checks on #2857

- **The entry kinds.** Figma offers exactly seven: `Position`, `Scale`, `Rotation`, `Size`, `Opacity`, `Path` and
  `TextStagger`. `FIGMA_ENTRY_KINDS` maps opacity to Opacity, scale to Scale, a slide and a travel to Position, a turn to
  Rotation and a size to Size. Each animation's own property list is read from the host, and a property it lacks is a
  named miss, never written blind.
- **No fill color.** No kind animates a fill (Fill, Color, Paint and Effect are refused). So a color track has no entry,
  and hover and press are style-guide rows only (Q-PT18 A's condition, not met). So is the switch's and the segmented
  control's reduced cue, which is their color.
- **TIMING is in seconds.** A frame whose style binds a TIMING variable of 0.24 plays in about a quarter of a second, so
  every TIMING value is ms ÷ 1000. The existing variables already were, from phase 1 on: 295 across the example brands,
  and 487 in the committed `out/figma` of all five. `test.ts` now holds each to its DTCG milliseconds.
- **Not yet named, so never written silently** (the review's finding 3 on #4608): the property a preset's **delay** binds
  under, a slide's **edge**, and a **self-sized slide's** own height. Until #2857 names them, the executor records each
  value it can't write as a named miss in its report ("Dialog / bottom / enter / panel / default: the edge it slides from
  (bottom) is not written yet, because Figma's property for it is not named (#2857)"). It also stamps the list on the
  style itself, so the style guide's row says what the style doesn't carry, and Apply Theme's summary names the first
  three. A delay of 0 (every default preset's) plays the same unwritten, so only a non-zero one is a miss: the plan
  carries each preset's resolved delay.
- **Reduced styles for the five indicator elements** (owner, 2026-11-26 on #4608): the accordion indicator, the tabs
  underline, the switch thumb and the segmented pill get no reduced style, since reduced motion turns them off. Their
  style guide row says what reduced motion does ("The indicator doesn't turn.").
- **AS-1 = A** (owner, 2026-11-26 on #4608): the element level only where a pattern moves more than one element.

### Held for the owner (on #2857)

- **The drafted descriptions.**
- **The style guide's new strings.**

### Checked

- `test-write-animation-styles.ts` (30, the floor) drives the real executor against a shim of the host:
  - every one of the 59 expected styles is written, by its folder name, and nothing loose beside a folder;
  - the shim's host offers Figma's seven animations, typed from the check, and a property an animation does not list is a
    named miss;
  - every pattern has a style and a reduced style, but the typed style-guide-only ones;
  - every entry binds a duration and an easing, both published preset variables, none hidden;
  - a second apply keeps every style's id and key, and replaces every entry;
  - a re-pointed preset writes the same bindings.
- `test.ts` holds every example brand's plan to the variables its own emitted Figma `motion.json` publishes, and every
  TIMING variable to its DTCG milliseconds ÷ 1000.
- **Mutations, each failing by name:**

  | Mutation | Fails |
  |---|---|
  | one style dropped | `missing: toast/exit/reduced` |
  | the easing bound to the hidden `motion/easing/standard` | `no entry binds a hidden primitive` |
  | entries edited, not replaced | `a second apply replaces every entry …` |
  | the style guide without the reduced sibling | `… carries its reduced sibling's words in the same row` |
  | opacity mapped to a kind Figma doesn't offer (`Fade`) | `Dialog / enter / panel / default fades (Opacity) and scales up …` |
  | the `default` leaf dropped from a name | `every style sits in its pattern's folder as default or reduced …` |
  | TIMING written in ms | `#2857 phase 3: every TIMING variable … is its duration in seconds` |
  | a slide's edge dropped with no miss | `no entry's edge, own-size distance or delay is dropped without a miss (silent: Toast / enter / default)` |
  | a non-zero delay dropped with no miss | `a brand that delays the surface preset … gets a named delay miss on every style that plays on surface …` |

**Trap.** An animation style has no idea of child layers: every entry plays on the node the style is applied to. A
pattern's own grouping (scrim, panel, content) can't live in one style, which is why the grain is a switch, not a
detail.
