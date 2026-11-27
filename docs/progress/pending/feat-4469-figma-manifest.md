## (2026-11-27) — The plugin keeps a component manifest in the file (#4469 part 2)

Owner decision A (2026-11-25): after Set up file or Update file the plugin writes the component manifest as plugin data in the file, where agents read it, with an optional Export manifest download; nothing on the canvas; keys and file names stay out of public artifacts. Part 1 (the `GAP / ` layers) merged in #4603.

### What it is
- `apps/plugin/src/component-manifest.ts`, pure. The record is `{ v: 1, engine, sets: [{ def, name, id, key, properties }] }` in the root's **shared** plugin data (`prism3` / `componentManifest`, draft names). Shared, not private: an agent reaches the file through its own plugin run, with another plugin id, and private plugin data is readable only by the plugin that wrote it.
- **Keys (owner decision Q2 A, 2026-11-27).** Each entry carries the published component set's `key`, so an agent in a library consumer can import the set; `null` while the set is not published. `liveKeyOf` reads it off the live node at every write (`getPublishStatusAsync`, then `key`), so a set published after its build gets its key at the next Set up file, Build or Update file. No real key is in the repo: the tests use the shim's `K:<n>` placeholders.
- Every field is read off the plans the executor builds from (`figmaAnatomySet` of the def materialized for the file's brand). The variant properties are the member names' coordinates (`planComponentName`), which is what Figma derives a set's variant properties from; the rest are `planSetProperties`. The only live facts are the node id and the key.
- **A variant's default is the first member's coordinate**, since Figma's `defaultVariant` is the set's first child. The test builds a set in the shim and checks its first child is that member.
- Written incrementally: Build upserts the set it landed (`noteManifest` after the ledger record), Update file upserts every set its apply read and did not refuse, stop or leave off, so a set built before the manifest existed gets listed by its first update. Set up file writes it too. Each write drops entries whose node is no longer a `COMPONENT_SET`. `applyUpdate` now returns `ids` (set name → node id) for this; `update-apply.ts` is outside the executor closure, so `EXECUTOR_REVISION` does not move.
- Export manifest: a card on Docs › Spec drawings (`manifest-export` → `component-manifest`), downloaded as `component-manifest.json`.

### The parity check, and what it measured
`manifestParity` lays the manifest against the **committed** `schema/component-contract.json` (written only by `--accept`). Measured over the 71 sets before writing it: every variant axis, its values and its default agree, with two expected exceptions, both handled by rule, not by a list. The state axis carries a subset of the contract's states (`pending`, `read-only`, `inactive` are code-only), so state values must be a subset. The slot-presence coordinates (`leading icon`) are Figma-only, so they are marked `slot` and skipped. The contract→Figma direction was dropped: Button's `width`, the fields' `style` and the focus ring's `offset` are kept out of Figma on purpose, and the axis-parity gate in `test.ts` already holds declared-against-projected.

The one real default disagreement the probe found, the spinner (first member `x-small`, contract `medium`), is out of scope: the spinner is built as standalone components (`emitAsComponents`), so it has no set and no manifest entry.

### Traps
- The plugin's main thread has no `TextEncoder`, so the 100 kB entry ceiling is counted by hand (`entryBytes`), with a test against Node's count. The whole catalog is about 36 kB.
- `lint-skills` reads backticked all-caps words as code names, so the skill writes the Figma type strings quoted (`"VARIANT"`).
