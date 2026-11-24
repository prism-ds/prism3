## (2026-11-24) — Arm 1's Storybook checks: an unregistered element is named at once, and the geometry reads the arm contract (#3969, #4436)

**#3969.** A Storybook check opening an element story whose tag the preview never registered waited out a 15 s
render timeout, story after story, before naming anything. With the button's import deleted from `preview.js`,
`check-build.ts` named nothing within 300 s. Now one page reads the built preview's registry before any story opens.
`a11y-harness.ts`'s `unregistered` checks the element tags, written by hand in `ELEMENT_TAGS`, and each one missing
fails by name: "p3-button is not registered in the built preview …".
- `check-build.ts` names the tag and skips that component's element stories. The whole check took 50 s with the
  mutation.
- Every harness check (`check-axe`, `check-aria`, `check-keyboard`, `check-rtl`, `check-geometry`) names it before
  `run`. `check-geometry` took 5.7 s with the mutation. Each also gains a self-test mutant that leaves `p3-button`
  undefined, and the mutant must be named.

**#4436.** `check-geometry.ts` now reads everything it measures from the arm's input contract:
- the stories (`forms`; a `template` form's cases are every built story its pattern matches);
- each root and part selector, and each case's variant through a new `variant` field (an attribute prefix, or props
  written per case);
- the focus ring (`focusRing`: outline, part or none), and the button's label through its `container/label` part.

`--contract`, `--storybook` and `--record` point it at another arm. The contract's first form is the reference, and
every other form is held equal to it. Arm 1's contract now lists `html` first, so arm 1's record is unchanged: the
same 60 cases, equal as data, and the Figma comparison gives the same 138 of 809.

`check:build` runs the contract check and the geometry again on `fixtures/other-arm.contract.json`. It describes arm
1's Storybook the way another arm would: its own form names, story ids listed per case, class roots, variants written
per case, and a token map. Token parity (`check-parity.ts`, `check-parity-fields.ts`, and so `check-token-parity.ts`)
names each token's CSS custom property through the contract's `tokens`. `ARM-CONTRACT.md` (and #4578) lists what still reads
arm 1, and why: token parity's probes, the Storybook conventions `open` relies on, the registry check, and the
accessibility checks.

**Checked.**
- The fixture runs through geometry: 78 checks, with its two self-test mutants named. The base `check-geometry.ts`
  had no `--contract` and measured arm 1's own contract whatever the flag said.
- Mutations, each by name:
  - a typo in the fixture's root;
  - arm 1's `tokens` mapped to a wrong name ("container background-color binds color.interactive.primary.fill.hover,
    the spec names color.interactive.primary.fill.rest");
  - a contract with no `variant`;
  - a `variant.cases` prop the def doesn't have (two new `check-arm-contract.ts --self-test` cases);
  - the button's import deleted from `preview.js`, as above.

**Scorecard.** No row's value moves: geometry across the forms stays 360 checks, token parity 1,770 and 1,666. Each
harness check gains one self-test mutant, which the card doesn't count. The scorecard harness and the CLI runs aren't
touched.

### After review (CHANGES at `0d07f5e2`)

- **The #4436 fixture step can now fail on the defect it fixes.** The review's mutation, `const CONTRACT_FILE = ARM_1;`
  (base's defect: `--contract` ignored), passed: the fixture describes arm 1's own Storybook, so a run that fell back to
  arm 1's contract found every story, ran arm 1's mutants and overwrote arm 1's record. `check-geometry.ts` now reads
  the file `--contract` names by its own path, never through `CONTRACT_FILE`, and fails when the loaded contract's `arm`
  isn't that file's: `FAIL setup: --contract names the contract "…", but the geometry loaded "arm 1: …" (#4436) …`.
  Before the fix the same mutation exited 0; after it, it fails by name. No scorecard row moves.
