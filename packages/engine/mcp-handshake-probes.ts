/**
 * The `initialize` probes every MCP server in this repo is driven with over its real stdio, and the
 * register of which servers those are (#1867, #3109).
 *
 * The answers are LITERALS, written down here, not computed by either server's rule (`negotiateHandshakeVersion`
 * in `mcp.ts`, `negotiateBridgeHandshake` in the bridge): a probe whose expectation came from the rule it checks
 * could not fail (`docs/34` shape 1). Each probe carries both servers' answers. `answer` is the engine server's:
 * `2024-11-05`, the one handshake revision it speaks. `bridge` is the Figma bridge's: since #4646 step 1 it also
 * speaks `2025-11-25`, the revision Tasks need, so it echoes that and answers it to anything else. Neither ever
 * answers `2026-07-28`, which removed `initialize`; Claude Code asks for `2025-11-25` and refuses a `2026-07-28`
 * answer (#3109).
 *
 * `MCP_SERVERS` maps each file that answers `initialize` to the stdio suite that drives it with these
 * probes. `mcp-test.ts` scans the tree for every `initialize` handler and fails, by file, on one this
 * register does not name, or on a suite that no longer reads `HANDSHAKE_PROBES`. So a third MCP server
 * cannot ship with its own copy of the fallback and go unprobed, as the bridge did.
 */
export const HANDSHAKE_PROBES: readonly { asked: string; answer: string; bridge: string; why: string }[] = [
  { asked: '2024-11-05', answer: '2024-11-05', bridge: '2024-11-05', why: 'a handshake revision the server speaks is echoed' },
  { asked: '2025-06-18', answer: '2024-11-05', bridge: '2025-11-25', why: 'an in-between revision gets the newest handshake revision the server speaks' },
  { asked: '2025-11-25', answer: '2024-11-05', bridge: '2025-11-25', why: 'what Claude Code asks for' },
  { asked: '2026-07-28', answer: '2024-11-05', bridge: '2025-11-25', why: 'a revision with no handshake is never answered' },
];

/** Repo-relative path of each MCP server → the stdio suite that drives it with `HANDSHAKE_PROBES`. */
export const MCP_SERVERS: Readonly<Record<string, string>> = {
  'packages/engine/mcp.ts': 'packages/engine/mcp-test.ts',
  'tools/figma-bridge/server.ts': 'apps/plugin/test-agent-bridge.ts',
};
