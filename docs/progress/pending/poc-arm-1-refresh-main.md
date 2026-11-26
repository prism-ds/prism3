## (2026-11-26) — Arm 1 carries main to a02951ce, and its components bind the motion presets (#3408)

### What changed
- `poc/arm-1` merges `origin/main` (132 commits since 0d7d289f) with a normal merge. Fifteen files were hand-resolved; the PR body lists each one. Arm 1's executor change takes revision 76 above main's 75, and names the two fields it redraws.
- Button binds `motion.preset.state` for its state change and `motion.preset.press` for its press. Spinner's enter fade binds `motion.preset.pop`, and its turn stays on the `motion.duration.spin` loop period. `@prism3/css` regenerates from those bindings, so `button.css`, `text-field.css` and `password-field.css` name preset variables everywhere except the spinner's turn.

### Why the defs and not the CSS
The CSS is generated from each def's `motion` bindings in `specs.json` (#3839, #4375). Editing the CSS alone would fail `check:generated`. Teaching the generator a mapping would leave the def saying one thing and the code another. So the bindings move in the def, and every surface that reads them follows.

### Traps
- The press preset defaults to the `instant` step, not `fast`, so the press is shorter than before. `check-browser.ts` now reads the press's duration and curve from `motion.preset.press`, and no longer assumes they equal the state change's.
- `test-arms.txt` became one file per arm on main (#4455). Arm 1's two `#4461` arms moved into `packages/engine/test-arms/`.
- ToggleButton still binds the old roles. It copied Button's bindings, and it is not a PoC component, so it is filed separately rather than moved here.
