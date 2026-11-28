## (2026-11-28) — Motion editor PR 3: preset and pattern previews, and the plays-the-data gate (#4571)

The third of the motion editor's build PRs (`docs/superpowers/motion-editor-proposal.md` §5 row 3, §3.1 and §3.2), on
the owner's decisions on #4571 (all A). Theme › Motion's preview gains a stage: choose a preset, and it plays on each
pattern that names it, picked from a "Used by" row, over a small page in the brand's paints, with a timeline under it
(one bar per track, its length the track's duration and its offset its delay, labeled with the preset). The four
presets no pattern names yet (reveal, draw, step, settle) play on plain specimens. Play, Replay and Slow motion work as
the traces' do, and a Motion edit plays the stage once, never by itself under reduced motion (D9 A). The owner decided
the strings and Q-ME3.1–3.5 on #4665 (2026-11-28): A throughout, the description trimmed, the delay suffix "400ms
delay", the "Used by" chips in human labels ("Bottom sheet enter"), and a specimen captioned with its preset's name.
The timeline's rows share one time axis (a subgrid), so bars compare across rows.

### The rule and its gate

No preview carries a timing of its own (§3). The stage reads each track's timing in one place, `trackTiming`
(`preview/sections/motion-stage.ts`), from `theme.motion` in the mode in view. `test:plays-the-data`
(`apps/studio/test-plays-the-data.ts`) holds it in Chromium: for every pattern the agent file lists, each track and each
CSS property its group moves, the element's computed duration, timing function and delay equal what
`motion.preset.<path>.*` resolves to in the emitted token tree, in every mode. The expected side is the engine's Node CLI
output, never Studio code: the committed `out/` for prism3, aurora and harbor, and a fixture brand the gate compiles
from aurora's brief plus the edits no example makes (a spring-eased preset, a preset fixed to a curve, a delay, a longer
exit, dark at another tempo with its own enter curve, a track override). It is pasted into the start screen as
design.md. Both sides go through the browser's own serialization, with no tolerance. It also holds that every pattern
is reached, each track has its element and its timeline bar, and each preset's "Used by" chips are exactly the patterns
that name it. It reads each element at rest, after Play and Replay, and once per mode after a Motion edit, because
`play()` rewrites the transition that actually plays; and it holds every lane to one time axis, with two tracks of equal
emitted duration and delay drawing equal bars, within 1px (#4665 review). Wired into CI beside `test:export-parity`, into `verify.ts`, and into the three gate lists.

Mutations, each failing by name: `trackTiming` returning 300ms for `fade` (82 checks, e.g. "prism3 light: pattern
'toast/enter' track 'toast.opacity' (opacity): duration 0.2s, got 0.3s"); one element's duration written as a literal
(the scrim at 240ms: passes where aurora's surface is 240ms, fails prism3, harbor, aurora's exits and the fixture); the
stage reading the brand's duration ramp instead of the mode's (51 checks, all "fixture dark", which is why the fixture
exists: no committed brand moves motion per mode); a 300ms duration written only in `play()` (967 checks, all after Play,
Replay or a Motion edit, none at rest); and the timeline's rows back on their own grids (520 checks, "the timeline's
lanes share one time axis" and "tracks … draw equal bars").

### Traps

- tsx compiles a `.ts` suite with esbuild's keepNames, so a named function handed to `page.evaluate` calls `__name`,
  which the page lacks. The gate defines it with an init script.
- hc-dark does not inherit dark's tempo, in the emission or in the stage: the fixture's mode mutation fails dark only.
- Not covered: reduced motion (PR 4 adds its arm), and the plugin, which runs Studio's UI whole.
