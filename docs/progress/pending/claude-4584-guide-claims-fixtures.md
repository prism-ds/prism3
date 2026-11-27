## (2026-11-27) — lint-guide-claims holds its "not a citation" refusal and its end-after-start rule by fixture (#4584)

Two of `lint-guide-claims.ts`'s MARKER rules had no SELF-CHECK fixture, so each could be deleted with every gate
green (`docs/34`). This adds one fixture for each, and fixes the citation count the summary prints.

### The change

- **`4455-malformed`.** Since #4501 every `<!-- src: … -->` comment is read as a citation, so one in neither form fails
  as `MARKER: … is not a citation`. The fixture plants `<!-- src: fixture/end.ts#4eedf20f -->`, a path and a
  fingerprint with no marker, and expects that failure by name.
- **`4455-end-before-start`.** The end needle is searched from the start needle, not from the top of the file. The
  fixture file holds two blocks that both close with `];`, and the guide cites the second one,
  `fixture/early.ts@"const b = [".."];"`, with the fingerprint of its lines 4-6, written by hand with `sha256sum`. It
  is a clean fixture and must pass. Searched from the top, the end lands on line 3, the block shrinks to line 4, and
  the fingerprint fails.
- **Clean fixtures carry their own tally.** The control's hard-coded "6 citations, 1 quoting nothing, 1 list" is now a
  `holds` field on each clean fixture, so the second one is held to its own count (1, 1, 0) as well. The summary now
  says "8 planted gaps named and 2 clean fixtures passing".
- **"N citations resolve" counts only citations that resolved.** `stats.cites++` ran before a citation was parsed, so
  a citation that failed was still counted. It now runs once the marker has resolved to lines in the file. SCOPE,
  which asks whether a guide carries any citation at all, reads a new `found` count instead, so a guide whose only
  citation is broken isn't also reported as having none.

### Evidence

Each mutation was applied to the gate (asserted to change the file), run, and restored from `HEAD`.

| Mutation | On `main` (77dfe6e) | On this branch |
|---|---|---|
| M1: `if (!mm) { fail('MARKER', …); continue; }` → `if (!mm) continue;` | exit 0, `✅ … 394 citations resolve` | exit 1, `SELF-CHECK: #4455-malformed (…) was not named` |
| M2: `src.indexOf(endNeedle, at[0])` → `src.indexOf(endNeedle)` | exit 1, 17 failures in the real guides, no SELF-CHECK | exit 1, 18 failures, among them `SELF-CHECK: #4455-end-before-start (…) got FINGERPRINT: … (lines 4)#75b5c4ca now hashes to #9ddc439f` |

M2 on `main` shows the issue's point: the real guides catch it only because their own `"};"` end needles happen to
occur earlier in their files. A guide without such a repeat would pass. Unmutated, the gate passes on this branch with
the same 394 citations as on `main`.
