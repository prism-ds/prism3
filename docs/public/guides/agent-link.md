# Use the agent link

<!-- DRAFT for owner review (#2637, lane 4; corrected to the Agent switch, Update file and the desktop bridge for #3264). -->

The agent link lets an AI agent drive the Prism3 plugin you have open in Figma. The agent asks for an action, such as writing the theme or building a component set, and the plugin runs the same write Update file runs, then hands back the same result you would see in Activity. <!-- src: apps/plugin/src/agent-protocol.ts@"export const AGENT_COMMANDS"#6bb39596 --> <!-- src: tools/figma-mcp/README.md@"Sections 1–4 run the".."the result carries the"#26342fd0 -->
Two things differ: an agent's theme write uses the brand settings the agent supplies, and an agent's clean-up preview appears in Activity only.

It is off every time the plugin opens, and only you can turn it on. <!-- src: apps/plugin/src/agent-link.ts@"* OFF BY DEFAULT, NOT".."* someone with that "#e3a1fc8c -->

## How it works

An agent working through Figma's own MCP connection can read and write a file's data, but it can't press the plugin's buttons. The agent link gives it two ways in: <!-- src: apps/plugin/src/agent-link.ts@"*\n * THE MAILBOX. A cloud agent's only Figma access is the hosted MCP's `use_figma`, which runs plugin-API".."*      in `results`,"#e9f3139b -->

- The file's plugin data, as a mailbox. The agent writes a request there, and the plugin, while the link is on, checks for requests about once a second, runs one, and writes the result back beside it. <!-- src: apps/plugin/src/agent-protocol.ts@"pollMs: 1000,"#faf40979 --> <!-- src: apps/plugin/src/agent-link.ts@"*\n * THE MAILBOX. A cloud agent's only Figma access is the hosted MCP's `use_figma`, which runs plugin-API".."*      in `results`,"#e9f3139b -->
- The desktop bridge, a small program on your computer that the agent talks to. While the link is on, the plugin holds a connection to it at `ws://localhost:17331`, on your computer only. The first time, the plugin asks you to pair: **Pair with the desktop bridge**, with a **Pairing code** from the bridge or your agent. A code works once, for 10 minutes. <!-- src: apps/plugin/src/agent-link-ui.ts@"*  prompt's one line".."busy: 'Pairing…'," --> <!-- src: apps/plugin/src/agent-bridge-relay.ts@"export const BRIDGE_PORT".."export const BRIDGE_URL" -->

"Prism3 Studio" carries both. "Prism3 Studio Offline" makes no network calls, so it has the mailbox only. <!-- src: apps/plugin/manifest.json@"\"name\": \"Prism3 Studio".."\"ws://localhost:17331\"\n    ]," --> <!-- src: apps/plugin/manifest-offline.json@"\"name\": \"Prism3 Studio".."\"reasoning\": \"Runs fully" -->

MCP (Model Context Protocol) is the standard way an AI agent connects to a tool such as Figma. You don't need to set anything up in Prism3 for it; the agent's own setup handles the connection to Figma.

## Turn it on

1. Open the file and run the Prism3 plugin.
2. Turn on the **Agent link** switch in the top bar, beside Update file. The library home has the same switch. <!-- src: apps/plugin/src/agent-link-ui.ts@"// The label is a `<".."const { el: chip, set" -->
3. Tell the agent the link is on. It sends a status request first, to confirm the plugin answers.

To turn it off, turn the **Agent link** switch off, or choose **Turn off** on the minimized strip. <!-- src: apps/plugin/src/agent-link-ui.ts@"const turnOff = hook".."turnOff.type = 'button" --> <!-- src: apps/plugin/src/agent-link-ui.ts@"const { el: chip, set" --> Closing the plugin also turns it off. <!-- src: apps/plugin/src/main.ts@"figma.on('close', ()"#13449644 -->

The Activity drawer's bar shows the link's state in a word: "Listening · bridge" or "Listening · mailbox" while it waits, "Listening · mailbox only" in Prism3 Studio Offline, and "Error" or "Not listening" when something is wrong. Point at the word to read the full status. <!-- src: apps/plugin/src/agent-link-ui.ts@"export const agentLinkWord".."if (!s.transports.mailbox" -->

*[Screenshot placeholder: the top bar with the Agent switch on, and the Activity drawer's agent word.]*

## What an agent can do

| Request | What the plugin does |
|---|---|
| `status` | Reports the plugin version, the file and page, whether the file has a saved brand and variables, and the link's state. Writes nothing. <!-- src: apps/plugin/src/agent-protocol.ts@"/** Engine version, ".."status: Record<string" --> |
| `apply-theme` | Writes the theme, as Update file's Theme item does, with the brand settings the agent supplies. See [Write the theme to a Figma file](apply-a-theme.md). <!-- src: apps/plugin/src/agent-protocol.ts@"/** A full `BrandInput".."'apply-theme': { input" --> |
| `build-components` | Builds one component set. See [Build components](build-components.md). <!-- src: apps/plugin/src/agent-protocol.ts@"/** A `componentDefs".."'build-components': " --> |
| `file-setup` | Sets up the file. See [Set up a file](file-setup.md). <!-- src: apps/plugin/src/agent-protocol.ts@"/** The page scaffold".."'file-setup': Record" --> |
| `style-guide` | Draws the style guides, with the same options as Docs. See [Build style guides](style-guides.md). <!-- src: apps/plugin/src/agent-protocol.ts@"/** The color style-".."'style-guide': StyleGuideOptions" --> |
| `prune` | Clean up: a preview first, then a confirm that carries the preview's fingerprint and deletes. The file must hold the brand sent. See [Remove what the brand no longer uses](update-a-file-safely.md#remove-what-the-brand-no-longer-uses). <!-- src: apps/plugin/src/agent-protocol.ts@"/** `confirm: false`".."prune: { input: BrandInput" --> |
| `readback` | Reads the file's color variables back and checks they were written correctly: each mode distinct, every alias resolving, the brand's modes present and scopes set. It also lists every component page. Writes nothing. It does not check contrast. <!-- src: apps/plugin/src/agent-protocol.ts@"/** The boot read-back".."readback: Record<string" --> |
| `update-components` | Updates sets in place: a check first, then a confirm that carries the check's fingerprint. See [Update sets in place](update-a-file-safely.md#update-sets-in-place). <!-- src: apps/plugin/src/agent-protocol.ts@"/** #2265: the in-place".."'update-components':" --> |
| `capture-baseline` | Records how each variant looks now, so a later update can tell your edits apart. Plugin data only. <!-- src: apps/plugin/src/agent-protocol.ts@"/** #2265: record the".."'capture-baseline': " --> |
| `adopt-members` | Claims variants Prism3 did not build, so updates can reach them. Plugin data only. <!-- src: apps/plugin/src/agent-protocol.ts@"/** #2283: the one-time".."'adopt-members': { def" --> |
| `draw-specs` | Draws the spec panel beside each family's usage panel, as **Draw specs** in the Specs tab in Docs does. <!-- src: apps/studio/src/shell/documentation.ts@"specsDraw: 'Draw specs" --> <!-- src: apps/plugin/src/agent-protocol.ts@"/** #2830 phase 2: draw".."'draw-specs': { def?" --> |
| `inspect` | Reads the layers you name and the layers inside them: type, name, page, size, whether locked, the main component and its key for an instance, its properties, the variables it uses and its text style. Writes nothing. <!-- src: apps/plugin/src/agent-protocol.ts@"/** #3147 Phase 2a. Writes nothing. Each".."inspect: { ids: string" --> |
| `component-keys` | Lists the file's component sets and components with their keys, so another file can place them. Writes nothing. <!-- src: apps/plugin/src/agent-protocol.ts@"/** #3147 Phase 2a. Writes nothing. Every".."'component-keys': { " --> |
| `audit-frames` | Checks frames for what a rebuild should have replaced: old components, text with no style, colors bound to no variable, hand-drawn rules and unnamed frames. The agent supplies the old names. Writes nothing. <!-- src: apps/plugin/src/agent-protocol.ts@"/** #3147 Phase 2a, ".."'audit-frames': { ids" --> |
| `snapshot` | Renders one layer as an image, as this session shows it. Writes nothing. <!-- src: apps/plugin/src/agent-protocol.ts@"/** #3147 Phase 2a. Writes nothing. One".."snapshot: { id: string" --> |
| `activity` | Lists what Activity shows for this session, newest first: each run's result, its details, every set built with problems and why, and the plugin build that ran it. Writes nothing. <!-- src: apps/plugin/src/agent-protocol.ts@"/** #3309. Writes nothing".."activity: { since?: " --> |
| `panels-clean` | The usage panels Clean up offers while Docs has panels off: a count, or with a confirm, the delete. A panel edited by hand is never removed. <!-- src: apps/plugin/src/agent-protocol.ts@"/** #3137 Q3137.7 A:".."'panels-clean': { confirm" --> |
| `set-override` | Points color roles at palette steps, or clears their overrides, in Light, Dark or a custom mode: a preview first, then a confirm that carries the preview's fingerprint and writes the theme. It refuses the whole list if any pair would drop below its minimum, and each change shows in Activity under Color override. Nothing else in Theme can be changed this way. <!-- src: apps/plugin/src/agent-protocol.ts@"/** #3394 Q3394.1 A:".."'set-override': { changes" --> |
| `context` | Says what the open file is: its brand and modes, its variable collections, the sets Prism3 built and which are due, and what is read-only: pages whose name contains FINAL, locked layers and `Original · …` copies. Writes nothing. <!-- src: apps/plugin/src/agent-protocol.ts@"/** #3300 B. Writes ".."context: Record<string" --> |

Every write an agent asks for passes the same checks as Update file, and is refused for the same reasons. <!-- src: apps/plugin/src/run-guard.ts@"/**\n * ONE WRITE AT A TIME, FILE-WIDE (#3697 R7, owner decision 2026-11-12; was one run per operation, #1957).".."*/"#802b70d3 -->

A color override's confirm is refused as `changes-moved` when its changes aren't the ones it previewed, and as `brand-moved` when the file's brand changed after the preview. Either way, nothing is written: preview again. <!-- src: apps/plugin/src/set-override.ts@"export const confirmMoved".."echoed === planHash " -->

## Safety

- **Off by default, never saved.** The link starts off at every launch and is not remembered between sessions. <!-- src: apps/plugin/src/agent-link.ts@"* OFF BY DEFAULT, NOT".."* someone with that "#e3a1fc8c -->
- **Only you can turn it on.** An agent can't switch it on: only the panel's **Agent link** switch sends that request. <!-- src: apps/plugin/src/agent-link-ui.ts@"const { el: chip, set" --> The main thread turns the link on only when the panel asks. <!-- src: apps/plugin/src/messages.ts@"/** The owner's AGENT".."\u007c { type: 'agent-link"#3ecd6409 -->
- **While it is off, the plugin ignores the agent entirely.** A request waiting in the file does nothing, and the plugin holds no connection to the bridge. <!-- src: apps/plugin/src/agent-link.ts@"* by the owner, through".."* someone with that "#efefb571 --> <!-- src: apps/plugin/src/agent-link-ui.ts@"// Transport B: while".."// to the main thread"#76ccd888 -->
- **Old requests are not replayed.** A request already waiting when you turn the link on is answered "stale" and not run; the agent has to send it again. <!-- src: apps/plugin/src/agent-link.ts@"/** Answer every unclaimed".."{ code: 'stale', message" -->
- **One request at a time.** The plugin runs requests in the order sent, never two at once, and never while the same write is running from Update file. <!-- src: apps/plugin/src/agent-link.ts@"*\n *   1. reads `inbox` (the agent's queue) and `claimed` (its own record of what it has taken);".."*      link on) never"#10971a60 -->
- **No code from the agent.** In the released plugin, a request names one of the actions above and nothing in it is run as code. A development build, used by maintainers, adds one more request, `run-code`; the release build leaves it out. <!-- src: apps/plugin/src/agent-protocol.ts@"/** #2530: the dev-only".."export type DevCmd =" --> <!-- src: apps/plugin/src/agent-dispatch.ts@"const rc = a && typeof" -->
- **The bridge proves itself.** Before the plugin takes a request from the desktop bridge, the bridge has to prove it holds your pairing. Another program listening on that port can't send one. <!-- src: apps/plugin/src/agent-bridge-relay.ts@"* THE SERVER PROVES ".."* any command is heard, and the retry finds the real bridge once it is back. The prompt and its words are unchanged.\n *"#a87764f6 -->
- **A pairing that fails asks for a new code.** If the bridge doesn't confirm the pairing within a quarter of a second, or the connection closes first, the plugin forgets the code and asks for another. Ask your agent for a new code rather than entering the same one again: another program on that port may have seen it. <!-- src: apps/plugin/src/agent-bridge-relay.ts@"const forgetSentCode".."};"#3bbe1f55 --> <!-- src: apps/plugin/src/agent-bridge-relay.ts@"if (code !== null) {".."deps.schedule(() => { if (ws === sock && codeSent && !connected) drop(sock, true); }, pairedMs);\n        }"#06d260c3 -->
- **Deletes and updates need a confirm.** A clean-up or a component update runs as a preview first, and the agent has to send a separate confirm. Ask it to show you the preview before it confirms. <!-- src: apps/plugin/src/agent-protocol.ts@"'file-setup': Record".."*  `previewHash`; `confirm"#eb54486c -->
- **It writes to the open file.** Whatever the agent asks for lands in the file the plugin is open in. Try a new workflow on a copy first. <!-- src: tools/figma-mcp/README.md@"launch. While it is ".."commands write to that"#6f9a7cff -->

The panel shows each result an agent's request produced, in Activity, as if you had run it. <!-- src: apps/plugin/src/agent-dispatch.ts@"* WHAT A HANDLER REPORTS".."* `status` is the one"#8b93af69 -->

## Other ways an agent works with Prism3

- Without Figma: the Prism3 engine has its own MCP server, which can generate and check a brand's tokens and write them to disk. It does not touch Figma files. <!-- src: packages/engine/mcp.ts@"*\n *  `validate_brand` does NOT re-inline the 52KB brand schema. Two copies made `tools/list` 91,528".."// this annotation to"#a2dae559 --> <!-- src: packages/engine/README.md@"- It doesn't write to"#782d7cd2 -->
- With the plugin closed: a set of scripts runs the plugin's own steps through Figma's MCP connection, for test files. This route is for maintainers and is documented in the repository's `tools/figma-mcp` folder. <!-- src: tools/figma-mcp/README.md@"# tools/figma-mcp — ".."\u007c `apps/plugin/src/mcp" -->

See the [feature reference](features.md) for what each route can do.
