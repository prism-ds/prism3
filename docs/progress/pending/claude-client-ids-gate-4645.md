## (2026-11-28) — A ratchet gate stops client names and fixture ids from spreading (#4645 phase 1)

Phase 1 of the brand-id rename (`docs/superpowers/brand-id-rename-proposal.md` §5). The owner answered every question
with A. This PR lands the gate first, as a ratchet (Q7 A). Nothing is renamed here.

### What landed

- **`packages/engine/client-ids.ts`** holds the deny-list, `CLIENT_DENY_LIST`. It is the one place the names are
  written on purpose. `names` holds the full names `lint-voice.ts` held since #1824, moved here unchanged. `ids` holds
  the fixture ids, with the two-letter id matched only where it reads as an id. `hashes` holds every further client
  name as a SHA-256 of its normalized form (Q6 A), and is empty today. `lint-voice.ts` now imports `names` from this
  file, so the two gates can't drift apart.
- **`packages/engine/lint-client-ids.ts`** reads every tracked file's path and contents. Binary files are path-only,
  and their count is reported. Each file's hits per rule are held to `schema/client-id-baseline.json`, which only
  `--accept` writes and `regen.ts` never does. A rise, or a new file with hits, fails by `path:line`. A fall fails until
  `--accept` lowers the baseline. A baselined file that's gone counts as a fall to zero.
- **The hash path.** The gate hashes every word, and every phrase of each listed length, in every path and file.
  Words split at case boundaries too, so `fooBarTheme` reads as three words. A name of two or more words also carries
  a `joined` digest of its words run together, which is compared with every single word, so `foobar` is found.
  Every run of case-split parts of one token, the whole token included, is rejoined and compared as well, so a one-word
  name in camel casing (`FooBar`) and a run-together name with a suffix (`FooBarTheme`) are still found. A multi-word
  entry without `joined`, or with `joined` equal to the spaced digest, fails by name.
  `--hash "<name>"` prints the entry to paste and writes nothing. Hits are named by hash prefix, so neither the list
  nor the gate's output spells a name out.
- **The allowlist** covers the fold-owned history (Q3 A), the fold's inputs (`docs/progress/pending/**`,
  `packages/engine/changes/**`, since the fold copies them verbatim into allowlisted files), the deny-list, the two
  gates that read it, the proposal and the baseline. Each entry must match a tracked file.
- **Proof the gate can see.** `CLIENT_ID_SELF_CHECK` runs the scan's own `hitsOf` over the proposal's cases. Nine
  must be flagged, four must not, and one is an upper-case copy of the planted hash word, which proves the lowercasing.
  A made-up two-word name, planted by hash, adds four more that must be flagged (spaced, camelCase, run together,
  run together then camelCase) and one near miss that must not. The planted word in camel casing adds two more, and
  a separate check feeds the entry check two broken made-up entries (no `joined`, `joined` equal to the spaced digest).
  The planted arm, `packages/engine/fixtures/client-id-arm.txt`, must be reached outside the allowlist with exactly its
  five hits, the hashed one included. Six surfaces must each contribute a scanned file.
- **Wired** into `verify.ts`, `ci.yml`, `CONTRIBUTING.md` §3, the PR template and CLAUDE.md's list (one entry).

### Deviations from the proposal

- **The planted arm isn't under `test-arms/`.** That directory is `lint-test-arms.ts`'s registry, which reads every
  file except `README.md` as an arm. A planted file there would fail `MALFORMED`, so it lives under `fixtures/`.
- **The fold's input directories are allowlisted.** Otherwise every progress entry or change note that names the
  regression gate would fail as a new file, even though the fold carries it unchanged into an allowlisted file.

### Evidence

- Baseline at landing: 13,815 hits in 305 files. 3,134 text files are read, 14 binary files are read by path only, and
  103 files are allowlisted by 11 entries.
- **Mutations, each failing by name:**
  - a quoted fixture id added to `apps/plugin/src/apply-theme.ts` → `NEW client-id:… at apps/plugin/src/apply-theme.ts:219`.
  - the planted arm moved into `docs/progress/archive/` → `PLANTED ARM … is not a tracked file`.
  - the planted hash word added to `apply-theme.ts` → `NEW client-id:sha256:c608275db08e at apps/plugin/src/apply-theme.ts:219`.
  - lowercasing dropped from `normalizeWords` → `SELF-CHECK "a stray QUORVALINTH in prose" should be flagged`.
  - the case-boundary split dropped from `normalizeWords` → `SELF-CHECK "const zentravaMorquilTheme = {}" should be
    flagged as client-id:sha256:5d9afaf19495`.
  - the run-together comparison dropped → `SELF-CHECK "import theme from './zentravamorquil.json'" should be flagged`.
  - the planted two-word name, camelCase and run together, in a new `apps/studio/src/` file → `NEW
    client-id:sha256:5d9afaf19495 at …:1, …:2`.
  - the rejoined-runs comparison dropped → `SELF-CHECK "brand: 'QuorValinth'" should be flagged as
    client-id:sha256:c608275db08e`.
  - the entry check's two `joined` rules dropped → `SELF-CHECK hash entry check: a two-word entry with no joined should
    be refused`.
  - an id-position path added to a baselined file → `ROSE`. An id removed from one → `FELL`.
  - `reference/` filtered out of the walk → `SCANNED BLIND reference/`.
- **§1.6, checked:** `tools/list` doesn't serve the client name in `theme-schema.json`'s root description.
  `compactSchema` cuts it to its first sentence, and no other tool returns the root description. Measured on a live
  stdio `tools/list` plus a `list_levers` call: 0 occurrences. No issue was filed.

### Limits

- A rise that isn't a new name, such as a regenerated fixture emission that gains a token, still fails. Accept it with
  `--accept`, and the baseline diff shows the rise. Until phase 2 and 3 land, engine PRs that grow either fixture's
  emission carry a baseline diff.
- The gate reads tracked files only. The built bundles are `lint-voice.ts`'s job.
- The two-letter id is matched only in the listed positions. A ratchet counts, so a name moved to another line in the
  same file passes.
- A hashed name is found as whole words, split at case boundaries, or run together as one whole word. Run together
  inside a longer word of one case (`foobartheme`), or spelled in a way the normalization doesn't fold (an apostrophe
  dropped), it's missed. An acronym with a lower-case suffix splits in the wrong place (`APIs` → `AP` + `Is`), so a
  hashed name written in capitals with a suffix (`FOOs`) is missed.
