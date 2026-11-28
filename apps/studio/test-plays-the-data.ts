/**
 * `test:plays-the-data` — the motion previews play the engine's data, and nothing else (#4571, the motion editor's PR 3;
 * `docs/superpowers/motion-editor-proposal.md` §3 and §5 row 3).
 *
 *   npm run -w @prism3/studio build
 *   npm run -w @prism3/studio test:plays-the-data
 *
 * ── the rule, stated ──────────────────────────────────────────────────────────────────────────────
 *
 * On Theme › Motion, every element the stage moves is moving on its track's preset: for each pattern the brand emits,
 * each track, and each CSS property that track's group moves, the element's COMPUTED transition duration, timing
 * function and delay equal what `motion.preset.<path>.{duration,easing,delay}` resolves to in the emitted token tree,
 * in the mode in view. The same for the plain specimens of the presets no pattern names (§3.1 item 2): every property
 * the specimen moves is on that preset. Each failure names the brand, the mode, the pattern and the track.
 *
 * WHEN it is read: at rest, and again after the stage plays, because `play()` rewrites every mover's transition and
 * that rewrite is what a person sees move. Each pattern is read after Play or Replay is pressed; once per mode, on its
 * first pattern, after a Motion edit (the tempo moved and moved back, so the brand is unchanged and the stage plays by
 * itself, D9 A), and then after Replay. A timing typed in the Play path alone fails the `after Play` / `after Replay`
 * arms by name (#4665 review, mutation c).
 *
 * It also holds, from the same emitted data:
 *   · REPRESENTED: every pattern the agent file lists is reached through the stage (its preset chosen, its "Used by" chip
 *     clicked), every track has its element and its CSS property in that element's transition list, and every track
 *     has a timeline bar naming its preset. A count floor per brand and mode, so a stage that drew nothing fails.
 *   · USED BY: each preset's chips are exactly the patterns whose tracks name it or its exit half.
 *   · ONE TIME AXIS (§3.2): every timeline lane starts at the same x and is as wide, and two tracks whose emitted
 *     duration and delay are equal draw bars of equal start and length, within 1px. A row sized to its own text fails
 *     `the timeline's lanes share one time axis` and `tracks … draw equal bars`.
 *
 * ── independence (docs/34) ────────────────────────────────────────────────────────────────────────
 *
 * SUBJECT: the built `dist/main.js`, driven in Chromium the way a person reaches it (the start screen, then Motion), read
 * as the browser computed it (`getComputedStyle`), so it is the transition the stage plays, whatever helper set it.
 *
 * EXPECTED: the emitted token tree and agent file, written by the engine's Node CLI (`cli.ts`), never by Studio code:
 *   · for the example brands, the committed `out/<id>.tokens.json` and `out/<id>.ai.json`, read off disk;
 *   · for the FIXTURE, a brand this gate builds (aurora's brief plus motion edits the examples never make: a spring-eased
 *     preset, a preset fixed to a curve, a delay, a longer exit, a mode at another tempo with its own easing role, and a
 *     track override), compiled by the same CLI into a temporary directory, and pasted into the start screen as design.md.
 * The tree is resolved here, alias by alias, through `$extensions.prism3.modes.<mode>` where a mode carries its own value.
 * The preview's own helper (`trackTiming`, which reads `theme.motion`) is never imported. Both sides are put through the
 * browser's own serialization (a probe element given the expected values) so `0.24s` and `240ms` compare equal and a
 * keyword curve compares as its numbers, with no tolerance.
 *
 * Mutation this fails by name: a duration hard-coded in the stage (`trackTiming` returning 300 for one preset, or one
 * element's transition written as a literal) → `<brand> <mode>: pattern '<p>' track '<element.property>' (<css>):
 * duration …`. A mode's tempo or easing role not reaching the stage → the fixture's dark arms. A track override not
 * reaching it → the fixture's `toast/enter` transform arm.
 *
 * ── what this does NOT cover ───────────────────────────────────────────────────────────────────────
 *   · reduced motion (each track's kind and `duration-reduced`): the motion editor's PR 4 adds that arm;
 *   · the plugin: it runs Studio's UI whole (`apps/plugin/src/ui/entry.ts`), and `test:export-parity` holds the two
 *     bundles to one source; this gate drives the web bundle;
 *   · what an element moves (its distance, its start scale): the track's own properties, drawn, not timed;
 *   · the Slow motion divisor, which is view state: the gate reads at its default, Off.
 */
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { parseDesignMd, toDesignMd, type BrandInput } from '@prism3/engine';
import { boundEvaluates } from './test-bounded.mjs';
import { launchWithoutWebFonts } from './test-web-fonts-stub.mjs';
import { hookGuard } from './test-hooks.mjs';
import { assertBundleFresh, STUDIO_SOURCE_ROOTS } from './test-bundle-freshness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const OUT = join(REPO, 'packages/engine/out');
const EXAMPLES = join(REPO, 'packages/engine/examples');
const hooks = hookGuard(import.meta.url);

let failed = 0;
let executed = 0;
let lastCheck = '';
const ok = (cond: boolean, label: string): void => {
  executed++;
  lastCheck = label;
  if (cond) console.log(`  ✓ ${label}`);
  else { failed++; console.error(`  ✗ ${label}`); }
};

/** The CSS properties each track property group moves. Typed here, the gate's own reading of Q-MS7 A, never read from
 *  the stage. */
const CSS_OF: Record<string, string[]> = { opacity: ['opacity'], transform: ['transform'], size: ['height'], color: ['background-color', 'color'] };
/** The floor on patterns per brand: the starter set is 22 (Q-PT16 A). */
const MIN_PATTERNS = 22;

// ── the emitted data, resolved here ─────────────────────────────────────────────────────────────
type Node = { $value?: unknown; $extensions?: { prism3?: { modes?: Record<string, { $value: unknown }> } }; [k: string]: unknown };
type Emitted = { id: string; tree: Record<string, Node>; root: string; patterns: Record<string, { half: string; tracks: { element: string; property: string; preset: string }[] }> };
const at = (tree: Record<string, Node>, path: string): Node | undefined => path.split('.').reduce<Node | undefined>((n, s) => (n ? (n[s] as Node | undefined) : undefined), tree as Node);
/** A leaf's value in `mode`: the mode's own where it has one, else its value; aliases followed, each hop in that mode. */
const resolve = (tree: Record<string, Node>, path: string, mode: string, hops = 0): unknown => {
  if (hops > 20) throw new Error(`alias chain too long at ${path}`);
  const n = at(tree, path);
  if (!n || !('$value' in n)) throw new Error(`no token ${path}`);
  const v = n.$extensions?.prism3?.modes?.[mode]?.$value ?? n.$value;
  if (typeof v === 'string' && /^\{.+\}$/.test(v)) return resolve(tree, v.slice(1, -1), mode, hops + 1);
  return v;
};
const css = (v: unknown, what: string): string => {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length === 4) return `cubic-bezier(${v.join(', ')})`;
  throw new Error(`${what}: not a CSS value (${JSON.stringify(v)})`);
};
/** What `motion.preset.<path>` resolves to in `mode`, as CSS. */
const expectedOf = (e: Emitted, presetToken: string, mode: string): { duration: string; easing: string; delay: string } => {
  const base = `${e.root}.${presetToken}`;
  return {
    duration: css(resolve(e.tree, `${base}.duration`, mode), `${base}.duration`),
    easing: css(resolve(e.tree, `${base}.easing`, mode), `${base}.easing`),
    delay: css(resolve(e.tree, `${base}.delay`, mode), `${base}.delay`),
  };
};
const load = (id: string, dir: string): Emitted => {
  const tree = JSON.parse(readFileSync(join(dir, `${id}.tokens.json`), 'utf8')) as Record<string, Node>;
  const root = Object.keys(tree).find((k) => !k.startsWith('$'))!;
  const ai = JSON.parse(readFileSync(join(dir, `${id}.ai.json`), 'utf8')) as { motion_patterns: Emitted['patterns'] };
  return { id, tree, root, patterns: ai.motion_patterns };
};

// ── the fixture: aurora's brief with motion edits no example makes, compiled by the engine's CLI ──
const FIXTURE_ID = 'aurora';
const fixtureInput = (): BrandInput => {
  const { input } = parseDesignMd(readFileSync(join(EXAMPLES, 'aurora.design.md'), 'utf8'));
  const mp = (input.motionPersonality ?? {}) as NonNullable<BrandInput['motionPersonality']>;
  input.motionPersonality = {
    ...mp,
    presets: {
      ...(mp.presets ?? {}),
      state: { easing: 'spring.snappy', duration: 'spring-duration.snappy' },   // a spring: hover, release
      pop: { easing: 'easing.calm', exit: { duration: 'duration.slow' } },     // fixed to a curve; a longer exit
      crossfade: { delay: 'delay.hide' },                                       // a delay: the tabs panel
      move: { duration: 'duration.slower' },
    },
    patterns: { ...(mp.patterns ?? {}), 'toast/enter': { 'toast.transform': { preset: 'preset.pop' } } },
  } as BrandInput['motionPersonality'];
  const ml = (input.modeLevers ?? {}) as Record<string, Record<string, unknown>>;
  input.modeLevers = { ...ml, dark: { ...(ml.dark ?? {}), tempo: 'relaxed', easings: { enter: 'expressive' } } } as BrandInput['modeLevers'];
  return input;
};
const fixtureDir = mkdtempSync(join(realpathSync(tmpdir()), 'p3-plays-data-'));
const fixtureMd = toDesignMd(fixtureInput());
writeFileSync(join(fixtureDir, 'fixture.design.md'), fixtureMd);
const cli = spawnSync(process.execPath, ['--import', 'tsx', join(REPO, 'packages/engine/cli.ts'), join(fixtureDir, 'fixture.design.md'), '--out', fixtureDir, '--committed'], { encoding: 'utf8' });

console.log(`Plays the data (#4571): the motion stage's transitions are the emitted presets\n${'='.repeat(78)}`);
ok(cli.status === 0, `fixture: the engine CLI compiles the fixture brief (exit ${cli.status}${cli.status ? `: ${(cli.stderr || cli.stdout).slice(-400)}` : ''})`);
if (cli.status !== 0) process.exit(1);

/** The brands: the start screen's example chips, against the committed emission, and the fixture, pasted. */
const BRANDS: { label: string; chip?: string; paste?: string; emitted: Emitted }[] = [
  ...['prism3', 'aurora', 'harbor'].map((id) => ({ label: id, chip: id, emitted: load(id, OUT) })),
  { label: 'fixture', paste: fixtureMd, emitted: load(FIXTURE_ID, fixtureDir) },
];
// The fixture differs where it means to: a guard that its edits reached the emission at all.
{
  const f = BRANDS.at(-1)!.emitted;
  ok(String(resolve(f.tree, `${f.root}.motion.preset.state.easing`, 'light')).startsWith('linear('), 'fixture: state is eased by a spring in the emission');
  ok(resolve(f.tree, `${f.root}.motion.preset.surface.duration`, 'dark') !== resolve(f.tree, `${f.root}.motion.preset.surface.duration`, 'light'), 'fixture: dark runs at another tempo in the emission');
  ok(f.patterns['toast/enter']?.tracks.find((t) => t.element === 'toast' && t.property === 'transform')?.preset === 'motion.preset.pop', 'fixture: the toast/enter transform track names pop in the agent file');
}

assertBundleFresh({ repo: REPO, bundle: 'apps/studio/dist/main.js', roots: STUDIO_SOURCE_ROOTS, label: 'main.js freshness',
  effect: 'the gate would read the old stage', build: 'npm run -w @prism3/studio build' });

const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json', '.css': 'text/css' };
const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  try {
    const p = join(HERE, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
    const body = readFileSync(p);
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
const ORIGIN = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const browser = await launchWithoutWebFonts(chromium);
/** #4647: every evaluate on every page this suite opens is bounded, so a busy page fails by name in 60 s. Installed
 *  before any page; `lint-chrome-bounds` holds it there. */
const evalBounds = await boundEvaluates(browser, { ms: 60000, where: () => (lastCheck ? `after "${lastCheck.slice(0, 80)}"` : 'before the first check') });

/** The browser's own serialization of a transition's three longhands, for the expected side. */
const normalize = (page: Page, v: { duration: string; easing: string; delay: string }) => page.evaluate((x) => {
  const d = document.createElement('div');
  d.style.transitionProperty = 'opacity';
  d.style.transitionDuration = x.duration;
  d.style.transitionTimingFunction = x.easing;
  d.style.transitionDelay = x.delay;
  document.body.append(d);
  const cs = getComputedStyle(d);
  const out = { duration: cs.transitionDuration, easing: cs.transitionTimingFunction, delay: cs.transitionDelay };
  d.remove();
  return out;
}, v);

/** Each moving element of a pattern on the stage: its computed transition, one entry per property. */
type Moved = { element: string; entries: Record<string, { duration: string; easing: string; delay: string }> };
const movedOn = (page: Page, pattern: string) => page.evaluate((p) => {
  // Splits a computed list on its top-level commas (a `linear()` or `cubic-bezier()` has commas of its own).
  const split = (s: string): string[] => { const out: string[] = []; let depth = 0, cur = ''; for (const ch of s) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; } out.push(cur.trim()); return out; };
  return [...document.querySelectorAll<HTMLElement>('[data-motion-pattern]')].filter((e) => e.dataset.motionPattern === p).map((e) => {
    const cs = getComputedStyle(e);
    const props = split(cs.transitionProperty), dur = split(cs.transitionDuration), ease = split(cs.transitionTimingFunction), del = split(cs.transitionDelay);
    // CSS repeats a shorter list to the property count.
    const entries = Object.fromEntries(props.map((pr, i) => [pr, { duration: dur[i % dur.length]!, easing: ease[i % ease.length]!, delay: del[i % del.length]! }]));
    return { element: e.dataset.motionElement ?? '', entries };
  });
}, pattern) as Promise<Moved[]>;

/** Each timeline bar: its track, its preset, and where it and its lane sit on screen, in px. */
type Bar = { track: string; preset: string; left: number; width: number; laneLeft: number; laneWidth: number };
const timelineOf = (page: Page) => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-p3="motion-timeline-bar"]')]
  .map((b) => {
    const r = b.getBoundingClientRect();
    const l = (b.parentElement ?? b).getBoundingClientRect();
    return { track: b.dataset.motionTrack ?? '', preset: b.dataset.preset ?? '', left: r.left, width: r.width, laneLeft: l.left, laneWidth: l.width };
  })) as Promise<Bar[]>;
const usedByChips = (page: Page) => page.locator('[data-p3="motion-used-by-chip"]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.pattern ?? ''));

const choosePreset = async (page: Page, preset: string): Promise<void> => {
  await page.locator('[data-p3="motion-stage-preset"]').selectOption(preset, { timeout: 15000 });
  await page.waitForFunction((p) => (document.querySelector('[data-p3="motion-stage-preset"]') as HTMLSelectElement | null)?.value === p, preset, { timeout: 5000 });
};
const chooseMode = async (page: Page, mode: string): Promise<void> => {
  const sel = page.locator('[data-p3="mode-select"]');
  if (await sel.isVisible()) await sel.selectOption(mode);
  else await hooks.click(page.locator(`[data-p3="mode-option"][data-mode="${mode}"]`));
  await page.waitForFunction((m) => document.querySelector(`[data-p3="mode-option"][data-mode="${m}"]`)?.getAttribute('aria-checked') === 'true'
    || (document.querySelector('[data-p3="mode-select"]') as HTMLSelectElement | null)?.value === m, mode, { timeout: 5000 });
};

/** Compare one element's entry for a CSS property with what its preset resolves to. */
const compare = async (page: Page, where: string, got: Moved | undefined, cssProp: string, want: { duration: string; easing: string; delay: string }): Promise<void> => {
  const entry = got?.entries[cssProp];
  ok(!!entry, `${where} (${cssProp}): the element is drawn and transitions ${cssProp}${got ? ` (has ${Object.keys(got.entries).join(', ')})` : ' (no element)'}`);
  if (!entry) return;
  const w = await normalize(page, want);
  ok(entry.duration === w.duration, `${where} (${cssProp}): duration ${w.duration}${entry.duration === w.duration ? '' : `, got ${entry.duration}`}`);
  ok(entry.easing === w.easing, `${where} (${cssProp}): easing ${w.easing.length > 60 ? `${w.easing.slice(0, 60)}…` : w.easing}${entry.easing === w.easing ? '' : `, got ${entry.easing.slice(0, 80)}`}`);
  ok(entry.delay === w.delay, `${where} (${cssProp}): delay ${w.delay}${entry.delay === w.delay ? '' : `, got ${entry.delay}`}`);
};

type Want = { duration: string; easing: string; delay: string };
/** Every track of `pattern` against its preset, as the stage's elements compute it now. */
const checkPattern = async (page: Page, at: string, pattern: string, tracks: { element: string; property: string }[], wants: Map<string, Want>, when: string): Promise<void> => {
  const moved = await movedOn(page, pattern);
  for (const t of tracks) {
    const key = `${t.element}.${t.property}`;
    const el = moved.find((m) => m.element === t.element);
    for (const cssProp of CSS_OF[t.property] ?? []) await compare(page, `${at}: pattern '${pattern}' track '${key}' ${when}`, el, cssProp, wants.get(key)!);
  }
};
/** Press the stage's Play or Replay, and say which it was. `play()` rewrites each mover's transition as it runs. */
const press = async (page: Page): Promise<string> => {
  const btn = page.locator('[data-p3="motion-stage-play"]');
  const label = ((await btn.textContent()) ?? '').trim();
  await hooks.click(btn);
  return label;
};
/** How many CSS transitions are running on the stage's elements of `pattern`: more than none once it plays. */
const runningOn = (page: Page, pattern: string) => page.evaluate((p) => [...document.querySelectorAll<HTMLElement>('[data-motion-pattern]')]
  .filter((x) => x.dataset.motionPattern === p).flatMap((x) => x.getAnimations()).filter((a) => a.constructor.name === 'CSSTransition' && a.playState === 'running').length, pattern);
/** A Motion edit that leaves the brand as it was: the tempo moved to another value, then back. The second edit changes
 *  the data the stage drew, so the stage plays once by itself (D9 A), on the brand's own timings again. False where the
 *  mode's controls are held (a derived mode, Q59). */
const TEMPO_CHIPS: Record<string, string> = { snappy: '[data-p3="tempo-snappy"]', standard: '[data-p3="tempo-standard"]', relaxed: '[data-p3="tempo-relaxed"]' };
const motionEdit = async (page: Page): Promise<boolean> => {
  const now = await page.evaluate((chips) => Object.keys(chips).find((t) => {
    const c = document.querySelector<HTMLButtonElement>(chips[t]!);
    return c && !c.disabled && c.getAttribute('aria-checked') === 'true';
  }) ?? null, TEMPO_CHIPS);
  if (!now) return false;
  const checked = (t: string) => page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute('aria-checked') === 'true', TEMPO_CHIPS[t]!, { timeout: 5000 });
  const other = Object.keys(TEMPO_CHIPS).find((t) => t !== now)!;
  await hooks.click(page.locator(TEMPO_CHIPS[other]!));
  await checked(other);
  await hooks.click(page.locator(TEMPO_CHIPS[now]!));
  await checked(now);
  return true;
};
/** One time axis (§3.2): every lane starts at the same x and is as wide, and two tracks on the same duration and delay
 *  (by the emitted tree, not by the stage) draw bars of the same start and length, within 1px. */
const timelineAxis = (at: string, bars: Bar[], wants: Map<string, Want>): void => {
  const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1;
  const lanes = bars.filter((x) => !near(x.laneLeft, bars[0]!.laneLeft) || !near(x.laneWidth, bars[0]!.laneWidth));
  ok(bars.length > 0 && lanes.length === 0, `${at}: the timeline's lanes share one time axis (${bars.map((x) => `${x.track} ${x.laneLeft.toFixed(1)}+${x.laneWidth.toFixed(1)}`).join(', ')})`);
  for (const [i, x] of bars.entries()) for (const y of bars.slice(i + 1)) {
    const wx = wants.get(x.track), wy = wants.get(y.track);
    if (!wx || !wy || wx.duration !== wy.duration || wx.delay !== wy.delay) continue;
    const same = near(x.left, y.left) && near(x.width, y.width);
    ok(same, `${at}: tracks '${x.track}' and '${y.track}' (${wx.duration}, delay ${wx.delay}) draw equal bars${same ? '' : `, got ${x.left.toFixed(1)}+${x.width.toFixed(1)} and ${y.left.toFixed(1)}+${y.width.toFixed(1)}`}`);
  }
};

try {
  for (const b of BRANDS) {
    const e = b.emitted;
    console.log(`\n${b.label} (${e.root})\n${'-'.repeat(78)}`);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    // tsx compiles this file with esbuild's keepNames, which wraps a named function in `__name(…)`; a function this
    // suite hands the page carries that call, so the page gets the identity it stands for.
    await ctx.addInitScript('globalThis.__name = (f) => f;');
    const page = await ctx.newPage();
    await hooks.watch(page);
    const errors: string[] = [];
    page.on('pageerror', (x) => errors.push(`uncaught: ${x.message}`));
    try {
      await page.goto(`${ORIGIN}/index.html`, { waitUntil: 'networkidle' });
      if (b.chip) await hooks.click(page.locator('[data-p3="start-example"]').filter({ hasText: b.chip }));
      else {
        await hooks.need(page, '[data-p3="start-paste"]');
        await page.fill('[data-p3="start-paste"]', b.paste!);
        await hooks.click(page.locator('[data-p3="start-import"]'));
      }
      await hooks.need(page, '[data-p3="frame"]');
      await hooks.click(page.locator('[data-p3="tab-motion"]'));
      await hooks.need(page, '[data-p3="motion-stage-block"]');

      const presets = Object.keys((at(e.tree, `${e.root}.motion.preset`) ?? {}) as object).filter((k) => !k.startsWith('$'));
      const patternNames = Object.keys(e.patterns);
      ok(patternNames.length >= MIN_PATTERNS, `${b.label}: the agent file lists ${patternNames.length} patterns (floor ${MIN_PATTERNS})`);
      const usersOf = (preset: string): string[] => patternNames.filter((p) => e.patterns[p]!.tracks.some((t) => t.preset === `motion.preset.${preset}` || t.preset === `motion.preset.${preset}.exit`));

      // USED BY, once per brand: each preset's chips are the patterns that name it or its exit half.
      for (const preset of presets) {
        await choosePreset(page, preset);
        const chips = await usedByChips(page);
        const want = usersOf(preset);
        ok(JSON.stringify([...chips].sort()) === JSON.stringify([...want].sort()), `${b.label}: Used by ${preset} is ${want.length ? want.join(', ') : 'nothing (a specimen)'}${JSON.stringify([...chips].sort()) === JSON.stringify([...want].sort()) ? '' : `, got ${chips.join(', ') || 'nothing'}`}`);
      }

      const modes = await page.evaluate(() => {
        const sel = document.querySelector<HTMLSelectElement>('[data-p3="mode-select"]');
        const fromSel = sel ? [...sel.options].map((o) => o.value) : [];
        const fromRadios = [...document.querySelectorAll<HTMLElement>('[data-p3="mode-option"]')].map((r) => r.dataset.mode ?? '');
        return [...new Set([...fromSel, ...fromRadios])].filter(Boolean);
      });
      ok(modes.length >= 2, `${b.label}: the preview offers ${modes.length} modes (${modes.join(', ')})`);
      const pressed = new Set<string>();
      let edits = 0;
      for (const mode of modes) {
        await chooseMode(page, mode);
        let patternsSeen = 0;
        let tracksSeen = 0;
        for (const [pi, pattern] of patternNames.entries()) {
          const tracks = e.patterns[pattern]!.tracks;
          const preset = tracks[0]!.preset.replace(/^motion\.preset\./, '').replace(/\.exit$/, '');
          await choosePreset(page, preset);
          await hooks.click(page.locator(`[data-p3="motion-used-by-chip"][data-pattern="${pattern}"]`));
          await page.waitForFunction((p) => document.querySelector('[data-p3="motion-scene"]')?.getAttribute('data-pattern') === p, pattern, { timeout: 5000 });
          const bars = await timelineOf(page);
          ok(bars.length === tracks.length, `${b.label} ${mode}: pattern '${pattern}': the timeline has one bar per track (${bars.length} of ${tracks.length})`);
          patternsSeen++;
          const wants = new Map<string, { duration: string; easing: string; delay: string }>();
          for (const t of tracks) wants.set(`${t.element}.${t.property}`, await normalize(page, expectedOf(e, t.preset, mode)));
          for (const t of tracks) {
            const key = `${t.element}.${t.property}`;
            const bar = bars.find((x) => x.track === key);
            ok(!!bar && `motion.preset.${bar.preset}` === t.preset, `${b.label} ${mode}: pattern '${pattern}' track '${key}': its timeline bar names ${t.preset.replace(/^motion\.preset\./, '')}${bar ? (`motion.preset.${bar.preset}` === t.preset ? '' : `, got ${bar.preset}`) : ', no bar'}`);
            tracksSeen++;
          }
          timelineAxis(`${b.label} ${mode}: pattern '${pattern}'`, bars, wants);
          // At rest, then after Play or Replay: `play()` rewrites every mover's transition, and that is what plays.
          await checkPattern(page, `${b.label} ${mode}`, pattern, tracks, wants, 'at rest');
          const label = await press(page);
          pressed.add(label);
          await checkPattern(page, `${b.label} ${mode}`, pattern, tracks, wants, `after ${label}`);
          // Once per mode, on its first pattern: a Motion edit plays the stage by itself (D9 A); then Replay.
          if (pi === 0 && await motionEdit(page)) {
            edits++;
            ok(await runningOn(page, pattern) > 0, `${b.label} ${mode}: pattern '${pattern}': a Motion edit plays the stage (its transitions are running)`);
            await checkPattern(page, `${b.label} ${mode}`, pattern, tracks, wants, 'after a Motion edit');
            const again = await press(page);
            ok(again === 'Replay', `${b.label} ${mode}: after a Motion edit the stage's button says Replay (says ${again})`);
            await checkPattern(page, `${b.label} ${mode}`, pattern, tracks, wants, `after ${again}, after a Motion edit`);
          }
        }
        ok(patternsSeen === patternNames.length && tracksSeen > 0, `${b.label} ${mode}: every pattern reached through the stage (${patternsSeen} of ${patternNames.length}, ${tracksSeen} tracks)`);

        // The specimens: the presets no pattern names, each on every property its specimen moves, at rest and played.
        for (const preset of presets.filter((p) => usersOf(p).length === 0)) {
          await choosePreset(page, preset);
          await hooks.need(page, '[data-p3="motion-used-by-none"]');
          const want = expectedOf(e, `motion.preset.${preset}`, mode);
          for (const when of ['at rest', 'played'] as const) {
            const label = when === 'played' ? await press(page) : '';
            const moved = await movedOn(page, `specimen:${preset}`);
            const props = moved.flatMap((m) => Object.keys(m.entries).map((p) => [m, p] as const));
            const tag = when === 'played' ? `after ${label}` : 'at rest';
            ok(props.length > 0, `${b.label} ${mode}: specimen '${preset}' ${tag}: moves something (${props.map(([m, p]) => `${m.element}.${p}`).join(', ') || 'nothing'})`);
            for (const [m, p] of props) await compare(page, `${b.label} ${mode}: specimen '${preset}' element '${m.element}' ${tag}`, m, p, want);
          }
        }
      }
      ok(pressed.has('Play') && pressed.has('Replay'), `${b.label}: the stage was read after Play and after Replay (${[...pressed].join(', ') || 'neither'})`);
      ok(edits > 0, `${b.label}: the stage was read after a Motion edit in ${edits} mode(s)`);
      ok(errors.length === 0, `${b.label}: no page errors${errors.length ? ` (${errors.slice(0, 3).join(' | ')})` : ''}`);
    } catch (x) {
      ok(false, `${b.label}: the run reached its end (${(x as Error).message.split('\n')[0]})`);
    } finally { await ctx.close(); }
  }
} finally {
  await browser.close();
  server.close();
  rmSync(fixtureDir, { recursive: true, force: true });
}

hooks.report(ok);
console.log(`bounded calls (#4647): ${evalBounds.calls} settled; the slowest took ${(evalBounds.slowestMs / 1000).toFixed(1)}s of the 60s bound`);
console.log(`\n${executed - failed}/${executed} passed`);
if (failed) { console.error(`✗ plays the data: ${failed} failed`); process.exit(1); }
console.log('✓ plays the data');
