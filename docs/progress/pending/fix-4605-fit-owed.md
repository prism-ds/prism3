## (2026-11-26) — The #3700 arm reads the fit's window off its own signal, not off a moment (#4605)

**What was wrong.** The `#3700` arm, "Brand to Shape with the fit owed", holds the mode control's fit back by slowing every frame to 600 ms. It then checked that Shape opens with Brand's select still shown and `data-fit-pending` set. It read that state the moment `goPlace` returned, and on a slow runner that moment can fall on either side of the window:
- **before the header's observer had set the flag:** CI's `fit select, data-fit-pending false`, on #4570's merge group;
- **after the fit had run:** `fit radios, data-fit-pending false`.

The state exists only between the observer raising `data-fit-pending` and the fit clearing it. The arm picked its moment instead of waiting on that.

**The fix.** A `MutationObserver`, installed before Shape opens, records the control's fit at the instant Shape's `data-fit-pending` is set. The arm waits for that record, polling on an interval, since frames are slowed. No sleep, no larger timeout, no retry. `chooseAnyMode` and the rest of the arm are unchanged.

**Measured, section 24 run alone on this Mac:**

| | Plain | Read 1.5 s late (a slow runner, standing in) |
|---|---|---|
| Before | 0 of 30 | 3 of 3, then 10 of 10 as the mutation below |
| After | 0 of 30 | 0 of 30 |

**Held by.** The mutation puts the immediate read back and keeps the late read. It fails 10 of 10, by name: `#3700 web light 1280, Brand to Shape with the fit owed: Shape opens with Brand's select still shown and its fit still owed — fit radios, data-fit-pending false`.

**Not changed, and worth knowing:** the app sets `data-fit-pending` only when the header's observer first fires, which is a frame after the control is placed. So a script that waits for the flag to *clear* can pass straight through that first frame. This arm now waits for the flag to be raised, so it doesn't depend on it. Filed as #4610 rather than changed here.
