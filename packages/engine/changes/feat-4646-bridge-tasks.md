---
engine: minor
---
The Figma bridge runs `figma_run` as an MCP task when the client asks for one, with progress through `tasks/get` and the plugin's result through `tasks/result`. A plain call that times out now names the run's id, and the new `figma_result` tool returns that run's result once it lands, so a long command is never sent twice. The bridge answers each client with the protocol revision it asked for when it speaks that revision, so a 2025-11-25 client gets the revision tasks need and an older client keeps its own; it never answers 2026-07-28. Only a 2025-11-25 session is offered tasks. The agent reference lists the bridge's protocol revisions, its capabilities and the new tool.
