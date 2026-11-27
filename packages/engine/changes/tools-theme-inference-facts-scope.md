---
engine: patch
---
The file facts report moves to `prism3-file-facts/0.2` (#2853). A scan now takes a scope: the whole file, the canvas selection (the current page when nothing is selected), or an explicit list of page or layer ids. The report states the scope it used, and an id the file does not hold refuses the scan by name. The report also carries an inventory: one row per top-level frame, section or component set in scope, with its size, position, background, explicit variable modes, a structural fingerprint, layer counts, font families and most-used fills. The seed reads 0.1 and 0.2 reports, and refuses any other format by name.
