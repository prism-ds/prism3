/**
 * figma-bridge — the agent link's TRANSPORT B: a local MCP server that drives the RUNNING Prism3 plugin in
 * the owner's Figma desktop app over a localhost WebSocket. For large sweeping tests from a Claude Code
 * session on the owner's machine; the file mailbox (`tools/figma-mcp/agent-link.ts`) is for small tests
 * from a cloud session. Both speak ONE protocol — `apps/plugin/src/agent-protocol.ts` — and this server
 * adds nothing to it: it builds the command envelope, hands it to the plugin, and returns the plugin's
 * result envelope unchanged.
 *
 *   npx tsx tools/figma-bridge/server.ts [--port 17331] [--grace-ms 120000] [--config <file>] [--rotate] [--pair] [--record <file>]   (or PRISM3_BRIDGE_PORT, PRISM3_BRIDGE_GRACE_MS, PRISM3_BRIDGE_CONFIG)
 *   PRISM3_BRIDGE_ARM=0|1|2 picks what a fresh agent is shown, for the adherence test (#3440; unset is 2, today's bridge).
 *
 * TWO SIDES, ONE PROCESS:
 *   · stdio MCP on the official SDK (`@modelcontextprotocol/server`, #4646; the engine's handshake rule and protocol
 *     constants are imported from `packages/engine/mcp.ts`) with four tools — `figma_status`,
 *     `figma_run {cmd, args, timeoutMs}` (a plain call, or a task when the client asks for one, #4646 step 1; an
 *     `update-components` confirm that overwrites hand edits asks the person first, by elicitation, #4646 step 3),
 *     `figma_logs {since, limit}` and `figma_result {id}`;
 *   · a WebSocket server on 127.0.0.1 (RFC 6455, hand-rolled on `node:http` + `node:crypto` — no `ws`
 *     package). The plugin's UI iframe connects to it while the owner has the agent link switched on, and
 *     relays each command to the main thread's dispatcher (`apps/plugin/src/agent-bridge-relay.ts`).
 *
 * The plugin connects to the DEFAULT port only: the manifest names `ws://localhost:17331` in
 * `allowedDomains` (the network build, "Prism3 Studio", since #3147), and Figma refuses any origin it does not list. `--port` exists for the test suite
 * and for a collision; using another port with the real plugin needs that manifest entry changed too.
 *
 * WIRE between this server and the plugin (JSON text frames):
 *   server → plugin   { type: 'command', command: AgentCommand }
 *   server → plugin   { type: 'challenge', v: 1, nonce } (first, on every connection) · { type: 'paired', token, proof } · { type: 'welcome', proof }
 *   plugin → server   { type: 'pair', proof, clientNonce } · { type: 'hello', state, held?, proof, clientNonce } · { type: 'state', state } · { type: 'result', result }
 *                     { type: 'progress', id, progress } · { type: 'log', id, line }
 *
 * PAIRING (#3204, the owner's Q3204.1 A; the flow and the hash: `apps/plugin/src/bridge-auth.ts`). A connection is not
 * the plugin until it proves the pairing token against the challenge's nonce. Until then it is sent no command, and it
 * replaces no one; a connection that sends anything else first, or a wrong proof, is closed. The token is derived from a
 * random secret kept in a user-only file (mode 0600, `bridgeConfigPath`), so pairing survives restarts; `--rotate`
 * makes a new secret, and every paired plugin then asks for a code again. A one-time pairing code is issued only on
 * demand, from a `figma_status` call while no plugin is connected or a `--pair` start, and lives 10 minutes (Q3204.5 A,
 * `createPairing`). It is printed on stderr and `figma_status` names it, since an MCP host may not show stderr. The
 * plugin asks for it the first time it connects on a machine and keeps the token it is given in `figma.clientStorage`.
 *
 * THE SERVER PROVES ITSELF TOO (#3697 R8, the owner's A). The plugin sends its own `clientNonce` with its pair and its
 * hello; the `paired` answer carries an HMAC of it keyed by the code just spent, and the `welcome` one keyed by the token
 * (`welcomeProof`, `pairedProof` in `bridge-auth.ts`, computed here with `node:crypto`). The plugin hears neither without
 * a proof that verifies, so a process squatting on the port cannot drive the open file. A hello or pair without a
 * well-formed `clientNonce` is refused like a wrong proof: the plugin that sends it would refuse the answer anyway.
 *
 * One plugin connection at a time (a newer PAIRED one replaces the older), one command in flight at a time.
 *
 * ONE BRIDGE, TWO FILES (#3297). The replaced connection is closed with `CLOSE.held` (4409), not 1000, so its relay knows
 * another paired instance holds the bridge. That relay's later hellos carry `yield: true`: a yielding hello with a valid
 * proof is refused with `CLOSE.held` while a plugin is attached, and attaches as usual once none is. Without it, two
 * files with the link on evicted each other on every retry. A hello without `yield` (the holder's own reconnect, #2497)
 * still replaces. The proof is checked the same either way: pairing is unchanged.
 *
 * A RECONNECT KEEPS A COMMAND IN FLIGHT (#2497). The plugin's socket can drop while a long command runs (a
 * ~6-minute update-components did). The waiting call is not failed: it waits `graceMs` for the plugin to come
 * back. The relay's `hello` names the ids it `held` (running, or a result kept for re-sending) and then re-sends
 * its kept results; a result is matched by id, resolves the call once, and a repeat is logged and ignored. A
 * command is never sent twice. One the new connection does not hold (it never reached the plugin, or the
 * plugin reloaded) fails at the hello with the reason, and one whose plugin does not come back fails at the
 * end of the grace. The wire gains only the optional `held`; the command and result envelopes are
 * unchanged, so `AGENT_PROTOCOL_VERSION` stays 1.
 * Bound to the loopback addresses only — 127.0.0.1, and ::1 where the host has it, because `localhost`
 * resolves to either depending on the machine. An upgrade whose `Origin` is not `null` is refused with 403 (#3147). That
 * keeps out an ordinary web page's own script, but not a page's sandboxed iframe, whose origin is `null` too (the review
 * of #3204 showed one connecting): the pairing proof above is what tells the plugin apart. The bind and the origin check
 * stay as defense in depth. stdout is the MCP channel; everything human-readable goes to stderr.
 */
import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { appendFileSync, chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { LATEST_PROTOCOL_VERSION, META } from '../../packages/engine/mcp';
import { AGENT_PROTOCOL_VERSION, AGENT_COMMANDS } from '../../apps/plugin/src/agent-protocol';
import { BRIDGE_PORT } from '../../apps/plugin/src/agent-bridge-relay';
import { CLIENT_NONCE_RE, CODE_ALPHABET, CODE_LENGTH, CLOSE, HELLO_LABEL, PAIR_LABEL, PAIRED_LABEL, TOKEN_LABEL, WELCOME_LABEL, formatCode } from '../../apps/plugin/src/bridge-auth';
import type { AgentCommand, AgentResult, AgentLinkState, AgentProgress } from '../../apps/plugin/src/agent-protocol';
// Types only, erased at run time: the SDK itself is loaded by `import()` where the MCP server is made (#4646).
import type { JSONRPCMessage, Server, Transport } from '@modelcontextprotocol/server';
import { ENGINE_VERSION } from '@prism3/engine/version';
import { isEntry } from '../../packages/engine/entry-point';

/** The plugin connects here — read from the relay, which the manifest's `allowedDomains` entry matches (#3147). */
export const DEFAULT_PORT = BRIDGE_PORT;
export const SERVER_INFO = { name: 'prism3-figma-bridge', version: ENGINE_VERSION };

/* ── what an agent reads on connecting (#3300) ──────────────────────────────────────────────────────── */

/**
 * The note a fresh agent reads before its first command: the rules that matter in a Figma file and where to read more.
 * The owner's text, approved verbatim (Q3300.1 A); change it only with the owner. Sent from this one constant in three
 * places — the `initialize` and `server/discover` results (`instructions`) and `figma_status`'s `readFirst` — because
 * the bridge answered Claude Code at `2024-11-05` until #4646 step 1 (#3109), a version older than the `instructions`
 * field, and a host may still not show it. `figma_status` says "Call first", so the text arrives either way.
 *
 * Product-agent channel, not the payload channel (docs/voice-standard.md §4): no RFC 2119 words. Kept short because
 * hosts truncate long server instructions; `test-agent-bridge.ts` caps it at 1,200 characters (`instructions/length`).
 * It does not say "don't reset overrides" on purpose: the rebind skill §4 tells the agent to reset them after a swap,
 * and only the bridge's own commands never do.
 */
export const BRIDGE_INSTRUCTIONS = [
  'Prism3 bridge. Each command runs in the Prism3 plugin, in the Figma file the owner has open. In that file:',
  '- Never detach a Prism3 instance. Detach only a legacy instance you are replacing.',
  '- Keep hand edits: change only the layers and fields the task names.',
  '- Pages whose name contains FINAL, locked layers and `Original · …` copies are read-only.',
  "- On a library instance, change component properties only: no fills, padding, radius or size. Spacing goes on the parent's auto layout, bound to a `space.*` variable.",
  "- Bind semantic roles by exact name (`color.*`, `space.*`), never `core.*` primitives. Read a role's `avoid_when` before you use it.",
  '- Save a named version before a write. Never delete a page.',
  'Start with figma_status, then figma_run `context`. Full rules: prism3://skills/prism3-rebind and prism3://skills/prism3-build-ui. Each command, with what it writes and refuses: prism3://commands.',
].join('\n');

/**
 * The five static resources (Q3300.3 A): files from the checkout this server runs in, read once at start and stamped
 * with `ENGINE_VERSION`, so "build time" is the checkout's commit. Each `path` is under `skills/` or `docs/public/`,
 * text that is already public (`resources/public-only`, §6 of the proposal); nothing is read live from the Figma file
 * (the file's own context is the `context` command's, Q3300.2 A). Paths are relative to the repository root.
 */
export const RESOURCES = [
  { uri: 'prism3://skills/prism3-rebind', path: 'skills/prism3-rebind/SKILL.md', mimeType: 'text/markdown', name: 'prism3-rebind skill', description: 'How to move a Figma file onto Prism3 without detaching: the mapping pass, the traps, the audit.' },
  { uri: 'prism3://skills/prism3-build-ui', path: 'skills/prism3-build-ui/SKILL.md', mimeType: 'text/markdown', name: 'prism3-build-ui skill', description: "How to bind Prism3's semantic roles by name, honor `avoid_when` and check contrast." },
  { uri: 'prism3://commands', path: 'docs/public/reference/commands.json', mimeType: 'application/json', name: 'commands.json', description: 'Every agent-link command with its args, what it writes and what it refuses, and every MCP tool.' },
  { uri: 'prism3://figma-conventions', path: 'docs/public/reference/figma-conventions.json', mimeType: 'application/json', name: 'figma-conventions.json', description: 'How a Prism3 Figma file is laid out and named: pages, sets, the `_` prefix, slots, variables.' },
  { uri: 'prism3://llms.txt', path: 'docs/public/llms.txt', mimeType: 'text/plain', name: 'llms.txt', description: 'The index of the public Prism3 docs.' },
] as const;

/** URIs this bridge once served under another name (#3412). A read of one still fails with resource-not-found, but
 *  the error names the new URI, so an agent holding an old note can find the file. */
export const RENAMED_RESOURCES: Record<string, string> = { 'prism3://skills/prism3-consume': 'prism3://skills/prism3-build-ui' };

/** MCP's resource-not-found error code. */
export const RESOURCE_NOT_FOUND = -32002;

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
type Loaded = { text: string } | { error: string };
let loadedResources: Map<string, Loaded> | null = null;
/** Read every resource once (the first call, made at start) and keep it; a file that cannot be read is kept as its error,
 *  so `resources/read` names it rather than the server failing to start. */
export const loadResources = (root = REPO_ROOT): Map<string, Loaded> => {
  if (loadedResources) return loadedResources;
  loadedResources = new Map(RESOURCES.map((r) => {
    try { return [r.uri, { text: readFileSync(join(root, r.path), 'utf8') }] as const; }
    catch (e) { return [r.uri, { error: `cannot read ${r.path} — ${(e as Error).message}` }] as const; }
  }));
  return loadedResources;
};

/**
 * THE BRIDGE'S HANDSHAKE (#4646 step 1, and the owner's note on #4646 of 2026-11-27). Until then it answered by the
 * engine server's rule, `2024-11-05` to every handshake client (#3109). Tasks and Elicitation are newer-revision features
 * a client uses only with a server that answers its revision, so the bridge now answers with the revision the client
 * asked for whenever the SDK speaks it (this list, which is the SDK's handshake list), so an older client keeps
 * `2024-11-05`, and answers anything else with the newest, `2025-11-25`. It never answers `2026-07-28`, the revision with
 * no `initialize`, which Claude Code refuses (#3109). The engine's `mcp.ts` keeps answering `2024-11-05`:
 * `HANDSHAKE_PROBES` holds both servers' answers as literals, and the bridge suite's `handshake/<version>` arms hold the
 * capabilities each revision gets.
 */
export const BRIDGE_HANDSHAKE_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05', '2024-10-07'] as const;
/** Every revision the bridge names: the 2026 one for `server/discover`, then the handshake ones. */
export const BRIDGE_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION, ...BRIDGE_HANDSHAKE_VERSIONS] as const;
/** The revision the bridge answers an `initialize` with. */
export const negotiateBridgeHandshake = (want: unknown): string =>
  typeof want === 'string' && (BRIDGE_HANDSHAKE_VERSIONS as readonly string[]).includes(want) ? want : BRIDGE_HANDSHAKE_VERSIONS[0];
/** The first revision that defines Tasks (`2025-11-25`): only a session at it or later is offered them. */
export const TASKS_SINCE = '2025-11-25';

/**
 * ELICITATION (#4646 step 3). The bridge asks the person through the client before a write that discards their work.
 * Elicitation is a CLIENT capability: the server declares nothing for it, so `capabilitiesFor` is unchanged and an
 * `initialize` answer looks the same with or without it. The bridge asks only a session that negotiated
 * `ELICITATION_SINCE` or later AND whose client declared form elicitation (`elicitation: {}`, the `2025-06-18` form, or
 * `elicitation: { form: {} }`). Any other session gets today's behavior: the preview, then a confirm that echoes its
 * `previewHash`. Every arm asks, like tasks (the owner's Q1 A on #4654): it is how a write is gated, not what an agent is
 * shown.
 */
export const ELICITATION_SINCE = '2025-06-18';
/** Whether a session is asked: its negotiated revision and the client's declared capabilities. Pure. */
export const elicitsFor = (revision: string | undefined, client: unknown): boolean => {
  if (revision === undefined || revision < ELICITATION_SINCE) return false;
  const e = (client as { elicitation?: unknown } | undefined)?.elicitation;
  if (e === null || typeof e !== 'object' || Array.isArray(e)) return false;
  return Object.keys(e).length === 0 || (e as { form?: unknown }).form !== undefined;
};
/** How long the bridge waits for the person's answer before it writes nothing. */
export const ELICIT_TIMEOUT_MS = 10 * 60_000;

/** The first use (#4646 step 3): an `update-components` confirm that overwrites hand edits, for every set or for one. */
export const overwritesHandEdits = (cmd: unknown, args: unknown): boolean => {
  if (cmd !== 'update-components' || args === null || typeof args !== 'object') return false;
  const a = args as { confirm?: unknown; choices?: { handEdits?: unknown; sets?: Record<string, { handEdits?: unknown } | undefined> } };
  if (a.confirm !== true || !a.choices || typeof a.choices !== 'object') return false;
  return a.choices.handEdits === 'overwrite' || Object.values(a.choices.sets ?? {}).some((s) => s?.handEdits === 'overwrite');
};
/**
 * The sets whose hand edits the confirm overwrites, with how many members each has hand-edited, read from its check's
 * result envelope (`update.sets[].counts.handEdited`), each set's choice resolved as the plugin resolves it (its own
 * `sets[name]` choice, else the run's). Null when there is no check to read: it ran before this bridge started, or on
 * another one.
 */
export const handEditsOverwritten = (check: AgentResult | null, args: unknown): { set: string; handEdited: number }[] | null => {
  const update = (check?.result as { data?: { update?: { sets?: unknown } } } | undefined)?.data?.update;
  if (!update || !Array.isArray(update.sets)) return null;
  const c = (args as { choices?: { handEdits?: unknown; sets?: Record<string, { handEdits?: unknown } | undefined> } }).choices ?? {};
  return (update.sets as { set?: unknown; counts?: { handEdited?: unknown } }[])
    .filter((s) => typeof s.set === 'string' && typeof s.counts?.handEdited === 'number' && s.counts.handEdited > 0)
    .filter((s) => (c.sets?.[s.set as string]?.handEdits ?? c.handEdits) === 'overwrite')
    .map((s) => ({ set: s.set as string, handEdited: s.counts!.handEdited as number }));
};
/** STRINGS FOR OWNER APPROVAL (#4646 step 3): the question, and figma_run's answer when nothing was sent. */
export const overwriteQuestion = (sets: { set: string; handEdited: number }[] | null): string => [
  'Overwrite hand edits in this Figma file?',
  sets === null
    ? "update-components will replace the hand edits its check found with the plan. That check didn't run through this bridge, so it can't list them here."
    : `update-components will replace hand edits with the plan in ${sets.length === 1 ? '1 set' : `${sets.length} sets`}: ${sets.map((s) => `${s.set} (${s.handEdited} ${s.handEdited === 1 ? 'member' : 'members'})`).join(', ')}.`,
  'The plugin saves a named version first. Decline, and nothing is written.',
].join('\n');
export const overwriteRefusal = (why: 'decline' | 'cancel' | 'error', detail?: string): string =>
  why === 'error'
    ? `The person couldn't be asked (${detail}), so update-components wasn't sent and nothing was written.`
    : `The person ${why === 'decline' ? 'declined' : 'dismissed the question'}, so update-components wasn't sent and nothing was written. Don't send it again unless they ask.`;

/**
 * SKILLS OVER MCP (#4646 step 2). The skills the bridge serves as MCP skills (`skills/list`, `skills/get`, and each file
 * at `skill://<name>/<path>`), from the same checkout files as the `prism3://skills/…` resources, read once at start.
 * `prism3-bridge` (Q3 A, 2026-11-28) is `BRIDGE_INSTRUCTIONS` verbatim plus figma_run's long-run line, as a skill only:
 * `instructions` and `readFirst` stay as they are, and it is not a resource.
 * Arm 2 only, like the resources. They are not listed in `resources/list`, which stays the five approved resources
 * (Q3300.3 A): a client that speaks the extension finds them through `skills/list`, and an older client keeps reading
 * `prism3://skills/…`. `prism3-build-screens` joins once its skill is on `main` (#4632).
 */
export const BRIDGE_SKILLS = ['prism3-rebind', 'prism3-build-ui', 'prism3-bridge'] as const;
/** The URI prefix every served skill file sits under (the SDK's default). */
export const SKILL_BASE = 'skill://';
type SkillFolder = { name: string; files: Record<string, string> } | { name: string; error: string };
/** Every file in each served skill's folder, by path under the folder; a folder that cannot be read is kept as its error. */
export const loadSkillFiles = (root = REPO_ROOT): SkillFolder[] => BRIDGE_SKILLS.map((name) => {
  const dir = join(root, 'skills', name);
  try {
    const files: Record<string, string> = {};
    for (const rel of (readdirSync(dir, { recursive: true }) as string[]).map((r) => r.split('\\').join('/')).sort()) {
      const abs = join(dir, rel);
      if (statSync(abs).isFile()) files[rel] = readFileSync(abs, 'utf8');
    }
    if (!files['SKILL.md']) return { name, error: `skills/${name} has no SKILL.md` };
    return { name, files };
  } catch (e) { return { name, error: `cannot read skills/${name} — ${(e as Error).message}` }; }
});

/** Server capabilities. `logging` is declared because the bridge streams the plugin's console lines as
 *  `notifications/message`, which MCP allows only from a server that declares it; the SDK refuses to send them otherwise
 *  (#4646). `tasks` (#4646 step 1): `figma_run` can run as a task, and `tasks/list` lists them. No `cancel`: the plugin
 *  cannot stop a command once it has it. `tasks` goes only to a session at `TASKS_SINCE` or later (`capabilitiesFor`). */
export const CAPABILITIES = {
  tools: { listChanged: false }, resources: { listChanged: false }, logging: {},
  tasks: { list: {}, requests: { tools: { call: {} } } },
  // #4646 step 2: Skills over MCP (SEP-2640). The SDK declares it when the skills are attached; `createMcpServer` checks
  // that what it declared is this, since `initialize` answers with this object.
  extensions: { 'io.modelcontextprotocol/skills': {} },
};
/** What a session is offered, by arm and revision: below arm 2 there are no resources and no skills (#3440), and below
 *  `TASKS_SINCE` no tasks. `server/discover` asks with no revision and gets no tasks: on `2026-07-28` Tasks are an
 *  extension (SEP-2663), a different surface the bridge does not serve. Skills are a custom-method extension, served at
 *  any revision. */
export const capabilitiesFor = (arm: BridgeArm, revision?: string) => {
  const { tools, resources, logging, tasks, extensions } = CAPABILITIES;
  return {
    tools,
    ...(armView(arm).resources ? { resources } : {}),
    logging,
    ...(revision !== undefined && revision >= TASKS_SINCE ? { tasks } : {}),
    ...(armView(arm).skills ? { extensions } : {}),
  };
};

/* ── the adherence test's arms (#3440, Q3440.3 A) ───────────────────────────────────────────────────── */

/**
 * WHAT A FRESH AGENT IS SHOWN, by arm, for the agent-adherence test (#3440 §2). `PRISM3_BRIDGE_ARM` picks one; unset is
 * arm 2, today's bridge, so nothing changes for anyone who doesn't set it.
 *   · 0 (F0) — the tools and nothing else: no `instructions`, no `readFirst`, no resources capability, and
 *     `figma_run context` refused here, before it reaches the plugin. `context` is also left out of the tools' command
 *     list and `figma_status`'s `commands`, so the arm does not advertise what it refuses.
 *   · 1 (F1) — arm 0 plus the note: `instructions` and `readFirst`. Still no resources and no `context`.
 *   · 2 (F2) — the note, the five resources, the skills (#4646 step 2) and `context`.
 * `test-agent-bridge.ts` (`arm/…`) reads arm 0's and arm 1's bodies for sentinels it writes itself, never read from
 * `BRIDGE_INSTRUCTIONS`.
 */
export type BridgeArm = 0 | 1 | 2;
export const DEFAULT_ARM: BridgeArm = 2;
/** `PRISM3_BRIDGE_ARM`'s value → an arm, or null for anything but `0`, `1` or `2` (the server then refuses to start). */
export const parseArm = (v: string | undefined): BridgeArm | null => (v === undefined || v === '' ? DEFAULT_ARM : v === '0' ? 0 : v === '1' ? 1 : v === '2' ? 2 : null);
/** The arm's view: whether it sends the note, serves the resources and the skills, and answers `context`. */
export const armView = (arm: BridgeArm) => ({ note: arm >= 1, resources: arm >= 2, skills: arm >= 2, context: arm >= 2 });
/** The command the arms below 2 refuse at the bridge. */
const CONTEXT_CMD = 'context';
/** The refusal arms 0 and 1 answer `figma_run context` with: the protocol's own code for a command a build lacks. */
export const ARM_REFUSAL = { code: 'unknown-command', message: 'context is not a command this bridge runs' } as const;

/**
 * ONE LINE PER `figma_run` CALL, for `--record <file>` (#3440 §3, V7 and refused attempts). Each call writes an
 * `attempt` line before anything runs (so a call the bridge refuses, or one cut off by a crash, is still on record) and an
 * `outcome` line when it ends, with the same `seq`. `args` are kept whole: `run-code`'s `code` is what V7 is scored from.
 * A plain call that times out ends with `tool-error`, but its run goes on (#4646): when that run settles, a `late` line
 * with the same `seq` records how it ended (#4656 item 2). It is its own kind, so a reader that keys `outcome` lines by
 * `seq` still reads the call's outcome, the one the agent saw.
 */
export type RecordLine =
  | { kind: 'attempt'; seq: number; at: string; arm: BridgeArm; cmd: unknown; args: unknown }
  | { kind: 'outcome'; seq: number; at: string; outcome: 'refused-by-bridge' | 'tool-error' | 'ok' | 'not-ok'; error?: unknown }
  | { kind: 'late'; seq: number; at: string; outcome: 'tool-error' | 'ok' | 'not-ok'; error?: unknown };
export const createRecorder = (write: (line: string) => void, now: () => Date = () => new Date()) => {
  let seq = 0;
  return {
    attempt: (arm: BridgeArm, cmd: unknown, args: unknown): number => { seq += 1; write(JSON.stringify({ kind: 'attempt', seq, at: now().toISOString(), arm, cmd, args } satisfies RecordLine) + '\n'); return seq; },
    outcome: (s: number, outcome: Extract<RecordLine, { kind: 'outcome' }>['outcome'], error?: unknown): void => {
      write(JSON.stringify({ kind: 'outcome', seq: s, at: now().toISOString(), outcome, ...(error !== undefined ? { error } : {}) } satisfies RecordLine) + '\n');
    },
    late: (s: number, outcome: Extract<RecordLine, { kind: 'late' }>['outcome'], error?: unknown): void => {
      write(JSON.stringify({ kind: 'late', seq: s, at: now().toISOString(), outcome, ...(error !== undefined ? { error } : {}) } satisfies RecordLine) + '\n');
    },
  };
};
export type Recorder = ReturnType<typeof createRecorder>;
export type RpcOptions = { arm?: BridgeArm; record?: Recorder };

/* ── RFC 6455 framing ───────────────────────────────────────────────────────────────────────────────── */

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
/** `Sec-WebSocket-Accept` for a client key (RFC 6455 §4.2.2). */
export const acceptKey = (key: string): string => createHash('sha1').update(key + GUID).digest('base64');

export const OP = { cont: 0x0, text: 0x1, binary: 0x2, close: 0x8, ping: 0x9, pong: 0xa } as const;
/** Largest message accepted from a client; a build's result with its telemetry is well under this. */
const MAX_MESSAGE = 64 * 1024 * 1024;

/** One unmasked server frame (servers never mask, §5.1). */
export const encodeFrame = (opcode: number, payload: Buffer): Buffer => {
  const n = payload.length;
  const head = n < 126 ? Buffer.alloc(2) : n < 65536 ? Buffer.alloc(4) : Buffer.alloc(10);
  head[0] = 0x80 | opcode;
  if (n < 126) head[1] = n;
  else if (n < 65536) { head[1] = 126; head.writeUInt16BE(n, 2); }
  else { head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([head, payload]);
};

/**
 * Incremental decoder for CLIENT frames: buffers bytes, unmasks, reassembles fragmented messages, and
 * reports protocol violations instead of guessing. Every client frame must be masked (§5.1).
 */
export const createDecoder = (on: {
  message(text: string): void;
  ping(payload: Buffer): void;
  close(code: number, reason: string): void;
  error(code: number, why: string): void;
}) => {
  let buf = Buffer.alloc(0);
  let parts: Buffer[] = [];
  let partsLen = 0;
  let fragOpcode = -1;
  return (chunk: Buffer): void => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = (buf[0] & 0x80) !== 0;
      const opcode = buf[0] & 0x0f;
      const masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f;
      let off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) {
        if (buf.length < 10) return;
        const big = buf.readBigUInt64BE(2);
        if (big > BigInt(MAX_MESSAGE)) { on.error(1009, 'frame too large'); return; }
        len = Number(big); off = 10;
      }
      if (!masked) { on.error(1002, 'client frames must be masked'); return; }
      if (buf.length < off + 4 + len) return;
      const mask = buf.subarray(off, off + 4);
      const payload = Buffer.from(buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      buf = buf.subarray(off + 4 + len);
      if (opcode >= 0x8) {
        if (!fin || len > 125) { on.error(1002, 'control frames are unfragmented and ≤125 bytes'); return; }
        if (opcode === OP.close) on.close(len >= 2 ? payload.readUInt16BE(0) : 1005, payload.subarray(2).toString('utf8'));
        else if (opcode === OP.ping) on.ping(payload);
        continue; // pong: nothing to do
      }
      if (opcode === OP.cont) {
        if (fragOpcode < 0) { on.error(1002, 'continuation without a message'); return; }
      } else {
        if (fragOpcode >= 0) { on.error(1002, 'new message inside a fragmented one'); return; }
        if (opcode !== OP.text && opcode !== OP.binary) { on.error(1002, `unknown opcode ${opcode}`); return; }
        fragOpcode = opcode;
      }
      parts.push(payload);
      partsLen += payload.length;
      if (partsLen > MAX_MESSAGE) { on.error(1009, 'message too large'); return; }
      if (fin) {
        const whole = Buffer.concat(parts);
        const wasText = fragOpcode === OP.text;
        parts = []; partsLen = 0; fragOpcode = -1;
        if (wasText) on.message(whole.toString('utf8'));
        else on.error(1003, 'the bridge speaks text frames only');
      }
    }
  };
};

/* ── pairing (#3204) ───────────────────────────────────────────────────────────────────────────────── */

/** Where the secret lives: `$PRISM3_BRIDGE_CONFIG`, else the user's config directory (`%APPDATA%` on Windows,
 *  `$XDG_CONFIG_HOME` or `~/.config` elsewhere), under `prism3/`. */
export const bridgeConfigPath = (env: NodeJS.ProcessEnv = process.env): string => {
  if (env.PRISM3_BRIDGE_CONFIG) return resolve(env.PRISM3_BRIDGE_CONFIG);
  const base = process.platform === 'win32' && env.APPDATA ? env.APPDATA : env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'prism3', 'figma-bridge.json');
};

/** Read the secret, or make one (`rotate` always makes a new one). The file is written user-only (0600) in a user-only
 *  directory (0700); a file found readable by others is narrowed back to 0600 and named on stderr. */
export const loadSecret = (path: string, opts: { rotate?: boolean; say?: (s: string) => void } = {}): { secret: Buffer; created: boolean } => {
  const say = opts.say ?? (() => undefined);
  if (!opts.rotate && existsSync(path)) {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as { secret?: unknown };
    if (typeof raw.secret === 'string' && /^[0-9a-f]{64}$/.test(raw.secret)) {
      if (process.platform !== 'win32' && (statSync(path).mode & 0o077) !== 0) { chmodSync(path, 0o600); say(`narrowed ${path} to mode 0600: it was readable by others`); }
      return { secret: Buffer.from(raw.secret, 'hex'), created: false };
    }
    say(`${path} holds no usable secret: making a new one`);
  }
  const secret = randomBytes(32);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify({ v: 1, secret: secret.toString('hex') }) + '\n', { mode: 0o600 });
  // `mode` applies only when the file is created; a rotated file keeps its old mode unless it is set again.
  if (process.platform !== 'win32') chmodSync(path, 0o600);
  return { secret, created: true };
};

/** Wrong codes allowed before the code is retired and a new one printed. */
export const MAX_PAIR_FAILS = 5;
/** How long a code is live after it is issued (the owner's Q3204.5 A). */
export const CODE_TTL_MS = 10 * 60_000;
/** Codes retired by wrong guesses before pairing closes until the next request (Q3204.5 A). */
export const MAX_RETIREMENTS = 3;
/** How long a connection may take to pair or prove itself before it is closed. */
export const AUTH_MS = 120_000;

const hmac = (key: string | Buffer, msg: string): Buffer => createHmac('sha256', key).update(msg, 'utf8').digest();
const sameHex = (want: Buffer, got: unknown): boolean => {
  if (typeof got !== 'string' || !/^[0-9a-f]{64}$/.test(got)) return false;
  return timingSafeEqual(want, Buffer.from(got, 'hex'));
};
const newCode = (): string => Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

/** The server's half of the pairing: the token the secret gives, the open code, and the two checks.
 *
 *  A CODE IS LIVE ONLY FOR A WINDOW (the owner's Q3204.5 A). None is issued at start: `request()` issues one on demand
 *  (`figma_status` while no plugin is connected, or a `--pair` start), and keeps a live one rather than replacing it. A
 *  code expires `CODE_TTL_MS` after it is issued. `MAX_PAIR_FAILS` wrong codes retire it for a new one, and after
 *  `MAX_RETIREMENTS` retirements pairing closes until the next request. A paired plugin proving its token (`settle()`)
 *  leaves no code live, so a paired machine has none. `now` is injected so the tests move the clock instead of sleeping. */
export const createPairing = (secret: Buffer, say: (s: string) => void = () => undefined, now: () => number = Date.now) => {
  const token = hmac(secret, TOKEN_LABEL).toString('hex');
  let code: string | null = null;
  let issuedAt = 0;
  let fails = 0;
  let retired = 0;
  const issue = () => {
    code = newCode(); issuedAt = now(); fails = 0;
    say(`pairing code: ${formatCode(code)} (live for ${CODE_TTL_MS / 60_000} minutes) — the Prism3 plugin asks for it the first time it connects on this machine`);
  };
  /** The live code, after dropping one that has expired. */
  const live = (): string | null => {
    if (code !== null && now() - issuedAt >= CODE_TTL_MS) { code = null; say('the pairing code expired'); }
    return code;
  };
  return {
    token,
    code: (): string | null => { const c = live(); return c ? formatCode(c) : null; },
    /** On demand: keep the live code, or open a new window with a new one. */
    request: (): string => { if (live() === null) { retired = 0; issue(); } return formatCode(code!); },
    /** A paired plugin proved its token: no code stays live. */
    settle: (): void => { code = null; },
    nonce: (): string => randomBytes(32).toString('hex'),
    helloOk: (nonce: string, proof: unknown): boolean => sameHex(hmac(token, HELLO_LABEL + nonce), proof),
    /** #3697 R8: the welcome's proof, over the plugin's own nonce. */
    welcomeProof: (clientNonce: string): string => hmac(token, WELCOME_LABEL + clientNonce).toString('hex'),
    /** A pairing attempt. A right code is spent; after `MAX_PAIR_FAILS` wrong ones the code is retired for a new one,
     *  and after `MAX_RETIREMENTS` retirements for none. #3697 R8: a right code answers the `paired` proof, keyed by the
     *  code just spent over the plugin's nonce and the token; a wrong one answers null. */
    pairOk: (nonce: string, proof: unknown, clientNonce: string): string | null => {
      const c = live();
      if (c === null) return null;
      if (sameHex(hmac(c, PAIR_LABEL + nonce), proof)) { code = null; say('paired: the code is spent'); return hmac(c, `${PAIRED_LABEL}${clientNonce}:${token}`).toString('hex'); }
      if (++fails >= MAX_PAIR_FAILS) {
        say(`${MAX_PAIR_FAILS} wrong pairing codes: that code is retired`);
        if (++retired >= MAX_RETIREMENTS) { code = null; say(`${MAX_RETIREMENTS} codes retired: pairing is closed until figma_status asks for a code or the bridge starts with --pair`); }
        else issue();
      }
      return null;
    },
  };
};
export type Pairing = ReturnType<typeof createPairing>;

/* ── the bridge (plugin connection + command state) ─────────────────────────────────────────────────── */

type Conn = { socket: Duplex; send(obj: unknown): void; close(code: number, why: string): void; connectedAt: string;
  /** Set by the bridge: the challenge's nonce, whether the token was proved, and the timer that closes a silent one. */
  nonce?: string; authed?: boolean; authTimer?: NodeJS.Timeout };
type LogEntry = { seq: number; at: string; id: string | null; kind: 'log' | 'progress' | 'bridge'; line: string };
const LOG_KEEP = 5000;
/** How long a command in flight waits for a dropped plugin to reconnect before it fails (#2497). */
export const DEFAULT_GRACE_MS = 120_000;
/** Ids whose result was already delivered, so a re-sent copy is named a repeat rather than a stranger. */
const DELIVERED_KEEP = 200;
/** Runs kept for `figma_result` and the task methods after they settle; the oldest settled one goes first (#4646). */
export const RUN_KEEP = 200;

/**
 * ONE `figma_run`, BY ITS ID (#4646 step 1). The id is the command's own (`b…`), given when the call is made, before the
 * command is queued, so a caller that stops waiting still has it. A run is `working` until the plugin's result arrives
 * (`completed`, whatever its `ok` says: that is the action's own verdict) or the bridge gives up on it (`failed`: no
 * plugin, or a drop it did not come back from). It settles once. A caller's timeout ends that caller's wait, never the
 * run: a result that lands later still settles it, so `figma_result` can read it and nothing is sent twice.
 */
export type RunStatus = 'working' | 'completed' | 'failed';
export type RunOutcome = { result: AgentResult } | { error: string };
export type RunHooks = { onProgress?(p: AgentProgress): void; onLog?(line: string): void };
export type RunView = { id: string; cmd: string; status: RunStatus; createdAt: string; lastUpdatedAt: string; progress: string | null; error: string | null; result: AgentResult | null };
export type Run = {
  id: string;
  /** Resolves when the command has been sent to the plugin, or refused for want of one. Its caller's clock starts here. */
  sent: Promise<void>;
  /** Resolves once, when the run settles. */
  done: Promise<RunOutcome>;
  view(): RunView;
  /** Hear its progress and console lines from now on; returns the call that stops hearing them. */
  listen(hooks: RunHooks): () => void;
};

export const createBridge = (opts: { pairing: Pairing; now?: () => Date; log?: (s: string) => void; graceMs?: number; authMs?: number }) => {
  const now = opts.now ?? (() => new Date());
  const say = opts.log ?? ((s: string) => process.stderr.write(`[figma-bridge] ${s}\n`));
  const graceMs = opts.graceMs ?? DEFAULT_GRACE_MS;
  const pairing = opts.pairing;
  const authMs = opts.authMs ?? AUTH_MS;
  let plugin: Conn | null = null;
  let pluginState: AgentLinkState | null = null;
  /** `conn` is the connection the command was sent on, or the later one whose hello said it holds it. */
  const pending = new Map<string, { conn: Conn; settle(o: RunOutcome): void }>();
  /** Every run, by id, newest last: the ones still working and the last `RUN_KEEP` settled ones. */
  const runs = new Map<string, { view: RunView; hooks: Set<RunHooks>; run: Run }>();
  const delivered = new Set<string>();
  let grace: NodeJS.Timeout | null = null;
  const logs: LogEntry[] = [];
  let seq = 0;
  let queue: Promise<unknown> = Promise.resolve();
  let idSeq = 0;

  const record = (id: string | null, kind: LogEntry['kind'], line: string) => {
    logs.push({ seq: ++seq, at: now().toISOString(), id, kind, line });
    if (logs.length > LOG_KEEP) logs.splice(0, logs.length - LOG_KEEP);
  };

  const fail = (id: string, why: string) => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    record(id, 'bridge', why);
    p.settle({ error: why });
  };
  /** Commands sent on a connection that is no longer the plugin's, still waiting for it to come back. */
  const orphans = () => [...pending].filter(([, p]) => p.conn !== plugin).map(([id]) => id);

  /** A new connection, after the handshake: challenge it. It is not the plugin until its hello proves the token. */
  const open = (conn: Conn) => {
    conn.nonce = pairing.nonce();
    conn.authed = false;
    conn.authTimer = setTimeout(() => conn.close(CLOSE.timedOut, 'not paired in time'), authMs);
    conn.send({ type: 'challenge', v: 1, nonce: conn.nonce });
  };
  /** A PAIRED connection (its hello proved the token). Replaces any earlier one; its commands wait for the hello. An
   *  unpaired connection never reaches here, so it can never evict the plugin (#3204). */
  const attach = (conn: Conn) => {
    if (plugin) plugin.close(CLOSE.held, 'replaced by a newer connection');
    plugin = conn;
    pluginState = null;
    record(null, 'bridge', 'plugin connected');
    say('plugin connected');
  };
  const detach = (conn: Conn) => {
    if (conn.authTimer) { clearTimeout(conn.authTimer); conn.authTimer = undefined; }
    if (plugin !== conn) return;
    plugin = null;
    record(null, 'bridge', 'plugin disconnected');
    say('plugin disconnected');
    if (!pending.size) return;
    if (grace) clearTimeout(grace);
    grace = setTimeout(() => {
      grace = null;
      for (const id of orphans()) fail(id, `the plugin disconnected while this command was running and did not reconnect within ${graceMs} ms`);
    }, graceMs);
  };
  /** The plugin's hello: adopt the commands it holds, fail the ones it does not. Nothing is re-sent. */
  const onHello = (held: unknown) => {
    const ids = new Set(Array.isArray(held) ? held.filter((x): x is string => typeof x === 'string') : []);
    for (const id of orphans()) {
      if (ids.has(id)) { pending.get(id)!.conn = plugin!; record(id, 'bridge', 'the reconnected plugin holds this command'); }
      else fail(id, 'the plugin reconnected while this command was running, and does not hold it: it never reached the plugin, or the plugin was reloaded');
    }
    if (grace && !orphans().length) { clearTimeout(grace); grace = null; }
  };
  /** One text message from a connection. Before its hello proves the token, only `pair` and `hello` are heard; anything
   *  else, or a wrong proof, closes it (#3204). */
  const onMessage = (conn: Conn, text: string) => {
    let m: { type?: string; state?: AgentLinkState; held?: unknown; result?: AgentResult; id?: string; progress?: AgentProgress; line?: string; proof?: unknown; yield?: unknown; clientNonce?: unknown };
    try { m = JSON.parse(text); } catch { m = {}; }
    if (!conn.authed) {
      const clientNonce = typeof m.clientNonce === 'string' && CLIENT_NONCE_RE.test(m.clientNonce) ? m.clientNonce : null;
      if (m.type === 'pair') {
        const proof = clientNonce === null ? null : pairing.pairOk(conn.nonce!, m.proof, clientNonce);
        if (proof === null) { record(null, 'bridge', 'a wrong pairing code: refused'); conn.close(CLOSE.wrongCode, 'wrong pairing code'); return; }
        record(null, 'bridge', 'a plugin paired');
        conn.send({ type: 'paired', token: pairing.token, proof });
        return;
      }
      if (m.type === 'hello' && clientNonce !== null && pairing.helloOk(conn.nonce!, m.proof)) {
        pairing.settle();
        if (conn.authTimer) { clearTimeout(conn.authTimer); conn.authTimer = undefined; }
        if (m.yield === true && plugin && plugin !== conn) {
          // #3297: a displaced instance asking politely. Another paired plugin holds the bridge, so this one waits.
          conn.close(CLOSE.held, 'another plugin instance holds the bridge');
          return;
        }
        conn.authed = true;
        attach(conn);
        conn.send({ type: 'welcome', proof: pairing.welcomeProof(clientNonce) });
      } else {
        record(null, 'bridge', 'a connection without the pairing token: refused');
        conn.close(CLOSE.notPaired, 'not paired');
        return;
      }
    }
    onPluginMessage(m);
  };
  /** One message from the plugin, parsed. */
  const onPluginMessage = (m: { type?: string; state?: AgentLinkState; held?: unknown; result?: AgentResult; id?: string; progress?: AgentProgress; line?: string }) => {
    if (!m.type) { record(null, 'bridge', 'unparseable message from the plugin'); return; }
    if (m.type === 'hello' || m.type === 'state') {
      if (m.state) pluginState = m.state;
      if (m.type === 'hello') onHello(m.held);
      return;
    }
    if (m.type === 'result' && m.result && typeof m.result.id === 'string') {
      const id = m.result.id;
      const p = pending.get(id);
      if (!p) {
        record(id, 'bridge', delivered.has(id) ? 'a repeated result, already delivered: ignored' : 'a result for a command this bridge is not waiting on');
        return;
      }
      pending.delete(id);
      delivered.add(id);
      if (delivered.size > DELIVERED_KEEP) delivered.delete(delivered.values().next().value as string);
      if (grace && !orphans().length) { clearTimeout(grace); grace = null; }
      p.settle({ result: m.result });
      return;
    }
    if (m.type === 'progress' && typeof m.id === 'string' && m.progress) {
      const pr = m.progress;
      record(m.id, 'progress', `${pr.phase} ${pr.done}/${pr.total} (${pr.chunkMs} ms)`);
      const r = runs.get(m.id);
      if (r && r.view.status === 'working') {
        r.view.progress = `${pr.phase} ${pr.done}/${pr.total}`;
        r.view.lastUpdatedAt = now().toISOString();
        for (const h of r.hooks) h.onProgress?.(pr);
      }
      return;
    }
    if (m.type === 'log' && typeof m.id === 'string' && typeof m.line === 'string') {
      record(m.id, 'log', m.line);
      const r = runs.get(m.id);
      if (r && r.view.status === 'working') for (const h of r.hooks) h.onLog?.(m.line);
    }
  };

  /** Drop the oldest settled runs past `RUN_KEEP`. A run still working is never dropped. */
  const trimRuns = () => {
    let settled = [...runs.values()].filter((r) => r.view.status !== 'working').length;
    for (const [id, r] of runs) {
      if (settled <= RUN_KEEP) return;
      if (r.view.status !== 'working') { runs.delete(id); settled--; }
    }
  };

  /**
   * Start one command: the run exists, with its id, at once. Queued: one command in flight at a time, and a command
   * holds the line until it settles or `holdMs` after it was sent, whichever comes first, as before #4646. The run
   * itself is kept past `holdMs`, until it settles.
   */
  const start = (cmd: string, args: unknown, holdMs: number, hooks: RunHooks = {}): Run => {
    const id = `b${now().getTime().toString(36)}-${(++idSeq).toString(36)}`;
    const at = now().toISOString();
    const view: RunView = { id, cmd, status: 'working', createdAt: at, lastUpdatedAt: at, progress: null, error: null, result: null };
    const hookSet = new Set<RunHooks>([hooks]);
    let settleDone!: (o: RunOutcome) => void;
    const done = new Promise<RunOutcome>((res) => { settleDone = res; });
    const settle = (o: RunOutcome) => {
      if (view.status !== 'working') return;
      view.lastUpdatedAt = now().toISOString();
      if ('result' in o) { view.status = 'completed'; view.result = o.result; } else { view.status = 'failed'; view.error = o.error; }
      hookSet.clear();
      settleDone(o);
      trimRuns();
    };
    let markSent!: () => void;
    const sent = new Promise<void>((res) => { markSent = res; });
    const run: Run = {
      id, sent, done,
      view: () => ({ ...view }),
      listen: (h) => { if (view.status === 'working') hookSet.add(h); return () => { hookSet.delete(h); }; },
    };
    runs.set(id, { view, hooks: hookSet, run });
    const go = () => new Promise<void>((release) => {
      markSent();
      if (!plugin) { settle({ error: 'no plugin is connected — the owner opens the Prism3 plugin in Figma and switches Agent link on' }); release(); return; }
      const command: AgentCommand = { v: AGENT_PROTOCOL_VERSION, id, cmd, args: args ?? {}, issuedAt: now().toISOString() };
      const hold = setTimeout(release, holdMs);
      void done.then(() => { clearTimeout(hold); release(); });
      pending.set(id, { conn: plugin, settle });
      record(id, 'bridge', `sent ${cmd}`);
      plugin.send({ type: 'command', command });
    });
    queue = queue.then(go, go);
    return run;
  };

  return {
    open, detach, onMessage, start,
    /** A run by id, while it is kept. */
    run: (id: string): Run | null => runs.get(id)?.run ?? null,
    /** The newest kept `update-components` check whose result carries this `previewHash` (#4646 step 3), or null. */
    checkFor: (previewHash: unknown): AgentResult | null => {
      if (typeof previewHash !== 'string' || !previewHash) return null;
      for (const r of [...runs.values()].reverse()) {
        const env = r.view.result;
        const u = (env?.result as { data?: { update?: { mode?: unknown; previewHash?: unknown } } } | undefined)?.data?.update;
        if (env && env.cmd === 'update-components' && u?.mode === 'preview' && u.previewHash === previewHash) return env;
      }
      return null;
    },
    status: () => ({
      connected: !!plugin, connectedAt: plugin?.connectedAt ?? null, plugin: pluginState, pairingCode: plugin ? pairing.code() : pairing.request(),
      running: [...pending.keys()], awaitingReconnect: orphans(), bridge: SERVER_INFO, protocol: AGENT_PROTOCOL_VERSION, commands: [...AGENT_COMMANDS],
    }),
    logs: (since = 0, limit = 200) => {
      const out = logs.filter((l) => l.seq > since);
      return { entries: out.slice(-limit), last: seq, dropped: Math.max(0, out.length - limit) };
    },
  };
};
export type Bridge = ReturnType<typeof createBridge>;

/* ── the WebSocket listener ─────────────────────────────────────────────────────────────────────────── */

/** The one `Origin` the bridge accepts (#3147): a sandboxed iframe's opaque origin, which is how a Figma plugin's UI
 *  connects. Anything else, a missing header included, is refused. Any page's sandboxed iframe sends it too, so this is
 *  defense in depth, not the gate: the pairing proof is (#3204). */
export const PLUGIN_ORIGIN = 'null';
export const originAllowed = (origin: string | string[] | undefined): boolean => origin === PLUGIN_ORIGIN;

/** Start the listener on loopback (127.0.0.1, plus ::1 when available); `port` 0 picks a free one. */
export const listen = async (bridge: Bridge, port: number): Promise<{ port: number; close(): Promise<void> }> => {
  const onUpgrade = (req: IncomingMessage, socket: Duplex) => {
    const key = req.headers['sec-websocket-key'];
    if (String(req.headers.upgrade).toLowerCase() !== 'websocket' || typeof key !== 'string' || req.headers['sec-websocket-version'] !== '13') {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }
    // THE ORIGIN CHECK (#3147): Figma serves a plugin's UI from a sandboxed iframe, whose origin is opaque, so its browser
    // sends `Origin: null`. A page's own script sends the page's origin and is refused here, before the handshake; so is a
    // request with no Origin at all. A page's SANDBOXED iframe sends `null` as well and passes: the pairing proof that
    // follows the handshake is what keeps it out (#3204, `createBridge` `onMessage`).
    if (!originAllowed(req.headers.origin)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nprism3 figma-bridge: only the Prism3 plugin may connect\n');
      return;
    }
    socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${acceptKey(key)}`, '', ''].join('\r\n'));
    let closed = false;
    const conn: Conn = {
      socket,
      connectedAt: new Date().toISOString(),
      send: (obj) => { if (!closed) socket.write(encodeFrame(OP.text, Buffer.from(JSON.stringify(obj), 'utf8'))); },
      close: (code, why) => {
        if (closed) return;
        closed = true;
        const p = Buffer.alloc(2 + Buffer.byteLength(why));
        p.writeUInt16BE(code, 0); p.write(why, 2);
        socket.end(encodeFrame(OP.close, p));
      },
    };
    const decode = createDecoder({
      message: (t) => bridge.onMessage(conn, t),
      ping: (p) => { if (!closed) socket.write(encodeFrame(OP.pong, p)); },
      close: (code) => conn.close(code === 1005 ? 1000 : code, ''),
      error: (code, why) => conn.close(code, why),
    });
    socket.on('data', (d: Buffer) => decode(d));
    // A peer that just goes away (Figma quits, the plugin window is killed) ends its side WITHOUT a close
    // frame. `node:http` upgrades sockets half-open, so without this the server side never closes, 'close'
    // never fires, and a phantom plugin stays "connected" until every command to it times out.
    socket.on('end', () => { closed = true; socket.destroy(); });
    socket.on('close', () => { closed = true; bridge.detach(conn); });
    socket.on('error', () => { closed = true; bridge.detach(conn); });
    bridge.open(conn);
  };
  const make = () => {
    const server = createServer((_req, res) => { res.writeHead(426, { 'content-type': 'text/plain' }).end('prism3 figma-bridge: WebSocket only\n'); });
    server.on('upgrade', onUpgrade);
    return server;
  };
  const bind = (server: ReturnType<typeof make>, host: string, p: number) => new Promise<number>((res, rej) => {
    server.once('error', rej);
    server.listen(p, host, () => { const a = server.address(); res(typeof a === 'object' && a ? a.port : p); });
  });
  const v4 = make();
  const bound = await bind(v4, '127.0.0.1', port);
  const servers = [v4];
  const v6 = make();
  // IPv6 loopback is best-effort: a host without it still serves every client that resolves to 127.0.0.1.
  try { await bind(v6, '::1', bound); servers.push(v6); } catch { /* no ::1 here */ }
  return {
    port: bound,
    close: () => Promise.all(servers.map((sv) => new Promise<void>((r) => { sv.closeAllConnections?.(); sv.close(() => r()); }))).then(() => undefined),
  };
};

/* ── MCP ────────────────────────────────────────────────────────────────────────────────────────────── */

/*
 * ON THE OFFICIAL SDK (#4646, the owner's decision A). The MCP side runs on `@modelcontextprotocol/server`, v2 of what
 * was `@modelcontextprotocol/sdk` (v2 ships as split packages), pinned exactly in the root `package.json`. Tasks,
 * Elicitation and Skills over MCP need server-to-client requests, per-run state, cancellation and resume, which is where
 * a hand-written server breaks. The bridge is the one exception to docs/08 §7's "no MCP SDK": `packages/engine/mcp.ts`
 * stays hand-written, because the engine runs with no `npm install` (docs/07 §3) and the bridge is local tooling.
 *
 * The SDK is loaded with `import()` inside `createMcpServer` and the stdio shell, never at the top of this file:
 * `lint-ecosystem.ts` and `emit-agent-reference.ts` import `TOOLS` from here, and they are engine gates.
 */

/**
 * #2639: `figma_run`'s `args` description, one entry per command, read from the source rather than typed here. It was
 * hand-typed and named 4 of the commands, telling an agent to send `{}` to commands that take arguments. Each command's
 * args are its `AgentArgs` member in `agent-protocol.ts`, as written (the same one-line form `emit-agent-reference.ts`
 * reads); the command list is `AGENT_COMMANDS`. A command with no one-line member fails the load, by name, so the
 * description can never skip one. Gated by `test-agent-bridge.ts` arm `mcp/args`.
 */
const PROTOCOL_SRC = 'apps/plugin/src/agent-protocol.ts';
export const argsByCommand = (src: string): Record<string, string> => {
  const lines = src.split('\n');
  const start = lines.findIndex((l) => /^export type AgentArgs = \{/.test(l));
  const end = lines.findIndex((l, i) => i > start && /^\};/.test(l));
  const out: Record<string, string> = {};
  for (const cmd of AGENT_COMMANDS) {
    const re = new RegExp(`^\\s*(?:'${cmd}'|${cmd.replace(/-/g, '\\-')}): (.+);\\s*$`);
    const hit = start < 0 ? undefined : lines.slice(start + 1, end).map((l) => re.exec(l)).find(Boolean);
    if (!hit) throw new Error(`figma-bridge: AgentArgs in ${PROTOCOL_SRC} has no one-line member for '${cmd}'`);
    out[cmd] = hit[1];
  }
  return out;
};
const ARGS = argsByCommand(readFileSync(join(REPO_ROOT, PROTOCOL_SRC), 'utf8'));
/** The `args` description for a command list: each command and its args type, then where the field docs live. */
export const argsDescription = (cmds: readonly string[]): string =>
  `${cmds.map((c) => `${c}: ${ARGS[c]}`).join('; ')}. Record<string, never> means send {}. Each field's meaning: docs/public/reference/commands.json.`;

export const TOOLS = [
  {
    name: 'figma_status',
    description: 'Whether the Prism3 plugin in the owner\'s Figma is connected to this bridge, the link state it last reported, and any command in flight. Call first. While no plugin is connected, this call issues a pairing code (`pairingCode`) if none is live: the owner enters it in the plugin once per machine, within 10 minutes. For the file\'s own state, run the `status` command with figma_run.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'figma_run',
    description: `Run one agent-link command in the connected plugin and return its result envelope (v, id, cmd, ok, startedAt, finishedAt, engineVersion, transport, result {verdict, data, logs} | error, progress). Commands: ${AGENT_COMMANDS.join(', ')}. The plugin runs it through the same handler the panel's button reaches. 'prune' with confirm: true deletes — preview with confirm: false first, and echo its previewHash. apply-theme and prune take the brand as args.input, the object the engine's MCP tools call \`brand\`. A call that times out leaves the command running in the plugin: don't send it again. Its error names the run's id, and figma_result returns the result once it lands. A client with tasks can run this as a task instead, and read the result from it.`,
    // #4646 step 1: run as a task when the client asks for one, and as a plain call when it doesn't.
    execution: { taskSupport: 'optional' as const },
    inputSchema: {
      type: 'object',
      properties: {
        cmd: { type: 'string', enum: [...AGENT_COMMANDS] },
        args: { type: 'object', description: argsDescription(AGENT_COMMANDS) },
        timeoutMs: { type: 'number', description: 'Default 600000 (a full catalog build takes minutes).' },
      },
      required: ['cmd'],
      additionalProperties: false,
    },
  },
  {
    name: 'figma_logs',
    description: 'Console and progress lines the plugin streamed, newest last. Pass `since` (the `last` from a previous call) to read only new lines.',
    inputSchema: { type: 'object', properties: { since: { type: 'number' }, limit: { type: 'number' } }, additionalProperties: false },
  },
  {
    name: 'figma_result',
    description: "A figma_run command's result, by its run id: the result envelope once the plugin has answered, or the run's status and last progress while it is still running. Use it after a figma_run that timed out, whose error names the id, rather than sending the command again.",
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: "The run's id: the id a figma_run timeout names, or a result envelope's id." } }, required: ['id'], additionalProperties: false },
  },
];

/**
 * One run's plugin readings → the MCP `progress` value, which the spec requires to increase with every
 * notification (#1684). A reading's `done` cannot be passed through: it restarts at every SEGMENT — build →
 * wire, each #1679 `retry` pass (1/6 … 6/6), the `wire` reading that closes the back-off, and the next set's
 * build when a command builds several. So a segment ends when the phase changes or `done` fails to rise,
 * and the finished segment's last `done` is folded into an offset: progress = offset + done, floored at the
 * previous value + 1 so a segment opening at `done: 0` still moves forward.
 *
 * No `total` is returned, on purpose. The only totals the plugin knows are per segment, and how many
 * segments a run will have (retry passes, nested sets) is unknown until it ends — any sum would be passed
 * by a later phase. MCP makes `total` optional; the phase's own fraction stays in `message`.
 */
export const createProgressCounter = () => {
  let offset = 0;
  let last = 0;
  let prev: { phase: string; done: number } | null = null;
  return (p: AgentProgress): number => {
    if (prev && (p.phase !== prev.phase || p.done <= prev.done)) offset += prev.done;
    prev = { phase: p.phase, done: p.done };
    last = Math.max(offset + p.done, last + 1);
    return last;
  };
};

/** The tools an arm lists: arm 2 is `TOOLS` itself; below it `context` is left out of `figma_run`'s command list. */
export const toolsFor = (arm: BridgeArm) => {
  if (armView(arm).context) return TOOLS;
  const cmds = AGENT_COMMANDS.filter((c) => c !== CONTEXT_CMD);
  return TOOLS.map((t) => t.name !== 'figma_run' ? t : {
    ...t,
    description: t.description.replace(`Commands: ${AGENT_COMMANDS.join(', ')}.`, `Commands: ${cmds.join(', ')}.`),
    inputSchema: { ...t.inputSchema, properties: { ...t.inputSchema.properties, cmd: { type: 'string', enum: [...cmds] }, args: { type: 'object', description: argsDescription(cmds) } } },
  });
};

const text = (v: unknown, isError = false) => ({ content: [{ type: 'text' as const, text: JSON.stringify(v, null, 2) }], structuredContent: v as Record<string, unknown>, ...(isError ? { isError: true } : {}) });
/** What figma_run returns for a settled run: the plugin's result envelope, or the bridge's error. */
const runResult = (o: RunOutcome) => ('result' in o ? text(o.result) : text({ error: o.error }, true));
/** How often a task's requester is asked to poll `tasks/get`, in ms (`pollInterval`). */
export const TASK_POLL_MS = 5_000;
/** The longest `ttl` a task keeps; a longer one asked for is cut to this. */
export const TASK_TTL_MAX_MS = 24 * 3_600_000;

/** A JSON-RPC message as it arrives on stdio, before the SDK reads it. */
type WireMessage = { jsonrpc?: string; id?: number | string | null; method?: string; params?: any };

/**
 * WHERE THE BRIDGE'S WIRE DIFFERS FROM THE SDK'S DEFAULTS, and stays as it was (#4646 step 0: nothing an agent or a test
 * reads moves). `bridgeTransport` puts this in front of the SDK, on each message read from stdio:
 *   · `server/discover` is answered in any state, in the shape the bridge always sent. The SDK pins one protocol era per
 *     connection and answers `server/discover` only on a 2026-07-28 one; the bridge answers it beside `initialize`.
 *   · `initialize` is served at the version the bridge's rule picks (`negotiateBridgeHandshake`, #4646 step 1; never
 *     `2026-07-28`, #3109), and one sent without `capabilities` or `clientInfo` is served with empty ones, not refused.
 *   · A read of a resource this bridge does not serve fails with -32002 and names a renamed URI (#3412). The SDK
 *     re-codes -32002 as -32602. A `skill://` file goes on to the SDK, and `bridgeTransport` sends its not-found as -32002.
 * Everything else goes to the SDK unchanged. Pure, so it is tested without a process.
 */
export const compatAnswer = (m: WireMessage, arm: BridgeArm): { reply: unknown } | { forward: WireMessage } => {
  if (typeof m !== 'object' || m === null || typeof m.method !== 'string' || m.id === undefined || m.id === null) return { forward: m };
  const view = armView(arm);
  const id = m.id;
  if (m.method === 'server/discover') {
    return { reply: { jsonrpc: '2.0', id, result: {
      resultType: 'complete', protocolVersions: [...BRIDGE_PROTOCOL_VERSIONS], capabilities: capabilitiesFor(arm), serverInfo: SERVER_INFO,
      ...(view.note ? { instructions: BRIDGE_INSTRUCTIONS } : {}), _meta: { [META.serverInfo]: SERVER_INFO },
    } } };
  }
  if (m.method === 'initialize') {
    const p = m.params && typeof m.params === 'object' ? m.params : {};
    return { forward: { ...m, params: { ...p, protocolVersion: negotiateBridgeHandshake(p.protocolVersion), capabilities: p.capabilities ?? {}, clientInfo: p.clientInfo ?? { name: 'unknown', version: '0' } } } };
  }
  if (m.method === 'resources/read' && view.resources) {
    const uri = m.params?.uri;
    // A `skill://` file is the skills extension's to answer (#4646 step 2).
    if (!RESOURCES.some((r) => r.uri === uri) && !(typeof uri === 'string' && view.skills && uri.startsWith(SKILL_BASE))) {
      const now = typeof uri === 'string' ? RENAMED_RESOURCES[uri] : undefined;
      const message = now ? `Resource not found: ${uri} was renamed; read ${now}` : `Resource not found: ${uri}`;
      return { reply: { jsonrpc: '2.0', id, error: { code: RESOURCE_NOT_FOUND, message, data: now ? { uri, renamedTo: now } : { uri } } } };
    }
  }
  return { forward: m };
};

/** JSON-RPC's method-not-found code. */
export const METHOD_NOT_FOUND = -32601;
/** The bridge's -32601 message, as it was before the SDK (#4652): it names the method. The SDK's own is a bare
 *  `Method not found`, so `bridgeTransport` puts the name back on the way out. */
export const methodNotFound = (method: string): string => `method not found: ${method}`;

/** The SDK's stdio transport with `compatAnswer` in front of it. Reading, framing and sending are the SDK's own; one
 *  difference from the hand-written loop is the SDK's: a line that is not JSON is skipped, not answered -32700. On the
 *  way out, a -32601 error names the method it answers (#4652), as the hand-written loop's did. */
export const bridgeTransport = (inner: Transport, arm: BridgeArm): Transport => {
  /** The method of each request forwarded to the SDK and not yet answered, by id. */
  const asked = new Map<string | number, string>();
  // A `skill://` file the skills extension does not serve: the SDK answers -32602 with `data: { uri }`, and the bridge
  // sends it as -32002, the code an unknown `prism3://` URI gets (#4661 review). The message stays the SDK's. Such a read
  // is in both maps; both are looked up and cleared before the one send.
  const skillReads = new Map<number | string, string>();
  const outer: Transport = {
    start: () => inner.start(),
    send: (msg, options) => {
      const m = msg as { id?: string | number | null; error?: { code?: number; message?: string; data?: { uri?: unknown } } };
      if (m.id !== undefined && m.id !== null && ('result' in m || 'error' in m)) {
        const method = asked.get(m.id);
        const uri = skillReads.get(m.id);
        asked.delete(m.id);
        skillReads.delete(m.id);
        const e = m.error;
        if (method !== undefined && e?.code === METHOD_NOT_FOUND) return inner.send({ ...m, error: { ...e, message: methodNotFound(method) } } as JSONRPCMessage, options);
        if (uri !== undefined && e?.code === -32602 && e.data !== undefined && JSON.stringify(Object.keys(e.data)) === '["uri"]' && e.data.uri === uri) {
          return inner.send({ ...m, error: { ...e, code: RESOURCE_NOT_FOUND } } as JSONRPCMessage, options);
        }
      }
      return inner.send(msg, options);
    },
    close: () => inner.close(),
    setProtocolVersion: (v: string) => inner.setProtocolVersion?.(v),
  };
  inner.onmessage = (msg, extra) => {
    const c = compatAnswer(msg as WireMessage, arm);
    if ('reply' in c) { void inner.send(c.reply as JSONRPCMessage).catch((e: Error) => outer.onerror?.(e)); return; }
    const f = c.forward;
    if (f && typeof f === 'object' && typeof f.method === 'string' && f.id !== undefined && f.id !== null) {
      asked.set(f.id, f.method);
      if (f.method === 'resources/read' && typeof f.params?.uri === 'string' && f.params.uri.startsWith(SKILL_BASE)) skillReads.set(f.id, f.params.uri);
    }
    outer.onmessage?.(f as JSONRPCMessage, extra);
  };
  inner.onerror = (e) => outer.onerror?.(e);
  inner.onclose = () => outer.onclose?.();
  return outer;
};

/** Largest JSON-RPC line read from stdio: the WebSocket's own ceiling, so a `run-code` body the plugin accepts is never
 *  cut off at the SDK's 10 MB default. */
const MAX_STDIO_MESSAGE = MAX_MESSAGE;

/**
 * The MCP server: the four tools, the five resources, the skills and the note, by arm, and figma_run as a task. Progress
 * and console lines during a run go out as `notifications/progress` (with the caller's `progressToken`) and
 * `notifications/message`. Built on the SDK's `McpServer` since #4646 step 2, because the skills extension attaches to
 * one; the tools and the task methods are still set on its underlying `Server`, by hand, as before. Returns that `Server`.
 */
export const createMcpServer = async (bridge: Bridge, opts: RpcOptions = {}): Promise<Server> => {
  const { McpServer, ProtocolError, ProtocolErrorCode } = await import('@modelcontextprotocol/server');
  const arm = opts.arm ?? DEFAULT_ARM;
  const view = armView(arm);
  const { extensions: _declaredByAttach, ...constructed } = capabilitiesFor(arm, TASKS_SINCE);
  const mcp = new McpServer(SERVER_INFO, {
    // Everything a session can be offered but the skills extension, which `attach` declares; `initialize` answers with
    // what its arm and revision get (below).
    capabilities: constructed,
    ...(view.note ? { instructions: BRIDGE_INSTRUCTIONS } : {}),
    // `initialize` is answered at the version `compatAnswer` hands it, which this list must hold.
    supportedProtocolVersions: [...BRIDGE_PROTOCOL_VERSIONS],
  });
  const server = mcp.server;

  /** The revision the last `initialize` on this connection answered with (#4656 item 3). Tasks, and figma_run's
   *  `execution`, are this session's only when it is `TASKS_SINCE` or later, as its capabilities say. Before any
   *  `initialize` there is no session, so none are. */
  let revision: string | undefined;
  const tasksOffered = () => revision !== undefined && revision >= TASKS_SINCE;

  // `toolsFor`'s JSON Schemas are plain objects; the SDK's type wants its own schema type for them. Below `TASKS_SINCE`
  // no tool carries `execution`, a field those revisions do not define.
  server.setRequestHandler('tools/list', () => ({
    tools: (tasksOffered() ? toolsFor(arm) : toolsFor(arm).map(({ execution: _, ...t }: { execution?: unknown }) => t)) as never,
  }));

  type Outcome = Extract<RecordLine, { kind: 'outcome' }>['outcome'];
  type Late = Extract<RecordLine, { kind: 'late' }>['outcome'];
  /** figma_run's checks, before anything is queued: the refusal to answer with, or what to start and how to record it. */
  const prepareRun = (a: Record<string, unknown>):
    { refusal: ReturnType<typeof text> } | { cmd: string; args: unknown; timeoutMs: number; outcome(o: Outcome, error?: unknown): void; late(o: Late, error?: unknown): void } => {
    const seq = opts.record?.attempt(arm, a.cmd, a.args ?? {});
    const outcome = (o: Outcome, error?: unknown) => { if (seq !== undefined) opts.record!.outcome(seq, o, error); };
    const late = (o: Late, error?: unknown) => { if (seq !== undefined) opts.record!.late(seq, o, error); };
    if (typeof a.cmd !== 'string') { outcome('refused-by-bridge', 'figma_run needs cmd'); return { refusal: text({ error: 'figma_run needs cmd' }, true) }; }
    if (a.cmd === CONTEXT_CMD && !view.context) { outcome('refused-by-bridge', ARM_REFUSAL); return { refusal: text({ error: ARM_REFUSAL }, true) }; }
    const timeoutMs = typeof a.timeoutMs === 'number' && a.timeoutMs > 0 ? Math.min(a.timeoutMs, 3_600_000) : 600_000;
    return { cmd: a.cmd, args: a.args ?? {}, timeoutMs, outcome, late };
  };
  /** A settled run's `--record` outcome. A result that arrived is the tool working: `ok: false` is the action's verdict. */
  const recordOutcome = (outcome: (o: Late, error?: unknown) => void, o: RunOutcome) => {
    if ('error' in o) { outcome('tool-error', o.error); return; }
    const env = o.result as { ok?: unknown; error?: unknown };
    outcome(env.ok === false ? 'not-ok' : 'ok', env.ok === false ? env.error : undefined);
  };
  /** One request's stream: progress to its `progressToken`, if it sent one, and console lines as `notifications/message`. */
  const streamTo = (ctx: { mcpReq: { _meta?: { progressToken?: string | number }; notify(n: unknown): Promise<void>; log(level: 'info', data: unknown, logger?: string): Promise<void> } }): RunHooks => {
    const token = ctx.mcpReq._meta?.progressToken;
    const progress = createProgressCounter();
    return {
      onProgress: (p) => {
        if (token !== undefined) void ctx.mcpReq.notify({ method: 'notifications/progress', params: { progressToken: token, progress: progress(p), message: `${p.phase} ${p.done}/${p.total}` } }).catch(() => undefined);
      },
      onLog: (line) => { void ctx.mcpReq.log('info', line, 'figma').catch(() => undefined); },
    };
  };

  /**
   * #4646 step 3: before a confirm that overwrites hand edits, ask the person, when this session can be asked
   * (`elicitsFor`). Null means go on; otherwise nothing is queued and this is figma_run's answer. A check that found no
   * hand edits under `overwrite` discards nothing, so it is not asked. An answer that is not an accept, or a question
   * that could not be put, writes nothing.
   */
  type Ctx = Parameters<typeof streamTo>[0] & { mcpReq: { elicitInput(params: unknown, options?: unknown): Promise<{ action: string }> } };
  const askBeforeWrite = async (p: { cmd: string; args: unknown; outcome(o: Outcome, error?: unknown): void }, ctx: Ctx): Promise<ReturnType<typeof text> | null> => {
    if (!overwritesHandEdits(p.cmd, p.args) || !elicitsFor(revision, server.getClientCapabilities())) return null;
    const sets = handEditsOverwritten(bridge.checkFor((p.args as { previewHash?: unknown }).previewHash), p.args);
    if (sets !== null && sets.length === 0) return null;
    let why: 'decline' | 'cancel' | 'error';
    let detail: string | undefined;
    try {
      const answer = await ctx.mcpReq.elicitInput({ mode: 'form', message: overwriteQuestion(sets), requestedSchema: { type: 'object', properties: {} } }, { timeout: ELICIT_TIMEOUT_MS });
      if (answer.action === 'accept') return null;
      why = answer.action === 'decline' ? 'decline' : 'cancel';
    } catch (e) { why = 'error'; detail = (e as Error).message; }
    const error = overwriteRefusal(why, detail);
    p.outcome('refused-by-bridge', error);
    return text({ error }, true);
  };

  server.setRequestHandler('tools/call', async (req, ctx) => {
    const name = req.params.name;
    const a = (req.params.arguments ?? {}) as Record<string, unknown>;
    if (name === 'figma_status') {
      const st = bridge.status();
      return text({ ...st, commands: view.context ? st.commands : st.commands.filter((c) => c !== CONTEXT_CMD), ...(view.note ? { readFirst: BRIDGE_INSTRUCTIONS } : {}) });
    }
    if (name === 'figma_logs') {
      return text(bridge.logs(typeof a.since === 'number' ? a.since : 0, typeof a.limit === 'number' ? a.limit : 200));
    }
    if (name === 'figma_run') {
      const p = prepareRun(a);
      if ('refusal' in p) return p.refusal;
      const refused = await askBeforeWrite(p, ctx as unknown as Ctx);
      if (refused) return refused;
      const run = bridge.start(p.cmd, p.args, p.timeoutMs);
      const stop = run.listen(streamTo(ctx));
      // The clock starts when the command is sent, as before: time spent queued behind another command is not counted.
      await run.sent;
      let timer: NodeJS.Timeout | undefined;
      const o = await Promise.race([run.done, new Promise<null>((r) => { timer = setTimeout(() => r(null), p.timeoutMs); })]);
      clearTimeout(timer);
      stop();
      if (o === null) {
        // #4646: the run goes on. Its id is stable, so the caller fetches the result instead of sending the command again.
        const error = `no result for '${p.cmd}' (${run.id}) within ${p.timeoutMs} ms — the plugin may still be running it. Don't send it again: figma_result {"id": "${run.id}"} returns its result once it lands`;
        p.outcome('tool-error', error);
        // #4656 item 2: the run goes on, so how it ends is recorded too, as a `late` line under the same seq.
        void run.done.then((late) => recordOutcome(p.late, late));
        return text({ error, runId: run.id }, true);
      }
      recordOutcome(p.outcome, o);
      return runResult(o);
    }
    if (name === 'figma_result') {
      const id = typeof a.id === 'string' ? a.id : '';
      const run = bridge.run(id);
      if (!run) return text({ error: `no run ${JSON.stringify(id)} on this bridge: it restarted since, or the run is older than the last ${RUN_KEEP} that finished` }, true);
      const v = run.view();
      if (v.status === 'completed') return text(v.result);
      if (v.status === 'failed') return text({ error: v.error, runId: v.id }, true);
      return text({ runId: v.id, cmd: v.cmd, status: v.status, createdAt: v.createdAt, lastUpdatedAt: v.lastUpdatedAt, progress: v.progress });
    }
    throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Unknown tool: ${name}`);
  });

  /*
   * TASKS (#4646 step 1), the `2025-11-25` form. A `tools/call` of figma_run that carries `params.task` is answered at
   * once with the run as a task (`CreateTaskResult`): its id is the run's id, so `figma_result` and the task methods name
   * the same run, and a reconnect mid-run (`awaitingReconnect`, #2497) goes on being that task. `tasks/get` gives its
   * status, with the last progress reading as `statusMessage`; the request's `progressToken` keeps getting
   * `notifications/progress` for the task's life; `tasks/result` waits for the run and returns what the plain call would
   * have, figma_run's result envelope; `notifications/tasks/status` goes out when it settles. A task `failed` only when
   * the bridge gave up on the run (no plugin, a drop it did not come back from), and `statusMessage` says why.
   *
   * The SDK validates a `tools/call` result as a `CallToolResult` and refuses a `CreateTaskResult` (its `2025-11-25`
   * tasks have no runtime), so a task-augmented figma_run is answered in front of that check, the way the MCP project's
   * own `ext-tasks` receiver binds its task methods. That reaches into the SDK's handler map; the version is pinned,
   * and the `tasks/…` arms of `test-agent-bridge.ts` fail by name if it moves.
   */
  const { RELATED_TASK_META_KEY } = await import('@modelcontextprotocol/server');
  type TaskRec = { run: Run; ttl: number | null; expiresAt: number | null };
  const tasks = new Map<string, TaskRec>();
  const taskView = (t: TaskRec) => {
    const v = t.run.view();
    const statusMessage = v.status === 'failed' ? v.error : v.status === 'working' ? v.progress : null;
    return { taskId: v.id, status: v.status, ttl: t.ttl, createdAt: v.createdAt, lastUpdatedAt: v.lastUpdatedAt, pollInterval: TASK_POLL_MS, ...(statusMessage ? { statusMessage } : {}) };
  };
  const expireTasks = () => {
    const at = Date.now();
    for (const [id, t] of tasks) if (t.expiresAt !== null && at >= t.expiresAt) tasks.delete(id);
    // The oldest finished tasks go first past `RUN_KEEP`; a task still working is never dropped.
    let finished = [...tasks.values()].filter((t) => t.run.view().status !== 'working').length;
    for (const [id, t] of tasks) { if (finished <= RUN_KEEP) break; if (t.run.view().status !== 'working') { tasks.delete(id); finished--; } }
  };
  const taskOf = (taskId: string): TaskRec => {
    expireTasks();
    const t = tasks.get(taskId);
    if (!t) throw new ProtocolError(ProtocolErrorCode.InvalidParams, `unknown or expired task: ${taskId}`);
    return t;
  };
  const startTask = async (params: { arguments?: unknown; task?: unknown }, ctx: Ctx) => {
    const aug = params.task;
    if (aug === null || typeof aug !== 'object' || Array.isArray(aug)) throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'task must be an object, such as {} or { "ttl": 3600000 }');
    const asked = (aug as { ttl?: unknown }).ttl;
    if (asked !== undefined && !(typeof asked === 'number' && Number.isInteger(asked) && asked >= 0)) throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'task.ttl must be a whole number of milliseconds, 0 or more');
    const p = prepareRun((params.arguments ?? {}) as Record<string, unknown>);
    // Refused before anything is queued: answered at once as a plain result, which a task requester accepts.
    if ('refusal' in p) return p.refusal;
    // #4646 step 3: the person is asked before the task exists, so a decline is a plain result too and no task is made.
    const refused = await askBeforeWrite(p, ctx);
    if (refused) return refused;
    const run = bridge.start(p.cmd, p.args, p.timeoutMs);
    run.listen(streamTo(ctx));
    const ttl = asked === undefined ? null : Math.min(asked as number, TASK_TTL_MAX_MS);
    const t: TaskRec = { run, ttl, expiresAt: ttl === null ? null : Date.now() + ttl };
    tasks.set(run.id, t);
    expireTasks();
    void run.done.then((o) => {
      recordOutcome(p.outcome, o);
      // After this turn, so a run that settles at once (no plugin) is still announced after the reply that names it.
      setImmediate(() => { void server.notification({ method: 'notifications/tasks/status', params: taskView(t) }).catch(() => undefined); });
    });
    return { task: taskView(t) };
  };
  const handlers = (server as unknown as { _requestHandlers?: unknown })._requestHandlers;
  if (!(handlers instanceof Map) || typeof handlers.get('tools/call') !== 'function' || typeof handlers.get('initialize') !== 'function') {
    throw new Error(`figma-bridge: the MCP SDK no longer keeps its request handlers where tasks expect them; run the version pinned in package.json`);
  }
  // The capabilities an `initialize` answers with are the negotiated revision's: no tasks below `TASKS_SINCE`.
  const plainInit = handlers.get('initialize') as (req: unknown, ctx: unknown) => Promise<{ protocolVersion: string; capabilities: unknown }>;
  handlers.set('initialize', async (req: unknown, ctx: unknown) => {
    // Set before the SDK's handler yields, from the revision `compatAnswer` already negotiated, so a request read right
    // after this `initialize` sees its session.
    const asked = (req as { params?: { protocolVersion?: unknown } })?.params?.protocolVersion;
    if (typeof asked === 'string') revision = asked;
    const r = await plainInit(req, ctx);
    revision = r.protocolVersion;
    return { ...r, capabilities: capabilitiesFor(arm, r.protocolVersion) };
  });
  const plainCall = handlers.get('tools/call') as (req: { params?: Record<string, unknown> }, ctx: unknown) => Promise<unknown>;
  handlers.set('tools/call', (req: { params?: Record<string, unknown> }, ctx: Ctx) => {
    const params = req?.params;
    if (params && typeof params === 'object' && 'task' in params) {
      if (params.name === 'figma_run' && tasksOffered()) return startTask(params, ctx);
      // #4656 item 3: a session not offered tasks is served the plain call, the `task` field ignored, as MCP has a
      // receiver do with task metadata for a request it declared no task support for.
      if (!tasksOffered()) { const { task: _, ...plain } = params; return plainCall({ ...req, params: plain }, ctx); }
    }
    return plainCall(req, ctx);
  });
  // The SDK leaves the `2025-11-25` task methods out of its method type but serves them: its codec validates each request.
  // A session not offered tasks does not have them (#4656 item 3), so each answers it -32601, as for any method it lacks.
  const setTaskHandler = server.setRequestHandler.bind(server) as unknown as (method: 'tasks/get' | 'tasks/list' | 'tasks/result', handler: (req: { params: { taskId: string } }) => unknown) => void;
  const ifOffered = <R>(method: string, h: (req: { params: { taskId: string } }) => R) => (req: { params: { taskId: string } }): R => {
    if (!tasksOffered()) throw new ProtocolError(ProtocolErrorCode.MethodNotFound, methodNotFound(method));
    return h(req);
  };
  setTaskHandler('tasks/get', ifOffered('tasks/get', (req) => taskView(taskOf(req.params.taskId))));
  setTaskHandler('tasks/list', ifOffered('tasks/list', () => { expireTasks(); return { tasks: [...tasks.values()].map(taskView) }; }));
  setTaskHandler('tasks/result', ifOffered('tasks/result', async (req) => {
    const t = taskOf(req.params.taskId);
    const o = await t.run.done;
    return { ...runResult(o), _meta: { [RELATED_TASK_META_KEY]: { taskId: t.run.id } } };
  }));

  // An arm below 2 has no resources and no skills, so it registers neither and the SDK answers their methods -32601 (#3440).
  if (view.skills) {
    // The skills first: `attach` refuses a server that already serves resources. A source of our own, not the SDK's
    // catalog, so the skill files are not listed in `resources/list` (see `BRIDGE_SKILLS`).
    const { SkillsExtension, skillEntry } = await import('@modelcontextprotocol/server/ext/skills');
    // A skill that cannot be read or does not validate is left out and named on stderr; the bridge still starts.
    const say = (line: string) => process.stderr.write(`[figma-bridge] skill ${line}\n`);
    const served: { name: string; files: Record<string, string> }[] = [];
    const entries: Awaited<ReturnType<typeof skillEntry>>[] = [];
    for (const f of loadSkillFiles()) {
      if ('error' in f) { say(`${f.name}: ${f.error}`); continue; }
      try { entries.push(await skillEntry(f.name, f.files, { baseUri: SKILL_BASE })); served.push(f); }
      catch (e) { say(`${f.name}: not served — ${(e as Error).message}`); }
    }
    const fileAt = (uri: string): string | undefined => {
      if (!uri.startsWith(SKILL_BASE)) return undefined;
      const [name, ...rest] = uri.slice(SKILL_BASE.length).split('/');
      return served.find((f) => f.name === name)?.files[rest.join('/')];
    };
    new SkillsExtension({
      source: {
        list: async () => ({ skills: entries }),
        get: async (uri) => entries.find((e) => e.uri === uri),
        read: async (uri) => {
          const text = fileAt(uri);
          return text === undefined ? undefined : { text, mimeType: uri.endsWith('.md') ? 'text/markdown' : uri.endsWith('.js') ? 'text/javascript' : 'text/plain' };
        },
      },
    }).attach(mcp);
    const declared = JSON.stringify(server.getCapabilities().extensions);
    if (declared !== JSON.stringify(CAPABILITIES.extensions)) {
      throw new Error(`figma-bridge: the SDK declared the skills extension as ${declared}, but initialize answers ${JSON.stringify(CAPABILITIES.extensions)}`);
    }
  }
  if (view.resources) {
    // The five static resources, on the same registry as the skill files. An unknown URI never reaches here:
    // `compatAnswer` answers it with -32002.
    for (const r of RESOURCES) {
      mcp.registerResource(r.name, r.uri, { description: r.description, mimeType: r.mimeType }, () => {
        const got = loadResources().get(r.uri)!;
        if ('error' in got) throw new ProtocolError(ProtocolErrorCode.InternalError, got.error);
        return { contents: [{ uri: r.uri, mimeType: r.mimeType, text: got.text, _meta: { 'prism3/engineVersion': ENGINE_VERSION } }] };
      });
    }
  }
  return server;
};

/* ── I/O shell ──────────────────────────────────────────────────────────────────────────────────────── */

const isMain = isEntry(import.meta.url);
if (isMain) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--port');
  const port = i >= 0 ? Number(argv[i + 1]) : process.env.PRISM3_BRIDGE_PORT ? Number(process.env.PRISM3_BRIDGE_PORT) : DEFAULT_PORT;
  if (!Number.isInteger(port) || port < 0 || port > 65535) { process.stderr.write(`[figma-bridge] bad port ${argv[i + 1]}\n`); process.exit(2); }
  const g = argv.indexOf('--grace-ms');
  const graceMs = g >= 0 ? Number(argv[g + 1]) : process.env.PRISM3_BRIDGE_GRACE_MS ? Number(process.env.PRISM3_BRIDGE_GRACE_MS) : DEFAULT_GRACE_MS;
  if (!Number.isInteger(graceMs) || graceMs < 0) { process.stderr.write(`[figma-bridge] bad grace ${argv[g + 1]}\n`); process.exit(2); }
  const c = argv.indexOf('--config');
  const configPath = c >= 0 ? resolve(argv[c + 1]) : bridgeConfigPath();
  const say = (s: string) => process.stderr.write(`[figma-bridge] ${s}\n`);
  let loaded: { secret: Buffer; created: boolean };
  try { loaded = loadSecret(configPath, { rotate: argv.includes('--rotate'), say }); } catch (e) {
    say(`cannot read or write the pairing secret at ${configPath} — ${(e as Error).message}`);
    process.exit(1);
  }
  if (loaded.created) say(`a new pairing secret is in ${configPath}${argv.includes('--rotate') ? ': every paired plugin asks for a code again' : ''}`);
  const arm = parseArm(process.env.PRISM3_BRIDGE_ARM);
  if (arm === null) { say(`bad PRISM3_BRIDGE_ARM ${process.env.PRISM3_BRIDGE_ARM}: 0, 1 or 2`); process.exit(2); }
  // --record <file>: one JSON line per figma_run attempt and outcome (#3440). Appended, so a restart keeps the earlier lines.
  const rec = argv.indexOf('--record');
  const recordPath = rec >= 0 ? argv[rec + 1] : undefined;
  if (rec >= 0 && (!recordPath || recordPath.startsWith('--'))) { say('--record needs a file'); process.exit(2); }
  const record = recordPath ? createRecorder((line) => appendFileSync(resolve(recordPath), line)) : undefined;
  const pairing = createPairing(loaded.secret, say);
  if (argv.includes('--pair')) pairing.request();
  const bridge = createBridge({ graceMs, pairing });
  // The five resources are read now, once: what they serve is this checkout's commit (#3300).
  for (const [uri, r] of loadResources()) if ('error' in r) say(`resource ${uri}: ${r.error}`);
  // The SDK loads first, so a checkout without `npm ci` stops here, before the socket opens (#4646).
  const { StdioServerTransport } = await import('@modelcontextprotocol/server/stdio');
  const server = await createMcpServer(bridge, { arm: arm as BridgeArm, record });
  const bound = await listen(bridge, port).catch((e: Error) => {
    process.stderr.write(`[figma-bridge] cannot listen on localhost:${port} — ${e.message}\n`);
    process.exit(1);
  });
  // Requests are answered as each finishes, so a long figma_run does not block figma_status. stdin closing ends the bridge.
  server.onerror = (e) => say(`mcp: ${e.message}`);
  server.onclose = () => { void bound.close().then(() => process.exit(0)); };
  await server.connect(bridgeTransport(new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: MAX_STDIO_MESSAGE }), arm as BridgeArm));
  process.stderr.write(`[figma-bridge] listening on localhost:${bound.port} — MCP on stdio — tools: ${TOOLS.map((t) => t.name).join(', ')}${arm === DEFAULT_ARM ? '' : ` — arm ${arm}`}${recordPath ? ` — recording to ${recordPath}` : ''}\n`);
}
