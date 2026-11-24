/**
 * KPI 1, DEVELOPER + CLI: THE SCRIPTED FLOOR (#3408, plan item 4), with KPI 3's one-edit check.
 *
 *   npx tsx tools/poc-kpi1/kpi1.ts --run scratch          (from a fresh copy to a built, checked component set)
 *   npx tsx tools/poc-kpi1/kpi1.ts --run update           (the scratch run as setup, then one edit, propagated)
 *   npx tsx tools/poc-kpi1/kpi1.ts --run <r> --keep       (leave the copy in $TMPDIR and print where)
 *   npx tsx tools/poc-kpi1/kpi1.ts --run scratch --plant drift      (a generated file that isn't the committed one)
 *   npx tsx tools/poc-kpi1/kpi1.ts --run update --plant skip-cli    (the edit made, the CLI not run after it)
 *   npx tsx tools/poc-kpi1/kpi1.ts --run update --plant skip-build  (the tokens emitted, the token CSS and Storybook not rebuilt)
 *   npx tsx tools/poc-kpi1/kpi1.ts --self-test            (the judges and the summary lines, on planted data)
 *
 * THE COPY. Each run works in a copy of this tree in `$TMPDIR`, never in the tree itself: the files git tracks plus
 * the untracked ones it doesn't ignore, as a fresh checkout of the measured commit holds them (`dirty` on the record
 * says when the tree differs from the commit). Making the copy stands in for `git clone` and is untimed.
 *
 * FROM SCRATCH. The copy loses every output the run must make (`GENERATED`, written here by hand): the brand's token
 * files, the component CSS, the elements and their manifest. `packages/tokens/dist` and the Storybook build are never
 * committed, so the copy has none. Then, timed, in order: `npm ci`, the engine CLI on the brand input, the two
 * component generators, and the Storybook build (which builds the token CSS first, as its script says).
 * It SUCCEEDS when every command exits 0 on its first try, every removed file is back and equal to the committed one
 * (the CLI's `build` stamp aside: a live run stamps it, a committed file doesn't), and `check-build.ts` passes on the
 * copy's Storybook: every story is there, renders its state, and both forms agree. The checks are untimed.
 *
 * THE UPDATE. Setup is the scratch run (untimed, not counted). Then, timed: one hand edit to the brand input (`EDIT`:
 * the primary color and the radius scale), the engine CLI, and the Storybook build. Nothing else: the component CSS and
 * elements bind token names, not values. The run proves that, rather than assuming it: both generators' `--check` must
 * pass after the edit, or the run FAILs, naming the generator the update also needed. Then KPI 3's check
 * (`one-edit.ts`): each probe's computed value, in both forms and both themes, read before and after the edit, against
 * the emitted DTCG before and after.
 *
 * WHAT IT LOGS: the wall-clock seconds; each command, with its seconds; the hand edits, the update's own edit counted
 * apart from fixes (a fix is a hand edit the run needed beyond the one it was asked to make; the script makes none, so a
 * run that would need one fails instead); the errors (a command that exits non-zero ends the run, so a passing run has
 * 0 and was right first time). A person's run (B2 on #3408) is separate: this is the floor it is compared with.
 *
 * OWNER DECISION K1 (#3408, pending): whether the from-scratch time includes `npm ci`. The value is A, timed; the line
 * names the install's own seconds and the decision, so either reading is on the card. `K1` below.
 *
 * A measurement, not a CI gate: it needs the npm registry (a warm cache serves it) and Chromium. It exits 1 on any
 * failure, with a FAIL line, so the scorecard's cell reads FAIL, never a time.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { asComputed, expected, judge, key, resolveToken, PROBES, FORMS, THEMES, type Reading } from './one-edit';

const HERE = import.meta.dirname ?? '';
const REPO = resolve(HERE, '../..');

/** What a from-scratch run must make, written by hand from the packages' READMEs (never read off a generator). */
export const GENERATED = [
  'packages/engine/out/prism3.tokens.json',
  'packages/engine/out/prism3.ai.json',
  'packages/engine/out/prism3.base.tokens.json',
  'packages/engine/out/prism3.dark.overlay.tokens.json',
  'packages/engine/out/prism3.hc-dark.overlay.tokens.json',
  'packages/engine/out/prism3.hc-light.overlay.tokens.json',
  'packages/css/button.css',
  'packages/css/field-label.css',
  'packages/css/field-message.css',
  'packages/css/text-field.css',
  'packages/css/password-field.css',
  'packages/css/demo.html',
  'packages/web-components/p3-button.js',
  'packages/web-components/p3-text-field.js',
  'packages/web-components/p3-password-field.js',
  'packages/web-components/custom-elements.json',
];
/** Never committed, so a fresh checkout has neither; removed anyway, so a stray local build can't stand in. */
const UNCOMMITTED = ['packages/tokens/dist', 'apps/storybook/storybook-static'];

export const BRAND_INPUT = 'packages/engine/examples/prism3.design.md';
/**
 * The update (#3408 KPI 1: "change the primary color and radius"). Each line must occur exactly once in the brand
 * input. The primary moves from the blue to a green, and the radius from the standard stop (1) to round (2), which
 * doubles every corner. Arm 2 runs the same change by value.
 */
export const EDIT: { what: string; from: string; to: string }[] = [
  { what: 'the primary color', from: 'primary: { l: 0.4709, c: 0.3001, h: 266.75 }', to: 'primary: { l: 0.52, c: 0.14, h: 160 }' },
  { what: 'the radius scale', from: 'radiusScale: 1', to: 'radiusScale: 2' },
];
/** K1 on #3408: is `npm ci` inside the from-scratch time? A (timed) until the owner answers. */
export const K1: { timed: boolean; state: 'pending' | 'answered' } = { timed: true, state: 'pending' };

export type Run = 'scratch' | 'update';
type Step = { kind: 'command' | 'edit'; what: string; seconds: number };
export type Result = { run: Run; steps: Step[]; seconds: number; installSeconds: number; probes: number; failure: string | null; copy: string };

const tsx = (f: string, ...a: string[]) => ['npx', 'tsx', f, ...a];
const SCRATCH: { what: string; argv: string[]; install?: true; plant?: string }[] = [
  { what: 'npm ci', argv: ['npm', 'ci', '--no-audit', '--no-fund', '--prefer-offline'], install: true },
  { what: `npx tsx packages/engine/cli.ts ${BRAND_INPUT}`, argv: tsx('packages/engine/cli.ts', BRAND_INPUT), plant: 'skip-cli' },
  { what: 'npm run -w @prism3/css generate', argv: ['npm', 'run', '-w', '@prism3/css', 'generate'] },
  { what: 'npm run -w @prism3/web-components generate', argv: ['npm', 'run', '-w', '@prism3/web-components', 'generate'] },
  { what: 'npm run -w @prism3/storybook build', argv: ['npm', 'run', '-w', '@prism3/storybook', 'build'], plant: 'skip-build' },
];
/** `--plant drift`: a generator that writes something other than the committed file, planted after the scratch run. */
const DRIFT = 'packages/css/button.css';
const UPDATE = SCRATCH.filter((s) => /cli\.ts|storybook build/.test(s.what));

// ------------------------------------------------------------------------------------------------ pure parts
/** Equal but for the CLI's `build` stamp under any `generator`: a live run writes one, the committed file doesn't. */
export const sameOutput = (file: string, committed: string, made: string): boolean => {
  if (committed === made) return true;
  if (!file.endsWith('.json')) return false;
  const strip = (s: string) => JSON.stringify(JSON.parse(s), (k, v) => (v && typeof v === 'object' && !Array.isArray(v) && k === 'generator' ? { ...v, build: undefined } : v));
  try { return strip(committed) === strip(made); } catch { return false; }
};

/** Each removed file that did not come back, or came back different, by name. */
export const regenerated = (files: string[], committed: Record<string, string>, made: Record<string, string | null>): string[] =>
  files.flatMap((f) => made[f] == null ? [`${f} was not made`] : sameOutput(f, committed[f], made[f]!) ? [] : [`${f} is not the committed file`]);

/** The brand input with the update made: each line replaced, or the reason it can't be. */
export const applyEdit = (text: string): { text: string; error: string | null } => {
  let out = text;
  for (const e of EDIT) {
    const n = out.split('\n').filter((l) => l === e.from).length;
    if (n !== 1) return { text, error: `${BRAND_INPUT} has ${n} lines reading "${e.from}" (${e.what}), not 1` };
    out = out.split('\n').map((l) => (l === e.from ? e.to : l)).join('\n');
  }
  return { text: out, error: null };
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** The one summary line a passing run prints, which the scorecard parses. */
export const summary = (r: Result): string => {
  const commands = r.steps.filter((s) => s.kind === 'command').length;
  const edits = r.steps.filter((s) => s.kind === 'edit').length;
  const k1 = `install ${r.installSeconds}s (K1 ${K1.timed ? 'A: timed' : 'B: untimed'}${K1.state === 'pending' ? ', pending' : ''})`;
  return r.run === 'scratch'
    ? `OK kpi1 (scratch): ${r.seconds} seconds; ${plural(commands, 'command')}, ${plural(edits, 'hand edit')}, 0 fixes, 0 errors, first try; ${k1}`
    : `OK kpi1 (update): ${r.seconds} seconds; ${plural(commands, 'command')}, ${plural(edits, 'hand edit')} (the update), 0 fixes, 0 errors, first try`;
};

/** KPI 3's line: the readings, each a probe in one form and one theme. */
export const oneEditLine = (readings: number) =>
  `OK one edit: ${readings} readings reach the edited tokens, ${PROBES.length} probes in both forms and both themes, from 1 edit (${PROBES.map((p) => p.name).join(', ')})`;

// ------------------------------------------------------------------------------------------------ the run
const sh = (argv: string[], cwd: string) => spawnSync(argv[0], argv.slice(1), { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });
const firstError = (out: string) => (out.split('\n').find((l) => /^(FAIL|✖|npm error|Error)/.test(l.trim())) ?? out.trim().split('\n').slice(-1)[0] ?? '').trim().slice(0, 300);

/** A copy of this tree in `$TMPDIR`: tracked files, plus untracked ones git doesn't ignore. */
const copyTree = (dest: string) => {
  const ls = sh(['git', 'ls-files', '-z', '-co', '--exclude-standard'], REPO);
  const files = ls.stdout.split('\0').filter((f) => f && existsSync(join(REPO, f)));
  const r = spawnSync('sh', ['-c', 'tar --null -T - -cf - | tar -xf - -C "$0"', dest], { cwd: REPO, input: files.join('\0'), maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`FAIL kpi1: copying the tree failed: ${String(r.stderr).trim().slice(0, 300)}`);
};

export const kpi1 = (run: Run, opts: { plant?: string; keep?: boolean } = {}): Result => {
  const tmp = mkdtempSync(join(tmpdir(), `prism3-kpi1-${run}-`));
  const res: Result = { run, steps: [], seconds: 0, installSeconds: 0, probes: 0, failure: null, copy: tmp };
  const outside = relative(REPO, tmp);
  try {
    if (!(outside.startsWith('..') || isAbsolute(outside))) throw new Error(`FAIL kpi1 (${run}): the copy ${tmp} is inside the repo`);
    copyTree(tmp);
    const committed = Object.fromEntries(GENERATED.map((f) => [f, readFileSync(join(tmp, f), 'utf8')]));
    for (const f of [...GENERATED, ...UNCOMMITTED]) rmSync(join(tmp, f), { recursive: true, force: true });

    // Steps are logged only for the timed run: the scratch run itself, or the update after its untimed setup.
    const go = (steps: typeof SCRATCH, timed: boolean, label: Run) => {
      for (const s of steps) {
        if (timed && s.plant && s.plant === opts.plant) continue;
        const t = Date.now();
        const r = sh(s.argv, tmp);
        const seconds = (Date.now() - t) / 1000;
        if (timed) res.steps.push({ kind: 'command', what: s.what, seconds });
        if (timed && s.install) res.installSeconds = Math.round(seconds * 10) / 10;
        if (r.status !== 0) throw new Error(`FAIL kpi1 (${label}): ${timed ? '' : 'setup '}step "${s.what}" exited ${r.status}: ${firstError(`${r.stderr}\n${r.stdout}`)}`);
      }
    };
    const checkScratch = (label: Run) => {
      const made = Object.fromEntries(GENERATED.map((f) => [f, existsSync(join(tmp, f)) ? readFileSync(join(tmp, f), 'utf8') : null]));
      const bad = regenerated(GENERATED, committed, made);
      if (bad.length) throw new Error(`FAIL kpi1 (${label}): ${plural(bad.length, 'generated file')} not reproduced from scratch: ${bad.join('; ')}`);
      const c = sh(tsx('apps/storybook/check-build.ts'), tmp);
      if (c.status !== 0) throw new Error(`FAIL kpi1 (${label}): the Storybook build check fails: ${firstError(`${c.stderr}\n${c.stdout}`)}`);
    };

    if (run === 'scratch') {
      const t0 = Date.now();
      go(SCRATCH, true, 'scratch');
      if (opts.plant === 'drift') writeFileSync(join(tmp, DRIFT), `${readFileSync(join(tmp, DRIFT), 'utf8')}/* drift */\n`);
      res.seconds = Math.round((Date.now() - t0 - (K1.timed ? 0 : res.installSeconds * 1000)) / 100) / 10;
      checkScratch('scratch');
      return res;
    }

    go(SCRATCH, false, 'update');
    checkScratch('update');
    const outDir = join(tmp, 'packages/engine/out');
    const wantBefore = expected(outDir);
    const before = readProbes(tmp);

    const t0 = Date.now();
    const s = Date.now();
    const edited = applyEdit(readFileSync(join(tmp, BRAND_INPUT), 'utf8'));
    if (edited.error) throw new Error(`FAIL kpi1 (update): ${edited.error}`);
    writeFileSync(join(tmp, BRAND_INPUT), edited.text);
    res.steps.push({ kind: 'edit', what: `edit ${BRAND_INPUT}: ${EDIT.map((e) => e.what).join(' and ')}`, seconds: (Date.now() - s) / 1000 });
    go(UPDATE, true, 'update');
    res.seconds = Math.round((Date.now() - t0) / 100) / 10;

    for (const [pkg, gen] of [['@prism3/css', 'packages/css/generate.ts'], ['@prism3/web-components', 'packages/web-components/generate.ts']]) {
      const c = sh(tsx(gen, '--check'), tmp);
      if (c.status !== 0) throw new Error(`FAIL kpi1 (update): the edit also needs ${pkg} regenerated, which the update did not run: ${firstError(`${c.stderr}\n${c.stdout}`)}`);
    }
    const bad = judge(before, readProbes(tmp), wantBefore, expected(outDir));
    if (bad.length) throw new Error(`FAIL one edit: ${plural(bad.length, 'reading')} wrong: ${bad.join('; ')}`);
    res.probes = Object.keys(wantBefore).length;
  } catch (e) {
    const m = (e as Error).message;
    res.failure = m.startsWith('FAIL') ? m : `FAIL kpi1 (${run}): ${m}`;
  } finally {
    if (!opts.keep) rmSync(tmp, { recursive: true, force: true });
  }
  return res;
};

const readProbes = (copy: string): Reading => {
  const r = sh(tsx('tools/poc-kpi1/one-edit.ts', '--read'), copy);
  if (r.status !== 0) throw new Error(firstError(`${r.stderr}\n${r.stdout}`) || `the browser read exited ${r.status}`);
  return JSON.parse(r.stdout.trim().split('\n').filter((l) => l.startsWith('{')).slice(-1)[0] ?? '{}');
};

// ------------------------------------------------------------------------------------------------ self-test
const readings = (f: (p: (typeof PROBES)[number], form: string, theme: string) => string): Reading =>
  Object.fromEntries(PROBES.flatMap((p) => FORMS.flatMap((form) => THEMES.map((theme) => [key(p, form, theme), f(p, form, theme)]))));
const old = readings((p, _f, t) => `${p.name}/${t}/0`);
const now = readings((p, _f, t) => `${p.name}/${t}/1`);
const BRAND = readFileSync(resolve(REPO, BRAND_INPUT), 'utf8');
const asIs = (b: object, o: object | null, p: string) => asComputed(resolveToken(b as never, o as never, p));

export const SELF: { name: string; check: () => string | null }[] = [
  { name: 'a run whose every probe reaches the edited token in both forms and themes passes', check: () => {
    const bad = judge(old, now, old, now);
    return bad.length ? bad.join('; ') : null; } },
  { name: 'an element form left at the old value fails by probe, form and theme', check: () => {
    const after = { ...now, [key(PROBES[0], 'element', 'dark')]: old[key(PROBES[0], 'element', 'dark')] };
    const bad = judge(old, after, old, now);
    return bad.length === 1 && bad[0].startsWith('button fill (element, dark): computes ') && bad[0].endsWith('(unchanged: the edit did not reach it)') ? null : JSON.stringify(bad); } },
  { name: 'a probe read in one form only fails as not read, by name', check: () => {
    const after = { ...now };
    delete after[key(PROBES[2], 'html', 'light')];
    const bad = judge(old, after, old, now);
    return bad.join() === 'text field corner (html, light): not read after the edit' ? null : JSON.stringify(bad); } },
  { name: 'a token the edit did not move fails: the probe would measure nothing', check: () => {
    const flat = readings((p, f, t) => (p.name === 'button corner' ? `same/${t}` : now[key(p, f, t)]));
    const flatBefore = readings((p, f, t) => (p.name === 'button corner' ? `same/${t}` : old[key(p, f, t)]));
    const bad = judge(flatBefore, flat, flatBefore, flat);
    return bad.length === 2 && bad.every((b) => b.startsWith('button corner (') && b.includes('the edit did not move pds3.radius.md')) ? null : JSON.stringify(bad); } },
  { name: 'a probe that reads the wrong thing before the edit fails by name', check: () => {
    const before = { ...old, [key(PROBES[1], 'html', 'light')]: 'rgb(0, 0, 0)' };
    const bad = judge(before, now, old, now);
    return bad.length === 1 && bad[0].startsWith('button corner (html, light): computes rgb(0, 0, 0) before the edit') ? null : JSON.stringify(bad); } },
  { name: 'the oracle resolves aliases through the dark overlay first, then the base, and writes hex as the browser does', check: () => {
    const base = { r: { a: { $value: '{r.b}' }, b: { $value: '#1e1eff' }, c: { $value: '#000000' }, d: { $value: { value: 8, unit: 'px' } } } };
    const dark = { r: { b: { $value: '{r.c}' } } };
    const got = [asIs(base, null, 'r.a'), asIs(base, dark, 'r.a'), asIs(base, null, 'r.d')];
    return got.join() === 'rgb(30, 30, 255),rgb(0, 0, 0),8px' ? null : got.join(); } },
  { name: 'a regenerated file equal but for the CLI build stamp passes; any other difference, or a missing file, fails by name', check: () => {
    const c = '{"x":{"generator":{"version":"1"}},"y":1}';
    const stamped = '{"x":{"generator":{"version":"1","build":"1+pending.3"}},"y":1}';
    const bad = regenerated(['a.json', 'b.json', 'c.css', 'd.css'], { 'a.json': c, 'b.json': c, 'c.css': 'x', 'd.css': 'x' }, { 'a.json': stamped, 'b.json': stamped.replace('"y":1', '"y":2'), 'c.css': null, 'd.css': 'x' });
    return bad.join('; ') === 'b.json is not the committed file; c.css was not made' ? null : bad.join('; '); } },
  { name: 'the update edits both lines of the real brand input once, and names a line it can\'t find', check: () => {
    const ok = applyEdit(BRAND);
    if (ok.error) return ok.error;
    // The brief's two changes, written here by hand, never read from EDIT: the primary anchor and the radius scale.
    const keys = ok.text.split('\n').filter((l, i) => l !== BRAND.split('\n')[i]).map((l) => l.split(':')[0]);
    if (keys.join() !== 'primary,radiusScale') return `the update changes ${JSON.stringify(keys)}, not the primary color and the radius scale`;
    const miss = applyEdit(BRAND.replace(EDIT[1].from, 'radiusScale: soft'));
    return miss.error === `${BRAND_INPUT} has 0 lines reading "radiusScale: 1" (the radius scale), not 1` ? null : `read as edited: ${miss.error}`; } },
  { name: 'GENERATED names files the repo commits, each once', check: () => {
    const missing = GENERATED.filter((f) => !existsSync(resolve(REPO, f)));
    return missing.length || new Set(GENERATED).size !== GENERATED.length ? `missing or repeated: ${missing.join(', ')}` : null; } },
  { name: 'the summary lines name the time, commands, hand edits, fixes, errors and the install with K1', check: () => {
    const base = { seconds: 21.4, installSeconds: 6.1, probes: 0, failure: null, copy: '' };
    const s = summary({ ...base, run: 'scratch', steps: SCRATCH.map((x) => ({ kind: 'command' as const, what: x.what, seconds: 1 })) });
    const u = summary({ ...base, run: 'update', seconds: 6.2, steps: [{ kind: 'edit', what: 'e', seconds: 0 }, ...UPDATE.map((x) => ({ kind: 'command' as const, what: x.what, seconds: 1 }))] });
    const want = [`OK kpi1 (scratch): 21.4 seconds; 5 commands, 0 hand edits, 0 fixes, 0 errors, first try; install 6.1s (K1 A: timed${K1.state === 'pending' ? ', pending' : ''})`,
      'OK kpi1 (update): 6.2 seconds; 2 commands, 1 hand edit (the update), 0 fixes, 0 errors, first try'];
    return s === want[0] && u === want[1] ? null : `${s}\n${u}`; } },
];

if (process.argv[1] && resolve(process.argv[1]) === resolve(HERE, 'kpi1.ts')) {
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  if (process.argv.includes('--self-test')) {
    let bad = 0;
    for (const t of SELF) { const why = t.check(); if (why === null) console.log(`OK self-test: ${t.name}`); else { bad++; console.error(`FAIL self-test: ${t.name}: ${why}`); } }
    process.exit(bad ? 1 : 0);
  }
  const run = arg('--run') as Run;
  if (run !== 'scratch' && run !== 'update') { console.error('usage: kpi1.ts --run scratch|update [--keep] [--plant drift|skip-cli|skip-build] | --self-test'); process.exit(2); }
  const r = kpi1(run, { plant: arg('--plant'), keep: process.argv.includes('--keep') });
  console.log(`kpi1 (${run}), copy at ${r.copy}${process.argv.includes('--keep') ? ' (kept)' : ' (removed)'}`);
  for (const s of r.steps) console.log(`  step: ${s.kind === 'edit' ? 'edit   ' : 'command'} ${s.what} [${s.seconds.toFixed(1)}s]`);
  if (r.failure) { console.error(r.failure); console.log(r.failure); process.exit(1); }
  console.log(summary(r));
  if (run === 'update') console.log(oneEditLine(r.probes));
}
