---
engine: minor
---
The Figma bridge serves the `prism3-rebind`, `prism3-build-ui` and new `prism3-bridge` skills over MCP, through the Skills extension: a client that supports it lists them with `skills/list` and reads their files at `skill://` URIs, from the same checkout files as the `prism3://skills/` resources, which stay. Only the bridge's default arm serves them. The agent reference lists the served skills.
