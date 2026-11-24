## (2026-11-23) — Update file's library callout is one summary line, the full list behind "Show the changes" (#4481)

**Status:** plugin (`update-plan.ts`, `messages.ts`), studio (`write-adapter.ts`, `state/update-file.ts`,
`shell/update-file.ts`, `chrome.css`), tests (`test-update-apply.ts`, `test-update-file.ts`, `test-write-adapter.ts`,
`test:chrome` section `ia2`), the Update a file safely guide and a `patch` change note. `EXECUTOR_REVISION` unchanged
(`update-plan.ts` is outside the executor's reach). CONTRACT unchanged. The new wording is DRAFT, put to the owner in the PR.

### What changed

- **Owner decision A on #4481 (2026-11-23).** A 12-change list in the "Files that use this library" callout filled the
  dialog and pushed the steps out of view. The callout is now one line counting the changes by kind, each kind naming its
  sets, then **Show the changes**, which opens the full list in a box at most four control heights tall that scrolls
  inside itself (and takes keyboard focus, so it can be read without a pointer). The steps stay in view.
- **Why the plugin had to change.** Each set's lines are capped at 8 plus an "N more" line, so Studio cannot count kinds
  from them. The checked set now carries `changes.kinds` (`changeKinds`): `breaks` (`breaksConsumers`: property removed
  or retyped, layer replaced or removed, member merged and removed), `retired` (`drop`) and `leaves` (a rename to a
  private name). Every change is exactly one, so they add up to `count`; Studio's adapter drops a split that doesn't, and
  the summary then gives the total alone rather than a guessed split.

### Gates and mutations

- `test:chrome` `ia2`: a 12-change check (8 that break Button, 4 retired on Select, neutral lines). Closed, the callout is
  at most 3 control heights and every step's head row (Theme, Components, Style guides) is inside the body's visible
  area; open, the box is at most 4 control heights and scrolls, Theme and Components still show and the body keeps at
  least 360px. Mutations: the list never hidden (the old layout) → `#4481 steps stay in view (closed)`; the box's
  `max-height` dropped → `#4481 steps stay in view (open)`.
- `test-update-file.ts`: the summary's counts and words from literal fixtures. Mutation: summing one set's split →
  `#4481 counts by kind`. `test-update-apply.ts`: a literal 14-change mix past the cap. Mutation: merges counted as
  retired → `#4481 split`. `test-write-adapter.ts`: a split that doesn't add up is left off.
- The foot rule (#3712) counted every foot button outside the buttons row as loose; a message's own control (Show the
  changes) is now part of its row.

### Trap for whoever re-verifies

At 1280 × 900 with Components open on its due sets, Style guides clears the body's fold by about 30px with the list
closed; opening the list puts it under the fold, reached by scrolling the body. The open arm asserts the first two steps
and the 360px floor, not Style guides.
