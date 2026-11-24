## (2026-11-24) — test arms and guide citations stop conflicting across queued PRs (#4455)

The structural fix #4459 ranked first after the cap: after each merge wave most of the queue went dirty on two files, `packages/engine/test-arms.txt` and the line-number citations in `docs/public/guides/*.md` (31 of 42 PRs on 2026-11-21).

### Test arms: one file per arm

`test-arms.txt` was kept sorted, so arms named for issues opened in the same week landed on adjacent lines, and two PRs that each registered one conflicted. GitHub's mergeability check ignores merge drivers, so `merge=union` was never an option. The registry is now `packages/engine/test-arms/`: each arm is a file named `<suite, / written __>__<NNNN>` that holds its old `<suite> #NNNN` line. Different arms are different files; the same arm added twice is the same bytes, which git merges as one. `--accept` writes one file per new arm and still never deletes. A file whose name and line disagree, holds two lines, or is empty fails MALFORMED, so a copied file can't register one arm under another's name. The independence argument is unchanged: the registry is still authored, the suites are still read as they stand.

Per-suite files were considered and rejected: `test.ts` alone holds 551 of the 1,420 arms, so they'd still collide there.

### Guide citations: markers, not line numbers

A citation is now `<!-- src: path@"start" -->` or `<!-- src: path@"start".."end" -->`. The start needle must occur exactly once in the file. The block runs from its line to the line where the end needle's first match at or after it ends. Needles are JSON strings, so `\n` spans lines and `|` writes a `|` that would otherwise split a table row (the docs renderer strips comments before it splits cells, but GitHub's table view does not). The new MARKER arm fails by name on a line-number citation, a needle gone from its file, one the file holds twice, or an end with no match. CITE, FINGERPRINT and ORDER read the resolved lines exactly as before.

Of the 385 citations, 374 were converted by `lint-guide-claims.ts --convert`, which resolves each marker again and keeps it only if it names the same lines. Each one kept its fingerprint, so it's checked against what was originally stamped. A separate Python check outside the gate confirmed the same lines for all 374. The other 11 were done by hand. Five ended on a trailing blank line, which no needle can end on; those were trimmed by one line, and the three fingerprinted ones re-stamped after reading. Six cited a line the file repeats (`due: 'Due',` sits in two maps; `alphabetical: true,` twice). Each was widened by one or two neighboring lines until its needle was unique, and the two fingerprinted ones were re-stamped after reading. The gate's summary reads the same before and after: 385 citations, 226 quoting, 159 held by fingerprint, 165 fingerprints, 7 ordered lists.

### What it closes and what it doesn't

#4310, #4414 and #4427 were each "a range moved by an insertion above it still passes". That can't happen now: an insertion above doesn't move a marker. #4048 and #4111's registry half go with #4455. #4460 (a claim dropped in a merge resolution) and #4027 (a template hole absorbing words) are different gaps and stay open. So does #4111's other half: new `test.ts` arms still append at one anchor near the end of the file.

### Proof

Mutations, each against a commit: dropping `#1812` from its suite fails `ARM GONE`; deleting its file fails `UNREGISTERED`; a file holding another arm's line fails `MALFORMED`; renaming a cited line, or copying its text into a comment, fails `MARKER` ("has no", "finds … 2 times"); one space inside a fingerprinted block fails `FINGERPRINT`; a line-number citation fails `MARKER`. Three lines inserted above 84 cited blocks pass. Weakening the resolver's uniqueness check, or its line-number refusal, fails the gate's own SELF-CHECK by fixture name.

A merge simulation starts two branches from one base. Each adds an arm, adds a citation, and inserts lines into `update-file.ts`, the file with the most citations (77). On main as it was, B conflicted with A in 8 files, 28 hunks (seven guides and `test-arms.txt`). On this branch B merges clean, and both gates pass on the merge with both arms and both citations present.
