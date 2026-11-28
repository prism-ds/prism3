---
engine: minor
---
The Figma bridge serves the `prism3-rebind` and `prism3-build-ui` skills over MCP, through the Skills extension: a client that supports it lists them with `skills/list` and reads their files at `skill://` URIs, from the same checkout files as the `prism3://skills/` resources, which stay. Only the bridge's default arm serves them. The agent reference lists the served skills.
