---
engine: patch
---
The motion editor's read model gains `patternPlayback` (#4571), which gives how each track of a motion pattern plays in a mode: its preset's duration with the mode's tempo applied, its easing as CSS (a role followed to the mode's curve, or a spring's `linear()` curve), its delay, and a slide's distance in px. Studio's motion stage plays these values and holds none of its own. No emission changes.
