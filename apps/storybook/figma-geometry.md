# Figma's geometry record: the Mac job (#3408 S6, KPI 2)

KPI 2 compares, for each state, what Figma actually lays out with what the browser lays out (Q32 A). The browser's
side is measured in CI (`check-geometry.ts`). Figma's side can only be read in Figma, so it comes from this job and
is committed as `apps/storybook/figma-geometry.json`. Until it is, `compare-figma-geometry.ts` fails, naming this job;
its `--self-test` (in `check:build`) proves the arithmetic on planted records.

## What it reads

`figma-geometry.js` reads every member of the `button`, `text-field` and `password-field` component sets in the open
file. It **writes nothing**: no node, page, style, variable or version. For each member it records the variant, each
boolean property's effective value on that member (#4461: the visibility of the node wired to it, or of the node shown
there unwired, listed under `unwired`; the set default only when neither exists), the extent, padding, stroke weights and corner radii, and every visible layer's box from
`absoluteBoundingBox`, relative to the member, with its node id, type and horizontal sizing. Each layer also records
its `border`, the stroke weight on each side that takes layout space (0 unless the frame includes its strokes in
layout), and, where it is stroked, its `stroke`: the weights, the alignment and whether they're in layout.

## Which file

The file holds the three component sets as the plugin builds them **at the commit being measured**, with a Prism3
theme applied: a scratch file, as `tools/component-roundtrip` uses. Which file the owner designates is an owner
decision on #3408. Never name the file or its key in a public issue, PR or comment.

## Steps (all on the Mac)

1. Make a worktree at the commit to measure and install in it (CLAUDE.md: never check out over someone's tree):

   ```bash
   git fetch origin && git worktree add --detach /tmp/p3-geometry-<run id> <full sha> && cd /tmp/p3-geometry-<run id> && npm ci
   ```

2. In Figma, the owner opens the designated file, brings it to the front, and runs the **Desktop Bridge** plugin there.
3. Run `apps/storybook/figma-geometry.js` through one Desktop Bridge call (`figma_execute`), its whole content as the
   code, unedited. It returns a JSON string.
4. Save the returned string, unedited, as `apps/storybook/figma-geometry.json` in the worktree.
5. Check it, against the code at the same commit:

   ```bash
   npm run -w @prism3/storybook build && npx tsx apps/storybook/check-geometry.ts && npx tsx apps/storybook/compare-figma-geometry.ts
   ```

   It prints `OK figma geometry: …`, or `FAIL figma geometry: N of M comparisons differ, in K findings` with one line
   per difference: `<component> <case> (<node id>): <what> is <code> in code, <figma> in Figma`. Lines that share a
   root cause print under one finding (`compare-figma-geometry.ts`, ROOT CAUSES): the button's root border, and the same
   difference repeated across cases. A difference is a finding, not a failure of the job.
6. Post the output verbatim to #3408, and push `figma-geometry.json` on a branch for a PR into `poc/arm-1`. The record
   names node ids and layer names only, no file name.

## Settled by a live run

The Desktop Bridge's `figma_execute` wraps the code in an async function body and returns only what the code
explicitly `return`s. The first live run got `undefined` back from a bare `(async () => { ... })();`, so the script
now starts `return (async () => {`. `compare-figma-geometry.ts --self-test` (in `check:build`) runs the script's
source the same way, in an async function body with a stub `figma` (one set, one member, one text layer), and fails by
name unless the record comes back. So dropping either `return`, the outer one or the IIFE's own, fails.

## Settled by the owner on the first record (#4432, 2026-11-21)

- **The button's transparent border** (CSS reserves 1px on every appearance; Figma's filled and text members have no
  stroke) is a real difference, and stays. It counts as **one finding**, not one per line: the comparison groups every
  border line, and every width or x line the border's difference explains exactly, under it.
- **Text line boxes** are modeled, not tolerated: Figma sets round(font size × line height), Chromium truncates the
  same product to 1/64px, and a centered text moves by half the difference. The code record carries each text part's
  computed font size and line height for this.
- **The fields** are compared through stories drawn with the message off (`<State>NoMessage`, at rest, hover,
  focus-visible, disabled and error), since Figma's members record `message` at its default, false. At error the code
  writes the message anyway (Q-POC2 A), so Figma's error member stays unreached: a finding, not a missing story.

## Settled by the owner on the press (#4581, 2026-11-24)

- **Geometry is layout, with transforms set aside.** The button's press (`:active`, `scale(0.98)`, Q-PS1 A) is motion,
  not layout, and Figma's pressed member draws no scale. `check-geometry.ts` sets the root's transform (and its
  transition) aside before it measures, so the press isn't a geometry difference. Another arm's press is measured the
  same way: the KPI 2 row on the scorecard says so. A glyph flipped right to left (`data-mirror`, #4052 A) keeps its
  box, so it doesn't move a measurement either.

## Part borders (#3408 KPI 2 findings, 2026-11-25)

The first records showed the field's content and entry inset 17px in code and 16px in Figma, and the Show/Hide
button 2px wider in code than its text. Both are a border: CSS's border takes layout space, and Figma's INSIDE stroke
(or the button's absent one) doesn't. A record made before this carried no part strokes, so those lines counted as
findings of their own. Each record from this one on carries every layer's layout border, and the code record carries
each part's CSS border and padding. The comparison then groups every line a part's border explains under that part,
one finding per bordered part, as it does for the button's root. Whether that difference stays is OWNER DECISION G1
on #3408.

## Not yet verified live

Still unconfirmed: that `loadAllPagesAsync` and `findAllWithCriteria` are allowed from the Desktop Bridge; that the
layer names match the anatomy's part paths (`container/label`; the plugin names layers by part); and how Figma reports
a stroke that sits inside the frame (CSS's border takes layout space, and Figma's inside stroke does not, so the first
run may show a 1px padding difference on the button: a real finding if so).
