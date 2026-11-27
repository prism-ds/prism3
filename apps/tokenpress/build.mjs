/**
 * TokenPress build (port step 4). One esbuild bundle and one stamped copy:
 *   • src/code.ts → dist/code.js   — the Figma sandbox controller (manifest.main)
 *   • src/ui.html → dist/ui.html   — the panel (manifest.ui), its version label stamped
 *
 * There is no second bundle: `src/ui.html` carries its own inline script, so TokenPress's UI never
 * needed inlining. The copy exists for one reason, the version: the label holds the placeholder
 * `__PLUGIN_VERSION__`, replaced here from package.json, the same value esbuild's `define` puts in
 * every export's `generator.version`. package.json is the only place the version is written; the
 * label was a hand-typed `v2.2.2` while exports said `3.0.0`
 * (tests/unit/version-single-source.test.ts).
 *
 * REPLACES vite.config.ts + vite.config.simple.ts. The repo runs one bundler (esbuild, as
 * apps/studio and apps/plugin do), and vite was the only thing pulling vite + vitest into the tree.
 * `--watch` keeps it rebuilding. Run: `node build.mjs` (or `npm run build` / `npm run dev`).
 *
 * Four things the vite config was doing had to be carried over deliberately rather than assumed,
 * because each is load-bearing and none is esbuild's default. They are ASSERTED below, not just
 * configured — the output is a gitignored artifact, so a silent regression here is visible nowhere
 * else (the same reasoning as apps/plugin/build.mjs's `</script>` check, #496).
 */
import { build, context } from 'esbuild';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

// 1. THE VERSION STAMP. exporter.ts writes `__PLUGIN_VERSION__` into every exported tree's
//    $extensions.generator.version. It is a bare identifier with no runtime declaration, so an
//    absent define does not warn — it ships a bundle that throws on first export. Read from
//    package.json, the same source vite's config read, so the two cannot drift.
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));

// The panel, served as authored apart from its version label. Every occurrence is replaced, and
// `verify` asserts none survives and the stamped label is there.
const UI_SRC = resolve(root, 'src/ui.html');
const UI_OUT = resolve(root, 'dist/ui.html');
const stampUi = async () => {
  const html = await readFile(UI_SRC, 'utf8');
  await mkdir(dirname(UI_OUT), { recursive: true });
  await writeFile(UI_OUT, html.split('__PLUGIN_VERSION__').join(pkg.version));
};

const opts = {
  entryPoints: [resolve(root, 'src/code.ts')],
  outfile: resolve(root, 'dist/code.js'),
  bundle: true,
  // 2. FORMAT. The Figma sandbox is not an ES-module context; an `export` statement in the output
  //    is a load-time syntax error. vite got this from `formats: ['iife']`.
  format: 'iife',
  // 3. TARGET. The sandbox is not a modern browser engine. vite pinned es2018 and disabled
  //    minification with the note that esbuild "doesn't strictly respect ES2018" — so minify stays
  //    off here for exactly that reason, not by oversight.
  target: 'es2018',
  minify: false,
  sourcemap: false,
  define: { __PLUGIN_VERSION__: JSON.stringify(pkg.version) },
  // 4. THE setImmediate SHIM. jszip calls setImmediate, which the Figma sandbox does not provide;
  //    vite injected this via rollup's `output.intro`. It must run BEFORE any bundled code, so it
  //    goes in `banner`, not `footer` or a module.
  banner: {
    js:
      'var setImmediate = setImmediate || function(fn) { ' +
      'var args = Array.prototype.slice.call(arguments, 1); ' +
      'return setTimeout(function() { fn.apply(null, args); }, 0); };',
  },
  logLevel: 'info',
};

/** Assert the four properties above hold in what was actually written. */
const verify = async () => {
  const js = await readFile(opts.outfile, 'utf8');
  const fail = (msg) => {
    throw new Error(`apps/tokenpress/dist/code.js: ${msg}`);
  };
  if (js.includes('__PLUGIN_VERSION__')) {
    fail('__PLUGIN_VERSION__ survived unsubstituted — every export would throw on load.');
  }
  if (!js.includes(JSON.stringify(pkg.version))) {
    fail(`the version stamp ${pkg.version} is absent, so exported trees would carry no generator version.`);
  }
  if (/^\s*(?:export|import)\s/m.test(js)) {
    fail('an ES-module statement reached the output; the Figma sandbox cannot load it (format must be iife).');
  }
  // The check above cannot fail TODAY, and saying so is the point: src/code.ts exports nothing, so
  // flipping format to 'esm' produces a bundle with no export statement and that check stays green
  // (measured — it is what the build's own mutation check caught). The property that actually differs
  // between the two formats is the wrapper: iife encloses the body so its ~2000 top-level `var`s stay
  // out of the sandbox's shared global scope, and esm leaves them there. Assert the wrapper, and keep
  // the statement check for the day something here does start exporting.
  if (!/^"use strict";\n\(\(\) => \{/m.test(js)) {
    fail('the bundle is not wrapped in an IIFE, so its top-level declarations leak into the Figma sandbox global scope (format must be iife).');
  }
  if (!js.startsWith('var setImmediate')) {
    fail("the setImmediate shim is not first — jszip calls it during export and the sandbox has no such global.");
  }
  if (/\brequire\(["']node:/.test(js)) {
    fail('a node: builtin reached the output; nothing exists to resolve it inside Figma.');
  }
  console.log(`  dist/code.js   (iife, es2018, v${pkg.version} stamped, setImmediate shimmed)`);

  const ui = await readFile(UI_OUT, 'utf8');
  if (ui.includes('__PLUGIN_VERSION__')) {
    throw new Error('apps/tokenpress/dist/ui.html: __PLUGIN_VERSION__ survived unsubstituted — the panel would show it as its version.');
  }
  if (!ui.includes(`<span class="version">v${pkg.version}</span>`)) {
    throw new Error(`apps/tokenpress/dist/ui.html: the panel's version label does not read v${pkg.version}.`);
  }
  console.log(`  dist/ui.html   (version label v${pkg.version})`);
};

if (watch) {
  const ctx = await context(opts);
  await ctx.watch();
  // The panel is stamped once; an edit to src/ui.html under --watch needs a rerun to reach dist/.
  await stampUi();
  console.log('watching apps/tokenpress/src …');
} else {
  // Remove both outputs first, so `verify` reads only what this build wrote: a step that stops
  // writing one leaves no file behind, where a leftover from an earlier build would pass.
  await rm(opts.outfile, { force: true });
  await rm(UI_OUT, { force: true });
  await build(opts);
  await stampUi();
  await verify();
  console.log('tokenpress build complete → apps/tokenpress/dist/');
}
