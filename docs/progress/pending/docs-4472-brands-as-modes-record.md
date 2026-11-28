## (2026-11-28) — Brands as modes: the design record (#4472, phase 1)

**What changed.** A new design doc, `docs/47-brands-as-modes.md`, records the owner's decisions on #4472: brands as modes (2026-11-25), and the eight answers plus the contract-version call on the design proposal (2026-11-26). Each one is a `Decided (...)` heading with its row in `docs/42-current-decisions.md` and `schema/decisions-index.json`, and docs/47 joins `REQUIRED_DECISION_DOCS` in `lint-decisions-index.ts`. No engine behavior changes and no artifact moves, so the PR carries no change note: the change-notes README says a change that owes no bump carries none.

**Why this is the whole of phase 1.** The proposal's build plan makes the design record its own phase, mergeable alone, so the decisions sit in one routed place before any engine work leans on them. The doc restates the decisions and the plan, not the proposal's survey of today's code: that survey describes code the later phases move, so a copy would go stale.

**Held for the owner.** Two questions the proposal and the answers left open, in docs/47 §4: (A) whether the default brand's color modes keep `light`/`dark` once a second brand arrives, and (B) how an existing custom mode used as a brand converts, since the proposal's in-place rename conflicts with `docs/44` §9.1 (Q172 A, never rename a mode in a built file). The phase that needs each one stops until it is answered.

**Trap for the next phase.** The owner's decision comment numbers the questions one higher than the proposal (architecture became Q1). docs/47 uses the owner's numbering; the proposal's "Q2" is the owner's "Q3".

**Held by.** `lint-decisions-index.ts`: deleting a docs/47 table row in docs/42 fails as DOCS/42 ROW MISSING, retitling a docs/47 heading fails as ROW NOT FOUND and UNINDEXED DECISION, and dropping docs/47 from `REQUIRED_DECISION_DOCS` fails as DECISION DOC NOT LISTED.
