## (2026-11-24) — A theme's type family is not a hand edit on a style guide table (#4482)

**The scenario, run.** Built the style guide in `test-style-guide.ts`'s host from the real emitted text styles, moved the theme's body family (`pds3/core/font/family/body`, Inter → Proof Sans). The host re-resolved 65 texts. Then ran the style guide again, as Update file's Style guides step does.
- **On its own, the font change makes no table read as edited.** Every table is drawn again under its own key. A print is compared only for a *superseded* table: one whose group is gone or now drawn as narrower tables (`verdictOf`). `44: theme font/redrawn` holds that.
- **A table superseded in the same Update does read as edited.** The Text styles table's specimens are drawn in their style, and the Font family table binds its specimens' family to the variable. The first form of the print read each text's resolved font, so the theme moved it. The table was kept with reason `edited` and offered for removal by hand. Reproduced as `✗ 44: theme font/superseded … kept [{"name":"Style guide — Text styles","reason":"edited"}]` before the fix.

**The fix.**
- A table's print moves to a second form, `2:` (`tablePrint`, `style-guide.ts`). It reuses #4486's `fingerprintOf(…, { bindings: true })`: a styled text reads as its style, and a bound font field reads as its variable, in either alias shape.
- It also asks for a new `overrides` option, which reads the `textStyleOverrides` a styled text's runs list. That keeps a bold or italic set over a whole styled line (#4486 review B1) an edit for tables, as the first form caught it. On a host that can't list overrides, the run's resolved face is read instead.
- A print in the first form is still compared in that form (`tablePrintMatches`). The usage panel's print is unchanged.

**Hand edits still read**, after the same font change (`44: theme font/hand edit (…)`): a font picked by hand, another style, a semantic bold that keeps the style, and a retyped specimen.

**What this can't fix.** A table recorded in the first form, on a file whose theme fonts have since changed, can't match again: nothing recorded the old font. If it is superseded, it is kept once (the safe direction). `44: theme font/aged print, font moved` pins that.

**Escape review.**
- *Which check should have caught it?* Section 11's superseded-table arms. They drew color tables only, whose texts are in no style, and no arm moved a font.
- *Added:* section 44, with a host model of a theme re-resolving styled and bound texts (`themeFamily`, the shim's own, not the plugin's reading), and an override list on the shim's segments.
- *Filed:* #4513, the same B1 gap on usage panels and member records.

**Mutations, each failing by name:** `tablePrint` reading the first form → `44: theme font/superseded`. `tablePrint` without `overrides` → `44: theme font/hand edit (semantic bold)`. A first-form print compared in the second form → `44: theme font/aged print`.

**Executor:** unchanged; no `EXECUTOR_REVISION` bump.
