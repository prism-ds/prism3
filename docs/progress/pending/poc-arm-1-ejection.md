## (2026-11-23) — Ejection, both modes: a standalone client outside the repo, measured (#3408)

**What changed.** A new measurement tool, `tools/poc-ejection/`, with no engine change. This is item 3 of the arm 1
plan on #3408.

- `eject.ts` builds a client in `$TMPDIR` with the tokens and all three POC components in both forms.
  - **Package mode** installs from `npm pack` tarballs (Q84 A).
  - **Source mode** copies the component source in with `copy-source.mjs`. The tokens stay a tarball (Q32 A).
- It checks that the client builds clean and renders in Chromium.
- It measures the steps, the time and two counts of references left to prism3 (`refs.ts`):
  - (a) references back into the repo or workspace, by kind;
  - (b) `@prism3/*` names.
- It records how an upstream change reaches each piece.
- The scorecard now measures both ejection rows. While owner decision D1 is open, it scores count (a).

**Arm 1, measured:**
- **Package mode:** 0 references back into the repo; 19 `@prism3` names; 9 steps; 2.8s warm, 3.7s cold. Upstream
  changes arrive by package version.
- **Source mode:** FAIL at 13 references back into the repo. Every one is a repo path in a copied file's comment
  header. It took 9 steps; 2.6s warm, 3.5s cold. The tokens update by package version. The copied components have no
  channel: none of them carries an upstream version, and that waits on #3411.

**Held for the owner:** whether a repo path in a comment counts toward (a) (a D1 detail), and what the copy script does
with the copies' "generated, do not edit" headers.

**Checked:** 13 self-test cases on the counter and 12 on the scorecard. Six code mutations each fail their own case by
name. Three leaks planted in real runs (a `file:` link to the engine, an `@prism3/engine` import, the repo URL) each
fail by kind.
