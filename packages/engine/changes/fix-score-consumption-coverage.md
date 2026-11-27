---
engine: minor
---
score_consumption says how much of a run it measured (#4125, owner decisions A and A). Its contract result gains `coverage`, the share of pair-and-mode checks that resolved, from 0 to 1, so a run with one unresolved pair no longer reads as a clean 100% beside `rate`. A pair whose side names a raw palette color, such as `core.palette.primary.100`, is now measured like any other and listed in a new `leaks` field, so a UI that reaches for a primitive still gets its contrast checked. Both fields are additive: `rate`, `vacuous` and every existing field keep their meaning. The alpha ramps and `transparent` stay unresolved, because a translucent color has no contrast of its own.
