---
engine: minor
---
The Figma bridge's method-not-found errors name the method again (`method not found: <method>`), as they did before the move to the MCP SDK. A session below 2025-11-25 now gets none of the task surface: no `execution` field on `figma_run`, a `figma_run` sent with `task` runs as a plain call, and `tasks/get`, `tasks/list` and `tasks/result` answer method-not-found. With `--record`, a call that timed out gets a `late` line when its run ends. The agent reference says the bridge's tasks are offered only to a 2025-11-25 session.
