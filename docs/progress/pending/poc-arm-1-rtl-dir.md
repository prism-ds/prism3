## (2026-11-24) — Arm 1 right to left: the text field's dir="auto", and a :dir() the build rewrites now fails (#4051, #4098)

**What changed.** Two of arm 1's open right-to-left defects (#3408), found by our own `check-rtl.ts`.
- **#4051.** The text field's input now carries `dir="auto"` in both forms, as its def's `accessibility.aria` line asks,
  so a Latin email address stays left to right on a right-to-left page. It's written by the element generator
  (`generate-fields.ts` → `p3-text-field.js`), the stories' HTML form, the CSS demo and the README's markup contract.
  The password field is unchanged: its def doesn't repeat the line, and whether it should is an owner decision posted
  on #4051 (recommended: no, so a masked value's direction doesn't hint at what was typed).
- **#4098.** The cause is now known. Vite 8 minifies CSS with lightningcss at its default target,
  `baseline-widely-available` (Chrome 111). `:dir()` needs Chrome 120, so the build lowers `x:dir(rtl)` to
  `x:is(:lang(ae),:lang(ar),…)`, which a `dir="rtl"` frame with no `lang` never matches. A client's own Vite at its
  default target would do the same. So `check-rtl.ts` now refuses a `:dir()` in `@prism3/css`'s shipped CSS, and any
  `:lang()` in the built CSS that the source doesn't write. Each fails by name, with the file and the selector.

**#4052 isn't in this PR.** Which glyphs mirror is settled on `main` (`RTL_MIRRORED_GLYPHS`, Q-RTL1 A). How a glyph
is marked to mirror in arm 1's markup is component API, so it's posted as an owner decision on #4052. `check-rtl`
still holds the unflipped arrow as its named exception. With #4098 fixed, a flip written as `:dir(rtl)` can no longer
pass silently.

**Checked.**
- `check-rtl.ts` holds `dir="auto"` on the text field's input in both directions. With a left-to-right value typed in,
  the input must compute `direction: ltr` on a right-to-left page. #4051's named exception is gone.
- Before the markup change, the new check fails 120 times by name: 20 cases × 2 forms × (the attribute in each
  direction, and the computed direction right to left).
- A `:dir(rtl)` rule added to `field-label.css` and rebuilt fails the new check by name twice: once for the source
  selector, once for the build's `:lang()` list. The old check passed the same build. Its only failures were the
  retired #4051 exception firing, and none named the rule.
- Five new self-test mutants, each failing by name: the input without `dir`, pinned to `rtl`, its resolution
  overridden by CSS, a planted `:dir()` source rule, and a planted `:lang()` lowering.

**Scorecard.** KPI 3 "Right to left" goes from 536 checks (at `39ecae46`) to 622. No other row moves. The
`kpi3-aria`, `kpi3-axe` and `kpi3-keyboard` counts are unchanged at 1,852, 960 and 448.
