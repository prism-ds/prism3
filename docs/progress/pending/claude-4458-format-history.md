## (2026-11-24) — Two PRs can no longer publish two shapes under one format version (#4458, #4330)

When two open PRs each raised a published format from N to N+1, git merged them with no conflict. The version lines
were identical and the schema edits landed in different places. The merged tree then published the union of both
shapes as N+1, and every gate passed. This happened twice before a reviewer caught it: `prism3-ai-metadata/0.6`
(#4332, #4096) and `prism3-component-defs/1.5` (#4074, #4096, #4099). A new gate, `lint-format-history.ts`, and an
authored record, `schema/format-history.json`, close it. This is item 5 of the #4459 ranking, the half of it that
covers version numbers. The half that covers counts is #4510, in its own PR.

### What the record holds

- Per published format, one row per version, oldest first, one row per line. Each row holds the version, the branch
  that took it, a 16-hex hash of the format's JSON schema, and a note on what the version adds.
- **The hash ignores prose.** `description`, `title`, `$comment` and `examples` are dropped, keys are sorted, and the
  schema's own `$id` reads as `<$id>`, so a raise doesn't change its own hash. Any other edit changes it.
- The gate hashes with its own walk, not `component-contract.ts`'s `schemaShape`. Sharing that walk would tie every
  recorded hash to another gate's fact list, which no version raise could repair. The duplication is deliberate.
- Four formats are registered: every `prism3-*` schema in `schema/` (ai-metadata, component-defs, component-docs,
  file-facts). A new schema that isn't registered fails `SCOPE`.

### Why the merge can't stay silent

- Each PR appends its own row after the same last line. The rows differ, since each names its own branch and hash,
  so git reports a conflict on the record.
- Keeping both rows fails `DUPLICATE`. Keeping one fails `SHAPE`, because the merged schema is the union and matches
  neither row.
- The only resolution that passes is a new version. `--accept` refuses to give a recorded version a second shape. The
  one exception is this branch's own newest row, while `origin/main` doesn't hold it yet.

### Evidence

- **A simulated two-PR merge, in a scratch clone.** PR A and PR B each add one field to `component-defs.schema.json`
  and raise to 1.8.
  - **Before**, on `main`: the merge is clean, both fields ship as 1.8, and `component-contract.ts --check` passes.
    That is #4330 reproduced.
  - **After**, on this branch: the record conflicts. Keeping both rows fails `DUPLICATE` (plus `ORDER` and `SHAPE`).
    Keeping A's row or B's row each fails `SHAPE`. `--accept` refuses to rewrite A's 1.8. Raising to 1.9 and
    accepting passes.
- **Mutations, each failing by its own name:**
  - a field added to the ai-metadata schema → `SHAPE`;
  - the constant and `$id` raised with no `--accept` → `UNRECORDED`;
  - the constant raised and the `$id` left behind → `ID`;
  - a row with no raise behind it → `AHEAD`;
  - an unregistered `prism3-*` schema → `SCOPE`.
  - Control: a description edit passes.
- **Self-check.** The gate runs its real `judge` over 10 planted records, including the three ways to resolve the
  merge, and 6 hash probes. The case count is written by hand.

### Limits, stated in the gate's header

- **The hash covers the schema, not the emitted document.** `test.ts` validates the emission against the schema, and
  nearly every object there closes `additionalProperties`.
- **The check reads only the current tree.** A hand edit that rewrites a recorded row's hash still passes. Holding
  rows against the merge base needs a `lint-push-base.ts` replay, filed as #4512.
- **Version constants with no schema aren't covered:** `COMPONENT_SPECS_SCHEMA`, `PANEL_FORMAT`, the projection map
  versions and others. Whether to extend the record to them is a decision for the owner.
