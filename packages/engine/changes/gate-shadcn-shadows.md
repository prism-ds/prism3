---
engine: patch
---
The shadcn round-trip gate now checks the Tailwind theme's shadows (#4355). Each `--shadow-<rung>-value` in `:root` and `.dark` is read back through Chromium's computed `box-shadow`, layer by layer, and compared with the brand's `shadow.<rung>` for that mode: inset, the four lengths and the color. Which rung each variable holds is typed in the gate, not read from the emitter's map, so a theme whose shadows are swapped between modes, or hold the wrong rung (in the emitter or in the map), now fails by name. Gates only; no committed artifact moves.
