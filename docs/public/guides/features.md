# Feature reference

<!-- DRAFT for owner review (#2637, lane 4; corrected to Update file for #3264). Kept in step with the ecosystem diagram's "Compare interfaces" view (#2643); where the two disagree, the code each row cites decides. -->

What each Prism3 surface can do. The [ecosystem diagram](../ecosystem/) shows how the surfaces connect; this page lists what you can do in each.

- Web Studio: Studio in a browser. <!-- src: apps/studio/build-site.mjs@"/**\n * Site build (#104). Produces the directory Vercel publishes.".."* plus the repo's `docs"#b1876ee9 -->
- Figma plugin: the same studio inside Figma <!-- src: apps/plugin/src/ui/entry.ts@"import './component-catalog".."mountAgentLink();"#6258203d -->, plus **Update file**, which writes to the file. <!-- src: apps/studio/src/state/update-file.ts@"button: 'Update file" -->
- Agent, through the agent link: an AI agent driving the open plugin. See [Use the agent link](agent-link.md). <!-- src: apps/plugin/src/agent-protocol.ts@"export const AGENT_COMMANDS"#6bb39596 -->
- Agent, through the Prism3 MCP server: an AI agent using the engine directly, with no Figma file. <!-- src: packages/engine/mcp.ts@"*\n *  `validate_brand` does NOT re-inline the 52KB brand schema. Two copies made `tools/list` 91,528".."// this annotation to"#5ae0ed66 -->

✓ means the surface can do it. – means it can't.

## Brand

| Feature | Web studio | Figma plugin | Agent link | MCP server |
|---|---|---|---|---|
| Start from a color, an example or a `design.md` | ✓ | ✓ | – | ✓ from a `design.md` (`theme_from_brief`) |
| Set levers with a live preview | ✓ | ✓ | – | ✓ list the levers (`list_levers`), no preview |
| Check contrast in every mode | ✓ Inspect › Contrast <!-- src: apps/studio/src/shell/pages.ts@"/** The views behind".."export const INSPECT"#9232e735 --> | ✓ Inspect › Contrast | – | ✓ `theme_brand`, `theme_from_brief` |
| Keep the working brand | ✓ in this browser <!-- src: apps/studio/src/persist-local.ts@"/** Storage key for the working".."return null; // corrupt / version-drifted local cache — same as first-run, no file to warn about\n  }\n};"#8ee27da6 --> | ✓ in the Figma file, when Update file writes the theme <!-- src: apps/plugin/src/persist-figma.ts@"export const NS = 'prism3".."root.setSharedPluginData"#ba150bb3 --> | – | – |
| Import a `design.md` brief | ✓ | ✓ | – | ✓ `theme_from_brief` |
| Export a `design.md` brief | ✓ <!-- src: apps/studio/src/main.ts@"const exportDesignMd" --> | ✓ | – | – |

<!-- src: apps/studio/src/shell/start.ts@"const c1 = card('Start".."const c4 = card('Import" --> <!-- src: packages/engine/mcp.ts@"name: 'list_levers',".."required: ['valid', 'errors'],\n    },\n    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },\n  }," -->

## Figma file

| Feature | Web studio | Figma plugin | Agent link | MCP server |
|---|---|---|---|---|
| [Write the theme](apply-a-theme.md): variables, modes and styles | – | ✓ Update file › Theme | ✓ `apply-theme` | – |
| [Set up file](file-setup.md): pages and helper components | – | ✓ Update file › Set up file | ✓ `file-setup` | – |
| [Add component sets](build-components.md) | – (lists the sets) <!-- src: apps/studio/src/preview/sections/component-sets.ts@"web: 'Building sets "#37b05aef --> | ✓ Components, then Update file › To add | ✓ `build-components` | – |
| [Update sets in place](update-a-file-safely.md#update-sets-in-place) | – | ✓ Update file › Due | ✓ `update-components` | – |
| [Draw style guides](style-guides.md) | – | ✓ Docs, then Update file › Style guides <!-- src: apps/studio/src/shell/pages.ts@"export const DOC_TABS".."] as const;"#aed5e5ff --> | ✓ `style-guide` | – |
| [Remove what the brand no longer uses](update-a-file-safely.md#remove-what-the-brand-no-longer-uses), with a preview | – | ✓ Update file › Clean up | ✓ `prune` | – |
| Draw spec panels | – | ✓ Docs › Specs <!-- src: apps/studio/src/shell/pages.ts@"export const DOC_TABS".."] as const;"#aed5e5ff --> | ✓ `draw-specs` | – |
| Read the file back | – | ✓ when the plugin opens | ✓ `readback`, `status` | – |

<!-- src: apps/studio/src/state/update-file.ts@"tabUpdate: 'Update',".."updateStep: 'Update " --> <!-- src: apps/plugin/src/agent-protocol.ts@"export const AGENT_COMMANDS" -->

## Tokens

| Feature | Web studio | Figma plugin | Agent link | MCP server |
|---|---|---|---|---|
| [Download DTCG token files](export-tokens.md): a base file and one overlay per mode | ✓ <!-- src: apps/studio/src/export-settings.ts@"export const ARTIFACTS".."},"#531be286 --> | ✓ | – | ✓ `export_theme` writes them to a folder |
| Write the token files, the agent metadata and the Figma variable files to a folder | – | – | – | ✓ `export_theme` <!-- src: packages/engine/README.md@"\u007c `export_theme` \u007c Writes" --> |
| Download the shadcn/ui theme and the Tailwind theme (Design tokens › Format) | ✓ <!-- src: apps/studio/src/export-settings.ts@"export const FORMAT_OPTION".."def: 'dtcg',"#91f3ff25 --> | ✓ | – | ✓ `export_theme`, the `shadcn` and `tailwind` sections |
| Score how generated UI used the tokens | – | – | – | ✓ `score_consumption` |

<!-- src: packages/engine/mcp.ts@"name: 'export_theme'".."annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },\n  }," --> <!-- src: packages/engine/mcp.ts@"name: 'score_consumption".."annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },\n  }," -->

TokenPress, a separate Figma plugin, exports any Figma file's variables and styles as DTCG token files. See [Export tokens](export-tokens.md#export-any-figma-file-with-tokenpress). <!-- src: apps/tokenpress/README.md@"A Figma plugin that "#9efac648 -->

## Limits worth knowing

- Writing to Figma needs the plugin open. The MCP server does not touch Figma files. <!-- src: packages/engine/README.md@"- It doesn't write to"#782d7cd2 -->
- The agent link is off at every launch, and only the panel can turn it on. <!-- src: apps/plugin/src/agent-link.ts@"* OFF BY DEFAULT, NOT".."* someone with that "#e3a1fc8c -->
- Exports start from the brand you set, not from the file's variables. To export what a file holds, use TokenPress. <!-- src: apps/studio/src/export-settings.ts@"export type ExportSource".."\u007c 'file-variables';"#64340234 --> <!-- src: apps/studio/src/export-settings.ts@"export const AVAILABLE_SOURCES"#30e8b1e2 -->
