## (2026-11-27) — test:chrome bounds every evaluate where they all go through, so a busy page fails by name (#4342)

#4127 and #4642 (#4612) bounded the evaluates on the paths that had stalled, one `within` at a time. The next stall came
at a plain read on another path: 18-s4f's Gradients read, after "figma QA-B12: unpaired …", 600 s to the watchdog
(#4342, 2026-11-27). Playwright sends `evaluate`, `evaluateAll`, `$eval` and `$$eval` with no timeout at all
(`kNoTimeout` in its client), so every such call in the harness could do the same. **This does not fix the renderer
stall's root cause; #4342 stays open.** It makes every stall fail fast and say where it was.

### Inventory (main at `463fdf3c`, `apps/studio/test-chrome.mjs`)
1,534 evaluate-family call sites: `page.evaluate` 1,042 · `page.waitForFunction` 445 · on other page objects 16
(`sp`, `bp`, `p2`, `p3`, …) · `locator`/handle `.evaluate` 23 · `.evaluateAll` 8. About 20 were already inside a
`within`; the 447 `waitForFunction`s had Playwright's own timeout but no label. The plugin's chrome runs inside this
same file (host `figma`), so it is covered by the same change.

### What changed
- **One wrapper, not 1,500 edits.** `boundEvaluates` (`test-bounded.mjs`) replaces the evaluate family on Playwright's
  own client prototypes, read off a live page: Page, Frame, Locator, JSHandle, ElementHandle. It is installed right
  after launch, before any page exists, so every page any context opens is bounded from its first call.
- **The label names the step and where it stopped:** the method, the call site (the caller's first two frames outside
  the helper and Playwright), the section and the last check reached, then the same page reading `within` gives
  (renders frames or not; on a watched page, where it stopped). Example from the self-check:
  `page.evaluate (gradientsRead test-chrome.mjs:6516 < test-chrome.mjs:6591; section 18-s4f, after "figma S4f lock and
  gradients: 0 console errors") did not settle within 3s; the page renders no frame`.
- **The bound, `EVAL_MS` = 60 s:** twice `STEP_MS`, so a `within` around an async step always speaks first, and 10x
  the slowest call that settled across the three shards (6.0 s, a frame wait in `settleModes`, of 47,405 calls). Every
  run prints its own slowest call. A `waitForFunction` gets its Playwright timeout plus 60 s, so Playwright's error
  still comes first; a `timeout: 0` gets 60 s.
- **One bound per call:** Page.evaluate into Frame.evaluate, or Locator.evaluate into JSHandle.evaluate after an await,
  is bounded at the outer call alone (an AsyncLocalStorage marks the inner one).
- **`within` takes the bound over.** `within(page, label, page.evaluate(…), ms)` disarms the call's bound, so an
  explicit label and limit always win. Its message now comes from the shared `stallMessage`, word for word as before.
- **The probes stay unbounded.** `rendersFrame` and `stallWhere` read the stored originals, so a bound's own diagnosis
  never probes through another bound. test-smoke's pages, never patched, fall back to their own methods.

### Held two ways (all in test:chrome)
- **Section 20, runtime:** on a page made busy, a plain `page.evaluate`, `page.waitForFunction` (`timeout: 0`),
  `locator.evaluate`, `locator.evaluateAll` and `frame.evaluate` each fail by name on a 3 s page bound, inside a 20 s
  guard. Then a 6 s `within` around a call on a 1 s bound must speak with its own words.
- **Section 20, `lint-chrome-bounds`:** reads this file's code for what the bound cannot reach: a CDP
  `Runtime.evaluate`/`callFunctionOn`/`awaitPromise`, a Worker's evaluate, Playwright's internal channel, the
  unbounded originals, a bound disarmed outside `within`, a page made before the install. A planted line of each of
  five kinds is caught by line number in every run.
- **Section 18-s4f:** the Gradients read itself, unchanged and pulled into `gradientsRead`, on a busy page fails by
  name with its function, the section and the last check.

### Mutations (sections 18-s4f and 20, on a one-off local shard)
- `boundEvaluates` patches nothing: all seven runtime checks fail by name with the guard's words ("still waiting at
  the 20s guard").
- `within` no longer disarms: the takeover check fails by name, hearing the call's words. The first version of that
  check survived this mutation: a 3 s `within` beat a 1 s bound plus its 3 s page reading either way. It now waits 6 s.
- A `cdp.send('Runtime.evaluate', …)` planted at line 6651: `lint-chrome-bounds` fails naming line 6651.

### Limits, filed
- Other `cdp.send` calls (Emulation, CSS, …) and the other browser suites (`test-smoke.mjs`, the plugin's
  `test-start-screen.mjs`, `test-build-verdict.mjs`, `test-style-guides-page.mjs`) are not covered: #4647.
- A bound that fires in a case with no `try` ends the run as an uncaught error carrying the label: by name, but the
  sections after it don't run. Before, the watchdog ended the run the same way 600 s later.
