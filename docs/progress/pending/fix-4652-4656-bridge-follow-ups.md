## (2026-11-28) — Figma bridge follow-ups: method-not-found names the method, tasks follow the session's revision, late results are recorded (#4652, #4656)

The review follow-ups from #4650 and #4654 (#4646 steps 0 and 1), in one fix lane.

- **#4652, the -32601 text.** The SDK answers a method it lacks with a bare `Method not found`; the hand-written
  bridge said `method not found: <method>`, and arms 0 and 1's adherence agent reads that refusal for
  `resources/list` and `resources/read`. `compatAnswer` sees only requests, so the fix sits beside it in
  `bridgeTransport`: it remembers each forwarded request's method by id, and on the way out rewrites a -32601's
  message to name it. Held by `mcp/method-not-found` and `arm/<n>-method-not-found`, with the text as literals.
- **#4652, the README.** "What moved" now lists all four changes. The dropped `resultType`, `_meta` server stamp,
  `ttlMs` and `cacheScope` apply to every connection, not only `2024-11-05` ones as the step-0 entry said: no client
  gets `2026-07-28` from `initialize`. `server/discover` keeps the stamps.
- **#4656 item 3, tasks below `2025-11-25`.** The capabilities already followed the revision; now the rest does. The
  server keeps the revision the connection's last `initialize` answered (set before the SDK's handler yields, so a
  request read right after it sees it). Below `2025-11-25`, `tools/list` drops `execution`, a `figma_run` with `task` is
  served as the plain call with `task` ignored (what MCP has a receiver do for task metadata it declared no support
  for), and `tasks/*` answer -32601. Held by `tasks/revision` and `arm/<n>-tasks`.
- **#4656 item 2, late results.** A plain-call timeout still records `tool-error`, and when the run ends a `late` line
  with the same `seq` records how. A new kind rather than a second `outcome`: `score-figma.ts` keys outcomes by `seq`,
  so a second one would have overwritten what the agent saw. Held by `record/late`.
- **#4656 item 4.** `commands.json`'s bridge entry gains `capabilitiesByRevision.tasks`, read from `TASKS_SINCE`, and
  `resources/tasks-scope` reads it from the served `prism3://commands` against a literal.
- **#4656 item 1, documented, not bounded.** A run whose plugin stays connected and never answers stays `working`
  until a drop past the grace or a restart; the README now says so. A bound would add a new failure message an agent
  reads, which this lane may not write, so the bound, its value and its copy are an owner question on the PR.
