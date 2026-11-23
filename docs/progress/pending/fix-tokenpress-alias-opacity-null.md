## (2026-11-23) — TokenPress keeps a color alias's opacity in every export (#4475)

**What.** Two Community users reported that a color variable aliasing another variable, with an opacity on the
referencing variable, exported `null`. In the Plugin API that is a COLOR variable whose mode value is
`VariableComposedColor`, `{ color: VariableAlias, opacity: number | VariableAlias }`, the opacity a percent. Read as a
plain RGB its channels are `undefined * 255 = NaN`, and `JSON.stringify` writes NaN as `null`. The DTCG file was fixed by
#4299 (#2365, owner decision A) two days before this issue was filed, but that fix has not been published to the
Community, which is still on the build that writes `components: [null, null, null]`. On `main`, two gaps remained for
the same construct:

- **The dot-notation format** reads the raw variable through its own value formatter and wrote
  `rgb(NaN, NaN, NaN)`, both for the wash and for a plain alias to it. It now writes the reference and the opacity,
  then the resolved color: `"{color.brand} @ 40%" -> "rgba(255, 128, 0, 0.40)"`.
- **`$extensions.figma.aliasOf`** kept an opacity only when it was an alias. A typed-in 40% was left baked into
  `$value`'s alpha, where it can't be told apart from the target's own alpha, so the reference could not be rebuilt.
  `aliasOf.opacity` now holds the literal percent too (`40`). This changes the shape #4299 pinned, so it is flagged as
  an owner decision on the PR; `tinted-wash-library.test.ts`'s expectation moves with it.

**Verification.** `tests/unit/alias-opacity-null.test.ts` (5) runs the real `exportToZip` and
`exportToZipWithFormats` over a stubbed `figma`. Against pre-#4299 `src` all 5 fail by name; against `main`'s `src` the
`aliasOf` literal-opacity test and the dot-notation test fail by name. Mutations: dropping the composed-color branch in
`convertVariableToDTCG` fails 13 by name (this file's 4 DTCG tests and #2365's); dropping the dot-notation branch fails
the dot-notation test; dropping the literal opacity fails the `aliasOf` tests.

**How it escaped.** #4299's tests exercised the DTCG file only. TokenPress keeps a separate raw-variable reader per
format (dot-notation and raw-figma each have their own `isVariableAlias` and value formatter), and no test sent the
composed value through every format, and `tools/exporter-comparison` compares DTCG only. The new test asserts no
`null` across the DTCG color formats and spaces and checks the dot-notation line exactly.
