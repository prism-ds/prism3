## (2026-11-24) — KPI 1, developer + CLI, measured, with KPI 3's one-edit check (#3408)

**What changed.** A new measurement tool, `tools/poc-kpi1/`, with no engine change. This is item 4 of the arm 1 plan
on #3408: the scripted floor of KPI 1's "Developer + CLI" experience. A person's run is still B2.

- `kpi1.ts` works in a copy of the tree in `$TMPDIR`, never in the tree itself.
  - **From scratch:** every generated output is removed (listed by hand). Then it times `npm ci`, the engine CLI on
    the brand input, both component generators, and the Storybook build. It passes when every command passes first
    try, every removed file comes back equal to the committed one (the CLI's build stamp aside), and
    `check-build.ts` passes on the copy.
  - **The update:** the scratch run is untimed setup. Then one hand edit to the brand input changes the primary color
    and the radius scale, and the CLI and the Storybook build propagate it. Both generators' `--check` must still
    pass, which shows the edit needed no component file regenerated.
- `one-edit.ts` is KPI 3's "one edit reaches both forms". It reads four hand-written probes (the button's fill and
  corner, each field's corner) in Chromium, in both forms and both themes, before and after the edit, against the
  emitted DTCG.
- The scorecard now measures `kpi1-cli-scratch`, `kpi1-cli-update` and `kpi3-one-edit`.

**Arm 1, measured at `ffd4d6ed` (warm npm cache):**
- **From scratch:** 17.3 seconds, with `npm ci` taking 5.7 of them. It took 5 commands, 0 hand edits, 0 errors, and
  passed first try. All 16 generated files came back equal to the committed ones.
- **Update:** 3.6 seconds. It took 1 hand edit (the update itself) and 2 commands, with 0 fixes and 0 errors. Neither
  component package needed regenerating.
- **One edit reaches both forms:** 16 of 16 readings. The button fill went from the blue to the green, and every
  corner doubled, in the HTML form and the element form, light and dark.

**Held for the owner:** K1 on #3408, whether the from-scratch time includes `npm ci`. The tool uses A (timed) until
then, and the cell shows the install's own seconds, so either reading is on the card.

**Checked:** 10 self-test cases on the tool and 13 on the scorecard (the new case failed before the rows existed). Five
code mutations each fail their own case by name. Three plants in real runs each fail by name: a generated file that
drifts, the CLI skipped after the edit, and the token CSS and Storybook not rebuilt after it.
