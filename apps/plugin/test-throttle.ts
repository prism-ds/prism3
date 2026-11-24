/**
 * #4476 (with #724) — A RUN STAYS BOUNDED WHILE A HIDDEN FIGMA WINDOW THROTTLES ITS TIMERS.
 *
 *   npx tsx apps/plugin/test-throttle.ts
 *
 * Seen by the owner (2026-11-23): a 45-table style guide sat on table 28 for about an hour, then finished within moments
 * once the window was visible. While Figma's window is hidden, Chromium runs a timer at the next whole second, and after
 * about five minutes at the next whole minute, so every `setTimeout(0)` hand-back can cost a minute. The fix
 * (`handBack`, `src/pace.ts`, owner decision A on #4476): hand back only once 50 ms of work has run, time each
 * hand-back, and once a sustained run of them comes back late (four in a row at least 250 ms late, a 5 s one counting
 * twice), do more work between them (from the last one's delay, doubling, capped at 15 s). The progress readings say
 * `throttled` from then on, for the progress line's note.
 *
 * THE FAKE CLOCK. `work(ms)` moves time forward by work; `wait(0)` moves it to when the fake host runs a 0 ms timer:
 * `prompt` (4 ms on), `second` (the next whole second), `minute` (the next whole minute). Nothing here reads a real clock.
 *
 * OVER `handBack` ITSELF:
 *   · `pace/warm` (#724): 162 offers around no work take no hand-back at all;
 *   · `pace/foreground`: on a prompt host, 30 ms units of work: every stretch between two hand-backs is at least 50 ms
 *     and at most 80 ms (50 plus one unit), so the visible window answers as often as before; never throttled;
 *   · `bound/minute`: 5,600 units of 50 ms (280 s of work) on a minute-aligned host finish within five times the work
 *     plus three minutes. A hand-back at every offer, the code before #4476, takes about 400 minutes;
 *   · `bound/second`, `bound/second-fine`, `bound/second-uneven` (#4506 review): through the five-minute second-aligned
 *     stage, in 50 ms, 1 ms and 1–200 ms units, at least three quarters of the time is work. With a 1 s threshold, no
 *     delay of that stage counted and about 5% of it was work;
 *   · `throttle/detect`: a minute-aligned host and a second-aligned one read as throttled; a prompt one never does;
 *   · `throttle/long`: a minute-aligned host reads as throttled at its second hand-back (a long one counts twice);
 *   · `throttle/cap`: no stretch of work between hand-backs passes 15 s plus one unit;
 *   · `throttle/one-slow`: one hand-back 1.5 s late among prompt ones (a long reconcile in the foreground) is not
 *     throttling;
 *   · `throttle/apart`: late hand-backs (1.5 s and 6 s) each separated by a prompt one are not throttling;
 *   · `foreground/slow-ticks`: a prompt host with every seventh hand-back 900 ms late, two in a row once and one 6 s
 *     hitch never reads as throttled, and every stretch stays at the 50 ms pace;
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
 *     and the run hands back at least once a table, so the window answers as often as before;
 *   · `main/slow-ticks`: the same run on a visible window with occasional slow ticks (every seventh hand-back 900 ms
 *     late, one 6 s hitch): no reading says `throttled`, so no note shows.
 *
 * INDEPENDENCE (docs/34): every bound is a literal typed here (50, 80, five times plus three minutes, three quarters,
 * 15 s, 60 tables), and every elapsed time is read off the test's own clock, never off a figure the run reports.
 *
 * MUTATIONS, each failing by name: the budget test in `handBack` dropped (a hand-back at every offer) → `pace/warm`,
 * `bound/minute`, `main/bound`; the throttled stretch never raised → `bound/minute`, `main/bound`; `THROTTLE_MS` back to
 * 1000 → the three `bound/second` arms, `throttle/detect`; the late count never reset by a prompt hand-back →
 * `throttle/apart`, `foreground/slow-ticks`, `main/slow-ticks`; `THROTTLE_RUN` 2 → the same and `throttle/long`; a long
 * hand-back counted once → `throttle/long`, `main/bound`; `THROTTLE_CLEAR` 1, or the stretch never doubled → the three
 * `bound/second` arms; the cap dropped → `throttle/cap`; `seen` never set → `throttle/detect`, `main/note`; the throttled
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
{
  const c = fakeClock('minute');
  const hand = handBack(c);
  const start = c.t;
  const W = 5600 * 50;
  for (let i = 0; i < 5600; i++) { c.work(50); await hand(); }
  const total = c.t - start;
  ok(total <= 5 * W + 3 * MIN,
    `bound/minute: 280 s of work in 50 ms units on a minute-aligned host finishes within 5 times the work plus three minutes (${(total / SEC).toFixed(0)} s, ${c.waits.length} hand-backs; bound ${((5 * W + 3 * MIN) / SEC).toFixed(0)} s)`);
}
for (const [unit, name] of [[50, 'bound/second'], [1, 'bound/second-fine']] as const) {
  // The first five minutes hidden: a second-aligned host, small units of work (a warm member is under 1 ms, a cell a few).
  // Before the #4506 review, no delay under a second counted, so every 50 ms of work waited most of a second (about 5%).
  const c = fakeClock('second');
  const hand = handBack(c);
  const start = c.t;
  let work = 0;
  while (c.t - start < 5 * MIN) { c.work(unit); work += unit; await hand(); }
  const total = c.t - start;
  ok(work >= 0.75 * total && hand.throttled,
    `${name}: through the five-minute second-aligned stage in ${unit} ms units, at least three quarters of the time is work (${(work / SEC).toFixed(0)} s of ${(total / SEC).toFixed(0)} s, ${c.waits.length} hand-backs), and it reads as throttled (${hand.throttled})`);
}
{
  // The same stage with units of uneven size, so a long stretch can end just before a whole second and its hand-back
  // comes back prompt: the stretch is remembered, and the next late hand-back resumes it.
  const c = fakeClock('second');
  const hand = handBack(c);
  const start = c.t;
  let work = 0;
  let seed = 17;
  while (c.t - start < 5 * MIN) { seed = (seed * 16807) % 2147483647; const u = 1 + (seed % 200); c.work(u); work += u; await hand(); }
  const total = c.t - start;
  ok(work >= 0.75 * total, `bound/second-uneven: the same stage in units of 1–200 ms, at least three quarters of the time is work (${(work / SEC).toFixed(0)} s of ${(total / SEC).toFixed(0)} s, ${c.waits.length} hand-backs)`);
}
{
  const hidden = fakeClock('minute');
  const h1 = handBack(hidden);
  for (let i = 0; i < 20; i++) { hidden.work(60); await h1(); }
  const second = fakeClock('second');
  const h3 = handBack(second);
  for (let i = 0; i < 20; i++) { second.work(60); await h3(); }
  const shown = fakeClock('prompt');
  const h2 = handBack(shown);
  for (let i = 0; i < 20; i++) { shown.work(60); await h2(); }
  ok(h1.throttled && h3.throttled && !h2.throttled, `throttle/detect: a minute-aligned host reads as throttled (${h1.throttled}), a second-aligned one too (${h3.throttled}), a prompt one does not (${h2.throttled})`);
}
{
  // A run started after five minutes hidden: two minute-aligned hand-backs read as throttled, not four.
  const c = fakeClock('minute');
  const hand = handBack(c);
  let at = 0;
  for (let i = 0; i < 40 && !at; i++) { c.work(60); await hand(); if (hand.throttled) at = c.waits.length; }
  ok(at === 2, `throttle/long: on a minute-aligned host the second hand-back reads as throttled (at hand-back ${at})`);
}
{
  // The cap: no stretch of work between two hand-backs is longer than 15 s plus one unit, however late they come back.
  const c = fakeClock('minute');
  const hand = handBack(c);
  const gaps: number[] = [];
  let since = c.t;
  for (let i = 0; i < 6000; i++) {
    c.work(100);
    const n = c.waits.length;
    await hand();
    if (c.waits.length > n) { gaps.push(c.t - c.waits[c.waits.length - 1].took - since); since = c.t; }
  }
  ok(hand.throttled && Math.max(...gaps) <= 15_100 && Math.max(...gaps) >= 15_000,
    `throttle/cap: on a minute-aligned host the longest stretch of work is 15 s plus at most one 100 ms unit (${Math.max(...gaps)} ms over ${gaps.length} hand-backs)`);
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
  // Late hand-backs, long ones among them, each separated by a prompt one: never a run, so never throttling.
  const c = fakeClock('prompt');
  const hand = handBack(c);
  const real = c.wait;
  let n = 0;
  c.wait = async (ms) => { n++; if (n % 2 === 0) { const d = n % 4 === 0 ? 6000 : 1500; c.t += d; c.waits.push({ ms, took: d }); return; } await real(ms); };
  for (let i = 0; i < 40; i++) { c.work(60); await hand(); }
  ok(n >= 20 && !hand.throttled, `throttle/apart: ${n} hand-backs, every other one 1.5 s or 6 s late, are not throttling (${hand.throttled})`);
}
{
  // A visible window with occasional slow ticks (#724's average is 77–118 ms; a heavy reconcile can take longer): every
  // seventh hand-back 900 ms late, once two of them in a row, once a 6 s hitch. None is a sustained run, so the run never
  // reads as throttled and every stretch of work stays at the 50 ms pace.
  const c = fakeClock('prompt');
  const hand = handBack(c);
  const real = c.wait;
  let n = 0;
  const slow = (k: number) => (k % 7 === 0 || k === 50 ? 900 : k === 80 ? 6000 : 0);
  c.wait = async (ms) => { n++; const d = slow(n); if (d) { c.t += d; c.waits.push({ ms, took: d }); return; } await real(ms); };
  const gaps: number[] = [];
  let since = c.t;
  for (let i = 0; i < 300; i++) {
    c.work(30);
    const k = c.waits.length;
    await hand();
    if (c.waits.length > k) { gaps.push(c.t - c.waits[c.waits.length - 1].took - since); since = c.t; }
  }
  ok(n >= 100 && !hand.throttled && Math.max(...gaps) <= 80,
    `foreground/slow-ticks: ${n} hand-backs on a prompt host, every seventh 900 ms late, two in a row once and one 6 s hitch, never read as throttled (${hand.throttled}), and every stretch stays 50–80 ms (longest ${Math.max(...gaps)} ms)`);
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
const runUnder = async (hostKind: 'minute' | 'prompt' | 'slow-ticks', step: number): Promise<{ work: number; waited: number; handBacks: number; readings: any[]; result: any }> => {
  let t = 1_000_000 * SEC + 17;
  let work = 0;
  let waited = 0;
  let handBacks = 0;
  Date.now = () => { t += step; work += step; return t; };
  g.setTimeout = ((fn: () => void, ms?: number) => {
    const from = t;
    const due = t + (ms ?? 0);
    if (!ms) handBacks++;
    // `slow-ticks`: a visible window whose every seventh hand-back is 900 ms late, and one 6 s hitch (the 30th).
    const tick = hostKind === 'slow-ticks' && !ms ? (handBacks === 30 ? 6000 : handBacks % 7 === 0 ? 900 : 0) : 0;
    t = hostKind === 'minute' ? Math.floor(due / MIN) * MIN + MIN : due + 4 + tick;
    waited += t - from;
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

{
  const r = await runUnder('slow-ticks', 60);
  ok(!!r.result && r.handBacks >= TABLES && !r.readings.some((m) => 'throttled' in m),
    `main/slow-ticks: a visible window with an occasional slow tick (every seventh hand-back 900 ms late, one 6 s hitch, ${r.handBacks} hand-backs) shows no note: no reading says throttled (${r.readings.filter((m) => 'throttled' in m).length} do)`);
}

console.log = log;
console.log(`\n${failed === 0 ? '✅ ALL PASS' : `❌ ${failed} FAILED`} — ${executed} assertions executed`);
process.exit(failed === 0 ? 0 : 1);
