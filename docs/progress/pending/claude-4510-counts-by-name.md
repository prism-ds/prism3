## (2026-11-24) — Three tests name the sets they expect instead of counting them (#4510)

Three tests compared a registry with a count written by hand, and every PR that added a set raised that count. When
two open PRs each raised it by one, git merged the identical lines, and the merged tree held a number neither PR had
checked. In #4260 the canvas-furniture count went from 60 to 61 on both sides; 62 was true. Only the merge queue's full
run caught it, and that drops the whole group. This is the half of #4459's ranked item 5 that covers counts. The half
that covers version numbers is #4458, in its own PR.

### The change

Each test now reads the ids it expects from `packages/engine/schema/component-surface.json`, the surface baseline
that only `lint-component-surface.ts --accept` writes.

- **`apps/plugin/test-canvas-furniture.ts`, `rollout/switch`.** This held `withSet.length === 68`. The expected list
  is now the baseline's default projections (keys with no `@`) of more than one member, less the three single
  components. A difference is named both ways: `not built: [...]` and `not in the baseline: [...]`. A def that builds one member but isn't in `ONE_MEMBER` is named as that, `one member in the baseline, not in ONE_MEMBER: [...]`, and not as missing from the baseline, which records it with one member.
- **`apps/studio/test-component-groups.ts`.** This held `catalog.length === 74`. The catalog's ids are now held to
  the baseline's default projections, both ways.
- **`apps/plugin/test-roundtrip.ts`, #1667.** This held `BUTTON_LAID.length === 8`. The ids are now held to the
  baseline's `@button-edges` and `@button-smaller` keys.
- **`apps/plugin/test-reactions.ts`, `map/scope`.** The count appeared only in the message, and it was stale: it said
  23 while 24 defs were listed. The message now computes it from the literal `want` map, which the test already
  checked.

**Why the baseline, and not the registry.** Each test's actual side comes from the defs: a registry filter, a
generated catalog, or `applyButtonLayout`. The baseline is an accepted record, not something these tests derive, so
the comparison stays a comparison (docs/34). Two PRs that each add a set each add their own baseline key, and the
merge keeps both. The guide's "74 component sets" is already checked by name by `lint-guide-claims.ts`'s `COUNT` arm,
so it isn't changed here.

### Evidence

- **A simulated two-PR merge, in a scratch worktree.** One PR adds a copy of Tag, the other a copy of Banner. Each adds
  its id to `CANVAS_FURNITURE` and its key to the baseline, as `--accept` would.
  - **Before**, on `main`, each PR also raises the count from 68 to 69, as the old rule required. The merge is clean.
    The test reads 69 and fails `rollout/switch` with `off: []`: true count 70, and the failure names nothing. That
    is #4260 reproduced.
  - **After**, on this branch, neither PR edits the test. The merge is clean and `rollout/switch` passes: "all 70
    defs … the 70 the surface baseline records".
- **Mutations, each failing the arm by id:**
  - the furniture filter drops `tag` → `rollout/switch … not built: ["tag"]`;
  - the generated catalog loses `divider` → `every set is listed once … not in the catalog: ["divider"]`;
  - `BUTTON_LAID` drops `toggle-button` → `#1667 … off: ["toggle-button@edges","toggle-button@smaller"]`.
  - the baseline records `tag` with one member → `rollout/switch … one member in the baseline, not in ONE_MEMBER: ["tag"]` (before the finish lane's fix it read `not in the baseline: ["tag"]`, which was wrong);
  - the baseline loses `tag`, or gains a `tag-copy` with a `@button-edges` projection → each of the three tests names the id, both ways.
- **No count was replaced by a floor or removed.** Each test now asserts more than before: which ids, not only how
  many.
