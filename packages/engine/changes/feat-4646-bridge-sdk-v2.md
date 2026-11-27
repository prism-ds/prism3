---
engine: minor
---
The Figma bridge runs on the official MCP SDK (`@modelcontextprotocol/server` 2.4.0), so it now needs `npm ci` at the repository root before it starts. Its tools, resources, note and arms are unchanged. Its `initialize` result now declares `logging`, for the console lines it already sent. The agent reference names the SDK pin under the bridge's `requires`.
