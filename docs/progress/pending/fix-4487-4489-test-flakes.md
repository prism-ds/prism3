## (2026-11-24) — Two merge-queue flakes wait on the state they assert (#4487, #4489)

Two browser tests failed merge-queue runs on PRs that hadn't touched their code. Each now waits on the state it
asserts. No assertion was dropped, skipped or loosened. Both races were reproduced locally on unchanged code first,
using loop harnesses that copy each suite's setup plus the one block under test, run 6 in parallel on 4 cores.

### #4487 — studio smoke, italics chip "Upright" exports `()`

One export writes five downloads: the base, then one overlay per mode (`exportTokens`). The test exported three
times on one page and read the first `download` event it saw. That failed in two separate ways.

- **Order.** Within one export, the base sometimes lands after the overlays (22 of 174 exports in a local loop). An
  overlay has no `type.caption` leaves, so the list was empty: CI's `()`. Before the fix, 14 of 360 chip checks failed
  this way, and all 10 failures traced had read `prism3.brand-b.overlay.tokens.json`. The first version of this PR
  put that down to a late overlay from the previous export. The order data shows it can be this export's own overlay.
  - **Fix:** wait for the base by name (`*.base.tokens.json`).
- **Drop.** Headless Chromium drops a page's downloads beyond ten in quick succession. On one studio page, three
  exports under a second apart delivered 10 files and only 2 bases: the third export was dropped whole. A bare page
  showed the same thing, every third burst of five, with or without a user gesture, and whatever the blob-revoke
  delay. Fresh pages never dropped a burst.
  - **How it surfaced:** the first version of this PR failed the merge queue on it: "Upright", the third export, got
    no base file within 15 s.
  - **Fix:** each chip gets its own page. It replays the chips before it in the same order (both; both → only;
    both → only → upright), so every write is the same transition as before, and then exports once.
  - **Stability:** 180 of 180 after, on top of the 360 of 360 after the order fix alone.
  - **Not a studio bug:** a designer doesn't export three times in under a second, and a normal desktop Chrome asks
    before allowing that many downloads.
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
