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
- **Each 0 ms hand-back is timed.** Two in a row at least 1 s late (`THROTTLE_MS`, `THROTTLE_RUN`) is throttling. The
  work between hand-backs then grows to the last one's delay, capped at 15 s (`THROTTLED_PACE_MAX_MS`), and the next
  on-time hand-back drops it back to 50 ms. The 1 s threshold sits above #724's measured cold average (77–118 ms) and
  below nearly every minute-aligned wait. Two in a row keeps one long foreground reconcile from reading as hidden.
- **The cap is the bound.** 15 s is under a quarter of the ~70 s hold that dropped Figma's own connections (#684). At a
  minute-aligned wake that is about 15 s of work a minute, so a run takes about four times its working time
  (`bound/minute`: 280 s of work in 1,194 s, where a hand-back at every offer takes about 400 minutes). It is a stated
  basis, not a measurement: a live hidden-window run can move it.
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
- **The first two throttled hand-backs still cost up to a minute each**: throttling cannot be read before it happens.
- **Coming back to the window** can meet one stretch of up to 15 s before the run is answering every 50 ms again.
- **Still a macrotask** (#724's warning): `REAL_CLOCK.wait` is `setTimeout`. No offline test can tell a macrotask from a
  microtask; the live run is the gate for that, as before.
- **Not tried:** a scheduling primitive the host does not throttle (a UI round-trip by `postMessage`). It cannot be
  verified offline, and the owner chose A.

### Gates and mutations

`test-throttle.ts` (14): `pace/warm`, `pace/foreground`, `bound/minute`, `bound/second`, `throttle/detect`,
`throttle/one-slow`, `throttle/recover`, `wait/kept`, `before`, `every`, and through `main.ts` `main/bound`, `main/note`,
`main/foreground`. `test-run-progress.ts` adds `throttle/build`, `throttle/build-note`, `throttle/update`,
`throttle/update-note`, `throttle/update-foreground`. Seventeen mutations, each failing by name. The pre-fix code (the
style guide given no `yieldTo`) fails `main/bound` ("waited 3558 s over 60 hand-backs") and `main/note`; the build given
none fails `throttle/build` (1,441 s); the update's bare `breathe` fails `throttle/update` (1,130 s).
