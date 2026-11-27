---
engine: minor
---
The motion presets join the lever manifest (#4571). `motionPersonality.presets` is a lever, so a surface draws its controls and an agent reads its description: each preset's duration, easing and delay, set brand-wide, each slot a step, role, curve or spring and never a number. The motion editor's read model gains `presetAdvisories`, which names where a preset's slots would draw an objection without refusing them: an exit half that plays as long as its entrance or longer, and a delay on either half. The engine's defaults raise neither. The surfaces now read the motion editor's helpers through `@prism3/engine`.
