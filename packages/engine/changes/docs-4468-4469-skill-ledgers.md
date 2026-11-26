---
engine: patch
---
Two skills now ask an agent to report what it built (#4468, #4469). `prism3-build-ui` ends every build with a ledger under four headings: Used (the components and token roles), Composed (built from Prism3 parts because no single component is that piece), Invented (with the reason) and Unsure. A worked example shows one. `prism3-rebind` names a layer built by hand because no component fits with the prefix `GAP / `, counts those layers by name in its rogue-binding audit, names Figma's Outline view (Cmd/Ctrl+Y) as a check by eye, and lists the instances placed, the GAP layers and the components worth suggesting in its end-of-job note. The skills gate holds each rule, so removing one fails by its own name. No emitted artifact changes.
