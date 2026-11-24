## (2026-11-24) — A font with no Semi Bold: Apply warns first and uses the nearest weight; a re-apply removes the weight variable the brand dropped (#4474)

Found in a demo rehearsal. A brand whose family had no Semi Bold applied with the default emphasis weight (600), and Apply Theme skipped 9 emphasis text styles mid-run. Setting `typography.weightRoles.emphasis: 700` fixed the styles, but the re-apply left `…/core/font/weight/600` in the file. Owner decision A (2026-11-24): before applying, name the missing face and point at the weight setting; use the nearest weight the family has, so no style is skipped; a re-apply removes the orphan weight variable.

### The fallback

`fillMissingWeights` (`apps/plugin/src/preload-fonts.ts`) runs in `runApplyTheme` before the font preload and before any write. Where a family lacks a weight under every spelling (`resolveFontStyle` returns nothing), it writes the nearest plain weight of the same italic-ness into the text plan's `fontStyle` and into each cut variable's literal, per mode. A tie goes the way CSS font matching goes: lighter below 400, heavier from 400 up, so a missing 600 between 500 and 700 takes 700. A cut that is not a plain weight (a width cut such as `Light Condensed`) has no nearest and keeps the old skip. The fallbacks come back as `weightFallbacks`, and the report says them first: `⚠ Not in this Figma: Inter Semi Bold — 9 text styles use Bold instead. To choose the weight, set Typography › Weights.` The wording is a DRAFT for the owner.

This replaces #237's posture (skip rather than substitute) for this one case. `test-apply-interrupted.ts`'s arm `#1728 missing cut left alone` asserted that posture, so it becomes `#1728 missing cut filled`: Inter's missing `Semi Bold Italic` cut now takes `Italic`, the nearest italic on that host, and the apply names it. The pre-flight, the print and the orphan report still read the plans as built, as they already did after `resolveCutPlan`.

### The orphan weight variable

`retireUnusedWeights` (`apps/plugin/src/retire-weights.ts`) runs after the type-vars stage, once every weight role aliases its new weight. It removes only `<prefix><digits>` names, where the prefix is the `…/font/weight/` the font plan itself writes, inside that plan's collection. Every other variable the brand stops writing is still reported and never deleted (#479). A weight variable that another variable aliases is kept and reported. The removal is said in the report, like the motion retype: `Removed 1 font weight variable the brand no longer uses (600).` (DRAFT). A removed name leaves the orphan count, so it is not reported twice.

The guides said Apply never deletes. `apply-a-theme.md` and `update-a-file-safely.md` now name this one deletion, and the citations the line shifts moved are re-pointed.

### Not covered

The agent paste path (`mcp-steps.ts`) runs the executors one step at a time and does not call `fillMissingWeights`, so a paste still skips those styles. Filed as #4498.

### Proof

`apps/plugin/test-weight-fallback.ts`, 21 assertions, floor 21 in `suites.json`. With `main`'s `apply-theme.ts`, 8 arms fail by name, including `fallback/none skipped` (the 9 emphasis styles of the rehearsal) and `retire/no orphan`. Six mutations each fail by name: the unfilled text plan written, no fallbacks returned, the cut rows left unfilled, the retire call dropped, the alias check dropped, and the digits test dropped.
