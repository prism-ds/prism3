# tools/figma-bridge — drive the running plugin from a local Claude Code session

The agent link's **transport B**. A local MCP server that sends commands to the Prism3 plugin running
in the owner's Figma desktop app, and returns the plugin's result envelopes. It speaks the same
protocol as the file mailbox (`tools/figma-mcp/README.md` §5); use it for large sweeps, where a
round trip through the file for every command is too slow.

The plugin does the writing. This server only carries commands in and results out.

## Set up (once, on the owner's machine)

Install the repository's dependencies once, then register the server with Claude Code as a stdio MCP
server:

```bash
cd /path/to/prism3 && npm ci
claude mcp add prism3-figma -- npx tsx /path/to/prism3/tools/figma-bridge/server.ts
```

Since #4646 the bridge runs on the official MCP SDK, `@modelcontextprotocol/server`, pinned exactly in
the root `package.json`. In a checkout without `npm ci` the server stops at start with a "Cannot find
package" error, before it opens the socket. Run `npm ci` again after a pull that moves the pin.

It listens on `ws://localhost:17331`, bound to loopback only. That is the origin the plugin manifest
lists in `networkAccess.allowedDomains` (since #3147 the relay ships in the network build, "Prism3
Studio"; "Prism3 Studio Offline" has no socket and offers the mailbox only), and Figma refuses any origin
it does not list. `--port` (or
`PRISM3_BRIDGE_PORT`) changes the server's port for tests or a collision, but the plugin still
connects to 17331 unless the manifest entry and `BRIDGE_PORT` in
`apps/plugin/src/agent-bridge-relay.ts` change with it.

**Who may connect: pairing (#3204, the owner's Q3204.1 A).** A connection is not the plugin until it
proves a pairing token. A one-time pairing code is issued only when it is asked for (the owner's
Q3204.5 A): by a `figma_status` call while no plugin is connected, or by starting the server with
`--pair`. The server prints it on stderr, such as `pairing code: 7KQ4-M2XR (live for 10 minutes)`, and
`figma_status` names it (`pairingCode`), since an MCP host may not show stderr. A later `figma_status`
keeps a live code rather than replacing it. The first time the plugin connects on a machine it asks for
that code, and the server answers
with a token the plugin keeps in `figma.clientStorage` (per person, per machine; never in the file or
its plugin data). From then on every connection opens with the server's challenge, and the plugin's
hello carries an HMAC of the token over the challenge's nonce. A connection without a valid proof is
closed (4401) before it is sent any command, and it never replaces a paired plugin that is connected.
A wrong code is closed with 4403; after 5 wrong codes the server retires the code and prints a new one.
A code lasts 10 minutes. After 3 codes are retired, pairing closes until the next request. Once a plugin
has proved its token, no code is live, so a paired machine has none.

**The server proves itself too (#3697 R8, the owner's A).** The plugin draws its own random
`clientNonce` for every connection and sends it with its pair and its hello. The `welcome` carries
`proof: HMAC(token, "prism3-bridge-welcome-v1:" + clientNonce)`, and the `paired` carries
`proof: HMAC(code, "prism3-bridge-paired-v1:" + clientNonce + ":" + token)`. The plugin hears neither
without a proof that verifies, and ignores a `paired` while it has no code pending, so a process holding the
port while this server is down can't drive the open file. A hello or pair without a well-formed
`clientNonce` is refused like a wrong proof. A plugin built before this change sends none, so update the
server and the plugin together.

The token comes from a random secret the server keeps in a user-only file (mode 0600, in a 0700
directory): `$PRISM3_BRIDGE_CONFIG`, else `~/.config/prism3/figma-bridge.json` (`$XDG_CONFIG_HOME`
when set, `%APPDATA%` on Windows), or the path given with `--config`. Pairing survives a restart.
`--rotate` writes a new secret: every paired plugin then asks for a code again.

The other two checks stay as defense in depth. The server binds loopback only, and it refuses with 403,
before the handshake, any upgrade whose `Origin` is not `null` (#3147); a request with no `Origin` is
refused too. That keeps out a page's own script, but not a page's sandboxed iframe, whose origin is
`null` as well: the review of #3204 drove the bridge from one, which is why pairing exists. `run-code`
stays in the dev build only (Q3147.4 A): a release build answers it `unknown-command`.

## Use

1. The owner opens the file, runs the Prism3 plugin (a development import of
   `apps/plugin/manifest.json`, freshly built), and switches **Agent link** on. The first time on a
   machine, the plugin asks for the server's pairing code under the Agent switch: call `figma_status`
   to get one. The Activity drawer
   reads `Listening · bridge` once the plugin has connected. It retries every 2 s, so the server can
   start before or after the plugin. **One plugin holds the bridge at a time** (#3297). With the link on
   in two files, the file that connected last holds it. The server closes the other file's connection with
   4409, and that file reads `Listening · mailbox` until the holder leaves. Its retries back off from 2 s
   to 30 s and send `yield: true`, so they never take the bridge from the holder. A socket that drops and
   comes back within 5 s does not change the word.
2. `figma_status` — `connected: true`, plus the link state the plugin last reported.
3. `figma_run { cmd: "status" }` — confirms the round trip, the engine version and the plugin build.
4. `figma_run { cmd, args, timeoutMs }` for each command. The result is the protocol's result
   envelope, unchanged: `result.verdict` is the panel's own verdict, `result.data` the structured
   facts, `result.logs` the console lines, `progress` the build readings. A command that was not run
   comes back with `error` (`unknown-command`, `bad-version`, `bad-args`, `link-off`,
   `handler-threw`).
5. `figma_logs { since }` — the console and progress lines streamed during runs. Pass the `last` value
   from the previous call to read only new lines. While a `figma_run` is in flight, the same lines
   arrive as `notifications/message`, and progress arrives as `notifications/progress` when the
   request carries a `progressToken`. The plugin's `done` count restarts at every phase (build,
   wire, each reference back-off `retry` pass), so `progress` is a running count across phases
   that only ever increases, as MCP requires. No `total` is sent, since the run's total is not known
   until it ends; `message` carries the phase's own fraction, e.g. `wire 24/48`.

Commands: `status`, `apply-theme {input}`, `build-components {def?}`, `file-setup`,
`style-guide {collections?, types?, tables?}`, `prune {input, confirm}`, `readback`, `update-components`, `capture-baseline`,
`adopt-members`, `draw-specs` — the same as the mailbox, run through the same handlers the panel's buttons reach — and the
four read-only node commands (#3147 Phase 2a), `inspect {ids, depth?, fields?, maxNodes?}`, `component-keys {names?, sets?}`,
`audit-frames {ids, legacy?, nameRule?}` and `snapshot {id, scale?}`, `activity {since?, limit?}` (#3309, the Activity
drawer's runs this session) and `context` (#3300, what the open file is: brand, sets, and what is read-only), which write nothing and answer in `result.data`
(the full shapes: `docs/public/reference/commands.json`). `prune` with `confirm: true` deletes; send `confirm: false` first and report
the preview. `status` lists every command the running build answers.

**Run `file-setup` again after `apply-theme`** (#3467, Q6 A). Setup draws the Cover only from the brand the file
holds, and `apply-theme` does not draw it, so on a fresh file the order `file-setup` → `apply-theme` leaves the Cover
empty. A second `file-setup` adds nothing else that is already there and draws the cover, as Update file's last
`cover` step does.

**A dev build of the plugin also answers `run-code {code, timeoutMs?}`** (#2530): `code` runs in the plugin's main
thread as the body of an async function, so it may `await` and `return`, and reaches `figma` as a global.
`result.data.value` is the returned value as JSON, `result.logs` the console lines printed while it ran; a syntax
error, a throw or a timeout (30 s by default, `timeoutMs` up to 600000) comes back as `error.code: 'handler-threw'`.
**A timeout stops the waiting, not the code:** the run may still be going, and a write it makes afterwards can still
land, so read the file again before relying on its state. This server needs no change for it: `figma_run` passes any
`cmd` through. A release build answers it `unknown-command`.

One command runs at a time. `figma_run` fails as a tool error (`isError`) only when no result can
come back: no plugin connected, a timeout (default 600 s), or the plugin not coming back after a
mid-run disconnect. A result whose `ok` is false is the action's own verdict and arrives as a normal
result.

## Long runs: tasks and `figma_result` (#4646)

Apply Theme, or a full `build-components` or `update-components` on a large file, can take longer than
any call should wait. Two things keep the result:

- **`figma_run` as a task.** The bridge declares the MCP `tasks` capability (`2025-11-25`), and
  `figma_run` has `execution.taskSupport: "optional"`. A client that sends `task` with the call gets
  a task back at once. The task id is the run's id, the same id the plugin's command and result
  carry. `tasks/get` reports `working`, with the last progress reading (`build 24/48`) as
  `statusMessage`. The call's `progressToken` keeps getting `notifications/progress` while the task
  runs, and `notifications/tasks/status` goes out when it ends. `tasks/result` waits for the run and
  returns what the plain call would have: the plugin's result envelope, tied to the task. A task
  `failed` only when the bridge gave up on the run (no plugin, or a drop it did not come back from),
  and `statusMessage` says why. `tasks/list` lists them. There is no `tasks/cancel`: the plugin
  cannot stop a command once it has it.
- **A timeout keeps the run.** A plain call still waits `timeoutMs`. When that runs out, the error
  names the run's id (`runId`), and the command goes on in the plugin. Don't send it again:
  `figma_result {id}` returns the result envelope once it lands, or the run's status and last
  progress while it is still running. A result that lands late is kept as the run's result. The
  bridge keeps the last 200 runs that ended, and every run still working.
- **A hung run has no bound** (#4656). A run ends only when the plugin answers or the bridge gives up on
  it, and the bridge gives up only when the plugin drops and does not come back within `--grace-ms`. So
  a plugin that stays connected but never answers leaves its run `working`: `figma_status` lists it
  under `running`, `figma_result` and `tasks/get` say `working`, and the run is never dropped from the
  200 kept. It clears when the plugin's socket drops past the grace, or when the bridge restarts. It
  does not block later commands: the queue moves on after the call's `timeoutMs`.

A reconnect mid-run (#2497, `awaitingReconnect`) keeps the same run, so a task goes on being the same
task, and `figma_result` reads the result the plugin re-sends.

To offer tasks, a client has to be told the server speaks `2025-11-25`. So since #4646 step 1 the
bridge answers with the revision the client asked for whenever the MCP SDK speaks it (`2025-11-25`,
`2025-06-18`, `2025-03-26`, `2024-11-05`, `2024-10-07`), so an older client keeps its own, and answers
anything else with `2025-11-25`. It never answers `2026-07-28`, which Claude Code refuses (#3109).
Only a `2025-11-25` session is offered `tasks`; every session gets `tools` and `logging`, and arm 2
`resources`. The rest of the surface follows the session's revision too (#4656): below `2025-11-25`,
`tools/list` gives `figma_run` no `execution` field, a `figma_run` sent with `task` is served as a plain
call with the `task` ignored, and `tasks/get`, `tasks/list` and `tasks/result` answer -32601. The
session's revision is the one the connection's last `initialize` answered. The engine's MCP server still answers `2024-11-05`; `packages/engine/mcp-handshake-probes.ts`
holds both servers' answers as literals, and the suite's `handshake/<version>` arms hold what each
revision is offered.

**A reconnect mid-run does not lose the result** (#2497). A long command (a large `update-components`
apply runs for minutes) can outlive the plugin's socket. The server keeps the call waiting for up to
`--grace-ms` (default 120000, or `PRISM3_BRIDGE_GRACE_MS`) for the plugin to reconnect; `figma_status`
lists the waiting ids under `awaitingReconnect`. On reconnect the plugin names the commands it holds
and re-sends its last results by command id. The server answers the call with the first copy and
logs any repeat as ignored. It never sends a command twice, so nothing runs twice. A command the
reconnected plugin does not hold (it never arrived, or the plugin was reloaded) fails at once with
that reason. Progress and log lines streamed while the socket was down are not replayed. After a bridge restart, each
result the plugin still keeps logs "a result for a command this bridge is not waiting on"; that is
harmless.

## What an agent reads on connecting (#3300)

A fresh agent with no checkout arrives knowing the rules that matter in a Figma file, and where to read
more:

- **A short note**, the owner's text (Q3300.1 A), from one constant, `BRIDGE_INSTRUCTIONS` in
  `server.ts`. It is sent as `instructions` in the `initialize` and `server/discover` results, and again
  as `readFirst` in every `figma_status` result. Until #4646 the bridge answered Claude Code at
  `2024-11-05` (#3109), and a host may still not show the field. `figma_status` says "Call
  first", so the note arrives either way. It stays under 1,200 characters, because hosts truncate long
  instructions.
- **Five static resources** (`resources/list`, `resources/read`; Q3300.3 A). Each is a file from the
  checkout the server runs in, read once at start and stamped with `ENGINE_VERSION`:

  | URI | File |
  |---|---|
  | `prism3://skills/prism3-rebind` | `skills/prism3-rebind/SKILL.md` |
  | `prism3://skills/prism3-build-ui` | `skills/prism3-build-ui/SKILL.md` |
  | `prism3://commands` | `docs/public/reference/commands.json` |
  | `prism3://figma-conventions` | `docs/public/reference/figma-conventions.json` |
  | `prism3://llms.txt` | `docs/public/llms.txt` |

  `prism3://skills/prism3-build-ui` was `prism3://skills/prism3-consume` until #3412. A read of the old URI fails with resource-not-found, and the error names the new one.

  Each file is under `skills/` or `docs/public/`, so it is text that is already public. Nothing is read
  live from the Figma file as a resource.

- **Two skills over MCP** (#4646 step 2): `prism3-rebind` and `prism3-build-ui`, served through the MCP
  Skills extension (`io.modelcontextprotocol/skills`, SEP-2640) from the same checkout files as their
  `prism3://skills/…` resources. A client that speaks the extension finds them with `skills/list`, gets
  one with `skills/get` (its frontmatter and the list of its files, each with a digest), and reads each
  file at `skill://<name>/<path>`, for example `skill://prism3-rebind/consistency-audit.js`. They load
  when the agent needs them. The bridge reads them from the checkout once, when it starts, so an edit
  to a skill shows after a restart. A skill file it does not serve fails with -32002, as an unknown
  `prism3://` URI does. The skill files are not listed in
  `resources/list`, which stays the five resources above, and an older client keeps reading the
  `prism3://` URIs. `prism3-build-screens` joins once its skill is on `main` (#4632).

The bridge points at the engine MCP server (`prism3-engine`) rather than proxying its tools (Q3300.4 A).

## The adherence test's arms (#3440)

`PRISM3_BRIDGE_ARM` picks what a fresh agent is shown, for the agent-adherence test (`tools/agent-adherence/figma.md`):

- `0`: the four tools only. There are no `instructions`, no `readFirst` and no resources, and `figma_run context` is
  refused at the bridge with `unknown-command`. `context` is also left out of the command lists.
- `1`: arm 0 plus the note.
- `2`, the default: the bridge as described above.

Every arm declares `tasks` and `logging` and lists `figma_result` (#4646 step 1): they are how the bridge works, not
what an agent is shown. The skills (#4646 step 2) are what an agent is shown, so only arm 2 serves them, like the
resources. A value other than these three stops the server from starting. `--record <file>` appends one `attempt` line per
`figma_run` call before it runs, and one `outcome` line after it ends, refused calls included. A plain
call that times out ends `tool-error`, but its run goes on, so when that run ends a `late` line with the same
`seq` records how (`ok`, `not-ok` or `tool-error`; #4656). It is its own kind, so the `outcome` line stays the
one the agent saw.
`apps/plugin/test-agent-bridge.ts` (`arm/…`, `record/…`) checks both. Its sentinels are written in the test, not read
from `BRIDGE_INSTRUCTIONS`.

## How it is built

- `server.ts` — the MCP server on the official SDK (#4646; `createMcpServer`), and an RFC 6455
  WebSocket server on `node:http` + `node:crypto`, with no `ws` package. The socket binds loopback only
  (127.0.0.1, and ::1 where available). The engine's MCP server (`packages/engine/mcp.ts`) stays
  hand-written; the bridge is the one exception to `docs/08` §7's "no MCP SDK", because Tasks,
  Elicitation and Skills need server-to-client requests and per-run state. The SDK is loaded only when
  the server runs, so the engine gates that import the bridge's `TOOLS` need no install.
  Its `initialize` rule is its own since #4646 step 1, `negotiateBridgeHandshake`: the client's revision
  when the SDK speaks it, else `2025-11-25`; never `2026-07-28`, which Claude Code refuses (#3109).
  `compatAnswer` keeps three answers the SDK would give differently, so nothing a client read moved
  with the SDK: `server/discover` is answered beside `initialize` on one connection, an `initialize`
  without `capabilities` or `clientInfo` is served rather than refused, and an unknown resource fails
  with -32002, not the SDK's -32602. `bridgeTransport` also puts the method's name back in a -32601
  error, `method not found: <method>`, where the SDK says only `Method not found` (#4652). What did
  move with the SDK, on every connection:
  - `initialize` declares `logging`, since the bridge sends console lines as `notifications/message`.
  - A stdin line that is not JSON is skipped rather than answered -32700.
  - Results no longer carry `resultType: 'complete'` or the `_meta` server stamp, and `tools/list` no
    longer carries `ttlMs` or `cacheScope`. Those are `2026-07-28` fields, and no client gets that
    revision from `initialize`, so this holds for every client. `server/discover`, which `compatAnswer`
    answers itself, keeps both stamps.
- `apps/plugin/src/agent-bridge-relay.ts` — the plugin side. It runs in the UI iframe, since the main
  thread has no network, and relays commands to the main thread's dispatcher.
- `apps/plugin/test-agent-bridge.ts` — the gate, an arm of the plugin's `test` step. It spawns this
  server, speaks MCP to it over stdio (including the shared `initialize` probes in
  `packages/engine/mcp-handshake-probes.ts`), drives its socket with a hand-rolled client (fragmented,
  64-bit-length, ping, unmasked and disconnect cases), then connects the real relay to the real
  `main.ts` and proves a `figma_run` reaches the panel's own handler. Its pairing arms run the server
  on a secret the test writes itself, so the token is derived there independently, and include the
  review's reproduction: a web page in Chromium whose sandboxed iframe opens the socket, refused.

**Not yet verified live:** that Figma's desktop app lets the plugin's iframe open
`ws://localhost:17331` from `allowedDomains`, in a development import and in the org-private
published build (the owner's Phase 1 live checks on #3147). Confirm this on the first run: switch the link on
with the server running, then check that `figma_status` reports `connected: true`.
