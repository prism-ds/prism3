## (2026-11-24) — TokenPress 3.0.2: HSL colors in the CSS format, a wash over a wash, and layered gradients named in the summary (#4477, #4478, #3885)

**What.** Three of six TokenPress export issues fixed. The other three each carry a decision about the export's shape,
and are held for the owner in the PR rather than built.

- **#4477.** With Color Space: HSL, the CSS format wrote every color as `[object Object]`, and a shadow with an HSL
  color lost it. The CSS transformer handled `colorSpace: 'srgb'` only and fell through to `String(value)`. One
  formatter, `formatDTCGColor`, now serves both the token path and the shadow path, writing each space in its own
  notation: `hsl(h, s%, l%)` and `hsla(…, a)` below full alpha. The comma form matches the existing `rgb()`/`rgba()`.
- **#4478.** A tinted wash whose color aliases another wash exported the bare alias, and its own opacity was lost.
  `resolveInMode` stopped at the inner composed color (not an alias, not RGB). A new `resolveWashInMode` recurses into
  it, and `resolveInModeAt` reports the collection and mode the walk ended in, so the inner wash's own aliases resolve
  where it lives. The outer opacity multiplies the inner alpha. The shape is #2365's decision A, unchanged. The
  dot-notation format has its own composed-color path (`DotNotationExporter.resolveComposedColor`, #4475), which wrote
  `-> null` for the same construct; review found it. It now recurses the same way, with the same depth limit, and the
  inner wash's halves resolve in the mode it was read in (its own first mode, when the file's mode is not one of its
  own), through a new `resolveAliasValueAt`.
- **#3885.** The names of skipped layered-gradient styles reached `console.warn` only. `code.ts` now posts them with
  the export result on both paths, and the panel's footer names them beside the blur-only skips.

### Is #4478 reachable?

The issue asked to confirm the construct in a scratch Figma file first. That probe was **not run**: the connected
Figma account has seven plans, several of them client organizations, and which one gets a scratch file is the owner's
call. The evidence is the API's own type: `VariableComposedColor`'s alias half is a plain `VariableAlias`, with nothing
narrowing its target to an RGB-valued variable, and a COLOR variable's `VariableValue` includes
`VariableComposedColor`. So the API permits it. The fix is small and changes no shape, so it ships. If a live probe
shows Figma refuses the construct, the code is unreachable but harmless.

### Traps for whoever re-verifies

- **The cross-collection mutation needs a third collection.** Resolving the inner wash in the *outer* wash's
  collection and mode passed every case at first, because the inner wash lived in the same collection. The distinguishing
  case puts the inner wash in its own collection with an opacity that aliases back into the theme. Read where the inner
  wash lives, that alias reads the theme's default mode (Light, 40%). Read in the outer mode (Dark), it reads 80%.
- **`resolveInModeAt` does not rewrite the mode it falls back from.** A `currentMode = pick` line survived deletion in
  review. The reported mode only feeds the inner wash's own lookups, which start in the same collection and fall back
  the same way, and a hop into another collection resets the mode. A case that needs the line would need two variables
  in one collection with different mode sets, which Figma does not produce, so the line was dropped rather than tested.
- **The panel test runs `src/ui.html`'s real script in `node:vm`** over a Proxy stand-in DOM, because TokenPress
  takes no browser dependency (`npm ci` only, no new packages). The stand-in records only `textContent` writes. A
  footer that renders through `innerHTML` alone would read as unset, and the test would fail rather than pass.

### Verification

`npm run -w @prism3/tokenpress test` (374 assertions, 18 new across three files), `build`, and
`npx tsx tools/exporter-comparison/gate.ts`, all green. Before the fix, with `main`'s five `src` files restored over
these tests, 15 fail by name: 3 for #4477, 8 for #4478 (5 DTCG and CSS, 3 dot notation) and 4 for #3885. Seven
mutations (HSL branch removed; nested wash not recursed; inner wash resolved in the outer mode; the dot-notation inner
wash's alpha dropped; the dot-notation inner wash resolved in the outer mode; `code.ts` not posting the names; the panel
ignoring them) each fail a named test.
