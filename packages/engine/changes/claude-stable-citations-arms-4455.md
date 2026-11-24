---
engine: patch
---
Two shared files no longer make queued PRs conflict with each other (#4455). The test-arm registry `lint-test-arms.ts` reads is now a directory, `packages/engine/test-arms/`, with one file per arm in place of the sorted `test-arms.txt`, so two PRs that each add an arm add different files. The public guides cite their sources by marker, `path@"first line".."last line"`, in place of line numbers, so a PR that inserts lines above cited code no longer moves the citation. `lint-guide-claims.ts` fails a citation by line number, a marker gone from its file, and a marker the file holds twice, each by name, and `--convert` rewrites a line-number citation as a marker naming the same lines. Gates and guide comments only; no committed artifact moves.
