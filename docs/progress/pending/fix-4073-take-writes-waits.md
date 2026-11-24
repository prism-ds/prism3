## (2026-11-24) — test:chrome waits for the write it reads, and settles only where it asserts none (#4073, #3686)

A merge-queue group dropped on `✗ #2909 figma dark 380: with the link off, Minimize asks the main thread to minimize (posted [])` (run 45369171189, chrome section 10). The same arm, and its sibling `T7 …: a click while on asks the main thread to turn the link off`, had failed the same way in at least eight local and CI runs (#4073, #3686), and passed each time on a re-run.

**Diagnosis.** The Minimize tile posts `minimize-ui` synchronously on click (`apps/plugin/src/agent-link-ui.ts`), and the suite records it through a `message` listener. `takeWrites` read that record after a fixed `setTimeout(…, 50)`, so on a loaded runner a post delivered later than 50 ms read as `posted []`. Every one of the 59 `takeWrites`/`takePosts` reads had the same exposure. So did section 10's #3308 `takeCv` reads and the stopped run's `run-ended` read, which waited on nothing at all.

**Fix (test only).** One reader, `takeFrom(page, key, n, type)`, with two uses that are now told apart at each call site:
- **A read that expects a write** (`takeWrites(page, n, type)`, `takePosts(page, n)`) polls until `n` writes (of `type`, when given) have landed. It is bounded by `POST_WAIT_MS` (5 s, the section's other bound), never waits less than the old 50 ms, and then waits for one marker message that the page posts to itself. A window's messages arrive in order, so any write the same handler posted after the awaited one is read too, and an extra write still fails `isWire`. A miss returns what did land, so the arm fails by name, as before.
- **A read that asserts nothing was posted, or only clears the record** (`settleWrites`, `settlePosts`, `takeCv(…, 0)`): the explicit settle step, 50 ms and no more, the same as every read before. A passing absence check is no slower.

Each call site was classified by reading what it asserts: 26 reads expect a write, 11 assert none, 22 clear the record. Where a read filters by type (`build-components`, `apply-theme`), it waits on that type, so a different write landing first doesn't end the wait early. Two reads that only discard the run's write after Update file's Go (the `Update again` history arms) now wait for it, so a late write can't leak into the next arm's absence check.

**Self-check.** Section 10's first cell checks the reader on a record of its own: an entry that lands 200 ms late is read by a read that expects it, and not by the settle step.

**Load loops.** Section 10 alone, from an untracked copy of the suite with `Emulation.setCPUThrottlingRate` on every page. In each round, two copies of the old suite and two of the fixed one ran at once on a 4-core box, under a 10× throttle with four busy loops, so both faced the same load.
- **Old reads:** 2 of 4 runs failed, with 3 posted-message misses: `#3128 … (posted ["build-components"] then [])`, and `#3308` twice (a `takeCv` read of `[]`). That is the same race in two more arms. An earlier, harsher round also caught `#3128`, before the section watchdog stopped every run.
- **Fixed reads:** 0 posted-message misses in 4 runs; 3 of 4 runs were fully green. The one failure was unrelated to message reads: a CDP font probe that read "drew nothing" under that load.
- **Lighter load:** at a 4× throttle with three copies, the old suite passed 3 of 3, so the race needs real contention.
- **Not reproduced:** the #2909 arm itself never failed locally. Its mechanism is the one shown above, and the fix covers it, but no local run shows that arm going from failing to passing.

**Mutations, each failing by name** (one run of section 10, all four applied, 25 failures, every one an intended arm):
- **`takeWrites`:** Minimize's click posting nothing (`agent-link-ui.ts`) fails `#2909 …: with the link off, Minimize asks the main thread to minimize (posted [])` and `#2949 …: Minimize asks …`, in all six figma cells. Each waited the 5 s bound and failed, so a missing message isn't masked.
- **`takeCv`:** the cover step not asking for its check (`main.ts`) fails `#3308 …` in all six figma cells.
- **The run-ended wait:** the Update file branch's `pendingEnds.push` dropped (`activity.ts`) fails `#533 …: the stopped run posts one run-ended, "Update file failed." (posted [])` in all six figma cells.
- **`takeFrom`:** the reader not polling (the settle alone) fails the self-check `#4073 web light 1280: … (read [] in 53 ms …)`.

The settle step's behavior is unchanged (50 ms, as every read was before), so the absence arms keep the mutations they already had.
