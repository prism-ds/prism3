## (2026-11-24) — score_consumption reports coverage and measures palette colors in pairs (#4125)

The consumer-agent audit (#4104) found `score_consumption` reporting `rate: 1` when pairs were never checked. #4326 added `vacuous` for the run where nothing resolved (#4200 Q3 b); the mixed run (12 checked, one pair unresolved in every mode) still read `rate: 1, vacuous: false`. And a pair whose background was a palette primitive (`core.palette.primary.100`) was always unresolved, though the same primitive in `refs` is accepted and flagged as a leak, so the UI that leaks a primitive was exactly the one the contrast check skipped.

**Fix (owner decisions A and A, 2026-11-20).** `scoreContractCompliance` (`eval.ts`) returns two more fields, both additive:
- `coverage`, checked ÷ (pairs × modes), so the mixed case reads `rate: 1, coverage: 0.75`. Counting per (pair, mode) rather than the issue's `checked + unresolved × modes` gives the same number whenever a pair resolves in all modes or none, and stays honest if one ever resolves in only some. It is 0 exactly when `vacuous` is true.
- `leaks`, the pairs measured through a raw palette color. A side that names `core.palette.<palette>.<step>`, `core.palette.white` or `core.palette.black` (root-relative, braced or root-qualified) resolves to the hex the tree emits for it. A mode swaps which palette a role reads, never a palette's steps, so one value serves every mode. The alpha ramps and `transparent` stay unresolved: a translucent color has no contrast without the ground under it.

The `outputSchema` description names both, which `emit-agent-reference` carries into the agent reference. `rate`, `vacuous`, `failures` and `unresolved` keep their types and meaning.

**Tests.** A `test.ts` block over a two-mode brand: an all-unresolved run reads coverage 0; three pairs with one unresolved read 4/6 (EXPECTED counted from the input); white on `primary.100` is measured in both modes at the tree's own `contrastOnWhite` for that step, in all three spellings, and listed as the one leak; `transparent` stays unresolved. Mutating `coverage` to 1 and dropping the primitive lookup each fail arms by name.

**#4281** (a string `include` threw in `export_theme`) was already fixed on `main` by the #4277 review change in `argumentErrors`, with its `mcp-test.ts` arm. This lane re-ran that arm's mutation (drop the array-type check) and it fails by name, so the issue closes here with no code change.

**Held: #4129** (accept CSS custom property refs, a `suggestions` field, empty-run rates). Its three OWNER DECISIONs on the issue are unanswered, and one names a public CSS spelling, so nothing of it is built. **#4339** is outside this batch: it is the plugin's paste runtime (`apps/plugin/src/mcp-steps.ts`), not these files.
