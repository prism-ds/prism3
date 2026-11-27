---
engine: patch
---
The motion editor's read model (#4571). A new module, `motion-editor.ts`, lists every target each motion preset slot accepts, in the order a picker shows them, and applies the spring rule to the duration a spring easing allows. It reads a resolved preset back as the paths a brand writes, says whether an easing follows a role or is fixed to a curve or spring, and maps each preset to the pattern tracks that use it. The engine's refusals now name the same target lists, worded as before. A new test holds that a motion-only edit leaves every non-motion part of the emission byte-identical. No emission changes.
