# `tools/poc-kpi1/` — KPI 1, developer + CLI, with KPI 3's one-edit check (#3408, plan item 4)

```sh
npx tsx tools/poc-kpi1/kpi1.ts --run scratch                  # from a fresh copy to a built, checked component set
npx tsx tools/poc-kpi1/kpi1.ts --run update                   # one edit to the brand input, propagated, then KPI 3
npx tsx tools/poc-kpi1/kpi1.ts --run <r> --keep               # leave the copy in $TMPDIR and print where
npx tsx tools/poc-kpi1/kpi1.ts --run scratch --plant drift    # a generated file that isn't the committed one
npx tsx tools/poc-kpi1/kpi1.ts --run update --plant skip-cli  # the edit made, the CLI not run after it
npx tsx tools/poc-kpi1/kpi1.ts --run update --plant skip-build  # the tokens emitted, the token CSS and Storybook not rebuilt
npx tsx tools/poc-kpi1/kpi1.ts --self-test                    # the judges and the summary lines, on planted data
```

This is the **scripted floor** of the brief's "Developer + CLI" experience. A person's run is separate (B2 on #3408),
and this is the floor it's compared with. Each run works in a copy of the tree in `$TMPDIR`, never in the tree
itself. The copy holds the files git tracks plus the untracked ones it doesn't ignore, as a fresh checkout of the
measured commit would. Making the copy stands in for `git clone` and isn't timed.

**From scratch.** The copy loses every output the run must make. Those are listed by hand in `GENERATED`: the brand's
token files, the component CSS, the elements and their manifest. The token CSS and the Storybook build are never
committed, so the copy has neither. Then, timed, in order:
1. `npm ci`;
2. the engine CLI on the brand input (`packages/engine/examples/prism3.design.md`);
3. `@prism3/css`'s generator;
4. `@prism3/web-components`' generator;
5. the Storybook build, which builds the token CSS first.

The run succeeds when every command passes on its first try, every removed file comes back equal to the committed one,
and `apps/storybook/check-build.ts` passes on the copy. The CLI's `build` stamp is the one allowed difference: a live
run writes one, and the committed file doesn't. The checks aren't timed.

**The update.** The scratch run is its setup, untimed and not counted. Then, timed:
1. one hand edit to the brand input (`EDIT`): the primary color from `{ l: 0.4709, c: 0.3001, h: 266.75 }` (the blue)
   to `{ l: 0.52, c: 0.14, h: 160 }` (a green), and `radiusScale` from 1 to 2, which doubles every corner;
2. the engine CLI;
3. the Storybook build.

Nothing else runs. The component CSS and the elements bind token names, not values. The run checks this rather than
assuming it: after the edit, both generators' `--check` must pass, or the run fails and names the generator the update
also needed. Arm 2 makes the same change by value.

**KPI 3: one edit reaches both forms** (`one-edit.ts`). There are four probes, written by hand: the button's fill and
corner, and each field's corner. Each names its part's selector, the CSS property and the token it binds. Each probe is
read in Chromium in both forms (the HTML story and the element story) and both themes, before the edit and after it.
That makes 16 readings. The oracle is the emitted DTCG, resolved through its aliases (the dark overlay first, for
dark). The browser's value comes through Style Dictionary's CSS, the component CSS and the cascade. A reading fails,
by probe, form and theme, when:
- it isn't read at all;
- its value before the edit isn't the token's value before;
- its value after the edit isn't the token's new value ("unchanged: the edit did not reach it");
- the edit didn't move its token, so the probe would pass whether or not the edit reached anything.

The reader and the judge share `one-edit.ts`'s form and theme lists, so a reader that dropped a form would drop it from
the judge too. `kpi1.ts` therefore holds each live read to its own typed scope (`SCOPE`: both forms, both themes, 16
readings), and a read outside it fails by name.

**What it logs:**
- the wall-clock seconds;
- each command, with its seconds;
- the hand edits, with the update's own edit counted apart from fixes. A fix is a hand edit the run needed beyond the
  one it was asked to make. The script makes none, so a run that would need one fails instead;
- the errors. A command that exits non-zero ends the run, so a passing run has 0 and was right first time. A failed
  run's line carries the cause: the first failure line plus up to five of the `- …` lines listed under it (how
  `check-build.ts` and the a11y checks name each failure), so a red first try can be diagnosed from the card.

**Owner decision K1 (#3408, pending):** does the from-scratch time include `npm ci`? The value uses A (timed) until the
owner answers. The line names the install's own seconds and the decision, so either reading is on the card. The choice
is `K1` in `kpi1.ts`, and the headline arithmetic (`headline`) is self-tested under both answers.

**Owner decision K2 (#3408, A):** the from-scratch start state both arms share is the code on disk (untimed) with the
npm cache warm (`npm ci --prefer-offline`). The cell names it, and so does the arm input contract
(`apps/storybook/ARM-CONTRACT.md`), so arm 2 runs from the same state.

**Scorecard rows** (`tools/poc-scorecard/measures.ts`): `kpi1-cli-scratch`, `kpi1-cli-update` and `kpi3-one-edit`. The
last reads the update run's second line. A measurement, not a CI gate: it needs the npm registry (a warm cache serves
it) and Chromium. It exits 1 with a FAIL line on any failure, so the card's cell reads FAIL, never a time.
