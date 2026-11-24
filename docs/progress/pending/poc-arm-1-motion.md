## (2026-11-24) — Arm 1: @prism3/css writes Button's motion bindings, and the generator refuses one it has no rule for (#4375)

**What changed.** #3841 (Q146 A) bound Button's state change and press to five motion tokens, and `@prism3/css` had
ignored them since refresh 4. `generate.ts` now writes them:
- **The state change.** Each part's transition names exactly the paint properties the spec's color rows set on it, on
  `motion.state` with `motion.state-easing`: the container's fill and border, and the ink of the label, visuals and
  spinner. A paint added to the def is animated without an edit here.
- **The press.** `:active` scales the button by 0.98 on `motion.press` with `motion.press-easing`. 0.98 is a
  documented raw value (Q-PS1 A); no token holds it. An inert button (disabled, inactive, pending) never scales.
- **Reduced motion.** The colors keep `motion.state-reduced`, and the press is none, as `motion.reduceMotion` says.
- **Strict about motion keys** (the refresh 3 lesson, now for motion). Every component the package draws (button,
  the two fields, and what they nest) must have a rule for each motion binding it carries, or generation stops:
  "button carries motion binding motion.lift that @prism3/css has no rule for (#4375)".

**The checks read settled values.** A forced state used to be read straight after `CSS.forcePseudoState`. With a
100ms transition, `check-browser.ts` read 16 values at their start. It now waits for every finite animation to end. The
parity check's sentinel durations run for seconds, so it finishes them (`Animation.finish()`) rather than wait.

**Checked.**
- `check-parity.ts` gives durations (`<i>ms`) and curves (`cubic-bezier(0.5, <i>, 0.5, 1)`) their own sentinels, so
  each motion binding decodes to one token name from the transition Chromium computes. That matters because the
  house brand resolves `motion.duration.fast` and `motion.duration-reduced.fast` to the same 100ms, so a value
  comparison can't tell them apart. Its map from key to property is written by hand, and an unmapped key is a gap.
  42 new bindings (3 appearances × 14).
- `check-browser.ts` holds the resolved values on light and dark, each on a light and a dark OS. It also holds the
  0.98 press, as its own literal, and that no inert button scales. Under reduced motion it holds the reduced
  durations and no press.
- **Fails before.** Against the base `button.css`, parity fails 42 bindings by name ("motion.state (container
  background-color duration) binds (no token: dur:0)"), and the browser check fails 32.
- **Mutations, each by name:** a key added to the def's motion (`motion.lift`) passes `check:generated` on the base
  and fails it here. The press rebound to the reduced duration, and the reduced-motion rule dropped, fail parity. The
  transitions removed, the press kept under reduced motion, and a disabled button that scales fail the browser check.

**Scorecard.** KPI 2 token parity, HTML/CSS form: 1,770 → 1,812 bindings. Component form: 1,666 → 1,708. No other
row moves. Storybook's pressed stories now show the scale in both forms, and both forms still agree.
