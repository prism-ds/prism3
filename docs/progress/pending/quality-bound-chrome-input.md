## (2026-11-27) — test:chrome bounds every key press and mouse move too, so a busy page fails the input by name (#4649)

#4648 (#4342) bounded the suite's 1,534 evaluate-family calls on Playwright's client prototypes. The page's raw input
was left out: 184 calls (`page.keyboard.press` 156, `page.mouse.move` 20, `page.keyboard.type` 4, `page.mouse.down` 3,
`page.mouse.up` 3), which Playwright sends with no timeout either. A key press on a busy page waited for the 600 s
watchdog, which names only the last check that passed. **The renderer stall's root cause is still not fixed; #4342
stays open.**

### What changed
- **The same bound, not 184 edits.** `boundEvaluates` (`test-bounded.mjs`) now also wraps Playwright's Keyboard, Mouse
  and Touchscreen prototypes: every method in `INPUT_METHODS` (keyboard `down` `up` `insertText` `type` `press`; mouse
  `move` `down` `up` `click` `dblclick` `wheel`; touchscreen `tap`). The bound is the evaluates' (`EVAL_MS`, 60 s, or a
  page's own `BOUND_MS`), and on it the call rejects with the same label: method, call site, section and last check,
  then the page reading. Example: `keyboard.press (test-chrome.mjs:… ; section 20, after "…") did not settle within
  3s; the page renders no frame`.
- **A new Playwright method cannot arrive unbounded.** At install, each input class's own methods are read off its
  prototype; one missing from `INPUT_METHODS` throws, so the suite stops before it starts rather than leaving it raw.
- **Locator actions stay on their own clock.** A locator's `click`, `press` or `fill` already carries Playwright's 30 s
  action timeout; the lint now refuses turning that off (below). The 15 s `bounded` inputs (#2550) keep their own
  bound, which fires first.
- **A stalled input is still in flight when it rejects.** The rejection ends its case, and the case's `finally` closes
  the context, which cancels it (the rule `test-bounded.mjs`'s header already gives for `bounded`).

### Held (section 20 of test:chrome)
- **Runtime, forced busy:** on a page made busy by a looping timer, each of the 12 input methods, written plain, fails
  by name on a 3 s page bound inside the arm's 20 s guard, all at once (a tap on a touch-enabled page of its own). The
  kinds are typed in the check, and a check asserts the typed list equals `INPUT_METHODS`, so a method dropped from
  either is caught.
- **`lint-chrome-bounds`, two new rules, each with a planted line caught by line number:** a CDP `Input.dispatch…`
  (or `insertText`, `imeSetComposition`, `emulateTouchFromMouseEvent`, `synthesize…`), raw input the bound cannot
  reach; and an action's timeout turned off (`{ timeout: 0 }` on a locator action, or `setDefaultTimeout(0)`).
- **The install-order rule's missing plant:** #4648's "page or context made before the install" rule had no planted
  line (a line appended at the end of the file can never be before the install). A context made on the file's first
  line, ahead of the source, must now be caught as `line 1`.

### Mutations (section 20, on a one-off local shard, after a `wip:` commit, reset after)
- The three input targets dropped from `boundEvaluates`, the CDP Input rule dropped, the timeout-off rule dropped, and
  the install-order push disabled, in one run: 16 checks fail by name (1040/1056). Each of the 12 input arms reads
  "still waiting at the 20s guard: the call has no bound"; each removed rule's planted line reads "nothing found".
- `wheel` dropped from `INPUT_METHODS`: the install throws `Mouse2 has input methods the bound does not list (wheel)`.
- The first version of the call-site check expected no function name before the file, and failed on the tap arm,
  whose arrow V8 named `inputs`; the check now allows an optional name, as `siteOf` writes one.
