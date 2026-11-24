## (2026-11-24) — A theme's type family is not a hand edit on a style guide table (#4482)

**The scenario, run.** Built the style guide in `test-style-guide.ts`'s host from the real emitted text styles, moved the theme's body family (`pds3/core/font/family/body`, Inter → Proof Sans). The host re-resolved 65 texts. Then ran the style guide again, as Update file's Style guides step does.
- **On its own, the font change makes no table read as edited.** Every table is drawn again under its own key. A print is compared only for a *superseded* table: one whose group is gone or now drawn as narrower tables (`verdictOf`). `44: theme font/redrawn` holds that.
- **A table superseded in the same Update does read as edited.** The Text styles table's specimens are drawn in their style, and the Font family table binds its specimens' family to the variable. The first form of the print read each text's resolved font, so the theme moved it. The table was kept with reason `edited` and offered for removal by hand. Reproduced as `✗ 44: theme font/superseded … kept [{"name":"Style guide — Text styles","reason":"edited"}]` before the fix.

**The fix.**
- A table's print moves to a second form, `2:` (`tablePrint`, `style-guide.ts`). It reuses #4486's `fingerprintOf(…, { bindings: true })`: a styled text reads as its style, and a bound font field reads as its variable, in either alias shape.
- It also asks for a new `overrides` option, which reads the `textStyleOverrides` a styled text's runs list. That keeps a bold or italic set over a whole styled line (#4486 review B1) an edit for tables, as the first form caught it. On a host that can't list overrides, the run's resolved face is read instead.
- A print in the first form is still compared in that form (`tablePrintMatches`). The usage panel's print is unchanged.

**Review B1: the sizes a font sets.** In Figma, a hugging text is re-measured when its family changes, and a text with an AUTO line height changes height too. The `2:` print still read every node's width and height, so on a real file the superseded table moved anyway: the specimen's width, its cell's, its column's, the grid's and the table's. The shim hid it: its text was 7px a character in any font.
- **The shim, section 44 only** (`familyMetrics`): a hugging text in Proof Sans is 1.15× as wide as in Inter, and with AUTO line heights Proof Sans sets a taller line. With it and no plugin change, `✗ 44: theme font/superseded … table 3243x3924 → 3258x3924; … kept [… "edited"]`, and the new `✗ 44: theme font/auto line height … table 3243x3924 → 3243x3940; … kept [… "edited"]`.
- **The fix:** `fingerprintOf`'s new `measured` option, which only `tablePrint` asks for, leaves out each size measured from a font (`fontMeasure`). That is a hugging text's own axes when it follows a style or a bound font field, and every size measured from those: a frame that hugs one, a grid cell that fills a track holding one, and up to the table. In their place it reads what those sizes are measured from (`measuredFrom`): sizing modes, text resize, grid gaps and tracks, wrap, bounds.
- **Not broader than that, on purpose.** The first cut left out every hugging or filling size. It broke section 21's `a superseded dimension table whose value moved is kept`: a Step table's bar hugs its bound padding with no text in it, and a moved value must still read. A plain text in no style keeps its size too: nothing a theme moves re-measures it.

**Hand edits still read**, after the same font change (`44: theme font/hand edit (…)`): a font picked by hand, another style, a semantic bold that keeps the style, a retyped specimen, and (new) the grid's column gap widened.

**What this can't fix.** A table recorded in the first form, on a file whose theme fonts have since changed, can't match again: nothing recorded the old font. If it is superseded, it is kept once (the safe direction). `44: theme font/aged print, font moved` pins that.

**Escape review.**
- *Which check should have caught it?* Section 11's superseded-table arms. They drew color tables only, whose texts are in no style, and no arm moved a font. For review B1: section 44 itself, because the shim didn't re-measure a text when its font changed, so it shared the plugin's blind spot (docs/34).
- *Added:* section 44, with a host model of a theme re-resolving styled and bound texts (`themeFamily`, the shim's own, not the plugin's reading), and an override list on the shim's segments.
- *Filed:* #4513, the same B1 gap on usage panels and member records; #4585, review B1's width gap in the usage panel's `5:` print (#4486, already merged).

**Mutations, each failing by name:** `tablePrint` reading the first form → `44: theme font/superseded`. `tablePrint` without `overrides` → `44: theme font/hand edit (semantic bold)`. A first-form print compared in the second form → `44: theme font/aged print`. For B1: the width restored in the second form → `44: theme font/superseded`; the height restored → `44: theme font/auto line height`; `measuredFrom` not read → `44: theme font/hand edit (column gap)`.

**Executor:** unchanged; no `EXECUTOR_REVISION` bump.
