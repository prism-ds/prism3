## (2026-11-27) — Arm 1's generated button plays the press and the release on the patterns' presets (#4629)

### What changed
- `@prism3/css` writes per-state transitions. The pressed rule (`:active` on a button that isn't inert) carries the press's: the scale and every paint on `motion.preset.press`. The resting rule carries the release's, the same properties on `motion.preset.state`. Hover and every other state keep the resting rule's.
- The three Button defs add `motion.press-reduced` (`motion.preset.press.duration-reduced`). Under reduced motion the scale has no transition and resolves to none, and each color change keeps its own preset's reduced duration: the press's into the press, the state's otherwise (R7).
- `check-parity.ts` reads each binding in the state it plays into. A new arm reads the `pressed` and `pressed/release` patterns from the emitted `prism3.ai.json`, not from the def, and holds each track's duration, easing and reduced form. Three new mutants fail by name: the press on the release's preset, the release on the press's, and the reduced press's colors on the release's reduced duration. `check-browser.ts` reads both halves against resolved values and adds a mutant for the press on the release's preset.
- `lint-token-consumers.ts`: the unread motion register drops from 48 to 47, because Button now reads `motion.preset.press.duration-reduced`.

### Why per state, not per property
CSS takes a transition from the rule a property moves to, not the one it leaves. So a rule on `:active` sets how the button goes into the press, and the resting rule sets how it comes back. One transition per property can't express two presets for the same property, which is why the scale ran on `press` both ways and the colors on `state`.

### Traps
- The reduced press needs its own rule inside the media block. The resting rule's reduced twin has lower specificity than the pressed rule, so without it the pressed rule's normal transitions win under reduced motion.
- The pressed rule names every painted part, the spinner included. The spinner only shows on a pending button, which is inert, so that rule never matches. It's written anyway so a paint added to the def is covered without an edit.
