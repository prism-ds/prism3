---
engine: patch
---
On macOS, an engine script run through a symlinked path now runs its check, and the checks that make temp folders pass there as they do on Linux (#4583, #4586). The temp folder on macOS sits behind a symlink (`/var` → `/private/var`, and `/tmp` → `/private/tmp`). A script's entry guard compared the path as typed with the real path the runtime loaded, so a run through the symlink skipped its whole check and exited 0. Every guard now compares real paths through `isEntry` (`entry-point.ts`), which throws by name instead of guessing when the two name different files. Every temp folder is taken at its real path, so a path made under it matches the paths the runtime reports. No emitted artifact changes.
