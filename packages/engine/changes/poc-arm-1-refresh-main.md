---
engine: minor
---
Button binds the motion presets (#3408, #2857). Its state change binds `motion.preset.state` and its press binds `motion.preset.press`, the presets the `hover` and `pressed` patterns name. By default the press now takes the `instant` step instead of `fast`. Spinner keeps the roles the motion skill's spinner recipe names: `motion.duration.fast` on `motion.easing-role.enter` for its fade, and `motion.duration.spin` for its turn. The generated `@prism3/css` follows the bindings.
