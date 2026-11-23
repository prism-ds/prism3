## (2026-11-23) — TokenPress's version has one source, and it is 3.0.1

**What.** TokenPress's panel showed a hand-typed `v2.2.2` (`src/ui.html`) while every export's
`$extensions.generator.version` read `3.0.0` from `package.json`. `package.json` is now the only place the version is
written. `src/ui.html` holds `v__PLUGIN_VERSION__`, and `build.mjs` writes `dist/ui.html` with the number in place, beside
`dist/code.js`, whose `define` already stamped the same value. `manifest.json` now loads `dist/ui.html`; the build asserts
the placeholder is gone and the label reads the package version, as it already asserted the code stamp. The version is
3.0.1, a patch for #4479's fix, and TokenPress's `docs/CHANGELOG.md` turns `[Unreleased]` into `[3.0.1]`, led by that fix.

**The test.** `tests/unit/version-single-source.test.ts` runs the real build and reads the label out of `dist/ui.html`
and the generator stamp out of `dist/code.js`, holding both to `package.json`. It reads the built files, not
`globalThis.__PLUGIN_VERSION__`: under tsx that is set by `test.ts` from `package.json`, so a check against it could not
fail. Matching values are not enough either, since a label typed to the current number matches until the next bump. So
the source label must be the placeholder, and no `N.N.N`, with or without a `v`, may appear in `src/ui.html`. A build that throws fails a test
by name rather than killing the suite. Before the change, 3 of its tests failed by name (label, placeholder, manifest).
Mutations, each failing by name: the label hard-coded to `v3.0.1` (the placeholder test); the panel stamp dropped from the
build (the build test and the label test); `define` hard-coded to `'3.0.0'` (the build test and the stamp test).
Review found that the panel-stamp mutation passed on a tree built once, because the test and the build's `verify` read
a `dist/` left over from the earlier build. Both now remove `dist/ui.html` and `dist/code.js` before building, so that
mutation fails by name on a built tree too, as does `Version 3.0.1` added to the panel's `<title>`.

**Trap.** A bump changes two files: `package.json` and the `apps/tokenpress` workspace entry in the root
`package-lock.json`. Miss the second and `npm ci` fails. No prism3 gate pinned TokenPress's version;
`tools/exporter-comparison/run-tokenpress.ts` and `test.ts` both read `package.json`. The example exports under
`apps/tokenpress/test-examples/` still say `3.0.0`, which is what produced them, and are left alone.

**Held for the owner.** 3.0.1 carries every `[Unreleased]` entry since 3.0.0, not only #4479's fix. That includes
gradient export and team-library aliases, which some would call a minor (3.1.0). The patch number is as asked; the
changelog says what the build contains. The Figma Community listing keeps its own counter.
