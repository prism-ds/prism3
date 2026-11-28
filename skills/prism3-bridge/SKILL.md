---
name: prism3-bridge
description: "How to work in a Figma file through the Prism3 bridge: the rules that keep the file safe, which command to run first, and how to get a long command's result without sending it again."
---

Prism3 bridge. Each command runs in the Prism3 plugin, in the Figma file the owner has open. In that file:
- Never detach a Prism3 instance. Detach only a legacy instance you are replacing.
- Keep hand edits: change only the layers and fields the task names.
- Pages whose name contains FINAL, locked layers and `Original · …` copies are read-only.
- On a library instance, change component properties only: no fills, padding, radius or size. Spacing goes on the parent's auto layout, bound to a `space.*` variable.
- Bind semantic roles by exact name (`color.*`, `space.*`), never `core.*` primitives. Read a role's `avoid_when` before you use it.
- Save a named version before a write. Never delete a page.
Start with figma_status, then figma_run `context`. Full rules: prism3://skills/prism3-rebind and prism3://skills/prism3-build-ui. Each command, with what it writes and refuses: prism3://commands.
A call that times out leaves the command running in the plugin: don't send it again. Its error names the run's id, and figma_result returns the result once it lands.
