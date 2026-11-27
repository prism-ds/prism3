## (2026-11-27) — A scoping proposal for renaming the committed client-named brand ids (#4645)

**What changed.** A new proposal, `docs/superpowers/brand-id-rename-proposal.md`, for the owner to decide on. It renames nothing, and no engine behavior changes. It covers the five points #4645 asks for: an inventory by kind, neutral-id schemes, the public surface a rename moves, the history options, and a phased plan with a gate. It ends with seven questions, each answerable with one letter.

**What the inventory found.**
- **The hits are mostly one prefix.** The issue's grep matches 14,853 lines in 334 files, but `nbds` is 12,296 of them: the `nb` fixture's token root, repeated in its emission and in both legacy reference trees.
- **Raw `\bnb\b` overstates the id.** Read in context, it is 867 occurrences in 115 files. The rest are local variables and binary fonts. The proposed gate therefore matches `nb` only in id positions.
- **Three surfaces the issue names don't carry the ids at all:** the hosted `/r/` URLs (an allowlist since #4373), the MCP server (it takes a `BrandInput` and serves no list of ids), and the shipped plugin and Studio menus (`prism3`, `aurora` and `harbor` only). Neither the contract's guaranteed names nor `CONTRACT_VERSION` move either, because `guaranteed` is keyed below the root.
- **There is a trap in the contract baseline.** `token-contract.ts --check` doesn't compare the baseline's `corpus` labels, so a stale brand label there passes silently. The rename has to refresh it with `--accept`.

**The recommendation.** Role-based ids (`ref-standard`, `ref-legacy`). History forward only, because rewriting a public repo's history breaks every clone, and merged PR refs keep the old objects anyway. The gate lands first, as a ratchet.

**Held by.** Nothing yet: this PR is docs only. The gate it proposes, `lint-client-ids.ts`, comes with its planted cases and a mutation that fails by name.

**Not yet confirmed.** Whether `tools/list` serves the full name found in `theme-schema.json`'s root description. Reading `compactSchema`, it very likely doesn't. Phase 1 confirms it and files an issue if it does.
