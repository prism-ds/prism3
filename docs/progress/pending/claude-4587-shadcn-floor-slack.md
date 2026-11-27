## (2026-11-27) — lint-shadcn-contrast fails an accepted floor lowered below the ratio it records (#4587)

A `KNOWN` or `KNOWN_PENDING` entry in `lint-shadcn-contrast.ts` mutes a failing pair while its ratio stays at or above
the entry's `floor`, the ratio the owner accepted. Nothing checked the floor itself. Raised above the measured ratio, it
failed as `BELOW ACCEPTED`. Lowered, it passed, and the pair could then regress all the way down to the new floor with
nothing failing. The owner's go-ahead for this backlog item is that a lowered floor must fail.

### The change

- **SLACK.** `judgeBelowFloor` now also fails an entry whose floor sits more than `SLACK_MAX` (0.01) below the measured
  ratio, floored to two places: `… — SLACK KNOWN: measured 3.97, floor 3, so the pair could fall to 3 unseen. Write
  3.97 as its floor` (or `SLACK PENDING` for the legacy fixture's entry). The comparison is in whole hundredths, so
  floating-point noise can't make 3.97 − 3.96 count as more than one step.
- **Why 0.01 and not zero.** The floors are written by hand from a floored measurement, and the last digit can move
  with the renderer. One hundredth absorbs that and nothing more.
- **A pair that improves fails too**, as `STALE KNOWN` already fails a pair that passes. Raising the floor to the new
  measurement tightens what was accepted, so it needs no new decision. Today every floor equals its measured ratio
  (29 known, 1 accepted), so the new arm fires on nothing.
- **`test.ts` #4587** drives `judgeBelowFloor` with hand-typed entries, not `KNOWN`: a floor lowered from 3.97 to 3.00
  fails as SLACK KNOWN, a pending floor two hundredths under fails as SLACK PENDING, and floors at 3.97 and 3.96 hold.

### Evidence

Each mutation was applied (asserted to change the file), run, and restored from `HEAD`.

| Mutation | On `main` (77dfe6e) | On this branch |
|---|---|---|
| `prism3 light: destructive/90 on card` floor 3.97 → 3.00 | exit 0, `✓ shadcn contrast — 655 pairs measured …` | exit 1, `prism3 light: destructive/90 on card 3.97 < 4.5 — SLACK KNOWN: measured 3.97, floor 3 …` |
| The legacy fixture's `KNOWN_PENDING` floor 3.77 → 3.70 | (not run) | exit 1, `… muted-foreground on muted 3.77 < 4.5 — SLACK PENDING: measured 3.77, floor 3.7 …` |
| The same `KNOWN` floor 3.97 → 3.96, one hundredth | (not run) | exit 0, inside the slack |
| The SLACK return in `judgeBelowFloor` neutered | (not run) | `test.ts`: 908712 passed, 2 failed, exactly `#4587 a KNOWN floor lowered from 3.97 to 3.00 fails as SLACK by name (got known)` and `#4587 a KNOWN_PENDING floor … (got accepted)` |

### Left as is

The issue offered a second option, keeping the gate as it was and saying in the header that a lowered floor is caught
only in review. The owner's backlog wording ("must fail") chose the check, so the header now records it instead.
