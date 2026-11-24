---
engine: minor
---
Per-mode font weights take the same range as the brand's own weight roles, any whole number from 1 to 1000 (#4214, owner decision A). `modeLevers.<mode>.weights` used to stop at 100 to 900, so a mode could not move a weight as far as the brand could set one; a brief that validated before still validates. A brand id that no file on Windows can carry, such as `CON`, `nul` or `a?b`, is now refused where its files are written, with a line that names the file and the reason, before anything is written: by the token emit, by every other file the CLI writes, and by export_theme. The published input schema is unchanged and still accepts such an id (owner decision, 2026-11-20).
