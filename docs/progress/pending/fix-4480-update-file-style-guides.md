## (2026-11-23) — Update file's Style guides step draws what the Style guides page shows, and its row says how many tables (#4480)

### What was seen

The owner picked a minimal set of style guide tables on Documentation › Style guides, ran Update file with Style guides
ticked, and saw 45 tables drawn. The suspicion was that Update file's step ignores the saved choices
(`apps/plugin/src/doc-settings.ts` `styleGuide`) or builds its own options.

### Diagnosis

The step does read the saved record: it asks for a fresh catalog, then posts
`savedDrawOptions(catalog, readSaved(host.docSettings.styleGuide))` (`apps/studio/src/main.ts`, `advanceUpdate`), and
`host.docSettings` is the main thread's answer to each `doc-settings-save`. The cause was the page's **Collection**
select. It was a view over the tree, not a selection, and `selectionOf` read `rec.tables` and ignored `rec.view`. Every
table starts selected, so with Collection set to core, **Deselect all** and the **Color** kind changed core only and every
other collection's tables stayed selected out of view. On the test's 7-table catalog that path drew 5 tables; on a
45-table file, nearly all of them.

### Owner decisions built (2026-11-23)

- **Q1 A, what you see is drawn.** `drawnOf` (`apps/studio/src/state/style-guides.ts`) narrows a selection to the
  tables of the collection in view; Every collection, or a view the file no longer holds, narrows nothing. The page's
  summary, its Draw label and post, the kinds its Options show, and `savedDrawOptions` (Update file's step) all go
  through it. The selection itself is unchanged, so tables ticked in another collection come back with Every collection.
  "Draw it again" on a table outside the view opens the view to every collection, so the retried table is drawn.
- **Q2 A, show the count.** Update file's Style guides row carries a chip, `UPDATE_COPY.guidesCount` (DRAFT wording,
  "2 tables"), counted by `savedDrawCount`, which reads `savedDrawOptions` itself, so the count and the draw cannot
  disagree. Opening Update file asks for the file's catalog (`countGuides`), so the count reads the file as it is; the
  chip is absent until the host answers.

### Tests and mutations

The existing #4480 browser arm (`apps/plugin/test-style-guides-page.mjs`) became the owner's path: Collection = core,
Deselect all, Color, each save answered as the main thread answers it; then Update file with Style guides ticked. Before
the change it failed by name: the summary said 5 tables, the run drew 5 keys, and the row had no count. New assertions:
the row says "2 tables" and matches the run's key count; opening Update file asks for the tables once; the saved-record
arm reads "2 tables" and the control "7 tables". Node arms in `apps/studio/test-style-guides.ts` assert `drawnOf` and
`savedDrawCount` by literal. Mutations, each failing by name: `savedDrawOptions` ignoring the view; the count reading
the selection instead of the draw; the page's summary and Draw ignoring the view; Update file not asking for the tables
on open (this one survived until the open-request assertion was added, because the test answers the catalog unasked).

### Trap

The browser arm's fake host echoes `doc-settings-save` as sent. The real host first normalizes with `docSettingsOf`,
which drops a `styleGuide` over `MAX_BYTES` (32,000) to `null`, and `null` means every table. A record that size would
show the same symptom silently; it is not covered here and was not shown reachable.
