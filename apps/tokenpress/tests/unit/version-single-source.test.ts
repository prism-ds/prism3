/**
 * TokenPress's version has one source: `package.json`.
 *
 * The panel's label was a hand-typed `v2.2.2` while every export's `$extensions.generator.version` read `3.0.0`
 * from `package.json`, so a release note could cite neither with confidence. The build now writes the version
 * into both: `dist/code.js` through esbuild's `define`, `dist/ui.html` by replacing the label's placeholder.
 *
 * What this checks is the BUILT plugin, because that is what Figma loads: it runs the real build, then reads
 * the label out of `dist/ui.html` and the generator stamp out of `dist/code.js`, and holds both to
 * `package.json`. A test that read `__PLUGIN_VERSION__` off `globalThis` would only read back what `test.ts`
 * set from `package.json`, and could not fail.
 *
 * Matching values are not enough on their own: a label hard-coded to the current version matches today and
 * drifts at the next bump, which is how `v2.2.2` happened. So the source label must hold the placeholder, not
 * a number, and no `N.N.N` literal, with or without a leading `v`, may appear in the panel source at all.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from '../../test-harness';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const PLACEHOLDER = '__PLUGIN_VERSION__';
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

/** The text of the panel's version label: `<span class="version">…</span>`. */
const label = (html: string): string[] =>
  [...html.matchAll(/<span class="version">([^<]*)<\/span>/g)].map((m) => m[1]);

/** The version in the exporter's generator stamp: `generator: { name: 'Token Press', version: "…" }`. */
const stamp = (js: string): string[] =>
  [...js.matchAll(/generator:\s*\{\s*name:\s*["']Token Press["'],\s*version:\s*["']([^"']*)["']/g)].map((m) => m[1]);

describe('version has one source (package.json)', () => {
  test('the readers find a label and a stamp, and nothing in text that only resembles them', () => {
    expect(label('<div><span class="version">v9.8.7</span></div>')).toEqual(['v9.8.7']);
    expect(label('<span class="tag">v9.8.7</span>')).toEqual([]);
    expect(stamp('generator: {\n  name: "Token Press",\n  version: "9.8.7"\n}')).toEqual(['9.8.7']);
    expect(stamp('generator: { name: "Other", version: "9.8.7" }')).toEqual([]);
  });

  const pkg = JSON.parse(read('package.json')) as { version: string };
  // The real build, once. A build that throws, or a file it did not write, fails a test by name instead of the
  // whole suite dying on the call or the read.
  // The outputs are removed first, here and not only in build.mjs, so the reads below see only what this build
  // wrote. A `dist/` left over from an earlier build would otherwise pass for a build that stopped writing one.
  for (const out of ['dist/ui.html', 'dist/code.js']) rmSync(join(ROOT, out), { force: true });
  let buildError = '';
  try {
    execFileSync(process.execPath, [join(ROOT, 'build.mjs')], { cwd: ROOT, stdio: 'pipe' });
  } catch (e) {
    const err = e as { stderr?: Buffer; message: string };
    buildError = (err.stderr && err.stderr.toString().trim().split('\n').filter((l) => /Error/.test(l)).join(' | ')) || err.message;
  }

  test('the build succeeds, its own checks included', () => {
    expect(buildError).toBe('');
  });

  const built = (p: string): string => (existsSync(join(ROOT, p)) ? read(p) : '');
  const ui = built('dist/ui.html');
  const code = built('dist/code.js');

  test('the built panel label reads the package.json version', () => {
    expect(label(ui)).toEqual([`v${pkg.version}`]);
  });

  test("the built exporter stamps the package.json version as the export's generator version", () => {
    expect(stamp(code)).toEqual([pkg.version]);
  });

  test('the panel source holds the placeholder, not a version literal', () => {
    const src = read('src/ui.html');
    expect(label(src)).toEqual([`v${PLACEHOLDER}`]);
    expect(src.match(/\b\d+\.\d+\.\d+\b/g)).toBe(null);
  });

  test('the manifest loads the built panel, not the source', () => {
    const manifest = JSON.parse(read('manifest.json')) as { ui?: string };
    expect(manifest.ui).toBe('dist/ui.html');
  });
});
