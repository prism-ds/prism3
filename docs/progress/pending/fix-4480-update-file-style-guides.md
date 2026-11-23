## (2026-11-23) — Update file's Style guides step: the in-session selection is drawn, and why a picked collection is not a narrowing (#4480)

### What was suspected

The owner picked a minimal set of style guide tables on Documentation › Style guides, ran Update file with Style guides
ticked, and saw 45 tables drawn. The suspicion was that Update file's step ignores the saved choices
(`apps/plugin/src/doc-settings.ts` `styleGuide`) or builds its own options.

### What the code does

It reads them. The step asks for a fresh catalog, then posts `savedDrawOptions(catalog, readSaved(host.docSettings.styleGuide))`
(`apps/studio/src/main.ts`, `advanceUpdate`). `host.docSettings` is the main thread's answer to each `doc-settings-save`,
the record as `writeDocSettings` kept it. The main thread's `runStyleGuide` narrows to `options.tables` by key. There is
no other caller of the style guide run.

The existing browser arm (Q2909.23 A) covered a record the host posted before the page opened. It never answered a
save, so it could not see a save that the host had dropped. The new arm in `apps/plugin/test-style-guides-page.mjs`
covers the owner's path. Nothing is saved when the panel opens. Core's two color tables are picked on the page, and
each save is answered as the main thread answers it. Update file then runs with Style guides ticked and posts those
two keys and no other. Mutation: posting `savedDrawOptions(m.catalog, null)` (the saved options dropped) fails
`#4480: Update file with Style guides ticked draws only the tables picked on the page this session` by name.

### The likely cause of the 45, an owner decision

The page's **Collection** select is a view over the tree, not a selection. Each table starts selected. With Collection
set to core, **Deselect all** and the **Color** kind act on core alone, so every other collection's tables stay
selected. On the arm's catalog, that path leaves 5 of 7 tables selected, the summary says "5 tables", and Update file
draws those 5. On a 45-table file the same path draws nearly every table. Whether picking a collection should narrow
what is drawn, and whether Update file's Style guides row should say how many tables it will draw, are design
decisions, held on #4480. No product code changed.
