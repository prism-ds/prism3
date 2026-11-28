/**
 * INPUT THAT CAN NEVER WAIT FOREVER (#2547, #2550), shared by the browser suites (`test-smoke.mjs`, `test-chrome.mjs`).
 *
 * A Playwright click, key press or `selectOption` on a ready control waits for the renderer to take the input. A key
 * press has no bound at all; a click or `selectOption` throws after 30 s, uncaught unless the caller catches it. Each
 * was seen: Escape at smoke S4d waiting two hours, a step click at smoke S4c and the Interactive picker throwing at
 * 30 s, and test:chrome S6.3's `lh-swap` `selectOption` timing out in a cloud run. An input run through `bounded`
 * is held to INPUT_MS: a stall fails ONE check by name and says what the page was doing, so the cause is read off
 * the failure instead of guessed.
 *   · If the page still renders a frame, it was BUSY (a long task, a loaded machine). When the input THREW it is
 *     over, and the caller carries on. When it did not return it is STILL IN FLIGHT and would land later, on whatever
 *     the caller does next (a late step click drifts the picker, a late Escape closes the next one), so the page goes
 *     to the caller's `onDead` as a dead one does, which must retire it: closing its context cancels the input
 *     (#2557 review, a busy stall once ran on into an uncaught throw that ended the suite).
 *   · If it renders none, the debugger PAUSES the renderer and the failure names the JavaScript stack it was in, or
 *     says it was not running JavaScript (layout, paint, GC, or no frames being produced at all). The page then goes
 *     to `onDead` too.
 * Every action passed in carries its own `{ timeout: INPUT_MS }` where Playwright takes one, so nothing inside it
 * outlives the bound on its own clock.
 *
 * The debugger must be on before the page stops answering. `Debugger.enable` runs on the page's main thread, so asked
 * for only once the page is stuck it never completes and the pause never lands (measured: an attach-after-the-stall
 * version reported "no JavaScript was running" for a page stuck in a JavaScript loop). Enabled early, `Debugger.pause`
 * is an interrupt that stops even a busy loop. A suite turns it on when it opens a page that will take bounded input
 * (`watchStalls`, #2585), so a freeze started by an EARLIER step is still located; `bounded` turns it on at the
 * page's first input otherwise, which locates a freeze the input itself starts.
 */

/** The bound on one input. */
export const INPUT_MS = 15000;

/** The original, unbounded methods `boundEvaluates` replaced, on each prototype it patched. Only the probes in this file
 *  read them: a probe that asks whether a stuck page renders must not itself be bounded, or its own bound's diagnosis
 *  would probe again. `lint-chrome-bounds` (section 20 of test-chrome) fails by name on any use outside this file. */
const RAW = Symbol('p3.unbounded');
/** `page.evaluate` without the bound, for this file's probes. A page from a browser `boundEvaluates` never patched
 *  (test-smoke's) has no originals stored, so its own method is the raw one. */
const rawEvaluate = (page, fn) => {
  const f = page.mainFrame();
  return (Object.getPrototypeOf(f)[RAW]?.evaluate ?? f.evaluate).call(f, fn);
};

/** Whether the page renders a frame within 3 s, bounded on this side. */
export const rendersFrame = (page) => Promise.race([
  rawEvaluate(page, () => new Promise((r) => requestAnimationFrame(() => r(true)))).catch(() => false),
  new Promise((r) => setTimeout(() => r(false), 3000)),
]);

const debuggers = new WeakMap();
const debuggerOf = async (page) => {
  if (debuggers.has(page)) return debuggers.get(page);
  const pending = (async () => {
    try {
      const cdp = await page.context().newCDPSession(page);
      const on = await Promise.race([cdp.send('Debugger.enable').then(() => true, () => false), new Promise((r) => setTimeout(() => r(false), 3000))]);
      return on ? cdp : null;
    } catch { return null; }
  })();
  debuggers.set(page, pending);
  return pending;
};

/** Pages whose debugger `watchStalls` turned on. A reporter made with `requireWatched` refuses input on any other. */
const watched = new WeakSet();

/** Turn the debugger on now, while the page answers (#2585). Call it once the page has loaded, on any page that will
 *  take bounded input; returns whether it is on. A page is marked watched only when it is on, so a failed attach is
 *  reported by the page's first bounded input, the same as a missing call. */
export const watchStalls = async (page) => {
  const on = !!await debuggerOf(page);
  if (on) watched.add(page);
  return on;
};

/** Pause the page and say where it was. */
const stallStack = async (page) => {
  const cdp = await Promise.race([debuggerOf(page), new Promise((r) => setTimeout(() => r(null), 3000))]);
  if (!cdp) return 'no debugger session could be opened on the page, so where it stopped is unknown';
  try {
    const paused = new Promise((r) => cdp.once('Debugger.paused', (e) => r(e)));
    await Promise.race([cdp.send('Debugger.pause').catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
    const e = await Promise.race([paused, new Promise((r) => setTimeout(() => r(null), 5000))]);
    if (!e) return 'the debugger could not pause it within 5s: it was not running JavaScript (layout, paint, GC, or no frames being produced at all)';
    const frames = (e.callFrames ?? []).slice(0, 6).map((f) => `${f.functionName || '(anonymous)'} ${String(f.url).split('/').pop() || '(page)'}:${f.location.lineNumber + 1}`);
    await Promise.race([cdp.send('Debugger.resume').catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
    return `it was running JavaScript: ${frames.join(' < ') || '(no frames)'}`;
  } catch (err) {
    return `the debugger failed (${String(err?.message ?? err).slice(0, 80)})`;
  }
};

/** Where a page that stopped is (#4342, #4465), for a caller that has just seen it render no frame. Only on a page
 *  `watchStalls` already watches, since a debugger turned on once the page is stuck never lands (this file's header);
 *  on any other page it says nothing rather than guess. Three readings, in this order:
 *   1. whether the main thread still runs a script: a page that runs one at once but draws no frame is idle, waiting on
 *      frame production; one that runs none is busy;
 *   2. whether it draws again within `backMs` (30s unless the caller's own wait was shorter): a long busy spell, or a hang;
 *   3. still stopped: the debugger pauses it and names the JavaScript stack, or says it was running none (style,
 *      layout, paint, GC, or a synchronous call). Last, because a pause that does not land stays pending and would
 *      stop the next script these readings run.
 *  #4465's first capture on CI (PR #4505) read "not running JavaScript", which (1) and (2) split. */
export const stallWhere = async (page, backMs = 30000) => {
  if (!watched.has(page)) return '';
  const answers = await Promise.race([rawEvaluate(page, () => true).catch(() => false), new Promise((r) => setTimeout(() => r(false), 3000))]);
  const runs = answers ? 'the main thread still runs a script, so it is idle and no frame is being produced' : 'the main thread runs no script, so it is busy';
  const t0 = Date.now();
  while (Date.now() - t0 < backMs) {
    if (await rendersFrame(page)) return `${runs}; it drew a frame again ${Math.round((Date.now() - t0) / 1000)}s later`;
  }
  return `${runs}; no frame in ${Math.round(backMs / 1000)}s more; ${await stallStack(page)}`;
};

/**
 * A suite's `bounded(page, label, act)`, which returns whether the input went through.
 *   · `ok(cond, label)` — the suite's assertion;
 *   · `isDead(page)` — a page the suite already gave up on is not touched again;
 *   · `onDead(page, label, why?)` — what the suite does with a page that renders no frame, or a busy one whose input
 *     is still in flight. It must report the failure and retire the page. `why` is set on the busy path and says
 *     what happened; on the dead path it is left out and `label` already carries the input and the stack, so the
 *     suite's own words for a dead page follow (test-smoke's `closeDead` signature).
 * Returns whether the input went through; false with `onDead` not called only when the input threw and nothing is
 * left in flight. `stats` is the slowest input that went through, for a suite to print as its margin. `inputMs` is the
 * bound, INPUT_MS unless a suite's self-check wants a short one.
 *   · `requireWatched` — every page that takes bounded input must first have been given `watchStalls` with its
 *     debugger on. An input on any other page fails one check by name and is not sent: without the early debugger a
 *     freeze an earlier step started is reported as "where it stopped is unknown", which is the #2585 shape, and
 *     nothing else would notice the missing call until a real stall (#2631 review). Both suites' reporters set it.
 */
export const makeBounded = ({ ok, isDead = () => false, onDead, inputMs = INPUT_MS, requireWatched = false }) => {
  const stats = { inputs: 0, slowestMs: 0, slowestLabel: '' };
  const bounded = async (page, label, act) => {
    if (isDead(page)) return false;
    if (requireWatched && !watched.has(page)) {
      ok(false, `${label}: the page was never given watchStalls, or its debugger did not turn on, so a freeze an earlier step started could not be located (#2585)`);
      return false;
    }
    await debuggerOf(page);
    let timer;
    const t0 = Date.now();
    const out = await Promise.race([
      act().then(() => 'ok', (e) => e),
      new Promise((r) => { timer = setTimeout(() => r('timeout'), inputMs); }),
    ]);
    clearTimeout(timer);
    if (out === 'ok') {
      stats.inputs++;
      const ms = Date.now() - t0;
      if (ms > stats.slowestMs) { stats.slowestMs = ms; stats.slowestLabel = label; }
      return true;
    }
    const what = out === 'timeout' ? `did not return within ${inputMs}ms` : `threw after ${Date.now() - t0}ms: ${String(out?.message ?? out).split('\n')[0].slice(0, 120)}`;
    if (await rendersFrame(page)) {
      if (out === 'timeout') await onDead(page, label, `the input ${what}; the page still renders frames, so it was busy, not stuck, but the input is still in flight`);
      else ok(false, `${label}: the input ${what}; the page still renders frames, so it was busy, not stuck`);
      return false;
    }
    await onDead(page, `${label}: the input ${what}; ${await stallStack(page)}`);
    return false;
  };
  return { bounded, stats };
};

/** The words a wait that hit its bound ends with (#4127, #4612): whether the page still renders a frame (busy elsewhere)
 *  or none (stuck), and on a page `watchStalls` watches, where it stopped. `backMs` bounds how long `stallWhere` waits
 *  for a frame to come back. test-chrome's `within` and every bounded evaluate below say it the same way. */
export const stallMessage = async (page, label, ms, backMs = 30000) => {
  if (page?.isClosed()) return `${label} did not settle within ${ms / 1000}s; the page was closed`;
  const live = page ? await rendersFrame(page) : false;
  const at = page && !live ? await stallWhere(page, Math.min(ms, backMs)) : '';
  return `${label} did not settle within ${ms / 1000}s; the page ${!page ? 'is unknown' : live ? 'still renders frames, so the wait was on something else' : 'renders no frame'}${at ? `; ${at}` : ''}`;
};

/** A bounded evaluate's promise carries this; `within` calls it to take the bound over with its own label and limit. */
export const DISARM = Symbol('p3.disarm');
/** A page's own bound for its bounded evaluates, in ms, set by a self-check that wants a short one on a page of its own. */
export const BOUND_MS = Symbol('p3.boundMs');

/** The raw input methods `boundEvaluates` bounds (#4649): every method Playwright's Keyboard, Mouse and Touchscreen
 *  classes define. Playwright sends each with no timeout, as it does an evaluate, so a key press on a busy page waited
 *  for the 600 s watchdog. A Locator's `click`, `press` or `fill` is not here: it carries Playwright's own 30 s action
 *  timeout. `boundEvaluates` fails at install if Playwright adds a method to one of these classes that is not listed,
 *  so a new method cannot arrive unbounded. */
export const INPUT_METHODS = {
  keyboard: ['down', 'up', 'insertText', 'type', 'press'],
  mouse: ['move', 'down', 'up', 'click', 'dblclick', 'wheel'],
  touchscreen: ['tap'],
};

/**
 * EVERY EVALUATE HAS A BOUND (#4342). Playwright sends `evaluate`, `evaluateAll`, `$eval` and `$$eval` with no timeout
 * at all (`kNoTimeout` in its client), so on a page whose main thread is busy, or that renders no frame while the
 * script awaits one, the call waits until the section watchdog (#3044) stops the run 600 s later, naming only the last
 * check that passed. #4127 and #4612 bounded the calls on the paths that stalled, one `within` at a time; the next
 * stall came at a plain read on another path (18-s4f's Gradients read, 2026-11-27). The suite holds about 1,500 such
 * calls, so they are bounded where they all go through, not one by one: this replaces the evaluate family on
 * Playwright's own client prototypes, read off a live page (Page, Frame, Locator, JSHandle, ElementHandle), so every
 * page any context of this process opens is bounded from its first call, however it was made. The page's raw input
 * goes the same way (#4649): Playwright sends a `keyboard`, `mouse` or `touchscreen` call with no timeout either, and the
 * suite made 184 of them, so every method in `INPUT_METHODS` is bounded on those three prototypes too, and a key press
 * on a busy page fails by name the same way. A stalled input is still in flight when it rejects; the rejection ends its
 * case, and the case's `finally` closes the context, which cancels it (this file's header).
 *
 *   · The bound is `ms`, or a page's own `BOUND_MS`. A `waitForFunction` already ends on Playwright's own timeout; its
 *     bound is that timeout plus `ms`, so Playwright's error still comes first, and a `timeout: 0` gets `ms`.
 *   · On the bound the call rejects with its LABEL: the method, the call site (the first two frames of the caller's
 *     stack outside this file and Playwright: function and line), and `where()` (test-chrome: the section and the
 *     last check reached), then `stallMessage`'s reading of the page. So a stall names the step and where it stopped.
 *   · One bound per call: a public method that calls another (Page.evaluate into Frame.evaluate, Locator.evaluate
 *     into JSHandle.evaluate after an await) is bounded at the outer call alone, which an AsyncLocalStorage marks.
 *   · `within(page, label, page.evaluate(…), ms)` passes the promise itself, and takes the bound over (`DISARM`), so
 *     an explicit label and limit always win over these.
 *   · The process-wide reach is the point, and the limit: a page of another browser binary, a CDP `Runtime.evaluate`
 *     or a CDP `Input.dispatch…` is not covered, which `lint-chrome-bounds` keeps out of the suite.
 * Returns the stats `log` gathers: the slowest call that settled, by site, so the bound's margin can be measured.
 */
export const boundEvaluates = async (browser, { ms, where = () => '' }) => {
  const { AsyncLocalStorage } = await import('node:async_hooks');
  const inner = new AsyncLocalStorage();
  const stats = { calls: 0, slowestMs: 0, slowestSite: '', bySite: new Map() };
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    await page.setContent('<p>bounds</p>');
    const handle = await page.locator('p').elementHandle();
    const protoOf = (o, name) => { for (let p = Object.getPrototypeOf(o); p; p = Object.getPrototypeOf(p)) if (Object.hasOwn(p, name)) return p; return null; };
    const targets = [
      [Object.getPrototypeOf(page), (o) => o, ['evaluate', 'evaluateHandle', '$eval', '$$eval', 'waitForFunction']],
      [Object.getPrototypeOf(page.mainFrame()), (o) => o.page(), ['evaluate', 'evaluateHandle', '$eval', '$$eval', 'waitForFunction']],
      [Object.getPrototypeOf(page.locator('p')), (o) => o.page(), ['evaluate', 'evaluateAll', 'evaluateHandle']],
      [protoOf(handle, 'evaluate'), (o) => o._parentOfType?.('Page') ?? null, ['evaluate', 'evaluateHandle']],
      [protoOf(handle, '$$eval'), (o) => o._parentOfType?.('Page') ?? null, ['$eval', '$$eval']],
      // #4649: the page's raw input, which Playwright sends with no timeout either (a key press, a mouse move).
      [Object.getPrototypeOf(page.keyboard), (o) => o._page ?? null, INPUT_METHODS.keyboard],
      [Object.getPrototypeOf(page.mouse), (o) => o._page ?? null, INPUT_METHODS.mouse],
      [Object.getPrototypeOf(page.touchscreen), (o) => o._page ?? null, INPUT_METHODS.touchscreen],
    ];
    const kinds = { Page: 'page', Frame: 'frame', Locator: 'locator', JSHandle: 'handle', ElementHandle: 'handle', Keyboard: 'keyboard', Mouse: 'mouse', Touchscreen: 'touchscreen' };
    for (const [proto, pageOf, names] of targets) {
      if (!proto) throw new Error('boundEvaluates: a Playwright prototype was not found, so the evaluates and input cannot be bounded');
      const kind = kinds[proto.constructor.name.replace(/^_/, '').replace(/\d+$/, '')] ?? proto.constructor.name;
      proto[RAW] = {};
      if (Object.values(INPUT_METHODS).includes(names)) {
        const unlisted = Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor' && typeof proto[n] === 'function' && !names.includes(n));
        if (unlisted.length) throw new Error(`boundEvaluates: ${proto.constructor.name} has input methods the bound does not list (${unlisted.join(', ')}); add them to INPUT_METHODS`);
      }
      for (const name of names) {
        const orig = proto[name];
        if (typeof orig !== 'function') throw new Error(`boundEvaluates: ${proto.constructor.name}.${name} is not a method`);
        proto[RAW][name] = orig;
        proto[name] = function bounded(...a) {
          if (inner.getStore()) return orig.apply(this, a);
          const site = {};
          const lim = Error.stackTraceLimit;
          Error.stackTraceLimit = 40;
          Error.captureStackTrace(site, bounded);
          Error.stackTraceLimit = lim;
          const page = pageOf(this);
          let bound = page?.[BOUND_MS] ?? ms;
          if (name === 'waitForFunction') {
            const t = a[2]?.timeout;
            if (t !== 0) bound += t ?? 30000;
          }
          const t0 = Date.now();
          const raw = inner.run(true, () => orig.apply(this, a));
          let timer = null, late = false;
          const out = new Promise((resolve, reject) => {
            // The slowest call that settled inside its bound, for the margin `ms` keeps (a stalled one is not a measure).
            const done = () => {
              clearTimeout(timer);
              if (late) return;
              const took = Date.now() - t0;
              stats.calls++;
              if (took > stats.slowestMs) { stats.slowestMs = took; stats.slowestSite = `${kind}.${name} (${siteOf(site)})`; }
              if (took > 1000) { const k = `${kind}.${name} (${siteOf(site)})`; stats.bySite.set(k, Math.max(took, stats.bySite.get(k) ?? 0)); }
            };
            raw.then((v) => { done(); resolve(v); }, (e) => { done(); reject(e); });
            timer = setTimeout(async () => {
              late = true;
              const w = where();
              reject(new Error(await stallMessage(page, `${kind}.${name} (${siteOf(site)}${w ? `; ${w}` : ''})`, bound)));
            }, bound);
          });
          out[DISARM] = () => { clearTimeout(timer); late = true; };
          return out;
        };
      }
    }
  } finally { await ctx.close(); }
  return stats;
};

/** The caller's first two frames outside this file and Playwright, as `function file:line`, from a captured stack. A
 *  name is kept only when it is a plain identifier: V8 infers dotted names for an arrow in a literal from the keys around
 *  it (`bp.waitForFunction.timeout` for an arrow in an array), which name nothing a reader can find. */
const siteOf = (site) => {
  const here = import.meta.url.split('/').pop();
  const frames = String(site.stack ?? '').split('\n').slice(1)
    .map((l) => l.trim().replace(/^at (async )?/, ''))
    .filter((l) => !l.includes('node_modules') && !l.includes('node:') && !l.includes(here))
    .map((l) => { const m = /^(?:(.*?) \()?(?:file:\/\/)?[^()]*\/([^/():]+):(\d+):\d+\)?$/.exec(l); return m ? `${/^[\w$]+$/.test(m[1] ?? '') ? `${m[1]} ` : ''}${m[2]}:${m[3]}` : null; })
    .filter(Boolean);
  return frames.slice(0, 2).join(' < ') || 'no call site in the stack';
};
