/**
 * EJECTION, BOTH MODES (#3408, plan item 3; owner decisions Q32 A and Q84 A): build a standalone client OUTSIDE the
 * repo, with the brand's tokens and all three POC components (button, text field, password field) in both delivery
 * forms (plain HTML/CSS and the custom elements), check that it builds clean and renders, and measure what it cost
 * and what it still points at.
 *
 *   npx tsx tools/poc-ejection/eject.ts --mode package      (install every package from `npm pack` tarballs)
 *   npx tsx tools/poc-ejection/eject.ts --mode source       (copy the component source in; the tokens stay a tarball)
 *   npx tsx tools/poc-ejection/eject.ts --mode <m> --keep   (leave the client in $TMPDIR and print where)
 *   npx tsx tools/poc-ejection/eject.ts --mode <m> --plant file-link|engine-import|repo-url   (a planted leak)
 *   npx tsx tools/poc-ejection/eject.ts --self-test         (the counter and the summary line, on planted fixtures)
 *
 * WHAT IT MEASURES, per mode:
 *   - the STEPS a client takes, each a command it runs or a file it writes by hand, in order;
 *   - the WALL-CLOCK seconds from the first step to a built client (the browser check is timed apart);
 *   - the REFERENCES LEFT TO PRISM3, in two counts kept apart (`refs.ts`): (a) references back into the repo or
 *     workspace, and (b) `@prism3/*` package names;
 *   - HOW AN UPSTREAM CHANGE ARRIVES: for each piece, the channel the client has (a package version it can bump, or
 *     none). A measurement only, until #3411 is built.
 *
 * WHICH COUNT IS SCORED is owner decision D1 on #3408. Until it is answered, the plan's recommended option A is
 * scored: count (a), with a target of 0. The summary line says "D1 pending" while it is.
 *
 * WHAT FAILS (exit 1, so the scorecard's cell reads FAIL with this tool's FAIL line, never a count): a step that
 * fails, a build that warns, a render check that fails, or a scored count above 0. A measurement, not a CI gate: it
 * needs the npm registry for Lit and esbuild (the npm cache serves them when warm), and Chromium for the render check.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { byKind, countRefs, KIND, readRepo, scanFile, type Count, type Repo } from './refs';

const HERE = import.meta.dirname ?? '';
const REPO = resolve(HERE, '../..');

export type Mode = 'package' | 'source';
/** The `@prism3/*` packages each mode installs, as the plan states them (Q32 A), not read off the client. */
export const DELIVERED: Record<Mode, string[]> = {
  package: ['@prism3/tokens', '@prism3/css', '@prism3/web-components'],
  source: ['@prism3/tokens'],
};
/** The scored count. D1 (#3408) decides it; until then the plan's recommended option A, count (a). */
export const SCORED: { count: 'a' | 'b'; d1: 'pending' | 'answered' } = { count: 'a', d1: 'pending' };
/** The client's bundler, pinned to the version the repo's lockfile already holds, so a warm npm cache serves it. */
const ESBUILD = '0.24.2';
const PACKAGES: Record<string, string> = {
  '@prism3/tokens': 'packages/tokens', '@prism3/css': 'packages/css', '@prism3/web-components': 'packages/web-components',
};

type Step = { kind: 'command' | 'file'; what: string; seconds: number };
export type Result = {
  mode: Mode; steps: Step[]; seconds: number; checkSeconds: number; count: Count; upstream: string[];
  failure: string | null; client: string;
};

// ------------------------------------------------------------------------------------------------ the run
export const eject = (mode: Mode, opts: { plant?: string; keep?: boolean } = {}): Result => {
  const tmp = mkdtempSync(join(tmpdir(), `prism3-eject-${mode}-`));
  const outside = relative(REPO, tmp);
  const client = join(tmp, 'client');
  const tarballs = join(tmp, 'tarballs');
  const steps: Step[] = [];
  const res: Result = { mode, steps, seconds: 0, checkSeconds: 0, count: { a: [], b: { occurrences: 0, names: [] }, installed: [], scanned: [] }, upstream: [], failure: null, client };
  if (!(outside.startsWith('..') || isAbsolute(outside))) { res.failure = `FAIL eject (${mode}): the client folder ${tmp} is inside the repo`; return res; }
  mkdirSync(client, { recursive: true });
  mkdirSync(tarballs, { recursive: true });

  const t0 = Date.now();
  const cmd = (what: string, argv: string[], cwd: string): string => {
    const s = Date.now();
    const r = spawnSync(argv[0], argv.slice(1), { cwd, encoding: 'utf8', maxBuffer: 1 << 26 });
    steps.push({ kind: 'command', what, seconds: (Date.now() - s) / 1000 });
    if (r.status !== 0) throw new Error(`FAIL eject (${mode}): step "${what}" exited ${r.status}: ${(r.stderr || r.stdout || '').trim().split('\n').slice(-1)[0] ?? ''}`);
    return `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  };
  const file = (what: string, rel: string, content: string) => {
    const s = Date.now();
    mkdirSync(join(client, rel, '..'), { recursive: true });
    writeFileSync(join(client, rel), content);
    steps.push({ kind: 'file', what, seconds: (Date.now() - s) / 1000 });
  };
  const pack = (name: string): string => {
    const out = cmd(`npm pack ${name}`, ['npm', 'pack', '--json', '--pack-destination', tarballs], resolve(REPO, PACKAGES[name]));
    const json = out.slice(out.indexOf('['), out.lastIndexOf(']') + 1);
    return join(tarballs, JSON.parse(json)[0].filename);
  };
  const npmI = ['--no-audit', '--no-fund', '--prefer-offline'];

  try {
    const tgz = DELIVERED[mode].map(pack);
    file('write package.json', 'package.json', `${JSON.stringify({
      name: 'ejected-client', version: '1.0.0', private: true,
      scripts: { build: 'esbuild src/main.js --bundle --format=iife --outdir=dist --log-level=warning && cp index.html dist/' },
    }, null, 2)}\n`);
    cmd(`npm install ${DELIVERED[mode].join(' ')} (tarballs)`, ['npm', 'install', ...tgz, ...npmI], client);
    if (mode === 'source') {
      const out = cmd('node copy-source.mjs (copy the component source in)', ['node', join(HERE, 'copy-source.mjs'), '--from', REPO, '--to', join(client, 'src', 'prism3')], client);
      const deps: Record<string, string> = JSON.parse(out.trim().split('\n').find((l) => l.startsWith('{')) ?? '{}').dependencies ?? {};
      const specs = Object.entries(deps).map(([n, v]) => `${n}@${v}`);
      if (specs.length) cmd(`npm install ${specs.join(' ')} (the copies' runtime dependencies)`, ['npm', 'install', '--save-exact', ...specs, ...npmI], client);
    }
    cmd(`npm install -D esbuild@${ESBUILD}`, ['npm', 'install', '-D', '--save-exact', `esbuild@${ESBUILD}`, ...npmI], client);
    file('write index.html (both forms of all three components)', 'index.html', readFileSync(join(HERE, 'client', 'index.html'), 'utf8'));
    file('write src/main.js (the entry)', 'src/main.js', readFileSync(join(HERE, 'client', `main.${mode}.js`), 'utf8'));
    const built = cmd('npm run build', ['npm', 'run', '--silent', 'build'], client);
    // esbuild's own warning marker (`▲ [WARNING]`), not npm's echo of the script, which names `--log-level=warning`.
    const warn = built.split('\n').filter((l) => /\[WARNING\]|▲/.test(l));
    if (warn.length) throw new Error(`FAIL eject (${mode}): the build warns: ${warn[0].trim()}`);
    res.seconds = Math.round((Date.now() - t0) / 100) / 10;

    const c0 = Date.now();
    const why = renderCheck(join(client, 'dist', 'index.html'));
    res.checkSeconds = Math.round((Date.now() - c0) / 100) / 10;
    if (why) throw new Error(`FAIL eject (${mode}): the built client ${why}`);

    if (opts.plant) plant(opts.plant, client);
    res.count = countRefs(client, readRepo(REPO), DELIVERED[mode]);
    res.upstream = upstream(client, mode);
  } catch (e) {
    res.failure = (e as Error).message.startsWith('FAIL') ? (e as Error).message : `FAIL eject (${mode}): ${(e as Error).message}`;
  } finally {
    if (!opts.keep) rmSync(tmp, { recursive: true, force: true });
  }
  return res;
};

/** A leak planted into the built client, before the count, for the hand mutations the PR body lists. */
const plant = (kind: string, client: string) => {
  if (kind === 'file-link') {
    const pj = JSON.parse(readFileSync(join(client, 'package.json'), 'utf8'));
    pj.dependencies = { ...pj.dependencies, '@prism3/engine': `file:${relative(client, join(REPO, 'packages/engine'))}` };
    writeFileSync(join(client, 'package.json'), JSON.stringify(pj, null, 2));
  } else if (kind === 'engine-import') appendFileSync(join(client, 'src/main.js'), "import '@prism3/engine';\n");
  else if (kind === 'repo-url') appendFileSync(join(client, 'src/main.js'), '// https://github.com/prism-ds/prism3\n');
  else throw new Error(`FAIL eject: unknown --plant ${kind} (file-link, engine-import, repo-url)`);
};

/**
 * How an upstream change reaches each piece: a `@prism3/*` dependency in the client's `package.json` arrives by a
 * package version it can bump. A copied component arrives only if the copies carry their upstream version
 * (`@prism3/<name>@x.y.z`, or a manifest naming it); otherwise the client has no channel at all.
 */
const upstream = (client: string, mode: Mode): string[] => {
  const pj = JSON.parse(readFileSync(join(client, 'package.json'), 'utf8'));
  const deps = Object.keys(pj.dependencies ?? {}).filter((n) => n.startsWith('@prism3/'));
  const out = deps.length ? [`${deps.join(', ')} by package version`] : [];
  if (mode === 'source') {
    const copies = countRefs(join(client, 'src', 'prism3'), { root: '\u0000', topDirs: [], workspaceNames: [], urls: [] }, []).scanned;
    const marked = copies.some((f) => {
      const t = readFileSync(join(client, 'src', 'prism3', f), 'utf8');
      return /@prism3\/[a-z-]+@\d+\.\d+\.\d+/.test(t) || (/"name":\s*"@prism3\//.test(t) && /"version":\s*"\d/.test(t));
    });
    out.push(marked ? 'the copied components by the version their copies carry' : `the copied components by no channel: none of the ${copies.length} copies carries an upstream version (#3411 not built)`);
  }
  return out;
};

/**
 * The built client, opened from disk in Chromium: no script error; each element defined and rendering its markup;
 * the plain HTML password field's script ran (its toggle is shown); and the token CSS applied (the filled HTML button
 * has a solid fill, not the default's, and its background, height and radius equal the element's). Returns why not, or null.
 */
export const renderCheck = (html: string): string | null => {
  const script = `
    const { chromium } = require(${JSON.stringify(createRequire(join(REPO, 'package.json')).resolve('playwright'))});
    (async () => {
      const b = await chromium.launch();
      const p = await b.newPage();
      const errors = [];
      p.on('pageerror', (e) => errors.push(String(e)));
      p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await p.goto(${JSON.stringify(pathToFileURL(html).href)});
      await p.waitForLoadState('load');
      const r = await p.evaluate(() => {
        const cs = (el, k) => el ? getComputedStyle(el)[k] : null;
        const plain = document.createElement('button'); document.body.append(plain);
        const hb = document.querySelector('#html-form > button.p3-button');
        const eb = document.querySelector('p3-button button.p3-button');
        const out = {
          defined: ['p3-button', 'p3-text-field', 'p3-password-field'].filter((t) => !customElements.get(t)),
          rendered: ['p3-button button.p3-button', 'p3-text-field input.p3-text-field__entry', 'p3-password-field input.p3-password-field__entry'].filter((s) => !document.querySelector(s)),
          html: ['#html-form > button.p3-button', '#html-form .p3-text-field__entry', '#html-form .p3-password-field__entry'].filter((s) => !document.querySelector(s)),
          toggleShown: !document.querySelector('#html-form .p3-password-field__toggle').hidden,
          // Filled is a solid fill from a token: with no token CSS the var() is invalid and the fill computes transparent.
          styled: cs(hb, 'backgroundColor') !== cs(plain, 'backgroundColor') && cs(hb, 'backgroundColor') !== 'rgba(0, 0, 0, 0)',
          agree: ['backgroundColor', 'height', 'borderTopLeftRadius'].filter((k) => cs(hb, k) !== cs(eb, k)),
        };
        plain.remove();
        return out;
      });
      await b.close();
      console.log(JSON.stringify({ ...r, errors }));
    })().catch((e) => { console.log(JSON.stringify({ crash: String(e) })); });`;
  const r = spawnSync('node', ['-e', script], { encoding: 'utf8', maxBuffer: 1 << 24 });
  let o: Record<string, unknown>;
  try { o = JSON.parse(r.stdout.trim().split('\n').slice(-1)[0]); } catch { return `could not be opened in Chromium: ${(r.stderr || r.stdout).trim().split('\n')[0]}`; }
  if (o.crash) return `could not be opened in Chromium: ${o.crash}`;
  const list = (k: string) => (o[k] as string[]);
  if (list('errors').length) return `logs a script error: ${list('errors')[0]}`;
  if (list('defined').length) return `does not define ${list('defined').join(', ')}`;
  if (list('rendered').length) return `has an element that renders no markup: ${list('rendered').join(', ')}`;
  if (list('html').length) return `is missing plain HTML: ${list('html').join(', ')}`;
  if (!o.toggleShown) return 'did not run the password field\'s script (its toggle is still hidden)';
  if (!o.styled) return 'is unstyled (the filled HTML button computes a transparent or browser-default background)';
  if (list('agree').length) return `renders the two forms differently: the buttons' ${list('agree').join(', ')}`;
  return null;
};

// ------------------------------------------------------------------------------------------------ the summary line
/** The line the scorecard reads. A failure is its own line; otherwise OK, or FAIL when the scored count is above 0. */
export const summarize = (r: Pick<Result, 'mode' | 'steps' | 'seconds' | 'count' | 'upstream' | 'failure'>): string => {
  if (r.failure) return r.failure;
  const a = r.count.a.length;
  const commands = r.steps.filter((s) => s.kind === 'command').length;
  const d1 = SCORED.d1 === 'pending' ? 'D1 pending, scoring option A' : 'per D1';
  // Most wanted first, so a cut line keeps it: the steps and time, the upstream channel, then the other count.
  const rest = [
    `${r.steps.length} steps (${commands} commands, ${r.steps.length - commands} files written), ${r.seconds}s`,
    `upstream: ${r.upstream.join('; ')}`,
    ...(SCORED.count === 'b' ? [`count (a): ${a}`] : []),
    `count (b), @prism3 names: ${r.count.b.occurrences} occurrences of ${r.count.b.names.length} (${r.count.b.names.join(', ') || 'none'})`,
  ].join('; ');
  const scored = SCORED.count === 'a' ? a : r.count.b.occurrences;
  if (scored > 0) {
    return SCORED.count === 'a'
      ? `FAIL eject (${r.mode}): count (a) is ${a} references back into prism3, target 0 (${d1}): ${byKind(r.count.a)}; ${rest}`
      : `FAIL eject (${r.mode}): count (b) is ${scored}, target 0 (${d1}); ${rest}`;
  }
  return `OK eject (${r.mode}): ${scored} references back into prism3; scored: count (${SCORED.count}), ${d1}; ${rest}`;
};

// ------------------------------------------------------------------------------------------------ self-test
const fixture = (files: Record<string, string>): string => {
  const d = mkdtempSync(join(tmpdir(), 'prism3-eject-fixture-'));
  for (const [p, t] of Object.entries(files)) { mkdirSync(join(d, p, '..'), { recursive: true }); writeFileSync(join(d, p), t); }
  return d;
};
const clean = (d: string): Record<string, string> => ({
  'package.json': JSON.stringify({ name: 'x', dependencies: { '@prism3/tokens': `file:${join(d, '..', 'outside.tgz')}`, '@prism3/css': 'file:../prism3-css-0.0.0.tgz' } }, null, 2),
  'src/main.js': "import '@prism3/tokens/prism3.css';\nimport '@prism3/css/button.css';\nimport './local.js';\n// see packages/nope-not-a-dir/x.ts, a path that names no file in the repo\n",
  'src/local.js': 'export {};\n',
  'node_modules/@prism3/css/button.css': '/* GENERATED by packages/css/generate.ts */\n',
  'dist/main.js': '// https://github.com/prism-ds/prism3 and packages/css/generate.ts, build output, not scanned\n',
});
const planted = (kind: string, d: string): [string, string] => {
  const into = relative(join(d, 'src'), join(REPO, 'packages/css/button.css'));
  return ({
    [KIND.link]: ['package.json', JSON.stringify({ name: 'x', dependencies: { '@prism3/engine': `file:${relative(d, join(REPO, 'packages/engine'))}` } })],
    [KIND.workspace]: ['package.json', JSON.stringify({ name: 'x', dependencies: { '@prism3/tokens': 'workspace:*' } })],
    [KIND.undelivered]: ['src/main.js', "import { generate } from '@prism3/engine';\n"],
    [KIND.pathInto]: ['src/main.js', `import '${into}';\n`],
    [KIND.absolute]: ['src/main.js', `// built from ${REPO}\n`],
    [KIND.repoPath]: ['src/main.js', '/* GENERATED by packages/css/generate.ts. Do not edit. */\n'],
    [KIND.url]: ['src/main.js', '// https://github.com/prism-ds/prism3/issues/1\n'],
  } as Record<string, [string, string]>)[kind];
};

export const SELF: { name: string; check: () => string | null }[] = [
  { name: 'a clean client counts 0 in (a): an outside tarball link, delivered imports, a path to no repo file; node_modules and dist are not added', check: () => {
    const d = fixture({});
    try {
      for (const [p, t] of Object.entries(clean(d))) { mkdirSync(join(d, p, '..'), { recursive: true }); writeFileSync(join(d, p), t); }
      const c = countRefs(d, readRepo(REPO), DELIVERED.package);
      if (c.a.length) return `counted ${c.a.length}: ${c.a.map((x) => `${x.file}:${x.line} ${x.kind}`).join('; ')}`;
      if (c.installed.length !== 1 || c.installed[0].kind !== KIND.repoPath) return `the installed package's repo path read ${JSON.stringify(c.installed)}, expected one ${KIND.repoPath}`;
      if (c.b.occurrences !== 4 || c.b.names.join() !== '@prism3/css,@prism3/tokens') return `count (b) read ${c.b.occurrences} of ${c.b.names.join()}, expected 4 of @prism3/css,@prism3/tokens`;
      return null;
    } finally { rmSync(d, { recursive: true, force: true }); }
  } },
  ...Object.values(KIND).map((kind) => ({ name: `a planted "${kind}" counts 1 in (a), by that kind`, check: () => {
    const d = fixture({});
    try {
      for (const [p, t] of Object.entries(clean(d))) { mkdirSync(join(d, p, '..'), { recursive: true }); writeFileSync(join(d, p), t); }
      const [p, t] = planted(kind, d);
      writeFileSync(join(d, p), t);
      const c = countRefs(d, readRepo(REPO), DELIVERED.package);
      return c.a.length === 1 && c.a[0].kind === kind ? null : `counted ${c.a.length}: ${c.a.map((x) => `${x.kind} (${x.text})`).join('; ') || 'nothing'}`;
    } finally { rmSync(d, { recursive: true, force: true }); }
  } })),
  { name: 'in source mode an import of @prism3/css is a package the client was not given', check: () => {
    const repo = readRepo(REPO);
    const r = scanFile('/x/src/main.js', "import '@prism3/css/button.css';\nimport '@prism3/tokens/prism3.css';\n", repo, DELIVERED.source, '/x', 'src/main.js');
    return r.a.length === 1 && r.a[0].kind === KIND.undelivered && r.a[0].line === 1 ? null : JSON.stringify(r.a);
  } },
  { name: 'a usage example in a comment is a mention, in (b), not an import in (a)', check: () => {
    const text = "/*\n *   <script src=\"@prism3/css/password-field.js\" defer></script>\n */\n//   import '@prism3/engine';\n";
    const r = scanFile('/x/src/a.js', text, readRepo(REPO), DELIVERED.source, '/x', 'src/a.js');
    return r.a.length === 0 && r.b.length === 2 ? null : `(a) ${JSON.stringify(r.a)}, (b) ${r.b.length}`;
  } },
  { name: 'the counter knows the repo from the repo: its folders, its workspaces and its URL', check: () => {
    const r: Repo = readRepo(REPO);
    const miss = [['packages', r.topDirs], ['@prism3/engine', r.workspaceNames], ['@prism3/css', r.workspaceNames], ['prism-ds/prism3', r.urls]].filter(([x, l]) => !(l as string[]).includes(x as string));
    return miss.length ? `missing: ${miss.map(([x]) => x).join(', ')}` : null;
  } },
  { name: 'a scored count above 0 is a FAIL line that names each kind, never an OK count', check: () => {
    const ref = { file: 'package.json', line: 3, kind: KIND.link, text: 'file:../prism3/packages/engine' };
    const base = { mode: 'package' as Mode, steps: [{ kind: 'command' as const, what: 'x', seconds: 1 }], seconds: 9, upstream: ['x by package version'], failure: null };
    const bad = summarize({ ...base, count: { a: [ref], b: { occurrences: 4, names: ['@prism3/css'] }, installed: [], scanned: [] } });
    const good = summarize({ ...base, count: { a: [], b: { occurrences: 4, names: ['@prism3/css'] }, installed: [], scanned: [] } });
    if (!/^FAIL eject \(package\): count \(a\) is 1 references back into prism3, target 0 .*file: or link: into the repo ×1/.test(bad)) return `with one reference: ${bad}`;
    if (!/^OK eject \(package\): 0 references back into prism3; scored: count \(a\)/.test(good)) return `with none: ${good}`;
    return null;
  } },
  { name: 'a failed step is the summary line itself, with no count', check: () => {
    const s = summarize({ mode: 'source', steps: [], seconds: 0, upstream: [], failure: 'FAIL eject (source): step "npm run build" exited 1: x', count: { a: [], b: { occurrences: 0, names: [] }, installed: [], scanned: [] } });
    return s === 'FAIL eject (source): step "npm run build" exited 1: x' ? null : s;
  } },
];

// ------------------------------------------------------------------------------------------------ CLI
if (process.argv[1] && resolve(process.argv[1]) === resolve(HERE, 'eject.ts')) {
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  if (process.argv.includes('--self-test')) {
    let bad = 0;
    for (const t of SELF) { const why = t.check(); if (why === null) console.log(`OK self-test: ${t.name}`); else { bad++; console.error(`FAIL self-test: ${t.name}: ${why}`); } }
    process.exit(bad ? 1 : 0);
  }
  const mode = arg('--mode') as Mode;
  if (mode !== 'package' && mode !== 'source') { console.error('usage: eject.ts --mode package|source [--keep] [--plant <kind>] | --self-test'); process.exit(2); }
  const r = eject(mode, { plant: arg('--plant'), keep: process.argv.includes('--keep') });
  console.log(`eject (${mode}), client at ${r.client}${process.argv.includes('--keep') ? ' (kept)' : ' (removed)'}`);
  for (const s of r.steps) console.log(`  step: ${s.kind === 'file' ? 'file   ' : 'command'} ${s.what} [${s.seconds.toFixed(1)}s]`);
  if (!r.failure) {
    console.log(`  render check: ${r.checkSeconds}s, outside the timed steps`);
    for (const x of r.count.a) console.log(`  (a) ${x.file}:${x.line} ${x.kind}: ${x.text}`);
    console.log(`  installed packages, not in (a): ${r.count.installed.length} references back into prism3${r.count.installed.length ? ` (${byKind(r.count.installed)})` : ''}`);
    console.log(`  scanned: ${r.count.scanned.length} files the client owns`);
  }
  const line = summarize(r);
  if (line.startsWith('FAIL')) { console.error(line); console.log(line); process.exit(1); }
  console.log(line);
}
