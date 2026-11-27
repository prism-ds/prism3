# Brand-id rename: scoping proposal (#4645)

**Status:** proposal for the owner. **No rename in this PR, and none until the owner answers §6.**
**Measured on:** `origin/main` at `06ed6c4c3e1a9256cbff05fe6428cd4845e6a6b2` (2026-11-27).

The public repo commits brand ids that read as client names: `wendys` and `nb`. The repo's own convention is
"the reference brand". This document scopes the work to rename them: what moves, what each choice costs, and
the gate that keeps the names from coming back.

**How this document names the brands.** It uses only the two ids #4645 already names publicly, plus forms
derived from them (`nb-redesign`, the `nbds` token root). Each brand's full display name, and the name of the
`reference/` directory that holds the `nb` brand, appear here as "the brand behind `wendys`", "the brand
behind `nb`" and `reference/<nb-brand>/`. They are counted, never spelled out.

---

## 1. Inventory

### 1.1 How it was measured

```sh
git grep -n -i -E '\bwendys\b|\bnb\b|nbds'          # the issue's pattern
git ls-files | grep -i -E 'wendys|(^|[/._-])nb([/._-]|$)|nbds'   # file and directory names
```

The full display names were counted separately, using the patterns `lint-voice.ts` already holds in
`CLIENT_NAMES` (#1824). Each file was assigned to exactly one kind by its path.

**One caveat on `\bnb\b`.** The raw count includes false positives: `nb` is a common local variable in
tests and scripts (`const nb = …` in `apps/studio/test-chrome.mjs`, `compare-chrome-assertions.mjs`,
`src/shell/bar.ts`), and binary font files match too. A contextual pattern (`'nb'`, `"nb"`, `` `nb` ``,
`nb.<artifact>`, `/nb/`, `nb-regression|fixture|measured|redesign`, `nbTheme`, `theme-nb`) finds
**867 occurrences in 115 files**, which is the real reach of the id. The lint in §5 uses contextual patterns
for exactly this reason.

### 1.2 Totals

| Pattern | Matching lines | Files |
|---|---:|---:|
| Everything the issue's grep matches | 14,853 | 334 |
| `wendys` | 414 | 65 |
| `nb` (raw `\bnb\b`; see the caveat above) | 2,352 | 219 |
| `nbds` (the `nb` brand's token root and legacy prefix) | 12,296 | 158 |
| Tracked **paths** that carry one of the ids | 126 | — |
| Full display name of the brand behind `wendys` | 366 | 20 |
| Full display name of the brand behind `nb` | 102 | 42 |

`nbds` dominates the total: it prefixes every token name in the `nb` fixture's emission and in the legacy
reference JSON.

### 1.3 By kind

| Kind | Paths | `wendys` | `nb` (raw) | `nbds` | Full names | Key files |
|---|---:|---:|---:|---:|---:|---|
| **A. Committed brand ids and emitted artifacts** (`out/`, `examples/`, `schema/`) | 26 | 19 in 8 files | 50 in 14 | 7,190 in 15 | 290 in 12 | `packages/engine/examples/wendys.design.md`, `examples/nb-redesign.design.md`, `theme-nb.ts` (`id: 'nb', root: 'nbds'`), `nb-fixture.ts`, `regen.ts` (the `cli` step for `wendys`), `schema/payload-manifest.json` (`brands`), `schema/token-contract.json` (`corpus`), `schema/nb-measured.json` |
| **B. Test and gate tables** | 1 | 205 in 20 | 1,014 in 60 | 198 in 17 | 50 in 9 | `nb-regression.ts` (a CI gate named for the brand), `test.ts`, `token-contract.ts`, `lint-voice.ts`, `apps/plugin/test-prune.ts`, `test-readback-parity.ts`, `test-rename-parity.ts`, `test-write-components.ts`, `apps/studio/test-export-parity.mjs`, `test-chrome.mjs`, `packages/tokens/check-consumability.mjs`, `tools/conformance-scan/*`, `tools/exporter-comparison/*` |
| **C1. Docs** (design record, READMEs, `superpowers/`) | 2 | 39 in 16 | 322 in 55 | 68 in 21 | 30 in 15 | `docs/02-nb-regression-pass.md`, `docs/30-versioning-and-compatibility.md`, `packages/engine/README.md`, `packages/tokens/README.md`, `CLAUDE.md`, `CONTRIBUTING.md` |
| **C2. Progress and release history** | 0 | 184 in 3 | 1,008 in 11 | 66 in 3 | 46 in 5 | `docs/00-progress.md`, `docs/progress/archive/*`, `packages/engine/CHANGELOG.md`, `docs/public/releases/*` |
| **D. Hosted registry URLs** `/r/<brand>.json` | 0 | 0 | 0 | 0 | 0 | `apps/studio/build-site.mjs` `HOSTED = ['aurora', 'harbor', 'prism3']` (#4373) |
| **E. Figma emission** | 67 | 0 | 7 in 1 | 3,318 in 27 | 35 in 2 | `packages/engine/out/figma/wendys/` (29 files), `out/figma/nb/` (29), `fixtures/figma/nb/` (9) |
| **F. MCP and agent-link brand ids** | 0 | 2 in 2 | 2 in 2 | 0 | 0 | `tools/figma-mcp/plan.ts`, `agent-link.ts`, `README.md` (`--brand` example ids) |
| **G. Legacy reference JSON** | 28 † | 0 | 14 in 4 | 1,296 in 39 | 0 | `reference/<nb-brand>/` (both trees: `raw-figma/` and `tokens/`) |
| **H. Other engine and app source** | 2 | 37 in 16 | 211 in 61 | 234 in 36 | 17 in 13 | `emit-dtcg.ts` (imports `nbTheme`), `modes.ts`, `standard-design-md.ts`, `theme-types.ts`, `figma-names.ts`, `materialization-renames.ts` |

† The `reference/<nb-brand>/` directory name is itself the full display name, so all 28 files under it carry
the name in their path.

### 1.4 Emitted file names under `packages/engine/out/`

- **`wendys`: 41 tracked paths.** That is `wendys.{tokens,base.tokens,web.base.tokens,ai,css-only}.json`,
  three mode overlays, `wendys-fidelity-report.md`, `shadcn/wendys.{css,registry-item.json}`,
  `tailwind/wendys.theme.css` and `figma/wendys/` (29 files).
- **`nb`: 40 tracked paths.** The same set without a fidelity report. Beside `out/` there are also
  `nb-regression-report.md`, `schema/nb-measured.json` and `fixtures/figma/nb/` (9 files).
- **Engine source files named for a brand:** `theme-nb.ts`, `nb-fixture.ts`, `nb-regression.ts`,
  `examples/nb-redesign.design.md`, plus `docs/02-nb-regression-pass.md`.

### 1.5 What does *not* carry the ids today (measured)

- **Hosted URLs.** `/r/` serves `aurora`, `harbor` and `prism3` only. `HOSTED` is an allowlist, and
  `test-shadcn-registry.ts` fails if any other brand reaches `public/r/`. Nothing has ever been served at
  `/r/wendys.json` or `/r/nb.json`.
- **The MCP server's brand list.** `packages/engine/mcp.ts` takes a `BrandInput`. It serves no list of
  brand ids. The only id list near the MCP is the dev tool `tools/figma-mcp` (kind F).
- **The plugin's and Studio's brand list.** Both read `example-registry.ts` `EXAMPLES` (`prism3`, `aurora`,
  `harbor`) through `schema/example-brands.json`. Neither id is in a shipped menu. `lint-voice.ts`'s
  `CLIENT_NAMES` arm already fails a built bundle that carries either full name or `nb-redesign`.
- **The token contract's guaranteed names.** `guaranteed` is keyed *below* the configurable root, so no
  guaranteed name contains a brand id. The ids appear only in the baseline's descriptive `corpus` labels.

### 1.6 Client-identifying strings beyond the two ids

- **Full display names of the two brands** (counts in §1.2). They appear outside the expected places in
  `packages/engine/examples/aurora.design.md:13` and `harbor.design.md:13`, which are hosted examples.
  The mention is a frontmatter comment, so it does not reach `example-brands.json`. They also appear in
  `packages/engine/schema/theme-schema.json` (the root `description`). `compactSchema` cuts that
  description to its first sentence for `tools/list`, so the name is very likely not served, but phase 1
  should confirm it. Full file lists:
  - The brand behind `wendys`: `docs/00-progress.md`, `docs/07-e2e-journey.md`,
    `docs/33-skills-adoption-plan.md`, `docs/progress/archive/2026-07-08.md`, `packages/engine/README.md`,
    `examples/wendys.design.md`, `lint-voice.ts` (deliberate: the deny-list), `modes.ts`,
    `out/figma/wendys/core.font.json`, `out/figma/wendys/text-styles.json`, `out/wendys-fidelity-report.md`,
    `out/wendys.ai.json`, `out/wendys.base.tokens.json`, `out/wendys.tokens.json`,
    `out/wendys.web.base.tokens.json`, `schema/token-contract.json`, `standard-design-md.ts`, `test.ts`,
    `theme-types.ts`, `packages/tokens/check-platforms.mjs`.
  - The brand behind `nb`: `.claude/hooks/session-start-claude-md-freshness.sh`, `.github/workflows/ci.yml`,
    `CLAUDE.md`, `CONTRIBUTING.md`, `README.md`, `apps/plugin/test-style-guide.ts`,
    `apps/studio/src/build-identity.ts`, `apps/studio/test-build-identity.ts`, `docs/00-progress.md`,
    `docs/01-token-architecture.md`, `docs/02-nb-regression-pass.md`, `docs/05-token-coverage-roadmap.md`,
    `docs/11-multi-brand-vision.md`, `docs/13-inspirations.md`, `docs/20-interactive-color-system.md`,
    `docs/30-versioning-and-compatibility.md`, `docs/45-style-guide-generator.md`,
    `docs/progress/archive/2026-07-08.md`, `docs/public/releases/0.239.0.{json,md}`,
    `docs/superpowers/specs/2026-09-26-ui-exploration-brief.md`, `packages/engine/CHANGELOG.md`,
    `anatomy-figma.ts`, `components/focus-ring.ts`, `examples/{aurora,harbor,nb-redesign,wendys}.design.md`,
    `figma-names.ts`, `lint-voice.ts` (deliberate), `materialization-renames.ts`, `nb-regression.ts`,
    `scale.ts`, `schema/nb-measured.json`, `schema/theme-schema.json`, `test.ts`, `theme-nb.ts`,
    `theme-types.ts`, `theme.ts`, `tools/conformance-scan/expected.ts`,
    `tools/file-seed-comparison/{compare,snapshots}.ts`, plus the 28 paths under `reference/<nb-brand>/`.
- **Other clients: 0 found.** A sampled search of prose near "client" and "customer" found no third client
  name. That search is **not exhaustive** for names nobody has listed. The deny-list in §5 is the owner's
  to extend (Q6).
- **Not a name, still a fingerprint.** The `wendys` and `nb` design inputs carry the brands' real anchor
  colors and typefaces. A neutral id doesn't hide a recognizable palette. This is out of #4645's scope,
  but it is raised as Q5.

---

## 2. Neutral-id options

| Scheme | `wendys` → | `nb` → | `nb-redesign` → | `nbds` root → |
|---|---|---|---|---|
| **A. Role-based (recommended)** | `ref-standard` | `ref-legacy` | `ref-legacy-redesign` | `refds` |
| B. Codenames, in the family of `aurora` and `harbor` | e.g. `quarry` | e.g. `meadow` | e.g. `meadow-redesign` | e.g. `mds` |
| C. Letters | `ref-a` | `ref-b` | `ref-b-redesign` | `rbds` |

**Why A.** Each fixture is named for the job it does. `wendys` is "the standard-dialect front door"
(`packages/tokens/README.md`), and `nb` is "the legacy `nbds.*` dialect and hand-authored regression target".
That matches the repo's existing phrase "the reference brand". A role name can't collide with a future
client, carries no hint of the original brand, and the shared `ref-` prefix sorts the fixtures together in
`out/`.

**Against B.** A codename reads exactly like a made-up example brand. #4373 drew a hard line between
examples, which are hosted, and real-brand fixtures, which are not. A codename blurs that line, so a later
agent could add one to `HOSTED`. Each codename would also need checking for anything that hints at its
source brand.

**Against C.** Letters are neutral but opaque. A reader has to look up which fixture is `ref-a`.

Any scheme leaves two choices open: the exact strings (the owner's call) and whether the display `name`
inside each `design.md` follows the id (Q4).

---

## 3. The public surface each rename moves

| Surface | What moves | Version or policy consequence |
|---|---|---|
| **Token contract** (`schema/token-contract.json`, docs/30) | Only the descriptive `corpus` labels (`"nb (legacy fixture, nbds.* dialect)"`, `"wendys (standard dialect)"`). `guaranteed` is keyed below the root, so no guaranteed name changes, and neither does the `nb` fixture's `nbds` root. | **No `CONTRACT_VERSION` bump.** docs/30 policy: names are versioned, and the guaranteed name surface does not move. `token-contract.ts --check` compares `guaranteed`, `brandDependent` and `deprecations`, not `corpus` (read from `token-contract.ts`). So a stale label passes `--check` silently: refresh it with `--accept` in the same PR, and let the §5 lint catch a missed one. |
| **Exported file names** (`out/`) | 41 paths for `wendys` and 40 for `nb` are renamed (§1.4), plus `nb-regression-report.md`, `schema/nb-measured.json` and `fixtures/figma/nb/`. | `schema/payload-manifest.json` `brands` is asserted by name in both directions, so it changes in the same PR. Renaming fixture output is an engine behavior change: the PR adds a `packages/engine/changes/<branch>.md` (class: build lane's call, likely patch). It never edits `ENGINE_VERSION`. |
| **`regen --check` artifact set** | Same count, new names. | `ARTIFACT_FLOOR` (`verify.ts`) is a floor and the count is unchanged, so **no edit**. Watch for stale untracked files under `out/` after the rename, as CLAUDE.md warns. |
| **Hosted URLs** `/r/<brand>.json` | **Nothing.** Neither id was ever hosted (§1.5). | **No redirects.** A redirect would publish the old id in `vercel.json` for a URL that never existed. |
| **MCP brand ids** | The MCP server serves none. The dev tool `tools/figma-mcp` (`--brand wendys`, `nb-redesign`) changes its example ids. | **No alias.** It is an unpublished dev tool, and an alias keeps the old string in code, which the §5 lint would have to allowlist. |
| **The plugin's brand list** | **Nothing.** The shipped list is `prism3`, `aurora` and `harbor`. Tests that use the fixtures (`test-prune.ts`, `test-readback-parity.ts`, `test-rename-parity.ts`, `test-write-components.ts`, `test-style-guide.ts`) change their tables. | No release-visible change. `lint-voice.ts` `CLIENT_NAMES` keeps guarding the bundles. |
| **CI and the gate lists** | `nb-regression.ts` is named in `ci.yml`, `CONTRIBUTING.md` §3, the PR template and CLAUDE.md. | `lint-doc-gates.ts` ties all four, so they change together. **CLAUDE.md is edited in a PR the owner reviews** (Q529 A). CLAUDE.md's "Working in `reference/`" section also spells out the `nb` brand's name and the `nbds.` rule. |
| **The `nbds` root and `reference/<nb-brand>/`** (only if Q2 = A) | Token names across `out/nb.*`, `out/figma/nb/` and both reference trees: about 11,800 `nbds` occurrences. The directory renames too. | Still not a contract move (below the root). `nb-regression.ts` compares by path, so the emission and the reference change in one mechanical PR, keeping the `$extensions.figma.variableId` linkage. |

---

## 4. History

Renaming changes the tree from here on. Git history, merged PRs, issue titles, the progress log and the
changelog keep the old names.

| Option | What it does | Cost |
|---|---|---|
| **A. Accept it, forward only (recommended)** | Rename the tree. The fold-owned history files keep their text (allowlisted by the §5 lint). Commits, PRs and issues stay as they are. | Nothing extra. The old names stay findable in history, as they have been for months on a public repo. |
| B. Rewrite git history (`git filter-repo`) | Rewrites every commit that carries a name. | **Strongly discouraged.** Every clone, worktree and fork breaks, and every agent lane mid-flight with them. Every squash-merge SHA cited in progress entries, PR bodies and issues goes dead. GitHub keeps `refs/pull/*/head` for merged PRs, so the old objects stay reachable through the PR pages anyway. Forks keep full copies. |
| C. Contact GitHub support | After B, ask GitHub to drop cached views and PR refs. | Only meaningful after B, so it costs all of B plus a support process meant for leaked secrets, not names. It still can't reach forks or local clones. |

**Editing issue and PR titles or bodies doesn't help.** GitHub records each title change as a timeline event
("changed the title from … to …"), and earlier versions of an edited body or comment stay readable in its
edit history.

**Recommendation: A.** History is public and immutable in practice. The useful work is making sure the
names stop growing: renaming the live tree, plus a gate. Whether the fold-owned history files (C2) also get
a one-time text scrub is Q3.

---

## 5. Phased plan, with gates

Every phase is its own PR off `main`. Each one runs `npm run verify` before Ready, carries a progress
fragment, and includes a mutation that fails a gate by name. No PR is stacked on another.

### Phase 1: the gate first, as a ratchet

**New gate `packages/engine/lint-client-ids.ts`.** It walks `git ls-files` and reads every tracked file's
**path and contents**. Binary files are skipped by a reported count, never silently.

- **Deny-list.** `lint-voice.ts`'s `CLIENT_NAMES` (the full names and `nb-redesign`) plus the contextual id
  patterns from §1.1 (`wendys`, `nbds`, and `nb` only in id positions). The list lives in one exported
  constant that both gates read: it is the one place the names are written on purpose. This is not a
  gate-independence breach (docs/34): the list is the gate's *oracle*, and the subject is the tree, which is
  independent of it.
- **Allowlist.** An explicit list of history paths: `docs/00-progress.md`, `docs/progress/archive/**`,
  `packages/engine/CHANGELOG.md`, `docs/public/releases/**`, the deny-list's own file and this proposal. Glob entries
  must each match at least one tracked file. An allowlist entry that matches nothing fails.
- **Ratchet.** It lands with a committed baseline (`schema/client-id-baseline.json`, written only by
  `--accept`, never by `regen.ts`) holding the per-file hit count today. It fails, by name, when any file's
  count rises or a new file appears: `client-id:wendys at apps/x.ts:12 (not in baseline, not allowlisted)`.
  A count that falls also fails until `--accept` lowers the baseline, so the baseline can't go stale.
- **Planted cases.** A `CLIENT_ID_SELF_CHECK` table in the same style as `lint-voice.ts`. It must flag
  `examples/wendys.design.md`, `'nb'`, `out/nb.tokens.json`, `nbds.pds.color`, `theme-nb`, and must not flag
  `const nb = box(x)`, `snb-redesigned` or `nbsp`. It also carries a planted *file*, under
  `packages/engine/test-arms/`, that the gate must report as a hit outside the allowlist. The test arm proves
  the walk reaches a real path, not just a string.
- **Represented-surface assertion.** The gate fails if any of `packages/`, `apps/`, `docs/`, `tools/`,
  `reference/` or `.github/` contributed zero scanned files. A narrowed walk can't pass by seeing less.
- **Wiring.** `verify.ts`, `ci.yml`, `CONTRIBUTING.md` §3, the PR template and CLAUDE.md's list, all held
  together by `lint-doc-gates.ts`.
- **Mutation, by name.** Add `'wendys'` to `apps/plugin/src/apply-theme.ts`, and the gate must fail naming
  that path and line. Rename the planted test-arm file into an allowlisted path, and the self-check must fail.
- **Also in phase 1:** confirm that `tools/list` doesn't serve `theme-schema.json`'s root-description
  mention (§1.6). File it as its own issue if it does.

### Phase 2: `wendys` → the new id

- `examples/wendys.design.md` and its display `name` (per Q4), the `regen.ts` `cli` step, all 41 `out/` paths,
  `payload-manifest.json` `brands`, and the `token-contract.json` `corpus` label (`--accept`, no version
  raise).
- The test and gate tables (20 files), `tools/figma-mcp`, `packages/tokens` (`check-consumability.mjs`,
  `check-platforms.mjs`, README), and non-history docs.
- **Gates:** `regen --check` (same count), `token-contract.ts --check` (level none),
  `lint-payload-manifest.ts`, `test-export-parity`, `check:consumability`. The §5 baseline drops by every
  `wendys` row, through `--accept`.
- **Mutation:** restore one `out/wendys.*` file, and `lint-payload-manifest.ts` and `lint-client-ids.ts`
  must both fail by name.

### Phase 3: `nb` and `nb-redesign` → the new ids (file and gate names, no root change)

- `theme-nb.ts`, `nb-fixture.ts`, `nb-regression.ts` and `nb-regression-report.md`, `schema/nb-measured.json`,
  `fixtures/figma/nb/`, `examples/nb-redesign.design.md`, the 40 `out/` paths, every test table (the ~60 files
  of kind B), and `docs/02-nb-regression-pass.md`.
- The gate rename touches `ci.yml`, `CONTRIBUTING.md` §3, the PR template and **CLAUDE.md** (owner reviews
  the diff).
- **Gates:** the renamed regression gate reproduces today's report byte for byte, apart from names.
  `lint-doc-gates.ts` passes. `regen --check` passes.

### Phase 4 (only if Q2 = A): the `nbds` root and `reference/<nb-brand>/`

- One mechanical PR. The `root` and `namespace` in the theme, both reference trees (raw-figma slash paths
  and DTCG brace aliases, with every `variableId` kept), the `out/` emission, and CLAUDE.md's
  "Working in `reference/`" section.
- **Gates:** every DTCG alias resolves, every raw-figma `alias` matches a `VariableID`, the regression gate
  is unchanged in its numbers, and the guaranteed set in `token-contract.ts --check` is identical.
- `aurora.design.md:13` and `harbor.design.md:13` lose their `nbds` comparison in the same PR.

### Phase 5: close the ratchet

- Sweep the remaining non-history prose. The baseline reaches **empty** and the baseline file is deleted.
  The gate becomes absolute: any hit outside the allowlist fails.
- **Mutation:** a single `nbds` added to `docs/07-e2e-journey.md` fails by name.

---

## 6. Owner questions

Each can be answered with one letter.

**Q1. Which neutral-id scheme?**
- **A (rec): role-based** — `ref-standard`, `ref-legacy`, `ref-legacy-redesign`, root `refds`.
- B: codenames in the `aurora`/`harbor` family.
- C: letters — `ref-a`, `ref-b`, `ref-b-redesign`.

**Q2. How far does the `nb` rename go?**
- **A (rec): all the way**, including the `nbds` root and the `reference/<nb-brand>/` directory, done last
  as phase 4. `nbds` is about 12,300 of the 14,900 hits, and the directory name is the brand's full name.
- B: ids, file names and gates only. The `nbds` root and `reference/` stay as the legacy regression target,
  allowlisted.
- C: `nb-redesign` and the gate names only.

**Q3. What happens to the history?**
- **A (rec): forward only.** Git history, PRs and issues are untouched, and the fold-owned files (progress
  log, archive, CHANGELOG, release notes) are allowlisted as written.
- B: forward only, plus one sanctioned PR that scrubs the text of the fold-owned files. This needs a
  named `lint-progress-order.ts` exemption, like the fold's.
- C: rewrite git history. Strongly discouraged (§4).

**Q4. Does each fixture's display `name` change with its id?**
- **A (rec): yes.** The `name` in `design.md` and everything emitted from it (`ai.json`, Figma text styles,
  the fidelity report) uses a neutral display name matching the id. Otherwise the 41 renamed files still
  carry the full name.
- B: no, only ids and file names change.

**Q5. The fixtures' real palettes and typefaces are a fingerprint. In scope?**
- **A (rec): no, keep them.** They are what makes the fixtures useful regression targets. Revisit only if
  the owner wants the fixtures fully anonymized.
- B: yes. Perturb the inputs and re-baseline the fixtures in a separate issue.

**Q6. Which names does the lint deny?**
- **A (rec): the two brands' ids and full names plus `nb-redesign`**, which is the current `CLIENT_NAMES`
  plus the ids. Any name added to that list is published, because the repo is public. So further client names
  go in as **SHA-256 hashes** of the lowercased name: the gate hashes each word and phrase it scans and compares,
  so the list never spells the name out. The owner supplies each name to the orchestrator in chat, and only its
  hash is committed.
- B: A, plus a broader heuristic (e.g. any `reference/` directory name). This adds false-positive upkeep.

**Q7. How does the gate land?**
- **A (rec): first, as a ratchet** (phase 1). Every later phase lowers the baseline, and nothing grows in
  the meantime.
- B: last, absolute, in the same PR as the final rename.
