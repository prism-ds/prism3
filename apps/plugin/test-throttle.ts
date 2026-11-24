/**
 * #4476 (with #724) — A RUN STAYS BOUNDED WHILE A HIDDEN FIGMA WINDOW THROTTLES ITS TIMERS.
 *
 *   npx tsx apps/plugin/test-throttle.ts
 *
 * Seen by the owner (2026-11-23): a 45-table style guide sat on table 28 for about an hour, then finished within moments
 * once the window was visible. While Figma's window is hidden, Chromium runs a timer at the next whole second, and after
 * about five minutes at the next whole minute, so every `setTimeout(0)` hand-back can cost a minute. The fix
 * (`handBack`, `src/pace.ts`, owner decision A on #4476): hand back only once 50 ms of work has run, time each
 * hand-back, and while two in a row come back at least 1 s late, do more work between them (up to the last one's delay,
 * capped at 15 s). The progress readings say `throttled` from then on, for the progress line's note.
 *
 * THE FAKE CLOCK. `work(ms)` moves time forward by work; `wait(0)` moves it to when the fake host runs a 0 ms timer:
 * `prompt` (4 ms on), `second` (the next whole second), `minute` (the next whole minute). Nothing here reads a real clock.
 *
 * OVER `handBack` ITSELF:
 *   · `pace/warm` (#724): 162 offers around no work take no hand-back at all;
 *   · `pace/foreground`: on a prompt host, 30 ms units of work: every stretch between two hand-backs is at least 50 ms
 *     and at most 80 ms (50 plus one unit), so the visible window answers as often as before; never throttled;
 *   · `bound/minute`: 400 units of 700 ms (280 s of work) on a minute-aligned host finish within five times the work
 *     plus three minutes. A hand-back at every offer, the code before #4476, takes about 400 minutes;
 *   · `bound/second`: the same work on a second-aligned host finishes within 2.5 times the work;
 *   · `throttle/detect`: a minute-aligned host reads as throttled; a prompt one never does;
 *   · `throttle/one-slow`: one hand-back 1.5 s late among prompt ones (a long reconcile in the foreground) is not
 *     throttling;
 *   · `throttle/recover`: once the host turns prompt again, the next stretch of work is back to at most 80 ms;
 *   · `wait/kept`: a wait the executor asks for (500 ms, the reference back-off) is always waited, and a long one is
 *     never read as throttling;
 *   · `before`: the `before` hook runs once per hand-back taken, never for an offer skipped;
 *   · `every`: a boundary that hands back at every pass on purpose (a page, a set) still does on a prompt host, and joins
 *     the throttled pace while throttled.
 *
 * THROUGH THE REAL `main.ts` (the run the owner saw): a style guide of 60 tables, with `Date.now` stepping 20 ms a call as
 * work and the global `setTimeout` running a 0 ms timer at the next whole minute:
 *   · `main/bound`: the run's time waiting is within four times its work plus three minutes. Before #4476 the run handed
 *     back after every table, so it waited about 60 minutes;
 *   · `main/note`: its last progress reading says `throttled`;
 *   · `main/foreground`: the same run on a prompt host, `Date.now` stepping 60 ms a call: no reading says `throttled`,
 *     and the run hands back at least once a table, so the window answers as often as before.
 *
 * INDEPENDENCE (docs/34): every bound is a literal typed here (50, 80, five times plus three minutes, 2.5 times, 60
 * tables), and every elapsed time is read off the test's own clock, never off a figure the run reports.
 *
 * MUTATIONS, each failing by name: the budget test in `handBack` dropped (a hand-back at every offer) → `pace/warm`,
 * `bound/minute`, `main/bound`; the throttled pace never raised (`pace` kept at `PACE_MS`) → `bound/minute`, `main/bound`;
 * `THROTTLE_RUN` read as 1 → `throttle/one-slow`; `seen` never set → `throttle/detect`, `main/note`; the throttled
 * pace not dropped on a prompt hand-back → `throttle/recover`; a long asked-for wait counted → `wait/kept`; `every`
 * skipping by the 50 ms budget like an offer → `every` (and `test-open-large-file.ts`); `main.ts`'s
 * style guide given no `yieldTo` (the executor's `realYield`) → `main/bound`, `main/note`.
 */
import { handBack, PACE_MS } from './src/pace';

let failed = 0;
let executed = 0;
const ok = (cond: boolean, label: string): void => {
  executed++;
  if (cond) console.log(`  ✓ ${label}`);
  else { failed++; console.error(`  ✗ ${label}`); }
};
const section = (s: string) => console.log(`\n${s}`);
const SEC = 1000;
const MIN = 60 * SEC;

type Host = 'prompt' | 'second' | 'minute';
/** The fake clock: time, the host's timer rule, and a log of each wait (asked ms, how long it took). */
const fakeClock = (host: Host) => {
  const c = {
    t: 7 * SEC + 123,
    host: host as Host,
    waits: [] as { ms: number; took: number }[],
    now: () => c.t,
    work: (ms: number) => { c.t += ms; },
    wait: async (ms: number) => {
      const from = c.t;
      const due = c.t + ms;
      c.t = c.host === 'prompt' ? due + 4 : c.host === 'second' ? Math.floor(due / SEC) * SEC + SEC : Math.floor(due / MIN) * MIN + MIN;
      c.waits.push({ ms, took: c.t - from });
    },
  };
  return c;
};

section('handBack — how often a run hands the thread back, and what it reads as throttling');
{
  const c = fakeClock('prompt');
  const hand = handBack(c);
  for (let i = 0; i < 162; i++) await hand();
  ok(c.waits.length === 0, `pace/warm (#724): 162 offers around no work take no hand-back (${c.waits.length} taken)`);
}
{
  const c = fakeClock('prompt');
  const hand = handBack(c);
  const gaps: number[] = [];
  let since = c.t;
  for (let i = 0; i < 200; i++) {
    c.work(30);
    const n = c.waits.length;
    await hand();
    if (c.waits.length > n) { gaps.push(c.t - c.waits[c.waits.length - 1].took - since); since = c.t; }
  }
  ok(PACE_MS === 50 && gaps.length > 0 && Math.min(...gaps) >= 50 && Math.max(...gaps) <= 80 && !hand.throttled,
    `pace/foreground: on a prompt host every stretch of work between hand-backs is 50–80 ms (${Math.min(...gaps)}–${Math.max(...gaps)} ms over ${gaps.length} hand-backs), never throttled (${hand.throttled})`);
}
for (const [host, factor, plus, name] of [['minute', 5, 3 * MIN, 'bound/minute'], ['second', 2.5, 0, 'bound/second']] as const) {
  const c = fakeClock(host);
  const hand = handBack(c);
  const start = c.t;
  const W = 400 * 700;
  for (let i = 0; i < 400; i++) { c.work(700); await hand(); }
  const total = c.t - start;
  ok(total <= factor * W + plus,
    `${name}: 280 s of work on a ${host}-aligned host finishes within ${factor} times the work${plus ? ' plus three minutes' : ''} (${(total / SEC).toFixed(0)} s, ${c.waits.length} hand-backs; bound ${((factor * W + plus) / SEC).toFixed(0)} s)`);
}
{
  const hidden = fakeClock('minute');
  const h1 = handBack(hidden);
  for (let i = 0; i < 20; i++) { hidden.work(60); await h1(); }
  const shown = fakeClock('prompt');
  const h2 = handBack(shown);
  for (let i = 0; i < 20; i++) { shown.work(60); await h2(); }
  ok(h1.throttled && !h2.throttled, `throttle/detect: a minute-aligned host reads as throttled (${h1.throttled}), a prompt one does not (${h2.throttled})`);
}
{
  const c = fakeClock('prompt');
  const hand = handBack(c);
  const real = c.wait;
  let n = 0;
  c.wait = async (ms) => { n++; if (n === 3) { c.t += 1500; c.waits.push({ ms, took: 1500 }); return; } await real(ms); };
  for (let i = 0; i < 20; i++) { c.work(60); await hand(); }
  ok(!hand.throttled, `throttle/one-slow: one hand-back 1.5 s late among prompt ones is not throttling (${hand.throttled})`);
}
{
  const c = fakeClock('minute');
  const hand = handBack(c);
  for (let i = 0; i < 100; i++) { c.work(700); await hand(); }
  const was = hand.throttled;
  c.host = 'prompt';
  // The first hand-back after the window shows ends the long stretch; every stretch after it is short again.
  let first = true;
  const gaps: number[] = [];
  let since = c.t;
  for (let i = 0; i < 600; i++) {
    c.work(30);
    const n = c.waits.length;
    await hand();
    if (c.waits.length > n) { if (!first) gaps.push(c.t - c.waits[c.waits.length - 1].took - since); first = false; since = c.t; }
  }
  ok(was && gaps.length > 0 && Math.max(...gaps) <= 80,
    `throttle/recover: throttled while hidden (${was}), then once the host is prompt, every stretch after the first hand-back is at most 80 ms (${gaps.length ? Math.max(...gaps) : 'none'} ms over ${gaps.length})`);
}
{
  const c = fakeClock('prompt');
  const hand = handBack(c);
  await hand(500);
  const asked = c.waits[0]?.ms;
  await hand(5000); await hand(5000); await hand(5000);
  ok(asked === 500 && c.waits.length === 4 && !hand.throttled,
    `wait/kept: an asked-for wait is always waited (${asked} ms, ${c.waits.length} of 4), and long ones are not throttling (${hand.throttled})`);
}
{
  const c = fakeClock('prompt');
  let before = 0;
  const hand = handBack(c, () => { before++; });
  for (let i = 0; i < 100; i++) { c.work(10); await hand(); }
  ok(before === c.waits.length && before > 0 && before < 100, `before: the hook runs once per hand-back taken (${before} for ${c.waits.length} taken of 100 offers)`);
}

{
  // `every`: a boundary that hands back at each pass (a page, a set, #3110/#3177) still does on a prompt host, around no
  // work at all; on a minute-aligned host it joins the throttled pace once throttling is read.
  const shown = fakeClock('prompt');
  const h1 = handBack(shown);
  for (let i = 0; i < 30; i++) await h1.every();
  const hidden = fakeClock('minute');
  const h2 = handBack(hidden);
  for (let i = 0; i < 30; i++) { hidden.work(60); await h2.every(); }
  ok(shown.waits.length === 30 && h2.throttled && hidden.waits.length <= 4,
    `every: on a prompt host every pass hands back (${shown.waits.length} of 30); throttled, 30 passes of 60 ms take at most 4 (${hidden.waits.length})`);
}

/* ── through the real main.ts ─────────────────────────────────────────────────────────────────────────────────── */
section('a style guide through main.ts, on a host that runs a 0 ms timer at the next whole minute');
const TABLES = 60;
const cols = Array.from({ length: TABLES }, (_, i) => ({ id: `C:${i}`, name: `c${i}`, modes: [{ modeId: `${i}:0`, name: 'Value' }], defaultModeId: `${i}:0` }));
const vars = cols.map((c, i) => ({ id: `V:${i}`, name: `${c.name}/100`, variableCollectionId: c.id, resolvedType: 'COLOR', description: '', valuesByMode: { [`${i}:0`]: { r: 1, g: 0, b: 0, a: 1 } } }));
const SETS = [{ name: '_style-guide-swatches', type: 'COMPONENT_SET', children: [] }, { name: '_style-guide-text-cells', type: 'COMPONENT_SET', children: [] }];
// One page and no token pages: every table is a named skip, so each costs the run its per-table hand-back and no rows.
const root = {
  name: 'throttle test file', type: 'DOCUMENT',
  get children() { return [{ name: 'Cover', type: 'PAGE', children: [] as unknown[], appendChild: () => undefined, findAllWithCriteria: () => SETS }]; },
  getSharedPluginData: () => '', setSharedPluginData: () => undefined, findAllWithCriteria: () => SETS,
};
const posted: any[] = [];
const host: Record<string, unknown> = {
  showUI: () => undefined,
  ui: { postMessage: (m: unknown) => { posted.push(m); }, onmessage: null as null | ((m: unknown) => void), resize: () => undefined },
  clientStorage: { getAsync: async () => undefined, setAsync: async () => undefined },
  on: () => undefined,
  root,
  currentPage: { name: 'Cover', children: [] },
  loadAllPagesAsync: async () => undefined,
  saveVersionHistoryAsync: async () => ({ id: 'v' }),
  loadFontAsync: async () => undefined,
  createFrame: () => ({}),
  variables: { getLocalVariableCollectionsAsync: async () => cols, getLocalVariablesAsync: async () => vars, setBoundVariableForPaint: (p: unknown) => p },
  getLocalTextStylesAsync: async () => [],
  getLocalEffectStylesAsync: async () => [], getLocalPaintStylesAsync: async () => [], getLocalGridStylesAsync: async () => [],
  listAvailableFontsAsync: async () => [],
};
const g = globalThis as Record<string, unknown>;
g.figma = host; g.__html__ = ''; g.PRISM3_BUILD = '2026-11-24T00:00:00Z tree-test0000';
const log = console.log;
console.log = (...a: unknown[]) => { if (typeof a[0] === 'string' && a[0].startsWith('[prism3')) return; log(...a); };
await import('./src/main');

const realNow = Date.now;
const realSetTimeout = globalThis.setTimeout;
/** One style-guide run under the fake clock: `Date.now` steps `step` ms a call (work), and a 0 ms timer runs at the next
 *  whole minute (`minute`) or 4 ms on (`prompt`). Returns the time spent working and waiting, and what was posted. */
const runUnder = async (hostKind: 'minute' | 'prompt', step: number): Promise<{ work: number; waited: number; handBacks: number; readings: any[]; result: any }> => {
  let t = 1_000_000 * SEC + 17;
  let work = 0;
  let waited = 0;
  let handBacks = 0;
  Date.now = () => { t += step; work += step; return t; };
  g.setTimeout = ((fn: () => void, ms?: number) => {
    const from = t;
    const due = t + (ms ?? 0);
    t = hostKind === 'prompt' ? due + 4 : Math.floor(due / MIN) * MIN + MIN;
    waited += t - from;
    if (!ms) handBacks++;
    return realSetTimeout(fn, 0);
  }) as unknown as typeof setTimeout;
  posted.length = 0;
  try {
    (host.ui as { onmessage: (m: unknown) => void }).onmessage({ type: 'style-guide', options: {} });
    const t0 = realNow();
    while (!posted.some((m) => m.type === 'style-guide-result') && realNow() - t0 < 60_000) await new Promise((r) => setImmediate(r));
  } finally {
    Date.now = realNow;
    g.setTimeout = realSetTimeout;
  }
  return { work, waited, handBacks, readings: posted.filter((m) => m.type === 'style-guide-progress'), result: posted.find((m) => m.type === 'style-guide-result') };
};

{
  const r = await runUnder('minute', 20);
  const last = r.readings[r.readings.length - 1];
  ok(!!r.result && last?.total === TABLES && last?.done === TABLES, `premise: the run reached all ${TABLES} tables and answered (${last?.done} of ${last?.total}; ${r.result?.headline})`);
  ok(r.waited <= 4 * r.work + 3 * MIN,
    `main/bound: waiting stays within four times the work plus three minutes (waited ${(r.waited / SEC).toFixed(0)} s over ${r.handBacks} hand-backs for ${(r.work / SEC).toFixed(1)} s of work; bound ${((4 * r.work + 3 * MIN) / SEC).toFixed(0)} s)`);
  ok(last?.throttled === true, `main/note: the last reading says the run is throttled (${JSON.stringify(last)})`);
}
{
  const r = await runUnder('prompt', 60);
  ok(!!r.result && !r.readings.some((m) => 'throttled' in m) && r.handBacks >= TABLES,
    `main/foreground: on a prompt host no reading says throttled (${r.readings.filter((m) => 'throttled' in m).length} do), and the run hands back at least once a table (${r.handBacks} for ${TABLES})`);
}

console.log = log;
console.log(`\n${failed === 0 ? '✅ ALL PASS' : `❌ ${failed} FAILED`} — ${executed} assertions executed`);
process.exit(failed === 0 ? 0 : 1);
