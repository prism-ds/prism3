## (2026-11-27) — Motion editor PR 1: the engine read model and the motion-isolation gate (#4571)

The first of the motion editor's build PRs (`docs/superpowers/motion-editor-proposal.md` §5, cleared by the owner's
decisions on #4571, all A). Engine only. Nothing a designer sees changes, and no committed artifact moves.

### What it adds

- **`packages/engine/motion-editor.ts`, pure.** The helpers the editor will read, in Studio and then the plugin:
  - `presetSlotTargets`: every target each preset slot accepts, roles first, then curves, then springs (Q-ME1 A:
    anything the engine accepts). The lists come from `presetTargets` in `theme-motion.ts`, which the engine's
    refusals now name too, so a picker and a refusal can't disagree.
  - `durationTargetsFor`: the spring rule as a picker needs it. A spring easing offers only that spring's settle time.
  - `slotPathsOf`, `easingSourceOf`, `presetSlotsSet`: a resolved half's slots as the paths a brand writes; whether an
    easing follows a role or is fixed to a curve or spring (§2.1 behavior 1); which slots the brand set, per half
    (behavior 2: an unset exit slot follows the entrance).
  - `presetUsedBy`, `patternsReachedBy`: each preset path's tracks and the patterns one edit re-times, read from the
    **resolved** patterns, so a track override that moves a track moves it in the map too.
  - `trackTargets`: what a track override may set. `REDUCED_KINDS` is now one exported list in `motion-patterns.ts`,
    which `resolvePatterns` checks against.
- **The motion-isolation gate (a `test.ts` block, #4571).** A motion-only edit leaves every non-motion part of the
  emission byte-identical: the token tree, base, overlays, web base, CSS-only source, the agent file, every Figma
  collection, and the shadcn and Tailwind themes. Four brands (the three examples and the minimal one) times five
  edits (tempo, easing roles, preset slots, track overrides, per-mode tempo and roles), 800 artifacts. Each side is its
  own engine run. What counts as motion is a literal in the gate, not read from the motion builder.

### The tradeoffs

- **The manifest entries moved to the PRs that draw them.** The proposal put the `levers.ts` entries for presets and
  tracks in PR 1. `apps/studio/test-pages.ts` fails a manifest lever with no Studio home, so an entry here would need a
  control here. The presets entry ships with PR 2 (the preset editor) and the patterns entry with PR 5 (the track
  editor), each with its copy for the owner.
- **Two decisions lines are motion-shaped.** `motion:` names the tempo, and `modeLevers:` names every mode that has a
  per-mode lever, motion's included, so a per-mode tempo adds its mode there. The gate strips both and says why.
  Everything else in the decisions list is compared.
- **Every edit must move the motion part**, or the gate would compare two identical emissions and pass (docs/34). An
  arm asserts it, per brand and edit.

### Verified

- Mutation, committed first: a color rule (the neutral hue) reads `tempo` → `#4571 motion isolation: … LEAKS: prism3 /
  tempo: tokens.json differs at …"h":266.75 → …"h":273.75`.
- Mutation: `presetUsedBy` reads the engine's default patterns instead of the resolved ones → `#4571 a track override
  that re-points the tooltip to fade moves it from pop's used-by list to fade's`.
- The two blocks add about 16 seconds to `test.ts`.
