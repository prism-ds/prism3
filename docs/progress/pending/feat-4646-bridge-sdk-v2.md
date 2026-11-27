## (2026-11-27) — The Figma bridge runs on the official MCP SDK, with nothing an agent reads moved (#4646 step 0)

The owner chose A on #4646: `tools/figma-bridge/server.ts` moves onto the official MCP SDK so Tasks, Elicitation and
Skills over MCP can follow, and `packages/engine/mcp.ts` stays hand-written. This is step 0, the move alone.

- **The package.** SDK v2 ships as split packages; `@modelcontextprotocol/server` is v2 of what was
  `@modelcontextprotocol/sdk` (its README says so). Pinned exactly at 2.4.0 (published 2026-10-23) in the root
  `package.json`, beside tsx. It brings `@modelcontextprotocol/core` and `zod`, nothing else.
- **The engine stays install-free.** `lint-ecosystem.ts` and `emit-agent-reference.ts` import the bridge's `TOOLS`, so
  the SDK is loaded by `import()` inside `createMcpServer` and the stdio shell, never at the top of the file. Checked in
  a checkout with no SDK installed: importing `TOOLS` works, and starting the server stops with "Cannot find package"
  before the socket opens.
- **The proof is the unchanged suite.** `apps/plugin/test-agent-bridge.ts` is untouched and runs 271 assertions, all
  pass, the same count as on `main`. Mutations, each failing by name: arm 0 and 1 advertising resources →
  `arm/0-resources`, `arm/1-resources`; `figma_logs` dropped from `tools/list` → `tools/list: figma_status, figma_run,
  figma_logs`; the -32002 answer removed → `resources/resolve`, `resources/renamed`.
- **Where the SDK differs, and what was kept.** The SDK pins one protocol era per connection, refuses an `initialize`
  without `capabilities` or `clientInfo`, and re-codes resource-not-found -32002 as -32602. The suite reads all three
  the old way, so `compatAnswer` answers them in front of the SDK: `server/discover` beside `initialize`, a bare
  `initialize` served with empty capabilities, and -32002. The handshake version still comes from the engine's
  `negotiateHandshakeVersion`, so the #3109 register and probes are unchanged.
- **What moved, on purpose.** `initialize` now declares `logging`: the bridge always sent console lines as
  `notifications/message`, which MCP allows only from a server that declares it, and the SDK refuses to send them
  otherwise. A stdin line that is not JSON is now skipped (the SDK's reader) rather than answered -32700. On a
  `2024-11-05` connection the results no longer carry the 2026-era `resultType`, `ttlMs`, `cacheScope` or the
  `_meta` server stamp, which that revision does not define; `server/discover` still carries them.
- **Running it.** The bridge now needs `npm ci` at the repository root. The README's setup says so, and
  `commands.json`'s bridge entry gains `requires`, read from the root pin.
- **For step 1.** The bridge answers every handshake client at `2024-11-05` (#3109). Tasks are defined from
  `2025-11-25` and elicitation from `2025-06-18`, so step 1 has to change what the bridge negotiates with a client
  that asks for `2025-11-25`, and with it the bridge's line in `HANDSHAKE_PROBES`.
