---
engine: minor
---
Button's press and release follow the `pressed` and `pressed/release` motion patterns (#4629, #3408). Each Button def adds `motion.press-reduced`, bound to `motion.preset.press.duration-reduced`, so under reduced motion the press's color change keeps its own preset's reduced duration (R7). The generated `@prism3/css` writes the press's transitions on the pressed rule, its scale and colors on `motion.preset.press`, and the release's on the resting rule, on `motion.preset.state`. Before, each property had one transition both ways, so the scale ran on `press` and the colors on `state`.
