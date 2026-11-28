## (2026-11-28) — Every browser suite bounds its evaluates, input and CDP commands, so a busy page fails the call by name in any of them (#4647)

#4648 and #4655 bounded test:chrome's evaluates and raw input on Playwright's client prototypes (`boundEvaluates`,
`apps/studio/test-bounded.mjs`). Two gaps were left. The other browser suites launched their own browsers without the
bound, so their plain `page.evaluate` calls still went out with no timeout and a busy page waited for the job timeout.
And test-chrome's CDP commands (`DOM.getDocument`, `Accessibility.getPartialAXTree`, `Emulation.setEmulatedMedia`, CSS,
Animation), all answered on the renderer's main thread, had no bound either. **#4342's root cause is still not fixed.**

### What changed
- **CDP commands go through the same bound.** `boundEvaluates` now wraps `CDPSession.send` too. Its label names the
  command, e.g. `cdp.send('DOM.getDocument') (test-chrome.mjs:… ; section 20, after "…") did not settle within 3s;
  the page renders no frame`. A session doesn't know its page, so `newCDPSession` is wrapped only to record which page
  each session opened on. The helper's own debugger (`Debugger.enable`, `pause`, `resume`) uses the original `send`,
  because a probe of a stuck page must not itself be bounded. This one prototype covers test-chrome's 119 sends and
  test-build-verdict's 12 without editing any call.
- **Installed in every browser suite under `apps/`:** test-smoke, test-site-headers, test-export-parity, lint-live-css's
  stylesheet parse, and the plugin's test-start-screen, test-build-verdict, test-style-guides-page and test-agent-bridge.
  Each install comes right after the launch, before any page, at 60 s. The scripted suites label a stall with their last
  check, and each prints its slowest settled call at exit. A local run's margins: smoke 10.0 s of 3,968 calls,
  test-build-verdict 5.0 s of 1,104, test-start-screen 4.0 s of 527, the rest under 1 s. The slowest are all
  `waitForFunction`, whose bound is its own timeout plus 60 s.
- **One install per process.** The prototypes are shared, so a second call (lint-live-css can parse more than once)
  returns the first call's stats and patches nothing again. Before this, a second install would have stored the bounded
  methods as the "originals".
- **No CI wiring moved.** Each suite runs in the job it ran in before, so CONTRIBUTING.md §3 and `lint-doc-gates` are
  unchanged.

### Held (section 20 of test:chrome)
- **`lint-chrome-bounds` reads every browser suite, not only test-chrome.** Every file under `apps/`, `packages/` and
  `tools/` that launches a browser must be a held suite or appear in `EXEMPT` with its reason. The list of launchers is
  read from the code, not from the list, so a new suite fails by name until it is listed. Each held suite must install
  `boundEvaluates` before its first page and pass every existing rule. Two plants check the lint itself: test-smoke's
  source with its install line removed must be caught, and a planted file that launches a browser and isn't listed must
  fail the scope rule.
- **Exempt:** test-web-fonts-stub (the launcher the suites call), two `tools/` harnesses that CI doesn't run, and two
  package files filed as #4657: `packages/engine/shadcn-browser.ts`, which runs in CI but can't import from `apps/`,
  and `packages/tokens/qa/render-qa.mjs`, a manual QA render.
- **Runtime, forced busy:** one command per CDP domain test-chrome sends, written as a plain `cdp.send` on the busy
  page, must each fail by name on its 3 s page bound inside the 20 s guard. The domains are typed in the check and
  compared with the domains this file's code sends, so a new domain must be added to the check.
- **A planted line** that sends a CDP command through the original `send` is caught as "the unbounded originals".

### Mutations (section 20, one-off local shard, after a `wip:` commit, then `git reset --hard`)
- Four mutations in one run, ending at 1065/1074, with every expected check failing by name:
  - test-smoke's install removed: `apps/studio/test-smoke.mjs installs boundEvaluates … — boundEvaluates is never
    installed on the browser`;
  - `CDPSession.send` dropped from `boundEvaluates`: each of the five CDP arms reads `still waiting at the 20s guard:
    the call has no bound`;
  - one test-chrome `Emulation.setEmulatedMedia` sent through the original: `line 13520: the unbounded originals`;
  - test-agent-bridge dropped from `SUITES`: `not listed: apps/plugin/test-agent-bridge.ts`.
- The ninth failure is the drop plant's own check. With the install already gone, there was nothing left for it to
  drop.
