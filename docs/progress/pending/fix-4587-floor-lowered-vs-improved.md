## (2026-11-27) — Correction to 2026-11-27 lint-shadcn-contrast fails an accepted floor lowered below the ratio it records: each floor is held against the base's copy, and an improvement warns (#4587)

The entry this corrects (#4631) failed any floor more than 0.01 under its measured ratio as SLACK, including a pair
that improved under a floor nobody touched. The owner decided on 2026-11-27 (#4631, comment 7210312587) that the gate
must tell the two apart: an edited floor fails, an improvement warns. That entry stays as written; this one records
the change.

### The change

The measured ratio alone cannot tell an edited floor from a pair that improved: a floor of 3.00 under a measured 3.97 is the same picture either way. So each entry's floor is
compared with the same entry's floor in the base's copy of the gate, read from git (`baseFloors`), a record the gate
never writes.

- **FLOOR LOWERED.** A floor below the base's floor for the same key fails, whatever the measured ratio:
  `… — FLOOR LOWERED KNOWN: floor 3, the base's floor 3.97, so the pair could fall to 3 unseen. Put 3.97 back` (or
  `PENDING` for the legacy fixture's entry). That includes a floor lowered to follow a ratio that fell.
- **SLACK, for a new entry.** An entry with no key at the base whose floor sits more than `SLACK_MAX` (0.01) below the
  measured ratio, floored to two places, fails: `… — SLACK KNOWN: a new entry, measured 3.97, floor 3 …`. A new floor
  is written from the measurement, not under it.
- **WARNING, for a pair that improved.** A floor at or above the base's, more than 0.01 below the measured ratio,
  passes and prints `WARNING <pair>: measured 4.1, floor 3.97 — the pair improved; record 4.1 as its floor in KNOWN`.
  Not a failure.
- **BELOW ACCEPTED** is unchanged: a pair under its floor fails.
- **The base** comes from the ladder `shadcn-vars.ts` and `lint-contract-version.ts` use: `MERGE_GROUP_BASE_SHA` in a
  merge group (authoritative, no fallback), `origin/<GITHUB_BASE_REF>` on a PR (fetched again in CI), else
  `origin/main` then `main`; then the merge base, or HEAD's first parent on the base branch (`comparisonBase`, #2556).
  No base ref, no merge base (a shallow clone), or a base copy whose tables it cannot parse each fail as `CANNOT RUN`.
  A base with no copy of the gate reads as no entries, so every entry is judged as new, the strictest reading. The
  studio job already checks out with `fetch-depth: 0`.
- **The parser checks itself.** `parseFloors` reads the tables out of source text, because the base's copy is a git
  blob. Before reading the base, the gate parses its own file and requires the result to equal `KNOWN` and
  `KNOWN_PENDING` as evaluated, so a parser that drifted fails by name instead of reading every entry as new.
- **The 0.01** allows the last digit of a floored ratio to move with the renderer. Comparisons are in whole hundredths.
- **`test.ts` #4587** drives `judgeBelowFloor` with hand-typed entries and base floors: a KNOWN floor edited from 3.97
  to 3.00 fails as FLOOR LOWERED, a PENDING floor lowered with its falling ratio fails the same way, an improvement to
  4.1 under an unchanged 3.97 passes with the exact warning, a new entry at 3.00 under 3.97 fails as SLACK, a pair at
  3.90 under 3.97 fails as BELOW ACCEPTED, four floors inside the slack hold quietly, and `parseFloors` reads a typed
  source and returns null for a missing table.

### Evidence

| Mutation | Result |
|---|---|
| Unmutated, against `origin/main` (on the #4631 branch, base 3aa2a76) | exit 0, `floors held against the base at 3aa2a763 (origin/main, merge base)`, 655 pairs, 0 failing |
| `prism3 light: destructive/90 on card` floor 3.97 → 3.00, committed | exit 1, `… 3.97 < 4.5 — FLOOR LOWERED KNOWN: floor 3, the base's floor 3.97 …` |
| A measured rise, through `test.ts` (4.105 under an unchanged 3.97) | passes, `WARNING prism3 light: destructive/90 on card: measured 4.1, floor 3.97 …` |
| `GITHUB_BASE_REF=no-such-branch` | exit 1, `no base ref — the floor-against-base arm CANNOT RUN …` |
| `GITHUB_EVENT_NAME=merge_group`, base unset | exit 1, `… MERGE_GROUP_BASE_SHA (merge group, authoritative) — unset or empty …` |
| A depth-1 clone | exit 1, `no merge base between HEAD and origin/main — the floor-against-base arm CANNOT RUN` |

### Left as is

`lint-push-base.ts` replays the git-history gates on a squash on main; this gate is not added to it, because it needs
Chromium and the emitted handoff, which the replay's scratch clone does not have. Its push-run path is `comparisonBase`,
the same helper the replayed gates use.
