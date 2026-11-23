## (2026-11-23) — TokenPress exports a team-library alias as the library's value (#4490)

**What.** A Community user reported that exporting a collection whose variables alias variables from another file
(a published library) fails. The Community build predates #4356 (#4166), which is on `main` but unreleased: there the
alias wrote `{VariableID:…}` and the validator's broken-alias error blocked the export. On `main` the export no longer
stops, but it still breaks downstream. #4356 writes the alias as `{brand.primary}`, a reference to a token the export
doesn't hold. Style Dictionary fails the build on it, and the CSS format writes `var(--brand-primary)`, a custom
property nothing declares.

**What the Plugin API gives.** The alias is a `VariableAlias` whose id names the library variable
(`VariableID:<key>/<id>`). `figma.variables.getVariableByIdAsync` returns `Promise<Variable | null>` (typings: "If not
found or the provided ID is invalid, returns a promise containing `null`"): the remote `Variable` (`remote: true`,
`valuesByMode` keyed by the library collection's modes) for a variable the file has imported, otherwise `null`. It
doesn't throw for an unknown id, and the scanner catches a rejection anyway. The local-only assumptions #4166 found
(`getLocalVariablesAsync` as the only source in `scanner.ts`, the exporter's and raw-figma exporter's id maps) are closed
on `main`. This PR doesn't change them. It isn't checked against a live host. The fakes follow the typings.

**Fix (owner decision A, 2026-11-23, on #4490).** In `convertVariableToDTCG`, an alias whose direct target is a
library variable exports the value it resolves to, through `resolveInMode`. That is the walk #2365 added, so it reads
the library collection's default mode and follows a chain inside the library. The value is converted with the scopes of
the variable that holds it, so an unscoped alias to a library OPACITY variable is `0.4`, not `40`. The reference moves
to `$extensions.figma.externalAlias.reference`. A chain that reaches no value keeps the reference as `$value`, as
before. A local alias to a local alias of a library variable stays a reference, because its target is in the export.
This reverses the `$value` shape #4166's decision C pinned. That shape has not been published, so no Community user
relies on it.

**Verification.** `tests/unit/library-alias-standalone.test.ts` (8) runs the real `exportToZip` and
`exportToZipWithFormats` over a stubbed `figma` with fake remote variables. Its first test walks the exported files and
asserts every `{…}` in a `$value` names a token the export defines. Against `main`'s `exporter.ts`, 7 of the 8 fail by
name, and so do #4166's two `$value` assertions. The dangling-chain test fails too, because it asserts the new
`reference` field. The one that passes is the local-chain case, which pins unchanged behavior. Mutations: forcing
`standalone = false` fails 6 by name, and converting with the local alias's scopes fails the opacity test by name.

**How it escaped.** #4356 tested that the reference was *named* (`{brand.primary}`, not `{VariableID:…}`) and never that
it *resolved*. No TokenPress test reads an export the way its consumer does. `tools/exporter-comparison` runs over
prism3's own emission, which has no library aliases. The new first test checks resolution over the exported files
themselves.

**Left open, filed as #4492.** A text style or gradient stop bound to a library variable writes the style's own
resolved value, so it builds on its own, but it keeps no record of the binding.
