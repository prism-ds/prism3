## (2026-11-27) — The Figma bridge runs figma_run as an MCP task, and a timeout keeps the run (#4646 step 1)

Long `figma_run` commands outlasted the wait: the call failed with "no result … the plugin may still be running it", and
the agent had to rebuild the outcome from `figma_logs`. Step 1 of #4646 fixes that two ways.

- **Tasks.** The bridge declares the `2025-11-25` `tasks` capability (`list`, `requests.tools.call`), and `figma_run`
  has `execution.taskSupport: "optional"`. A call with `task` is answered at once with the run as a task. `tasks/get`
  reports it, with the last progress reading as `statusMessage`; the call's `progressToken` keeps getting progress;
  `tasks/result` waits and returns the plugin's result envelope, tied to the task; `notifications/tasks/status` goes out
  when it ends. A task `failed` only when the bridge gave up on the run. No `tasks/cancel`: the plugin cannot stop a
  command once it has it, so the bridge does not offer to.
- **A run outlives its caller's timeout.** The bridge now keeps every run by its id (the command's own `b…` id, given
  before the command is queued). A timeout ends the caller's wait and names the id; `figma_result {id}` returns the
  envelope once it lands, or the run's status while it runs. Before, a timeout deleted the run, and a late result was
  "a result for a command this bridge is not waiting on". The queue still lets the next command through at the
  caller's timeout, as before, so a hung plugin does not block the bridge.
- **A reconnect keeps the task.** The task id is the run's id, and #2497's reconnect already kept the run, so a drop
  mid-task resumes the same task with no new code. `tasks/reconnect` proves it against a fake slow plugin.
- **The handshake had to move.** A client offers tasks only to a server that answers `2025-11-25`, and the bridge
  answered every handshake client `2024-11-05` by the engine's rule (#3109). The bridge now has its own list: it echoes
  `2025-11-25` or `2024-11-05` and answers anything else `2025-11-25`, never `2026-07-28`. `HANDSHAKE_PROBES` gains a
  `bridge` answer beside the engine's, both literals; the engine's MCP server is unchanged.
- **The SDK serves the `2025-11-25` task methods but gives them no runtime.** It validates a `tools/call` result as a
  `CallToolResult` and refuses a `CreateTaskResult`, so a task-augmented `figma_run` is answered in front of that check,
  through the SDK's handler map, as the MCP project's own `ext-tasks` receiver does. The pinned version holds it in
  place, and the `tasks/…` arms fail by name if it moves. The `2026-07-28` Tasks extension (SEP-2663) is a separate
  surface; the bridge pins the `2025` era over stdio, so it does not apply here.
- **Ordering trap.** With no plugin a run fails before its task reply is written, so the first draft announced the
  task's status before the reply that names it. The notice now waits one turn; `tasks/order` pins it.
- **Tests.** `apps/plugin/test-agent-bridge.ts`: 303 assertions, all pass (271 before). Mutations, each failing by
  name: the task id differing from the run id → `tasks/status`, `tasks/result`, `tasks/reconnect`, `tasks/failed`;
  a timeout dropping the run → `figma_result/working`, `figma_result/late`; the `tasks` capability removed →
  `tasks/capability`, `arm/0-tasks`, `arm/1-tasks`; the status notice sent at once → `tasks/order`.
- **Arms.** `tasks`, `logging` and `figma_result` are in every arm: they are how the bridge works, not what an agent is
  shown. F0 now lists four tools; `tools/agent-adherence/figma.md` says so. Held for the owner on the PR.
