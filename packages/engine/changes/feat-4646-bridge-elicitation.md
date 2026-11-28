---
engine: minor
---
The Figma bridge asks the person, through MCP elicitation, before it sends an `update-components` confirm that overwrites hand edits. The question names each set whose hand edits it replaces, from the check this bridge ran, and a decline writes nothing. Only a session at protocol revision 2025-06-18 or later whose client declares form elicitation is asked; any other client gets the confirm as before. The agent reference describes when the bridge asks.
