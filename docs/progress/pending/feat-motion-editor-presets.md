## (2026-11-27) — Motion editor PR 2: the Motion tab and its preset editor (#4571)

The second of the motion editor's build PRs (`docs/superpowers/motion-editor-proposal.md` §5), on the owner's decisions on
#4571 (all A). Studio's Depth & motion page splits into two tabs, Depth and Motion (Q-ME3 A), and Motion gains a Presets
section: one row per preset, with pickers for its duration, easing and delay.

### What it adds

- **The split (Q-ME3 A).** `depth` keeps Elevation and Shadow tint. The new `motion` tab takes tempo, easing per role and
  the motion preview (curves, durations, springs, the preset traces), moved whole with their copy. Depth's Continue goes
  to Motion, and Motion's to Layout. Every place-keyed list in the chrome and smoke suites gains `motion`.
- **Presets (`domains/motion.ts`).** One row per preset in the engine's order. Each slot's button shows its token and the
  value it resolves to in the mode in view (`duration.moderate · 300ms`).
  - The pickers list everything the engine accepts (Q-ME1 A), read from PR 1's `presetSlotTargets` and
    `durationTargetsFor`: roles, then curves, then springs, each curve drawn. A spring easing offers only its settle time.
  - "follows ‹role›" or "fixed" (§2.1 behavior 1). An arriving preset's Exit disclosure says it follows the entrance
    until set (behavior 2).
  - **Advisories, never blocks (Q-ME1 A).** `presetAdvisories` (engine, codes only) names the two cases the owner gave: an
    exit as long as its entrance or longer, and a delay. The row shows a warning line and keeps the edit.
  - **Brand-wide.** Previewing any mode but Light, every preset picker is disabled under one line (§4.1).
- **The writes (`state/motion-input.ts`).** One slot at a time, into `motionPersonality.presets.<preset>[.exit].<slot>`. The
  spring rule is kept in the write: picking a spring clears the duration, and leaving a spring clears its settle time, so
  the module never makes a write the engine would refuse. A reset prunes back to the loaded bytes.
- **The lever.** `motionPersonality.presets` joins `levers.ts` (copy DRAFT). It was planned for PR 1. `test-pages.ts` fails
  a lever with no Studio home, so it moved here, where it has one.

### The tradeoffs

- **Only the owner's two advisories.** The motion skill has more rules a preset could break (R2, the role against the half;
  R6, slow chrome). Which to warn on was put to the owner as a question. This PR wires the two the decision names, and
  the codes extend without a UI change.
- **One D9 arm retired with the shared page.** "An Elevation edit plays nothing" held that a shadow edit didn't replay
  the traces when both lived in one preview. They no longer share one, so the arm went with the page.
- **Depth's focus floor.** Depth now holds four focusable controls, so V1's focus floor is 4 there and 10 everywhere else.

### Verified

- `test-motion-input.ts` (8 arms, `#4571`): each write at its path, the exit under `.exit`, the spring rule, and a reset
  byte-identical to the loaded brand.
- Chrome section `4571`: the rows, the pickers' contents, each write read back from the persisted brand, the advisory,
  the spring rule, Reset, and Dark held read-only, then the chrome probe with a preset picker open.
