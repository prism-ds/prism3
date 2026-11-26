## (2026-11-24) — The Tailwind theme's shadows are gated per mode (#4355)

`tailwind/<brand>.theme.css` sets `--shadow-<rung>-value` in `:root` and `.dark`. Gate 5 (`check:shadcn`) proved a
utility reads the variable and that both blocks set it; nothing compared the value with the brand's. A theme whose
shadows were swapped between modes, or held the wrong rung, passed every gate. Owner decision on #4386 (2026-11-24):
build it now, as its own PR, gate only.

### What changed
- **An arm in gate 2, not a new gate.** `lint-shadcn-roundtrip.ts` already opens each brand's Tailwind theme in
  Chromium per mode, and already owns the expected-side alias walk over `<brand>.tokens.json`. The shadow arm runs on
  that same page.
- **ACTUAL.** `shadcn-browser.ts` gains `shadows`: it sets each expression as the probe's `box-shadow`, reads the
  computed style, splits it into layers at top-level commas, and paints each layer's color on the canvas the way
  `read` does (opaque rgb, then the raw alpha byte). Lengths come back in px.
- **EXPECTED.** `shadow.<rung>` in `<brand>.tokens.json` for the mode (dark from `$extensions.prism3.modes`), through
  the gate's own walk (`expectedRaw`, split out of `expectedValue`), its own dimension reader (`expectedPx`) and its
  own color parser. `emit-tailwind.ts` reads the handoff through `resolveRole` and writes `toOklchCss`; the gate uses
  neither.
- **The rung is typed in the gate (review of this PR).** The first version took each variable's rung from
  `TAILWIND_SHADOWS`, the map the emitter writes from. Swapping `shadow-md` and `shadow-lg` there passed every gate
  but `drift`, and a regen cleared that. `EXPECTED_SHADOWS` now types the six variables and their roles in the gate.
  The map is read only to fail when it names a rung the table doesn't, or drops one.
- **Scope is asserted, not counted.** The arm fails if it read fewer than every brand's theme in both modes, or
  compared no layers. Today: 120 layers, 5 brands × 2 modes × 6 rungs × 2 layers.

### Mutations
Each failed the gate by name; see the PR's Ready comments for the lines.
- Swap only the shadow variables between `:root` and `.dark` in `emit-tailwind.ts` (the issue's mutation).
- Change one emitted shadow: `shadow-md-value` written from `shadow.lg`.
- Swap `shadow-md` and `shadow-lg` in `TAILWIND_SHADOWS`: `prism3 tailwind light shadow-md-value layer 1: lengths
  0 2 4 -2 → 0 3 6 -3`.
- Add a rung to the map only: `TAILWIND_SHADOWS names shadow-3xl, which EXPECTED_SHADOWS does not`.

### Trap
The page script is a string inside a template literal, so a regex in it needs doubled backslashes. Single ones
(`\(`) are swallowed by the template, the regex still compiles, and every layer reads `NaN`. The first run caught it.
