## (2026-11-25) — TokenPress 3.0.3: library bindings inside composites, CSS motion values, solid paint styles reported (#4366, #3886, #3884)

Three owner decisions recorded 2026-11-24 on each issue and on #4511, built after #4511 (3.0.2) merged. TokenPress is a
guest app: its own patterns, `src/` kept ES2018 (no `?.`, no spread in new code; `dist/code.js` carries 0 `?.`). The
version moves in its one source, `apps/tokenpress/package.json`, 3.0.2 → 3.0.3, with the root lockfile's workspace
entry, and `docs/CHANGELOG.md` has the entry.

- **#4366 → A: a composite names a library binding.** `resolveExternalAliasTargets` found library variables only
  through local variables' own aliases, so a text style, shadow or gradient stop bound straight to a library variable
  was never looked up. The scanner now also takes the ids the styles bind (`styleBoundIds`). Each such sub-property
  exports its resolved value plus a marker in `$extensions.figma.externalAlias`, keyed by its path inside `$value`
  (`fontWeight`, `0.color`, a shadow's `color` or `<layer>.color`, Figma's `radius` as DTCG's `blur`). The marker
  holds #4490's four fields. **A trap the fixture caught:** with the binding unresolved, `resolveFontWeight` fell
  back to a cache that matches a local variable by value, so a library-bound 600 exported as an alias to an unrelated
  local `font/weight/semibold`. A library-bound weight or line height now skips that cache (`externalIds`).
- **#3886 → A: the CSS format writes motion values.** `cubicBezier` is `cubic-bezier(x1, y1, x2, y2)`, and `duration` is
  `ms` (seconds converted, a `"50ms"` string kept, an alias a `var()`). Any other value written as an object or array
  (a gradient, a spring, a font stack) is left out of `tokens.css` and named: `PlatformExport.omitted`, collected once
  across modes by the multi-format exporter (`getSkippedCssValues`), and named in the footer. **Read as:** scalar
  values (a number, a string) are valid CSS, and still export. Only values that came out as JSON are left out.
- **#3884 → A: solid paint styles are reported.** A paint style whose visible paints are all solid is named
  (`getSkippedSolidPaintStyles`) and in the footer. An image style, and a style whose only paint is hidden, are not
  solid styles and aren't listed. Exporting solid styles (the file and the naming policy) is filed as #4594.
- **The footer** gains two sentences, each in the existing shape: `Skipped N solid paint style(s): <names>` (a direct
  mirror) and `Skipped N token(s) with no CSS form: <names>` (owner decision 2026-11-25, A, on the PR). It also holds
  any skip for 10 s; before, only a blur skip did.

**Checked.** Fails before: 16 named failures across the three, with the new tests on base's `src`. The tests:
- `composite-external-alias.test.ts`: 8 tests (5, then 3 after review);
- `css-motion-values.test.ts`: 7 tests;
- `solid-paint-styles.test.ts`: 4 tests (3, then 1 after review);
- `skipped-gradient-summary.test.ts`: 6 more, through `code.ts` and `ui.html`.

**Mutations, each by name:** eight. Three for #4366 (the cache skip, the style-bound lookup, the stop's marker), two
for #3884 (a hidden-only style counted as solid, the footer sentence), three for #3886 (seconds not converted, objects
as JSON, the names dropped across modes). TokenPress tests pass (395, the census updated), the build too, and
`tools/exporter-comparison/gate.ts` agrees on all five brands.

**After review.** The review found three #4366 branches no test could fail, each passing all 395 with the branch
removed: the shadow's `radius` → `blur` rename, the per-layer index (`1.color`), and the line-height cache skip.
Three tests now hold them: a library-bound blur is marked under `blur`, a key in `$value`; a two-layer shadow's
markers land on `0.color` and `1.color`, both paths in `$value`; and a library-bound 150% line height is the ratio 1.5,
not an alias to a local line-height variable holding 1.5. Each branch removed now fails its own test by name. A fourth
test holds a style that layers a solid with an image as not a solid style (the review's nit). The CSS footer sentence
takes the owner's wording, and `#3886`'s scope stays as built (owner decision 2026-11-25, A). 399 assertions.

**Trap.** The test runner imports every file into one process, so only one test file can drive `src/code.ts`: its
`figma.ui.onmessage` is set once, on import. The sandbox and panel halves for the new skips live in
`skipped-gradient-summary.test.ts`, beside #3885's, for that reason.
