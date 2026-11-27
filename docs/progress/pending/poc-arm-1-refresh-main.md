## (2026-11-27) — Arm 1 carries main to a02951ce, and its button binds the motion presets (#3408)

### What changed
- `poc/arm-1` merges `origin/main` (132 commits since 0d7d289f) with a normal merge. Fifteen files were hand-resolved; the PR body lists each one. Arm 1's executor change takes revision 76 above main's 75, and names the two fields it redraws.
- Button binds `motion.preset.state` for its state change and `motion.preset.press` for its press. `@prism3/css` regenerates from those bindings, so `button.css` names preset variables for both.
- Spinner keeps `motion.duration.fast` on `motion.easing-role.enter` for its fade, and `motion.duration.spin` for its turn. The motion skill's spinner recipe names those roles, not a preset, and `lint-motion-literals.ts` holds the def's reduced prose to that recipe. Moving the fade to a preset starts with the skill, on main.
- Main's #4583 entry-guard rule met arm 1's Q142 A rule, under which `@prism3/css` and `@prism3/web-components` never import the engine. Each package gets one `entry.mjs`, the inline real-path guard main uses for plain node, instead of the engine's `isEntry`. Storybook and the PoC tools import `isEntry` as main's scripts do.
- The adherence scorer's `toCss` reads main's DTCG 2025.10 value forms (#4360): a color as `{ colorSpace, components, hex, alpha? }`, a dimension as `{ value, unit }`. Without that it resolved no semantic color from the conforming tree, and `@prism3/css`'s browser check could not start. Built from main's tree, the oracle now resolves every name it resolved from arm 1's string tree. The only values that differ are main's own changes, the reduced durations and the high-contrast dark shadows.

### Why the def and not the CSS
The CSS is generated from each def's `motion` bindings in `specs.json` (#3839, #4375). Editing the CSS alone would fail `check:generated`. Teaching the generator a mapping would leave the def saying one thing and the code another. So the bindings move in the def, and every surface that reads them follows.

### Traps
- The press preset defaults to the `instant` step, not `fast`, so the press is shorter than before. `check-browser.ts` now reads the press's duration and curve from `motion.preset.press`, and no longer assumes they equal the state change's.
- `test-arms.txt` became one file per arm on main (#4455). Arm 1's two `#4461` arms moved into `packages/engine/test-arms/`.
- ToggleButton still binds the old roles. It copied Button's bindings, and it is not a PoC component, so it is filed separately rather than moved here.
- A first draft moved Spinner's fade to `motion.preset.pop`. `lint-motion-literals.ts` failed it by name, because the def's reduced prose no longer matched the skill's recipe, so it was reverted.
