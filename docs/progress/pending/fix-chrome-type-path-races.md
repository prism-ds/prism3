## (2026-11-24) — test:chrome #2183 disables and reads a switch in one task, and a page that stops on the Type path says where it stopped (#4466, #4465, #4342)

A P0 lane on the chrome flakes that dropped whole merge-queue groups (#4459 item 1). One race is fixed outright. The other, a page that stops on the Type path, did not reproduce off CI, so this PR makes its next CI hit name the code it stopped in.

### #4466: fixed

The #2183 arm set `disabled` on a switch in one `page.evaluate` and read its skin in the next. On the web, a Google Fonts reply landing between the two repaints the Type levers on `fonts` (`domains/type.ts`), and the fresh, enabled `type-fluid` switch was read as "a disabled switch drawn enabled". The product is right: the repaint draws the switch from state.

`READ_SWITCH` now takes `[sel, true]`, which sets `disabled` and reads in one task. The fonts repaint is a task of its own (the loader's `fetch().then`), so it can't fall between the two. `getComputedStyle` restyles at once, and only the knob's transform transitions, so the colors read are the disabled ones. The Build style guides switch uses the same path.

Measured with Inter hidden from Chromium (a fontconfig `rejectfont`; CI's runner has no Inter) and the Google Fonts stub's reply delayed 0–2 s at random, 3 processes in parallel, web host:

| | #2183 web cases | disabled-skin failures |
|---|---|---|
| before | 90 | 1 (the CI shape: drew the enabled, on switch) |
| after | 150 | 0 |

The lane that filed #4466 measured 3 in 280 under similar conditions.

### #4465 and #4342: located, not fixed

Neither reproduced: 0 in 72 runs of the #2183 case here (3 processes, 2 CPU burners), 0 in 471 in #4465's investigation, and 2 full shard-3 runs in CI's order (13537/13537 each).

What the CI line means is now measured. `locator.click` resolving `type-fluid`, logging `waiting for element to be visible, enabled and stable` and then nothing for 30 s is exactly what a JavaScript loop planted on the Type page, starting just after Show advanced turns on, produces. Playwright's actionability check waits on the page's frames, and a page whose main thread has stopped never answers. A switch that is hidden, disabled, moving or replaced each logs its reason instead (`element is not visible`, `element was detached from the DOM, retrying`, measured). So the CI failures are a page that stopped on the Type path, as #4465's investigation concluded, not a race on the switch.

So the next hit says where:
- `test-bounded.mjs` exports `stallWhere(page)`: on a page `watchStalls` already watches, it pauses the page through the debugger and names its JavaScript stack, or says it was running none (layout, paint, GC, or no frames at all). It says nothing on an unwatched page, because a debugger turned on after the stall never lands.
- `within` (section 21's bounded waits, #4127) appends it when the page renders no frame. Section 21 calls `watchStalls` after its #4127 self-check, whose frames are held by a stub rather than stuck.
- The #2183 arm calls `watchStalls` after `open`, and its catch adds whether the page still renders frames and, if not, where it stopped. Its `openTypeAdvanced` reveal is no longer swallowed by `.catch(() => {})`, so a reveal that stops fails by name instead of surfacing 30 s later as an anonymous click timeout.
- A self-check (`#4342: a wait on a page stuck in JavaScript names where it stopped`): a page of its own, watched, stuck in a loop named `stallSelfCheck`, must be reported by that name.

With the planted loop, the arms read: `#2183 web light: … waiting for element to be visible, enabled and stable; the page renders no frame; it was running JavaScript: mutationHang (page):23366`, and `QA-B9/B17/I11: … Type: the type scale: the preview pane's frames did not settle within 30s; the page renders no frame; it was running JavaScript: mutationHang`.

### Mutations, each in a committed tree, each failing by name

- **M1:** the disabled knob drawn on `--p3-disabled-icon` (`chrome.css`). 38 checks fail as `a disabled … switch … draws Prism3's disabled switch … the outline button's disabled.icon`, both hosts and themes.
- **M2:** `READ_SWITCH` no longer sets `disabled`. Every switch's disabled-skin check fails by name.
- **M3:** a `for (;;)` loop planted on the Type page 400 ms after Show advanced turns on. Section 35 fails all four cases with the stack, and section 21 fails with its named step and the stack.
- **M4:** `within` no longer asks `stallWhere`. `#4342: a wait on a page stuck in JavaScript names where it stopped …` fails (`… the page renders no frame`, no location).

### For whoever picks #4465 up next

When the arm next fails on CI, read the part after "the page renders no frame". A JavaScript stack names the loop. "Not running JavaScript" points at layout, paint or GC, and then a CDP trace on failure is the next step.
