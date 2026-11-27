/**
 * The external rows' read-only capture (#2075 part 2): a `use_figma` script that runs part 1's OWN scan
 * (`scanOpenFile`, apps/plugin/src/file-facts-figma.ts, bundled with the engine's `file-facts.ts`) inside the open
 * file and returns the facts report, plus the join that reassembles it. Running the shipped scan rather than a
 * hand-written serializer keeps the external rows on the exact code the plugin carries.
 *
 *   npx tsx tools/file-seed-comparison/scan-script.ts print <chunk> --scope <scope>   # the script for chunk <chunk> (0, 1, …)
 *   npx tsx tools/file-seed-comparison/scan-script.ts join <dir> --out <report.json>
 *
 * SCOPE (#2853 Q5 A), required, so a capture never takes a scope by default:
 *   --scope file              every page (the whole-file report)
 *   --scope selection         the layers selected on the current page; with nothing selected, the current page (Q1 A)
 *   --scope <id>[,<id>…]      the named pages, or the named layers (frames or sections), as Figma ids (`12:345`)
 * The scope is in the report (`scope`), so chunks captured under two scopes, or a selection that changed between
 * calls, hash differently and `join` refuses them. An id the file does not hold fails the `use_figma` call by name.
 *
 * WHY CHUNKS. A report can run to a megabyte and one `use_figma` result cannot. Each call scans the whole file (the
 * scan is deterministic, so every call produces the same bytes) and returns one 40,000-character slice, with the
 * chunk count, the full length and an FNV-1a hash of the whole text. `join` reads `<dir>/chunk-<n>.json` for every
 * chunk, checks they agree on length and hash, concatenates, and refuses (exit 1) when the result does not hash to
 * the stated value: a half-captured report is worse than none.
 *
 * READ-ONLY. The scan loads pages and reads; part 1's plugin suite runs it, in every scope, under write-logging shims
 * of the nodes and of `figma` itself, and fails on any write. It never changes the selection or the current page. The
 * script adds nothing that writes: it holds the report in a local and returns a slice.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { isEntry } from '../../packages/engine/entry-point';
import type { FactsNode, ScopeRequest } from '../../packages/engine/file-facts';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
export const CHUNK = 40000;
export const CHUNK_FORMAT = 'prism3-file-facts-chunk/1';

/** FNV-1a over UTF-16 code units, as hex: the same function in the script and in `join`. */
export const fnv = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
};

export type ScopeArg = { from: 'whole-file' } | { from: 'selection' } | { from: 'ids'; ids: string[] };
/** `--scope`'s value as the adapter's `ScopeChoice`; null when it is not one. */
export const parseScope = (v: string | undefined): ScopeArg | null => {
  if (!v) return null;
  if (v === 'file') return { from: 'whole-file' };
  if (v === 'selection') return { from: 'selection' };
  const ids = v.split(',').map((x) => x.trim());
  return ids.every((x) => /^[^\s,]+$/.test(x)) ? { from: 'ids', ids } : null;
};

export const scanScript = async (chunk: number, scope: ScopeArg): Promise<string> => {
  const out = await build({
    stdin: { contents: `export { scanOpenFile as run } from './src/file-facts-figma';`, resolveDir: join(repo, 'apps/plugin'), loader: 'ts' },
    bundle: true, minify: true, format: 'iife', globalName: '__p3', platform: 'neutral', target: 'es2020',
    mainFields: ['module', 'main'], write: false, legalComments: 'none',
  });
  return [
    `const __I=${chunk},__N=${CHUNK};`,
    out.outputFiles[0].text.trim(),
    `const __fnv=${fnv.toString()};`,
    `const __r=JSON.stringify(await __p3.run(figma,${JSON.stringify(scope)}));`,
    `return {format:${JSON.stringify(CHUNK_FORMAT)},chunk:__I,chunks:Math.ceil(__r.length/__N),length:__r.length,fnv:__fnv(__r),text:__r.slice(__I*__N,(__I+1)*__N)};`,
  ].join('\n');
};

type Chunk = { format: string; chunk: number; chunks: number; length: number; fnv: string; text: string };
export const joinChunks = (chunks: Chunk[]): { text: string } | { error: string } => {
  if (!chunks.length) return { error: 'no chunks' };
  const [first] = chunks;
  if (chunks.some((c) => c.format !== CHUNK_FORMAT)) return { error: `a chunk is not ${CHUNK_FORMAT}` };
  if (chunks.some((c) => c.chunks !== first.chunks || c.length !== first.length || c.fnv !== first.fnv)) return { error: 'the chunks disagree on count, length or hash: the file changed between calls' };
  const byIndex = new Map(chunks.map((c) => [c.chunk, c.text]));
  const missing = Array.from({ length: first.chunks }, (_, i) => i).filter((i) => !byIndex.has(i));
  if (missing.length) return { error: `missing chunk(s) ${missing.join(', ')} of ${first.chunks}` };
  const text = Array.from({ length: first.chunks }, (_, i) => byIndex.get(i)!).join('');
  if (text.length !== first.length || fnv(text) !== first.fnv) return { error: 'the joined report does not match its stated length and hash' };
  return { text };
};

/**
 * The author's self-check (not a CI step): run the printed script for every chunk against a host built from the
 * prism2 export (`snapshots.ts`), join the chunks, and compare with the engine scanning the same snapshot directly.
 * Then drop one chunk and corrupt another, and expect `join` to refuse each by name.
 */
const selftest = async (): Promise<void> => {
  const { snapshotFromExport } = await import('./snapshots');
  const { scanFileFacts, scopePages, sourceFromSnapshot } = await import('../../packages/engine/file-facts');
  const snap = snapshotFromExport(join(repo, 'reference/Prism2/tokens/raw-figma'));
  const src = sourceFromSnapshot(snap);
  const host: Record<string, unknown> = {
    variables: {
      getLocalVariableCollectionsAsync: async () => snap.collections, getLocalVariablesAsync: async () => snap.variables,
      getVariableByIdAsync: src.variableById, getVariableCollectionByIdAsync: src.collectionById,
    },
    getLocalPaintStylesAsync: async () => snap.styles.paint, getLocalTextStylesAsync: async () => snap.styles.text,
    getLocalEffectStylesAsync: async () => snap.styles.effect, getLocalGridStylesAsync: async () => snap.styles.grid,
    getStyleByIdAsync: src.styleById, root: { children: snap.pages }, currentPage: { ...snap.pages[0], selection: [] },
  };
  const AsyncFn = Object.getPrototypeOf(async () => {}).constructor;
  const capture = async (scope: ScopeArg, h = host): Promise<Chunk[]> => {
    const run = async (i: number): Promise<Chunk> => new AsyncFn('figma', await scanScript(i, scope))(h);
    const head = await run(0);
    return [head, ...(await Promise.all(Array.from({ length: head.chunks - 1 }, (_, i) => run(i + 1))))];
  };
  const chunks = await capture({ from: 'whole-file' });
  const [first] = chunks;
  const joined = joinChunks(chunks);
  const direct = JSON.stringify(await scanFileFacts(src));
  // Scoped: the same variables over three small pages, a selection of two frames on the first, given out of order.
  const frame = (id: string, w: number): FactsNode => ({ id, type: 'FRAME', name: id, width: w, height: 100, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }], children: [] });
  const pages = [
    { id: 'p:1', name: 'One', children: [frame('f:a', 390), frame('f:b', 390), frame('f:c', 1440)] },
    { id: 'p:2', name: 'Two', children: [frame('f:d', 1440)] },
    { id: 'p:3', name: 'Three', children: [frame('f:e', 1920)] },
  ];
  const scopedHost = { ...host, root: { children: pages }, currentPage: { ...pages[0], selection: [{ id: 'f:b' }, { id: 'f:a' }] } };
  const viaScript = async (scope: ScopeArg) => { const r = joinChunks(await capture(scope, scopedHost)); return 'text' in r ? r.text : r.error; };
  const viaEngine = async (req: ScopeRequest) => JSON.stringify(await scanFileFacts({ ...src, ...scopePages(pages, req) }));
  const selection = await viaScript({ from: 'selection' });
  const byIds = await viaScript({ from: 'ids', ids: ['p:3', 'p:2'] });
  let missing = '';
  try { await capture({ from: 'ids', ids: ['nope'] }, scopedHost); } catch (e) { missing = (e as Error).message; }
  const results = [
    ['joined report equals the direct scan', 'text' in joined && joined.text === direct],
    ['--scope selection equals the engine over the same selection', selection === (await viaEngine({ from: 'selection', page: 'p:1', ids: ['f:a', 'f:b'] }))],
    ['--scope selection reports the two selected frames', JSON.parse(selection).scope.ids.join() === 'f:a,f:b' && JSON.parse(selection).inventory.length === 2],
    ['--scope <ids> equals the engine over the same pages', byIds === (await viaEngine({ from: 'ids', ids: ['p:2', 'p:3'] }))],
    ['--scope with an id the file lacks fails the call by name', /no page or layer with id nope/.test(missing)],
    ['chunks from two scopes are refused', 'error' in joinChunks([...(await capture({ from: 'selection' }, scopedHost)), ...(await capture({ from: 'ids', ids: ['p:2'] }, scopedHost)).map((c) => ({ ...c, chunk: c.chunk + 1 }))])],
    ['--scope values parse, and a bad one does not', JSON.stringify(['file', 'selection', '1:2,3:4', 'a b', ''].map(parseScope)) === JSON.stringify([{ from: 'whole-file' }, { from: 'selection' }, { from: 'ids', ids: ['1:2', '3:4'] }, null, null])],
    ['more than one chunk was exercised', first.chunks > 1],
    ['a missing chunk is refused', 'error' in joinChunks(chunks.slice(1)) && /missing chunk/.test((joinChunks(chunks.slice(1)) as { error: string }).error)],
    ['a corrupted chunk is refused', 'error' in joinChunks(chunks.map((c, i) => (i === 1 ? { ...c, text: `${c.text.slice(0, -1)}x` } : c)))],
  ] as const;
  for (const [label, ok] of results) console.log(`${ok ? '✓' : '✗'} ${label}`);
  console.log(`script: ${(await scanScript(0, { from: 'whole-file' })).length} characters; report: ${first.length} characters in ${first.chunks} chunk(s)`);
  if (results.some(([, ok]) => !ok)) process.exit(1);
};

if (isEntry(import.meta.url)) {
  const [cmd, a, ...rest] = process.argv.slice(2);
  const scope = rest[0] === '--scope' ? parseScope(rest[1]) : null;
  if (cmd === 'print' && /^\d+$/.test(a ?? '') && scope) process.stdout.write(`${await scanScript(Number(a), scope)}\n`);
  else if (cmd === 'selftest') await selftest();
  else if (cmd === 'join' && a && rest[0] === '--out' && rest[1]) {
    const chunks = readdirSync(a).filter((f) => /^chunk-\d+\.json$/.test(f)).map((f) => JSON.parse(readFileSync(join(a, f), 'utf8')) as Chunk);
    const r = joinChunks(chunks);
    if ('error' in r) { console.error(`join refused: ${r.error}`); process.exit(1); }
    writeFileSync(rest[1], `${JSON.stringify(JSON.parse(r.text), null, 2)}\n`);
    console.log(`wrote ${rest[1]} (${chunks.length} chunk(s), ${r.text.length} characters, fnv ${fnv(r.text)})`);
  } else {
    console.error('usage: scan-script.ts print <chunk> --scope file|selection|<id>[,<id>…] | join <dir> --out <report.json> | selftest');
    process.exit(2);
  }
}
