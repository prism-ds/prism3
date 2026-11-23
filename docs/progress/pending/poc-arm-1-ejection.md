## (2026-11-23) — Ejection, both modes: a standalone client outside the repo, measured (#3408)

**What changed.** A new measurement tool, `tools/poc-ejection/`, with no engine change. This is item 3 of the arm 1
plan on #3408.

- `eject.ts` builds a client in `$TMPDIR` with the tokens and all three POC components in both forms.
  - **Package mode** installs from `npm pack` tarballs (Q84 A).
  - **Source mode** copies the component source in with `copy-source.mjs`. The tokens stay a tarball (Q32 A).
- It checks that the client builds clean and renders in Chromium. Every file the bundle reads, from esbuild's
  metafile, must lie inside the client.
- It measures the steps, the time and two counts of references left to prism3 (`refs.ts`):
  - (a) references back into the repo or workspace, by kind;
  - (b) `@prism3/*` names.
- It records how an upstream change reaches each piece.
- The scorecard now measures both ejection rows. Per owner decision D1 (A, 2026-11-23), it scores count (a).

**Arm 1, measured:**
- **Package mode:** 0 references back into the repo; 19 `@prism3` names; 9 steps; 2.8s warm, 3.7s cold. Upstream
  changes arrive by package version.
- **Source mode:** FAIL at 13 references back into the repo. Every one is a repo path in a copied file's comment
  header. It took 9 steps; 2.6s warm, 3.5s cold. The tokens update by package version. The copied components have no
  channel: none of them carries an upstream version, and that waits on #3411.

**Held for the owner:** three decisions, in the PR body.
1. A D1 detail: does a repo path in a comment count toward (a)?
2. A D1 detail: do the installed packages' own files count toward (a)?
3. What does the copy script do with the copies' "generated, do not edit" headers?

**Checked:** 21 self-test cases on the ejection and 12 on the scorecard. Six code mutations each fail their own case by
name. Three leaks planted in real runs (a `file:` link to the engine, an `@prism3/engine` import, the repo URL) each
fail by kind.

**Review fixes.** The counter missed a multi-line `import {…} from` into the repo, and a relative `new URL(…)`. It now
matches `from '…'` on any line, and `new URL(…)`. The metafile check now backs it up: a multi-line import planted into a
real client fails both checks. `byKind` sorts with `localeFreeCompare`. A failed npm step quotes npm's first error line.
The counter also reads a `new URL(` whose string is on the next line: esbuild doesn't read a `new URL()` as an input, so
the metafile check can't. A build that fails to resolve quotes esbuild's first `[ERROR]` line. D1 is answered (A), so
the "D1 pending" mark is gone from the cells.
