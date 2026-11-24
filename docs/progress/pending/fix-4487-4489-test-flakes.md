## (2026-11-24) — Two merge-queue flakes wait on the state they assert (#4487, #4489)

Two browser tests failed merge-queue runs on PRs that hadn't touched their code. Each now waits on the state it
asserts. No assertion was dropped, skipped or loosened. Both races were reproduced locally on unchanged code first,
using loop harnesses that copy each suite's setup plus the one block under test, run 6 in parallel on 4 cores.

### #4487 — studio smoke, italics chip "Upright" exports `()`

- **The race.** One export writes several downloads: the base, then one overlay per mode (`exportTokens`). The test
  took the first `download` event it saw. The overlays from the *previous* chip's export were sometimes still
  arriving, and an overlay has no `type.caption` leaves, so the list was empty. Before the fix, 14 of 360 chip
  checks failed with exactly CI's `()`, and every one of the 10 failures traced read `prism3.brand-b.overlay.tokens.json`.
- **The fix.** Wait for the export's base file by name (`*.base.tokens.json`).
- **A second, silent defect.** The wait for the chip to read pressed checked `aria-checked`, which the chip never
  carries (`chipChoice` sets `aria-pressed`), and swallowed the timeout. So it always waited the full 5 s and then
  carried on. It now reads `aria-pressed`, and a chip that never reads pressed is named in the failure.
- **Mutation.** "Upright" left the italic in place (`setItalicStyle` without the `italicDefault` clear): the check
  fails by name, listing italic leaves.

### #4489 — `test:start`, `#3697 R9 confirm-edits` times out on the Shape slider

- **What the loop showed.** This wasn't the DOM race the issue guessed at. The page itself stopped answering:
  `evaluate` and `requestAnimationFrame` both went unanswered, and one run hung forever at about 0 CPU. It happened
  only on the press right after the one that took the slider to its top, while that press's whole-panel redraw was
  happening. About 720 presses on a settled slider at the top froze nothing. With a debugger attached it never
  froze (0 of 204), so no stack could be taken. The freeze is filed on its own as #4499. It is not explained here.
- **The fix.** The test no longer fires five presses into a redraw; three of them were past the top and changed
  nothing.
  - **One press, then wait.** It now makes one press (down from the top, up otherwise) and waits until the redrawn
    slider reads a new value.
  - **The example load is waited on by name.** The fixed 150 ms after the example load is now a wait for the brand
    switcher to name the example. It's the first example the switcher doesn't already name, because the first one
    is the boot brand and its wait would pass at once.
  - **Both waits feed the named checks** (`confirm-edits`, `edit-only`, `#4245 control`), so a load or edit that
    doesn't land fails by name instead of throwing at 30 s.
- **Mutations.** Each fails by name: the example load delayed 6 s fails `#3697 R9 confirm-edits`, and a slider whose
  edit writes nothing fails the same check.
