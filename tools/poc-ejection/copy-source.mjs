#!/usr/bin/env node
/**
 * SOURCE MODE'S COPY SCRIPT (#3408, plan item 3; owner decision Q32 A): copy the components' source into a client,
 * where the client owns it. The tokens are not copied: they stay the versioned `@prism3/tokens` package, so they
 * never fork per app.
 *
 *   node tools/poc-ejection/copy-source.mjs --from <prism3 checkout> --to <client>/src/prism3
 *
 * What it copies: each component package's published files (its `package.json` `files`), less the README, into
 * `<to>/css/` and `<to>/web-components/`, byte for byte. What it prints, as one JSON line: the files it copied and
 * the runtime dependencies the copies need (the element package's own `dependencies`, today Lit), which the client
 * installs itself.
 *
 * It copies verbatim on purpose: this is the eject a client runs, and what the copies still say about prism3 is
 * what the reference counter (`refs.ts`) measures. Rewriting them here would hide the measurement.
 */
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const from = arg('--from');
const to = arg('--to');
if (!from || !to) { console.error('usage: copy-source.mjs --from <prism3 checkout> --to <client>/src/prism3'); process.exit(2); }

const PACKAGES = { css: 'packages/css', 'web-components': 'packages/web-components' };
const copied = [];
const dependencies = {};
for (const [dest, dir] of Object.entries(PACKAGES)) {
  const pj = JSON.parse(readFileSync(resolve(from, dir, 'package.json'), 'utf8'));
  mkdirSync(join(to, dest), { recursive: true });
  for (const f of pj.files.filter((x) => x !== 'README.md')) {
    copyFileSync(resolve(from, dir, f), join(to, dest, f));
    copied.push(`${dest}/${f}`);
  }
  Object.assign(dependencies, pj.dependencies ?? {});
}
console.log(JSON.stringify({ copied, dependencies }));
