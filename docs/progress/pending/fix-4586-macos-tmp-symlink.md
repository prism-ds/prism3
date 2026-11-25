## (2026-11-25) — A symlinked path decides nothing: real paths for the entry guard and the temp root (#4586, #4583)

**What was wrong.** On macOS the temp root sits behind a symlink (`/var` → `/private/var`, and `/tmp` → `/private/tmp`). Linux's doesn't, so CI never saw either defect:
- **#4583, the entry guard.** 37 scripts decided "am I being run, or imported?" with `resolve(process.argv[1]) === fileURLToPath(import.meta.url)` or a close variant. `argv[1]` is the path as typed or spawned; `import.meta.url` is the real path V8 loaded. Through a symlink they differ, so the script skipped its whole check and **exited 0, a silent pass**. `lint-push-base`'s replay spawns gates from clones under the temp root, so four of its `shadcn-vars` cases read a pass on a Mac, and any gate run from a symlinked checkout (`/tmp/<worktree>` on a Mac) ran nothing.
- **#4586, the temp root.** `tmpdir()` returns the root unresolved. The `#1870` coverage fixture in `test.ts` looked up its own coverage entry by `pathToFileURL`, which never matched V8's real path, and `check-package.mjs` checked that the resolved CSS `startsWith` its unresolved temp folder.

**The fix, at the source.**
- `packages/engine/entry-point.ts` holds `isEntry(import.meta.url)`, which compares the real paths of both sides. The surfaces reach it through `@prism3/engine/harness`, the node-only entry, and `tools/` scripts by relative path, as they reach other engine modules. Every guard of the old shape now calls it: 37 files across the engine, the plugin, the studio and `tools/`. The two plain-node `.mjs` scripts carry the same comparison inline. Where `argv[1]` names a *different* file with this module's name, `isEntry` throws by name rather than guess.
- **Removed or kept:** no guard was obsolete. Each one keeps a module importable for its exports without running its check.
- **The extension left off (the #4602 review).** A gate run as `npx tsx packages/engine/regen --check` is loaded as `regen.ts`, but `argv[1]` stays the extensionless path, which names no file. Every guard read that as "not the entry point" and exited 0 having printed nothing: `isEntry`, the four `/name\.ts$/` tests (`token-contract.ts`, `component-contract.ts`, `kb-briefs-refresh.ts`, `tools/binding-audit/reconcile.ts`) and the two inline `realpathSync` guards (`verify.ts`, `lint-advisory-expiry.ts`). `isEntry` now tries a missing `argv[1]` again with the module's own extension, and all six now call it. The two plain-node `.mjs` scripts keep their inline guards: run without the extension, they fail to load, loudly.
- Every temp root is taken as `realpathSync(tmpdir())`: 63 sites in 27 files.
- The two sites that compare a temp path with a runtime path now reach their temp folder through a symlink they make themselves, then resolve it: the `#1870` fixture and `check-package.mjs`. So Linux CI holds the resolve too.

**Held by.** A new `test.ts` block makes its own symlink, so it reproduces the class on Linux:
- `isEntry` against the old guard on a path through it;
- a guarded file and the real `shadcn-vars.ts --check`, each run through it;
- a run of `isEntry`, and of the real `token-contract --check`, with the extension left off;
- a scan of 800 tracked scripts, which fails by `file:line` on any guard of its own or unresolved temp root. In a `.ts` file outside `entry-point.ts`, any code line that reads `process.argv[1]` is its own guard, so a comparison split over two lines and a name test are both named; a namespace-qualified `os.tmpdir()` is a temp root like a bare one. The scan first judges planted sources whose verdicts are typed, the review's two blind spots among them.
- the in-process `isEntry` probes are wrapped, so a guard that throws fails its own arm instead of stopping the suite.

**Not reproduced:** the suite hang #4586 mentions didn't recur in any run in this lane, on the default temp root, before or after the fix. If it comes back, the run's last arm is the place to start.
