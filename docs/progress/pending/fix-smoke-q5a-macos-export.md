## (2026-11-27) — test:smoke's export set says why it came back short (#4596)

**What changed.** `downloadSet` in `apps/studio/test-smoke.mjs` now reports why a set came back short, in a non-enumerable `why`. It gives how many downloads the click started (counted in the page, one per anchor with `download` it clicks), how many of the expected files arrived and whether the 15s ran out, and each file that arrived but could not be read, with the browser's failure. The #2942 case's `exportedUnderline` carries that reason after "no base file". The expected count is still read from the committed files, never from the page, and the started count is reported, never compared (docs/34).

**This is a diagnosis aid, not a fix.** #4596's failure (`#2942 Q5 A … got "no base file"`, every run on one Mac, never on CI) did not reproduce on Linux: 0 failures in 61 runs of the case on `main` (1 plain, 40 in 4 parallel processes, 20 with a 6× CDP CPU throttle on the page), and 0 in 40 after this change. "No base file" has two possible causes, and the old set could not tell them apart:
- **No base download event before the race ended.** With `count` at 5, `got.size >= count` cannot resolve without the base, so the 15s ran out: the click started no download, or the browser delivered fewer than five.
- **The base arrived but `dl.path()` or `JSON.parse` threw.** A failed or cancelled download, swallowed by `catch {}`.

The next run on that Mac names which, and the file names that did arrive.

**Ruled out by reading.**
- `count` is 5 on any checkout. Regen's uncommitted outputs live under `out/components/`, outside the filter.
- The web download path is synchronous: `exportTokens` clicks one anchor per file in the confirm's own task. The blob is captured at the click, so the `revokeObjectURL` at 0ms cannot fail it.
- `rebuild()` persists and then notifies in one task, so the theme is rebuilt by the time `settle` sees `localStorage` change.
- The Export page redraws only on `bar`, `host` and `origin`, and nothing on the web fires those asynchronously after the area opens.
- Neither the suite nor `src/` has a platform branch.

**Measured.** The five `download` events do not always arrive in emission order. In 10 of 120 exports the base was not first; one run's third export delivered `brand-b` first. `downloadSet` counts by name, so the order is not the cause, but a reader of the new `why` should not expect emission order.

**Mutation (fails by name).** The studio's `download()` skips the base file once the underline is unset (`main.ts`, rebuilt). The case then fails `#2942 Q5 A: Prism3: off, the export carries no core.font.underline (got "no base file: the click started 4 downloads; 4 of 5 arrived before 15s ran out (prism3.brand-b.overlay.tokens.json, …)")`.

**For whoever picks up #4596 next.** Run `npx tsx verify.ts smoke` on the Mac that fails and read the reason after "no base file". "The click started 0 downloads" means the confirm click registered nothing: look at the Export page under the click. "Started 5; 4 of 5 arrived" means the browser dropped one. An "arrived but unreadable" entry names a failed download.
