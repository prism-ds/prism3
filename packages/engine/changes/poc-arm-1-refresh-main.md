---
engine: minor
---
Button and Spinner bind the motion presets (#3408, #2857). Button's state change binds `motion.preset.state` and its press binds `motion.preset.press`, the presets the `hover` and `pressed` patterns name. Spinner's enter fade binds `motion.preset.pop`, the quick-arrival preset, with the same default values it had before. Its turn stays on the `motion.duration.spin` loop period, because no preset times a loop. By default the press now takes the `instant` step instead of `fast`. The generated `@prism3/css` follows the bindings.
