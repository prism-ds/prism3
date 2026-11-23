/**
 * THE REFERENCE COUNTER for the ejected client (#3408, plan item 3): what in a client built outside the repo still
 * points back at prism3. Two counts, kept apart, because owner decision D1 picks which one the scorecard scores:
 *
 *   (a) REFERENCES BACK INTO THE REPO OR WORKSPACE, each with its kind:
 *       - `file:` or `link:` links whose target resolves inside the repo, and any `workspace:` link (that protocol
 *         only resolves inside a workspace);
 *       - an import of a `@prism3/*` package the client was not given (`@prism3/engine`, or `@prism3/css` in source
 *         mode, where the components are copied, not installed);
 *       - a relative or absolute path, in an import, `href`, `src` or `url()`, that resolves inside the repo;
 *       (those two read code lines only: a usage example in a comment is a mention, counted in (b));
 *       - the repo's absolute path anywhere;
 *       - a path that names a file in the repo (`packages/css/generate.ts`), anywhere, comments included;
 *       - the repo's URL anywhere.
 *   (b) `@prism3/*` PACKAGE NAMES: every occurrence, anywhere, and the distinct names.
 *
 * WHAT IS SCANNED: every file the client owns, which is everything under the client folder except `node_modules/`
 * and the build output (`dist/`). In source mode the copied component source is the client's own, so it is scanned.
 * The installed packages (`node_modules/@prism3/`) are counted on their own and reported, never added to (a).
 *
 * INDEPENDENCE (`docs/34`). The counter never reads the copy script, the install's output or the tool's list of steps.
 * What it knows comes from the repo and from this file: the repo root, its top-level folders and the files under them,
 * the workspace package names from the root `package.json`, and the repo URL from git plus the one written below. The
 * packages a mode delivers are written down by the caller as the plan states them (package mode: tokens, css and
 * web-components; source mode: tokens only), not read off the client. So a planted `file:` link into the repo, an
 * `@prism3/engine` import or a repo URL shows in (a) by kind, whatever built the client.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

export type Ref = { file: string; line: number; kind: string; text: string };
export type Repo = { root: string; topDirs: string[]; workspaceNames: string[]; urls: string[] };
export type Count = {
  a: Ref[];
  b: { occurrences: number; names: string[] };
  installed: Ref[];
  scanned: string[];
};

/** The repo's slug, written down so a checkout with no remote (or a local `file://` one) still knows it. */
const SLUG = 'prism-ds/prism3';

export const KIND = {
  link: 'file: or link: into the repo',
  workspace: 'workspace: link',
  undelivered: 'import of a @prism3 package the client was not given',
  pathInto: 'path that resolves into the repo',
  absolute: 'the repo\'s absolute path',
  repoPath: 'path naming a file in the repo',
  url: 'the repo\'s URL',
} as const;

/** What the counter knows about the repo, from the repo itself. */
export const readRepo = (root: string): Repo => {
  const topDirs = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules').map((d) => d.name);
  const globs: string[] = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).workspaces ?? [];
  const workspaceNames: string[] = [];
  for (const g of globs) {
    const base = join(root, g.replace(/\/\*$/, ''));
    const dirs = g.endsWith('/*') && existsSync(base) ? readdirSync(base).map((d) => join(base, d)) : [base];
    for (const d of dirs) {
      const pj = join(d, 'package.json');
      if (existsSync(pj)) { const n = JSON.parse(readFileSync(pj, 'utf8')).name; if (n) workspaceNames.push(n); }
    }
  }
  const remote = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' }).stdout?.trim() ?? '';
  const fromRemote = /github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(remote)?.[1];
  const urls = [...new Set([SLUG, fromRemote].filter((x): x is string => !!x))];
  return { root, topDirs, workspaceNames, urls };
};

const walk = (dir: string, skip: (rel: string) => boolean, base = dir, out: string[] = []): string[] => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    const rel = relative(base, p);
    if (skip(rel)) continue;
    if (e.isDirectory()) walk(p, skip, base, out);
    else if (e.isFile() && statSync(p).size < 4 << 20) out.push(p);
  }
  return out;
};

const inside = (root: string, p: string) => { const r = relative(root, p); return r === '' || (!r.startsWith('..') && !isAbsolute(r)); };
const pkgOf = (spec: string) => /^(@prism3\/[a-z0-9-]+)/.exec(spec)?.[1];

/**
 * The references in one file. `clientRoot` resolves a lockfile's links (npm writes them relative to the root);
 * `delivered` is the `@prism3/*` names this mode installs as packages.
 */
export const scanFile = (file: string, text: string, repo: Repo, delivered: string[], clientRoot: string, rel: string): { a: Ref[]; b: string[] } => {
  const a: Ref[] = [];
  const b: string[] = [];
  const seen = new Set<string>();
  const add = (line: number, kind: string, t: string) => {
    const k = `${line}\u0000${kind}\u0000${t}`;
    if (!seen.has(k)) { seen.add(k); a.push({ file: rel, line, kind, text: t.slice(0, 160) }); }
  };
  const isPkgJson = /(^|\/)package\.json$/.test(rel);
  const isLock = /(^|\/)(package-lock|npm-shrinkwrap)\.json$/.test(rel);
  const fromDir = isLock ? clientRoot : dirname(file);
  const lines = text.split('\n');
  // The root as an absolute path, not the tail of a relative one (`../../home/…` is a path into the repo, counted once).
  const absRe = new RegExp(`(?<![\\w.~-])${repo.root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);
  const repoPathRe = repo.topDirs.length ? new RegExp(`(?<![\\w@.$/-])((?:${repo.topDirs.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})/[\\w./-]*[\\w])`, 'g') : null;
  lines.forEach((ln, i) => {
    const n = i + 1;
    for (const m of ln.matchAll(/@prism3\/[a-z0-9-]+/g)) b.push(m[0]);
    if (absRe.test(ln)) add(n, KIND.absolute, ln.trim());
    for (const u of repo.urls) if (ln.toLowerCase().includes(u.toLowerCase())) add(n, KIND.url, ln.trim());
    if (repoPathRe) {
      for (const m of ln.matchAll(repoPathRe)) {
        const p = m[1].replace(/[.]+$/, '');
        if (existsSync(join(repo.root, p))) add(n, KIND.repoPath, p);
      }
    }
    // Package manifests and lockfiles: dependency specs and resolved locations.
    if (isPkgJson || isLock) {
      for (const m of ln.matchAll(/"((?:file|link):([^"]+))"/g)) {
        if (inside(repo.root, resolve(fromDir, m[2]))) add(n, KIND.link, m[1]);
      }
      for (const m of ln.matchAll(/"(workspace:[^"]*)"/g)) add(n, KIND.workspace, m[1]);
    }
    // Specifiers: imports, requires, CSS @import and url(), href and src attributes. Not on a comment line: a usage
    // example in a header (`//   import '@prism3/web-components/button';`) is a mention, counted in (b), not an import.
    // A path or URL in a comment is still caught above.
    if (/^\s*(\/\/|\/\*|\*|<!--)/.test(ln)) return;
    const specs = [
      ...ln.matchAll(/\b(?:import|export)\b[^'"`]*?\bfrom\s*['"]([^'"]+)['"]/g),
      ...ln.matchAll(/\bimport\s*\(?\s*['"]([^'"]+)['"]/g),
      ...ln.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]/g),
      ...ln.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)/g),
      ...ln.matchAll(/\burl\(\s*['"]?([^'")]+)['"]?\s*\)/g),
      ...ln.matchAll(/\b(?:href|src)\s*=\s*['"]([^'"]+)['"]/g),
    ].map((m) => m[1]);
    for (const s of new Set(specs)) {
      const pkg = pkgOf(s);
      if (pkg) { if (!delivered.includes(pkg)) add(n, KIND.undelivered, s); continue; }
      if (s.startsWith('.') || isAbsolute(s)) {
        if (inside(repo.root, resolve(dirname(file), s))) add(n, KIND.pathInto, s);
      }
    }
  });
  return { a, b };
};

/** Count both kinds over a client folder. */
export const countRefs = (client: string, repo: Repo, delivered: string[]): Count => {
  const owned = walk(client, (rel) => rel === 'node_modules' || rel === 'dist');
  const out: Count = { a: [], b: { occurrences: 0, names: [] }, installed: [], scanned: owned.map((f) => relative(client, f)) };
  const names = new Set<string>();
  for (const f of owned) {
    const r = scanFile(f, readFileSync(f, 'utf8'), repo, delivered, client, relative(client, f));
    out.a.push(...r.a);
    out.b.occurrences += r.b.length;
    for (const x of r.b) names.add(x);
  }
  out.b.names = [...names].sort();
  const inst = join(client, 'node_modules', '@prism3');
  if (existsSync(inst)) {
    for (const f of walk(inst, () => false)) {
      const r = scanFile(f, readFileSync(f, 'utf8'), repo, delivered, client, relative(client, f));
      out.installed.push(...r.a);
    }
  }
  return out;
};

/** `kind ×n, kind ×n`, in a stable order. */
export const byKind = (refs: Ref[]): string => {
  const c = new Map<string, number>();
  for (const r of refs) c.set(r.kind, (c.get(r.kind) ?? 0) + 1);
  return [...c].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([k, v]) => `${k} ×${v}`).join(', ');
};
