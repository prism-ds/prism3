# `tools/poc-ejection/` — ejection, both modes (#3408, plan item 3)

```sh
npx tsx tools/poc-ejection/eject.ts --mode package        # every package from `npm pack` tarballs (Q84 A)
npx tsx tools/poc-ejection/eject.ts --mode source         # the component source copied in; the tokens stay a tarball
npx tsx tools/poc-ejection/eject.ts --mode <m> --keep     # leave the client in $TMPDIR and print where
npx tsx tools/poc-ejection/eject.ts --mode <m> --plant file-link|engine-import|repo-url   # a planted leak
npx tsx tools/poc-ejection/eject.ts --self-test           # the counter and the summary line, on planted fixtures
```

Each run builds a standalone client in `$TMPDIR`, outside the repo. The client has the brand's token CSS and all
three POC components (button, text field and password field), each in both forms: plain HTML/CSS and the custom
element. The page is `client/index.html`, and the entry is `client/main.<mode>.js`. The run then checks two things:
- **It builds clean:** esbuild exits 0 and prints no warning.
- **It renders, in Chromium, from disk:**
  - no script error;
  - every element is defined and renders its markup;
  - the plain password field's script runs;
  - the filled HTML button has a solid token fill, and its background, height and radius equal the element's.

**Source mode** runs `copy-source.mjs`, the copy script a client would run. It copies each component package's
published files, less the README, byte for byte, into `src/prism3/`. Then it installs what the copies need (Lit).

**What it measures, per mode:**
- **Steps:** each command the client runs or file it writes by hand, in order.
- **Wall-clock seconds:** from the first step to a built client. The render check is timed separately.
- **Two counts of references left to prism3** (`refs.ts`):
  - **(a) references back into the repo or workspace.** Each is named by kind: a `file:` or `link:` into the
    repo, a `workspace:` link, an import of a `@prism3` package the client wasn't given, a path that resolves into the
    repo, the repo's absolute path, a path that names a file in the repo, or the repo's URL.
  - **(b) `@prism3/*` package names.**
- **How an upstream change arrives,** for each piece: by a package version, or by no channel. This is a measurement
  only, until #3411 is built.

**Scored count: owner decision D1.** Until D1 is answered, the run scores count (a), the plan's option A, and its line
says "D1 pending". The choice is `SCORED` in `eject.ts`.

**What it scans:** every file the client owns. That's everything under the client folder except `node_modules/` and
`dist/`, so in source mode it includes the copies. References in the installed `node_modules/@prism3/` files are
printed on their own line and never added to (a).

**It exits 1 on:** a failed step, a build warning, a failed render check, or a scored count above 0. The scorecard
then reads FAIL with this tool's line, never a count. The rows are `eject-package` and `eject-source` in
`tools/poc-scorecard/measures.ts`. It needs the npm registry for Lit and esbuild (a warm npm cache serves them) and
Chromium.

**Independence (`docs/34`):** the counter never reads the copy script, the install output or the step list. It knows
the repo from the repo: its root, its folders and files, its workspace names and its URL. The packages each mode
delivers are written down in `eject.ts`. The self-test plants each kind of reference into a clean fixture, and each
must count exactly 1, by that kind. `--plant` does the same to a real run, which must FAIL by kind.
