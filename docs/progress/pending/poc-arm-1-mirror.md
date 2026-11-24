## (2026-11-24) — PoC arm 1: a glyph that points flips right to left, the password input follows the page, and the press is set aside in geometry (#4052, #4051, #3408)

Three owner decisions from the arm 1 review batch (#3408, 2026-11-24), built on `poc/arm-1` at `194fe943`.

- **#4052 → A: the author marks the glyph.** A glyph that points (an arrow, a chevron) carries `data-mirror` on its own
  `<svg>`. `@prism3/css` flips it with `[dir="rtl"] <slot> > svg[data-mirror] { transform: scaleX(-1) }`, written by
  both generators (the button's visuals in `generate.ts`, the fields' in `fields.ts`), never `:dir()`, which the
  default Vite target rewrites (#4098). Both forms render into light DOM, so one rule per component serves both. The
  slot never flips, and an unmarked glyph stays as drawn. The story's arrow and the CSS demo's arrow are marked.
  `check-rtl`'s `KNOWN.arrow` exception is deleted: the check now asserts that the arrow is marked, flips right to left
  and is drawn as authored left to right, and that the add glyph never flips.
- **#4051 → A: the password field's input gets no `dir`.** `check-rtl` asserts it carries none and computes the page's
  direction, in both directions. The README row that left it open now states the decision.
- **KPI 2 and the press → A.** Geometry is layout, with transforms set aside, as `check-geometry.ts` already did
  (#4581). `figma-geometry.md` says so, and the scorecard's KPI 2 Figma geometry row now reads "layout only, transforms
  set aside (the press is motion)", for both arms. A scorecard self-test holds the row's text.

**Name.** `data-mirror`, the name the owner's decision used. It says what happens, needs no value, and reads the same
on an inline `<svg>` in either form.

**Checked.**
- **Fails before.** The new `check-rtl` on base's CSS and story markup fails 6 by name: the arrow isn't marked (both
  directions) and doesn't flip right to left, in each form. Base's label fails the new scorecard case.
- **Mutations, each by name:** the mirror rule removed from `generate.ts` (`the trailing arrow (marked data-mirror)
  does not flip right to left`); `dir="auto"` added to the password input in the element generator (`the password
  field's input carries dir="auto"; it carries no dir …`); three new self-test mutants (the rule overridden, the mark
  dropped, the password input given `dir`); the row's label put back.

**Trap.** `check-rtl`'s left-to-right lines carry no direction suffix, only right-to-left ones end in ` (rtl)`. A
`mustName` written with `(ltr)` matches nothing and reports the mutant as uncaught.
