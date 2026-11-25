# The arm input contract (#3408)

The KPI 2 and KPI 3 checks in this folder measure a Storybook. They don't need to know how an arm builds its
components. They need one JSON file that says where things are. Arm 1's is `arm-1.contract.json`. Another arm writes
its own, and `check-arm-contract.ts` tells it, by name, what's missing.

```sh
npx tsx apps/storybook/check-arm-contract.ts --contract <your-contract.json> --storybook <your storybook-static dir>
```

## KPI 1: the start state both arms share (K2 A)

KPI 1's from-scratch run starts from **the code on disk, untimed, with the npm cache warm** (owner decision K2 A on
#3408, 2026-11-24). Getting the code (a clone, a copy, or an `npm create` template fetch) is setup and isn't timed; the
install, when the run has one, reads a warm cache. Arm 1's run is `tools/poc-kpi1/kpi1.ts`, and its KPI 1 cell names
this start state. Another arm's KPI 1 run starts from the same state, so the two times measure the same thing. The
install is inside the time (owner decision K1 A, 2026-11-25): `npm ci` is timed, from the warm cache.

## What the file holds

```jsonc
{
  "format": "1.0",
  "arm": "a short name for the arm",
  "components": {
    "button": {
      "root": "[data-component=\"button\"]",       // the component's root, inside Storybook's #storybook-root
      "parts": {
        "container": "",                            // always '' (the root itself)
        "container/label": ":scope > .label",       // each anatomy part path: a selector relative to the root
        "container/spinner": { "unboxed": "why" }   // or a part with no box of its own in your markup, and why
      },
      "focusRing": { "drawn": "outline" },          // or { "drawn": "part", "selector": "..." } or { "drawn": "none", "why": "..." }
      "variant": { "attributes": "data-prop-" }     // or { "cases": { "error": { "validation": "error" } } }
    },
    "text-field": { "...": "..." }
  },
  "forms": {                                       // the FIRST form is the reference the others are held to
    "your-form-name": { "template": "components-{component}-{form}--{case}" },   // a story id pattern, or:
    "another-form":   { "cases": { "button": { "rest": "story-id", "hover": "story-id" } } }
  },
  "tokens": { "scheme": "stock" }                  // or { "scheme": "map", "map": { "--your-name": "pds3.color.text.primary" } }
}
```

- **Components.** `button` and `text-field` are required, because the brief names them for both arms.
  `password-field` is optional. Any other component id must be one the engine defines.
- **Part paths.** These come from the engine's anatomy for each component, which is `specs.json`'s `anatomy[].part` in
  the emitted component exports (`npx tsx packages/engine/emit-component-docs.ts --uncommitted --out <dir>`). Every part
  path must be mapped to a selector or declared `unboxed`. A part path the anatomy doesn't have fails. These are the
  same keys Figma's layers carry, so the geometry record can be set beside Figma's.
- **The focus ring** goes in `focusRing`, not `parts`. If the anatomy draws `container/focusRing`, `none` fails.
- **Variant.** How the checks learn which variant a story shows (the def's props it sets). Either `attributes`, a
  prefix the root carries each prop under (arm 1's `data-prop-size="small"`), or `cases`, the props each case sets,
  written out. A case `cases` doesn't list is every prop at its default. Each prop must be one the def has.
- **Forms.** Name as many delivery forms as the arm ships. Each form needs a story id for every KPI 2 state:
  - `rest`, `hover`, `focus-visible`, `disabled` and `pending` for every component;
  - `error` as well, for the fields.

  Each id must be in your built Storybook's `index.json`. Story ids that weren't checked don't count as a pass.
  A form may name more cases than these; the geometry check visits every one. A `template` form's cases are every
  built story its pattern matches.
- **The first form** is the reference: the geometry record is written from it, and every other form is held equal to
  it, to 0.01px.
- **Tokens.** Use `stock` if your CSS custom properties are stock Style Dictionary's names: `--` and the full token
  path, each `.` a `-` (`--pds3-color-text-primary`). Otherwise, give a `map` from each property to its token path.
  Every path must be a token in `packages/engine/out/prism3.tokens.json`.

## What reads it

- `check-geometry.ts` reads everything it measures from the contract (#4436): the stories (`forms`), each root and
  part selector, each case's variant (`variant`), the focus ring (`focusRing`), and the button's label (its
  `container/label` part). `--contract <file>` points it at another arm's, `--storybook <dir>` at its build, and
  `--record <file>` says where to write its record. A part the contract maps to a selector that no story drew, in any
  form, fails by name, so a selector that matches nothing can't drop its part. Arm 1's run is also held to
  `expected-stories.ts`; another arm's run is held to its KPI 2 stories.
- `check:build` runs the contract check and the geometry again on a second contract,
  `fixtures/other-arm.contract.json`. It describes arm 1's Storybook the way another arm would: its own form names,
  story ids listed per case, class roots, variants written per case, and a token map. So a contract that isn't arm 1's
  runs through the geometry steps on every build.
- `compare-figma-geometry.ts` compares exactly the contract's boxed parts. A Figma layer for a part the contract maps
  fails when no code case drew it. It no longer drops out because the code never drew it. `--contract <file>` points it
  at another arm's contract.
- `check-arm-contract.ts` validates every field.
- Token parity (`packages/css/check-parity.ts`, `check-parity-fields.ts`, and so the element form's
  `check-token-parity.ts`) names each token's CSS custom property through arm 1's `tokens`.

## Still arm 1's, and why

These read arm 1 directly (filed as #4578). Each needs a decision or a build on the day arm 2's repo is readable:

- **Token parity's probes.** The parity checks render markup written from `@prism3/css`'s own README contract, with
  `@prism3/css`'s stylesheets, not a Storybook. Only the token naming comes from the contract. Arm 2's token parity
  needs its own probes, or a check that decodes sentinels on its Storybook, and its `tokens` is what that check reads.
- **How a story is opened.** `a11y-harness.ts`'s `open` assumes arm 1's Storybook conventions: the `theme` and `dir`
  toolbar globals, a `[data-story-frame]` wrapper that carries them, the pseudo-states addon's classes for hover,
  pressed and focus-visible, and the password field's revealed Show/Hide button. An arm 2 Storybook needs the same, or
  the contract needs fields for them. It waits for the contract's root, not arm 1's.
- **The registry check** (#3969) reads arm 1's element tags. Another arm's run reads none, because its contract
  doesn't name its tags.
- **The accessibility checks** (`check-axe.ts`, `check-aria.ts`, `check-keyboard.ts`, `check-rtl.ts`) and
  `check-build.ts` visit arm 1's story list and read arm 1's classes. They're KPI 3 checks of arm 1 against itself.
