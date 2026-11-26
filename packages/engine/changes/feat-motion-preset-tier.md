---
engine: minor
---
Motion phase 1 (#2857): presets become a published alias tier, and the motion tokens are rebuilt to the owner's structure, primitives → roles → presets. This is a clean break: nothing consumed the motion variables, so `CONTRACT_VERSION` takes its own MAJOR, 16.0.0.

- **Presets.** Each of the ten presets (`state`, `fade`, `crossfade`, `move`, `reveal`, `draw`, `surface`, `expand`, `step`, `settle`) is `motion.preset.<name>.duration`, `.easing`, `.delay` and `.duration-reduced`, each an alias of a step, role, curve, spring or delay, never a number, plus `motion.preset.<name>.transition`, the DTCG transition over those slots. Defaults are the approved rows. A preset eased by a spring plays for the spring's settle time; its composite is `springTransition`, which the conforming projection omits.
- **Brand input.** `motionPersonality.presets` re-points any slot, with each a motion path (`{ surface: { duration: duration.longer, easing: easing.landing } }`); the old string form is refused. `motionPersonality.curves` adds a brand's own named curves beside the six, refused when one overshoots, leaves CSS's x range, takes a built-in name, or does not fit the role that uses it.
- **Reduced motion.** Every step's reduced twin is `min(full, 100ms)`: ordered at every tempo, and never 0.
- **New primitives.** `motion.spring.effects` (damping 1, stiffness 1600, with its settle time and CSS curve), `motion.delay.show` (400ms) and `motion.delay.min-show` (500ms), the same at every tempo, and `motion.distance.nudge` → `space.100`.
- **Removed.** `motion.transition.default`, `.enter`, `.exit` and `.emphasized`. `motion.duration-ms.50` is no longer reached by every brand, so it is brand-dependent.
- **Figma.** The `motion` collection gains each preset slot as a published TIMING or EASING alias, the delays, and each spring's settle time as a hidden TIMING primitive. Springs are hidden primitives now that a preset is the handle on them. A spring preset's easing aliases the spring, bounce only. Distance has no Figma form yet.
- **Sidecar.** `motion_presets` names each preset's tokens and what each slot resolves to (`prism3-ai-metadata/0.8`).
- **Springs.** A spring stiffer than 1000 is sampled more finely than 5ms, so its `linear()` curve keeps the 0.005 bound; every existing spring is unchanged.
