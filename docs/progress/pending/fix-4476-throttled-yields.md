## (2026-11-24) — Plugin runs stay bounded while Figma's window is hidden (#4476, with #724)

**Status:** plugin (`pace.ts` `handBack`, `main.ts`, `messages.ts`), studio (`write-adapter.ts`, `state/host-session.ts`,
`state/status-strip.ts`, `main.ts`), tests (new `test-throttle.ts`; arms in `test-run-progress.ts`,
`test-style-guide-page.ts`, `test-write-adapter.ts`, `test-host-session.ts`, `test-status-strip.ts`) and a `patch` change
note. `EXECUTOR_REVISION` unchanged: the writers (`write-components.ts`, `style-guide.ts`) are untouched, only the
`yieldTo` `main.ts` passes them moved, and `lint-executor-revision.ts` reads the executor as unchanged. CONTRACT
unchanged. The note's wording is DRAFT, put to the owner in the PR.

### What broke

A 45-table style guide sat on table 28 for about an hour, then finished within moments once the owner looked at the
Figma window (2026-11-23). Every run handed control back with a `setTimeout(0)`: the style guide after every table and
every 28 cells, a build every 4 members, Update file at every set and page. While the window is hidden Chromium runs a
timer at the next whole second, and after about five minutes hidden at the next whole minute. So each hand-back cost up
to a minute, however little work came before it. Through the real `main.ts`, a 60-table style guide on a fake host
that runs a 0 ms timer at the next whole minute waited 3,558 s for 3.7 s of work. That is the owner's hour.

### The fix (owner decision A, 2026-11-24)

One hand-back per run, `handBack` in `pace.ts`, offered at every boundary the executors already have, never at a new
one:
- **Taken once 50 ms of work has run** (`PACE_MS`, the #3170 cadence). This is #724 too: a warm rebuild no longer pays
  162 hand-backs per phase around 1 ms of work. Measured with real timers, 648 warm members took 1,311 ms before and
  589 ms after.
- **Each 0 ms hand-back is timed.** A hand-back at least 250 ms late is late (`THROTTLE_MS`). Four late in a row
  (`THROTTLE_RUN`), a hand-back 5 s late or more counting twice (`THROTTLE_LONG_MS`), is throttling: four hand-backs
  (about 4 s) on a second-aligned host, two on a minute-aligned one. The work between hand-backs then starts at the last
  one's delay and doubles at each late one after, capped at 15 s (`THROTTLED_PACE_MAX_MS`). The next on-time hand-back
  drops it back to 50 ms, and the stretch is remembered for two on-time hand-backs (`THROTTLE_CLEAR`), because a long
  stretch under second alignment can end just before a whole second. 250 ms sits above #724's measured cold average
  (77–118 ms) and well below the ~950 ms a second-aligned host gives a 50 ms stretch; asking for a run keeps occasional
  slow foreground ticks from reading as hidden.
- **The review's correction (#4506).** The first cut counted a hand-back late only at 1 s or more, two in a row. Every
  delay of the first, second-aligned stage is under a second, so for its five minutes the run never read as throttled
  and waited most of a second after every 50 ms of work: about 5% speed for small units. `bound/second` passed only
  because its units were 700 ms. Now `bound/second` runs the five-minute stage in 50 ms units (276 s of work in 300 s;
  15 s of 301 s before), with `bound/second-fine` (1 ms) and `bound/second-uneven` (1–200 ms) beside it.
- **The cap is the bound.** 15 s is under a quarter of the ~70 s hold that dropped Figma's own connections (#684). At a
  minute-aligned wake that is about 15 s of work a minute, so a run takes about four times its working time
  (`bound/minute`: 280 s of work in 1,203 s, where a hand-back at every offer takes about 400 minutes; after the
  five-minute second-aligned stage, which runs at about 1.1 times the work, the whole run takes about 2.6 times). It is a
  stated basis, not a measurement: a live hidden-window run can move it.
- **A wait the executor asks for** (`ms > 0`, the reference back-off) is always kept and never read as throttling.
- **Boundaries that hand back at every pass on purpose keep doing so while the window is visible** (`every`): a page of
  the file (#3110, #3177's one page per turn) and a set of Update file (#3170). They join the throttled pace only while
  throttled. The 50 ms budget is for the executors' chunks and rows, where #724 measured the hand-backs costing more than
  the work. A first cut budgeted the pages too, and `test-open-large-file.ts` (`entry/style-guide`,
  `update/search-yields`) and `test-update-kept-main.ts` failed by name: those rules are #3110's and #3177's, not this
  issue's to relax.
- **The note.** Once a run reads as throttled, its readings carry `throttled: true` (`component-progress`,
  `style-guide-progress`, `run-progress`) to the end of the run. The Build set and Style guides lines append the note,
  and the status strip shows it in place of "Still working on…". It stays for the rest of the run, so it explains a slow
  run to a designer who comes back to the window.

Wired into the build (its page loads and every set, dependencies included), the style guide (page loads, tables, rows)
and Update file (its reads, set boundaries and members, panel and agent alike, replacing #3170's `paced`).

### Traps for whoever re-verifies this

- **Fewer hand-backs means a later Stop.** A cancel can only arrive at a hand-back. In the foreground that is at most
  50 ms plus one unit of work later than before. While throttled it can be up to 15 s plus a timer wake, but the window
  is hidden then. `test-style-guide-page.ts` `cancel` assumed a hand-back after every table over a shim whose tables
  cost nothing, so it now steps the clock 60 ms a call. `test-agent-link.ts` `one-run` held the run at the same hand-back
  over a one-table file, so its file now has a page to load, which hands back at every pass (`every`).
- **Throttling costs a few hand-backs to read**: about 4 s at the start of the second-aligned stage, or two minute-aligned
  hand-backs (up to a minute each) for a run started after five minutes hidden, such as an agent's.
- **A foreground false reading is still possible**, just harder: four slow hand-backs (250 ms or more) in a row, or two
  of 5 s. Simulated with one hand-back in twenty 300–1,500 ms late, 0 of 200 runs read as throttled; with one in seven,
  55 of 200. A false reading stretches the work to that delay until the next on-time hand-back, and shows the note for
  the rest of the run.
- **Coming back to the window** can meet one stretch of up to 15 s before the run is answering every 50 ms again.
- **Still a macrotask** (#724's warning): `REAL_CLOCK.wait` is `setTimeout`. No offline test can tell a macrotask from a
  microtask; the live run is the gate for that, as before.
- **Not tried:** a scheduling primitive the host does not throttle (a UI round-trip by `postMessage`). It cannot be
  verified offline, and the owner chose A.

### Gates and mutations

`test-throttle.ts` (21): `pace/warm`, `pace/foreground`, `bound/minute`, `bound/second`, `bound/second-fine`,
`bound/second-uneven`, `throttle/detect`, `throttle/long`, `throttle/cap`, `throttle/one-slow`, `throttle/apart`,
`foreground/slow-ticks`, `throttle/recover`, `wait/kept`, `before`, `every`, and through `main.ts` `main/bound`,
`main/note`, `main/foreground`, `main/slow-ticks`. `test-chrome.mjs` section 10 reads the note at its three Studio call
sites as drawn: the build's phase line, the status strip, the style guide's phase line (`#4476 …`). `test-run-progress.ts` adds `throttle/build`, `throttle/build-note`, `throttle/update`,
`throttle/update-note`, `throttle/update-foreground`. Seventeen mutations, each failing by name, and twelve more from the review's correction: the 1 s threshold back
(`bound/second`, `bound/second-fine`, `bound/second-uneven`, `throttle/detect`); the late count never reset
(`throttle/apart`, `foreground/slow-ticks`, `main/slow-ticks`); `THROTTLE_RUN` 2 (the same three and `throttle/long`);
a long hand-back counted once (`throttle/long`, `main/bound`); `THROTTLE_CLEAR` 1, or the stretch never doubled (the
three `bound/second` arms); the cap dropped (`throttle/cap`); `every` never throttled (`every`); `seen` never set
(`throttle/detect` and nine more); and in Studio's `main.ts`, the note dropped from `componentPhase`, from
`styleGuidePendingText`, or the `throttled` argument dropped from `stripHears`' `heard` (`#4476` in `test-chrome.mjs`). The pre-fix code (the
style guide given no `yieldTo`) fails `main/bound` ("waited 3558 s over 60 hand-backs") and `main/note`; the build given
none fails `throttle/build` (1,441 s); the update's bare `breathe` fails `throttle/update` (1,130 s).
