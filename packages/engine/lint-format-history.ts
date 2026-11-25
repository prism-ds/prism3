/**
 * FORMAT-HISTORY GATE (#4458, #4330) — one version of a published format names one shape, and two PRs cannot take
 * the same version without a conflict or a failure by name.
 *
 *   npx tsx packages/engine/lint-format-history.ts
 *   npx tsx packages/engine/lint-format-history.ts --accept --note "<what this version adds>" [--by <name>]
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Each published format carries its version three times: a constant (`AI_METADATA_SCHEMA`, `COMPONENT_DEFS_FORMAT`,
 * …), its JSON schema's `$id`, and the schema's `format` const where it has one. A test holds them equal. When two
 * open PRs each raise a format from N to N+1, their version lines are byte-identical, so git merges them with NO
 * conflict, while their schema edits land in different places and merge too. The merged tree then publishes the
 * union of both shapes as N+1, a shape neither PR shipped, and `main` has called two different shapes N+1 in turn.
 * Every gate passes: the equality test reads N+1 on all three sides, and `component-contract.ts`, whose baseline
 * records the defs schema's facts as a list, takes the union too.
 *
 * Seen twice: #4332 and #4096 both took `prism3-ai-metadata/0.6` (#4458); #4074, #4096 and #4099 each took
 * `prism3-component-defs/1.5` (#4330). Both were caught by a reviewer reading the diff, not by a gate.
 *
 * ── THE RECORD ──────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * `schema/format-history.json` holds, per format, one row per version, oldest first, one row per line:
 *
 *   { "version": "0.7", "by": "<branch that took it>", "shape": "<16 hex>", "note": "<what it adds>" }
 *
 * `shape` is a sha256 over the format's JSON schema with its prose removed (below). This gate fails, by name:
 *
 *   DUPLICATE   one format records one version twice.
 *   ORDER       the versions do not rise, oldest to newest.
 *   UNRECORDED  the constant names a version the record does not hold (raised without `--accept`).
 *   AHEAD       the record's newest version is above the constant (a row with no raise behind it).
 *   ID          the schema's `$id` is not the constant (the version moved in one place only).
 *   SHAPE       the schema's shape is not the shape recorded for the constant's version: the format changed and
 *               kept its number, or a merge put two PRs' shapes under one number.
 *   SCOPE       a `prism3-*` schema in `schema/` has no entry in `FORMATS`, or the record names a format that is
 *               not registered (docs/34 shape 13: every published schema is represented, not counted).
 *
 * WHY TWO PRs CANNOT MERGE SILENTLY. Each PR appends its own row after the same last line, and the two rows differ
 * (each names its own branch and its own shape), so git reports a TEXT CONFLICT on the record. Whichever way it is
 * resolved, the result fails here unless it is right: both rows kept fail DUPLICATE; one row kept fails SHAPE,
 * because the merged schema is the union and matches neither row. The only passing resolution is a new version:
 * raise the constant and the `$id` above the merged one and `--accept`. A PR branched after the other merged sees
 * the version already recorded, so its own shape change fails SHAPE until it raises the number.
 *
 * ── INDEPENDENCE (docs/34) ──────────────────────────────────────────────────────────────────────────────────────
 *
 *   EXPECTED = the row for the constant's version in `schema/format-history.json`, written by `--accept` only.
 *   ACTUAL   = the schema as it stands, hashed here, and the constant as the engine imports it.
 *
 * The record is an authored baseline. `regen.ts` never writes it, and `--accept` APPENDS a row for a version the
 * record does not hold. It never rewrites a row another branch wrote (shape 6: a gate allowed to rewrite what it
 * reads has no memory). The one rewrite it makes is this branch's own newest row, while `origin/main` does not hold
 * it yet, so a PR that changes its schema twice keeps one version. That rewrite needs `origin/main` read: where the
 * ref cannot be read, `--accept` refuses the rewrite by name and says to fetch (review S1 of #4515); an append still
 * works. It reads `origin/main` as last fetched, so a row merged since then reads as not merged: fetch first.
 *
 * The shape is hashed by this file's own walk, not by `component-contract.ts`'s `schemaShape`. Sharing it would tie
 * every recorded hash to another gate's fact list. A change there would fail every format here at once, and no
 * version raise could fix it. The duplication is deliberate.
 *
 * THE SHAPE. A walk that knows what each position of the schema holds (review B1 of #4515):
 *   · a SCHEMA: its annotation keywords `description`, `title`, `$comment` and `examples` are removed, and every other
 *     keyword is kept, its value read by kind;
 *   · a NAME MAP, the value of `properties`, `patternProperties`, `$defs`, `definitions` or `dependentSchemas`: every
 *     name is kept, whatever it is called, so a property or a `$defs` member named `description` or `title` is part
 *     of the shape, and each value is a schema;
 *   · a schema under `items`, `additionalProperties`, `not`, `if`/`then`/`else`, `contains`, `propertyNames`, the
 *     `unevaluated*`/`additionalItems` keywords, or in the lists `allOf`, `anyOf`, `oneOf`, `prefixItems`;
 *   · DATA, every other keyword's value (`required`, `enum`, `const`, `default`, a bound, `type`): kept whole.
 * Object keys are sorted, and the schema's own `$id` string is read as `<$id>`, so a raise does not move its own shape.
 *
 * COUNTED: a property, a `$defs` member or any other named member added, removed or retyped, whatever its name; a
 * `required` member; an `enum` or `const` value; a bound; `additionalProperties`; any keyword other than the four
 * annotations, at any depth. Reordering an array (`required`, `enum`, `anyOf`) moves it too: over-sensitive,
 * accepted, because a raise costs one command. A schema under a keyword the walk does not list (an older draft's
 * `dependencies`, a vendor keyword) is read as data, its annotations included: over-sensitive, the safe direction.
 * NOT COUNTED: an annotation keyword's text where it annotates a schema, object key order, the file's formatting, and
 * the version in the schema's own `$id`.
 *
 * ── ITS LIMITS ──────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   · The shape is the SCHEMA's, not the emitted document's. `test.ts` validates the committed `out/*.ai.json` and a
 *     brand's component export against their schemas, and almost every object there sets `additionalProperties`. So
 *     a field the export gains fails there until the schema names it, and then fails SHAPE here. A field added under
 *     one of the few open objects passes both.
 *   · IN-TREE ONLY. A hand edit that rewrites a recorded row's `shape` to the new schema passes. That is what a
 *     conflict resolved by hand could do. Holding every row the base holds byte-for-byte needs a merge-base read and
 *     its `lint-push-base.ts` replay: #4512.
 *   · Only formats with a JSON schema are registered. A version constant with no schema (`COMPONENT_SPECS_SCHEMA`,
 *     `PANEL_FORMAT`, the projection map versions, …) has no shape to hash. A row-only record would still turn two
 *     identical raises into a conflict. Whether to extend it is an owner decision on #4458's PR.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AI_METADATA_SCHEMA } from './ai-metadata';
import { COMPONENT_DEFS_FORMAT } from './component-defs-export';
import { COMPONENT_DOCS_SCHEMA } from './emit-component-docs';
import { FILE_FACTS_FORMAT } from './file-facts';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const SCHEMA_DIR = join(here, 'schema');
const RECORD = join(SCHEMA_DIR, 'format-history.json');
const TAG = 'lint-format-history';

/** Every published format with a JSON schema: its family, the constant the engine stamps, and the schema. */
const FORMATS: readonly { family: string; constant: string; constName: string; source: string; schema: string }[] = [
  { family: 'prism3-ai-metadata', constant: AI_METADATA_SCHEMA, constName: 'AI_METADATA_SCHEMA', source: 'ai-metadata.ts', schema: 'ai-metadata.schema.json' },
  { family: 'prism3-component-defs', constant: COMPONENT_DEFS_FORMAT, constName: 'COMPONENT_DEFS_FORMAT', source: 'component-defs-export.ts', schema: 'component-defs.schema.json' },
  { family: 'prism3-component-docs', constant: COMPONENT_DOCS_SCHEMA, constName: 'COMPONENT_DOCS_SCHEMA', source: 'emit-component-docs.ts', schema: 'component-docs.schema.json' },
  { family: 'prism3-file-facts', constant: FILE_FACTS_FORMAT, constName: 'FILE_FACTS_FORMAT', source: 'file-facts.ts', schema: 'file-facts.schema.json' },
];

export type Row = { version: string; by: string; shape: string; note: string };
export type Record_ = { note: string; formats: Record<string, Row[]> };
/** What this run read for one format: the constant's version, the schema's `$id` version, the schema's shape. */
export type Live = { family: string; constName: string; version: string; idVersion: string; shape: string };
export type Failure = { kind: 'DUPLICATE' | 'ORDER' | 'UNRECORDED' | 'AHEAD' | 'ID' | 'SHAPE' | 'SCOPE'; family: string; text: string };

// ---- the shape --------------------------------------------------------------------------------------------------

/** The annotation keywords removed from a SCHEMA. Removed only where the key is a keyword: a member of a name map
 *  (below) with the same name, a property called `description`, is part of the shape (review B1 of #4515). */
const PROSE = new Set(['description', 'title', '$comment', 'examples']);
/** Keywords whose value maps NAMES to schemas: every name is kept, whatever it is called, and each value is a schema. */
const NAME_MAPS = new Set(['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas']);
/** Keywords whose value is one schema, or (`items`, in its older array form) a list of them. */
const SUBSCHEMA = new Set(['items', 'additionalProperties', 'unevaluatedProperties', 'unevaluatedItems', 'additionalItems',
  'not', 'if', 'then', 'else', 'contains', 'propertyNames']);
/** Keywords whose value is a list of schemas. */
const SUBSCHEMAS = new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems']);

/** The schema with its annotations removed, keys sorted, and its own `$id` read as `<$id>`. The walk knows what each
 *  position holds: a schema (annotations removed), a name map (every name kept), or data (`required`, `enum`,
 *  `const`, `default`: kept whole). Deliberately not `component-contract.ts`'s `schemaShape` (see the header). */
export const shapeOf = (schema: unknown): string => {
  const id = (schema as { $id?: unknown })?.$id;
  const sorted = (o: object, f: (k: string, v: unknown) => unknown, keep: (k: string) => boolean = () => true): Record<string, unknown> =>
    Object.fromEntries(Object.keys(o).filter(keep).sort().map((k) => [k, f(k, (o as Record<string, unknown>)[k])]));
  const data = (v: unknown): unknown => {
    if (typeof v === 'string') return v === id ? '<$id>' : v;
    if (Array.isArray(v)) return v.map(data);
    if (v && typeof v === 'object') return sorted(v, (_k, x) => data(x));
    return v;
  };
  const schemaAt = (v: unknown): unknown => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return data(v); // `true` / `false` schemas, and anything else
    return sorted(v, (k, x) => {
      if (NAME_MAPS.has(k) && x && typeof x === 'object' && !Array.isArray(x)) return sorted(x, (_n, sub) => schemaAt(sub));
      if (SUBSCHEMA.has(k)) return Array.isArray(x) ? x.map(schemaAt) : schemaAt(x);
      if (SUBSCHEMAS.has(k) && Array.isArray(x)) return x.map(schemaAt);
      return data(x);
    }, (k) => !PROSE.has(k));
  };
  return createHash('sha256').update(JSON.stringify(schemaAt(schema))).digest('hex').slice(0, 16);
};

const versionOf = (stamp: string, family: string): string =>
  stamp.startsWith(`${family}/`) ? stamp.slice(family.length + 1) : `(not ${family}/…: "${stamp}")`;

/** -1, 0 or 1 by numeric dot segments; a non-numeric version sorts as NaN and fails ORDER. */
const cmp = (a: string, b: string): number => {
  const x = a.split('.').map(Number); const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (Number.isNaN(d)) return Number.NaN;
    if (d) return Math.sign(d);
  }
  return 0;
};

// ---- the judgment (one function, run on the real record and on the planted ones) ---------------------------------

export const judge = (record: Record_, live: readonly Live[], registered: readonly string[], published: readonly string[]): Failure[] => {
  const out: Failure[] = [];
  for (const fam of published) if (!registered.includes(fam))
    out.push({ kind: 'SCOPE', family: fam, text: `schema/ publishes "${fam}", which FORMATS in ${TAG}.ts does not register` });
  for (const fam of Object.keys(record.formats)) if (!registered.includes(fam))
    out.push({ kind: 'SCOPE', family: fam, text: `the record holds "${fam}", which FORMATS does not register` });
  for (const l of live) {
    const rows = record.formats[l.family] ?? [];
    const seen = new Map<string, Row>();
    for (const r of rows) {
      const was = seen.get(r.version);
      if (was) out.push({ kind: 'DUPLICATE', family: l.family, text: `version ${r.version} is recorded twice, by "${was.by}" and by "${r.by}". Two PRs took the same number: raise ${l.constName} above it` });
      seen.set(r.version, r);
    }
    rows.forEach((r, i) => {
      if (i && !(cmp(rows[i - 1].version, r.version) < 0))
        out.push({ kind: 'ORDER', family: l.family, text: `row ${i + 1} records ${r.version} after ${rows[i - 1].version}; versions rise, oldest first` });
    });
    if (l.idVersion !== l.version)
      out.push({ kind: 'ID', family: l.family, text: `${l.constName} reads ${l.version}, the schema's $id reads ${l.idVersion}. Move both together` });
    const newest = rows.at(-1);
    const mine = [...rows].reverse().find((r) => r.version === l.version);
    if (!mine) {
      out.push({ kind: 'UNRECORDED', family: l.family, text: `${l.constName} reads ${l.version}, which the record does not hold${newest ? ` (newest: ${newest.version})` : ''}. Run: npx tsx packages/engine/${TAG}.ts --accept --note "<what ${l.version} adds>"` });
      continue;
    }
    if (newest && cmp(newest.version, l.version) > 0)
      out.push({ kind: 'AHEAD', family: l.family, text: `the record's newest version is ${newest.version}, above ${l.constName} (${l.version}). A row with no raise behind it` });
    if (mine.shape !== l.shape)
      out.push({ kind: 'SHAPE', family: l.family, text: `the schema's shape is ${l.shape}; ${l.version} was recorded as ${mine.shape} by "${mine.by}". The format changed and kept its number, or a merge put two shapes under it: raise ${l.constName} and the $id above ${newest?.version ?? l.version}, then --accept` });
  }
  return out;
};

// ---- the self-check: the real `judge` over planted records, each answer literal -----------------------------------

const selfCheck = (): string[] => {
  const F = 'prism3-x';
  const reg = [F];
  const row = (version: string, shape: string, by = 'a'): Row => ({ version, by, shape, note: '' });
  const live = (version: string, shape: string, idVersion = version): Live[] => [{ family: F, constName: 'X', version, idVersion, shape }];
  const rec = (...rows: Row[]): Record_ => ({ note: '', formats: { [F]: rows } });
  // A two-PR merge, planted: each PR raised 0.7 to 0.8 with its own shape; the merged schema is the union.
  const cases: [string, Record_, Live[], string[], string[]][] = [
    ['control: the constant recorded with its shape', rec(row('0.7', 'h0')), live('0.7', 'h0'), reg, []],
    ['a shape change that kept its number', rec(row('0.7', 'h0')), live('0.7', 'h1'), reg, ['SHAPE']],
    ['a raise with no row', rec(row('0.7', 'h0')), live('0.8', 'h1'), reg, ['UNRECORDED']],
    ['a row with no raise', rec(row('0.7', 'h0'), row('0.8', 'h1')), live('0.7', 'h0'), reg, ['AHEAD']],
    ['the merge, both rows kept', rec(row('0.7', 'h0'), row('0.8', 'hA', 'pr-a'), row('0.8', 'hB', 'pr-b')), live('0.8', 'hAB'), reg, ['DUPLICATE', 'ORDER', 'SHAPE']],
    ['the merge, one row kept', rec(row('0.7', 'h0'), row('0.8', 'hA', 'pr-a')), live('0.8', 'hAB'), reg, ['SHAPE']],
    ['the merge, resolved by a new version', rec(row('0.7', 'h0'), row('0.8', 'hA', 'pr-a'), row('0.9', 'hAB', 'pr-b')), live('0.9', 'hAB'), reg, []],
    ['rows out of order', rec(row('0.8', 'h1'), row('0.7', 'h0')), live('0.7', 'h0'), reg, ['ORDER']],
    ['the $id left behind', rec(row('0.8', 'h1')), live('0.8', 'h1', '0.7'), reg, ['ID']],
    ['an unregistered schema', rec(row('0.7', 'h0')), live('0.7', 'h0'), [], ['SCOPE', 'SCOPE']],
  ];
  // Hand-counted, not derived: a self-check that lost a case would otherwise report its smaller count as a pass.
  const EXPECTED_CASES = 10;
  const bad: string[] = [];
  if (cases.length !== EXPECTED_CASES) bad.push(`the self-check holds ${cases.length} planted records, not ${EXPECTED_CASES}`);
  for (const [name, r, l, registered, want] of cases) {
    const got = judge(r, l, registered, [F]).map((f) => f.kind).sort();
    if (JSON.stringify(got) !== JSON.stringify([...want].sort())) bad.push(`self-check "${name}": wanted [${want.join(', ')}], got [${got.join(', ')}]`);
  }
  // The shape walk: prose and key order do not move it; a property, an enum value and the $id-as-version do or don't.
  const s = { $id: 'prism3-x/0.7', type: 'object', description: 'a', properties: { a: { type: 'string', title: 't' } }, required: ['a'] };
  const d = { ...s, properties: { ...s.properties, description: { type: 'string' } }, $defs: { title: { type: 'string' } } };
  const n = { ...s, properties: { properties: { type: 'object', description: 'a' } } };
  const probes: [string, unknown, boolean, unknown?][] = [
    ['a description edit', { ...s, description: 'b' }, false],
    ['keys reordered', { required: ['a'], properties: s.properties, type: 'object', description: 'a', $id: s.$id }, false],
    ['the $id raised', { ...s, $id: 'prism3-x/0.8' }, false],
    ['a property added', { ...s, properties: { ...s.properties, b: { type: 'number' } } }, true],
    ['a required member added', { ...s, required: ['a', 'b'] }, true],
    ['an enum value added', { ...s, properties: { a: { type: 'string', enum: ['x'] } } }, true],
    // Review B1 of #4515: a PROPERTY named like an annotation is part of the shape; the annotation itself is not.
    ['a property named description added', { ...s, properties: { ...s.properties, description: { type: 'string' } } }, true],
    ['a property named description retyped', { ...d, properties: { ...d.properties, description: { type: 'number' } } }, true, d],
    ['a property named description removed', { ...d, properties: { a: d.properties.a } }, true, d],
    ['a $defs member named title retyped', { ...d, $defs: { title: { type: 'number' } } }, true, d],
    // The trap the parent-key rule falls into: a property NAMED properties holds a schema whose description is prose.
    ['the description of a property named properties edited', { ...n, properties: { properties: { type: 'object', description: 'b' } } }, false, n],
  ];
  // Hand-counted, as EXPECTED_CASES is.
  const EXPECTED_PROBES = 11;
  if (probes.length !== EXPECTED_PROBES) bad.push(`the self-check holds ${probes.length} shape probes, not ${EXPECTED_PROBES}`);
  for (const [name, v, moves, base = s] of probes)
    if ((shapeOf(v) !== shapeOf(base)) !== moves) bad.push(`self-check shape: ${name} ${moves ? 'did not move' : 'moved'} the shape`);
  return bad;
};

// ---- reading the tree -------------------------------------------------------------------------------------------

const fail = (lines: string[]): never => {
  console.error(`\n❌ ${TAG}: ${lines[0]}`);
  for (const l of lines.slice(1)) console.error(l);
  process.exit(1);
};

const readRecord = (): Record_ => {
  let r: Record_;
  try { r = JSON.parse(readFileSync(RECORD, 'utf8')); } catch (e) { return fail([`cannot read ${relative(repo, RECORD)} — this check CANNOT RUN.`, `    ${(e as Error).message}`]); }
  if (!r || typeof r !== 'object' || !r.formats || typeof r.formats !== 'object') return fail([`${relative(repo, RECORD)} has no "formats" object — this check CANNOT RUN.`]);
  for (const [fam, rows] of Object.entries(r.formats))
    if (!Array.isArray(rows) || rows.some((x) => !x || typeof x.version !== 'string' || typeof x.by !== 'string' || typeof x.shape !== 'string' || typeof x.note !== 'string'))
      return fail([`${relative(repo, RECORD)}: "${fam}" is not a list of { version, by, shape, note } rows — this check CANNOT RUN.`]);
  return r;
};

const readLive = (): { live: Live[]; published: string[] } => {
  const published: string[] = [];
  for (const f of readdirSync(SCHEMA_DIR).filter((n) => n.endsWith('.schema.json')).sort()) {
    const id = JSON.parse(readFileSync(join(SCHEMA_DIR, f), 'utf8')).$id;
    const m = typeof id === 'string' ? /^(prism3-[a-z0-9-]+)\/\d+(\.\d+)*$/.exec(id) : null;
    if (m) published.push(m[1]);
  }
  if (published.length < FORMATS.length) fail([`schema/ publishes ${published.length} versioned prism3 schema(s), fewer than the ${FORMATS.length} registered — the scan is blind, this check CANNOT RUN.`]);
  const live = FORMATS.map((f) => {
    const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, f.schema), 'utf8'));
    return { family: f.family, constName: f.constName, version: versionOf(f.constant, f.family), idVersion: versionOf(String(schema.$id), f.family), shape: shapeOf(schema) };
  });
  return { live, published };
};

/** One row per line, so each PR's row is one line of the diff and two PRs' rows conflict where they meet. */
const write = (r: Record_): void => {
  const fams = Object.keys(r.formats).sort();
  const body = fams.map((fam) => `    ${JSON.stringify(fam)}: [\n${r.formats[fam].map((x) => `      ${JSON.stringify({ version: x.version, by: x.by, shape: x.shape, note: x.note })}`).join(',\n')}\n    ]`).join(',\n');
  writeFileSync(RECORD, `{\n  "note": ${JSON.stringify(r.note)},\n  "formats": {\n${body}\n  }\n}\n`);
};

const arg = (name: string): string | undefined => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };

// ---- main -------------------------------------------------------------------------------------------------------

const bad = selfCheck();
if (bad.length) fail(['the self-check failed, so a clean run would prove nothing.', ...bad.map((b) => `  ✗ ${b}`)]);

const record = readRecord();
const { live, published } = readLive();
const registered = FORMATS.map((f) => f.family);

if (process.argv.includes('--accept')) {
  const blocking = judge(record, live, registered, published).filter((f) => !['UNRECORDED', 'SHAPE'].includes(f.kind));
  if (blocking.length) fail(['--accept refuses while the record or the versions disagree in a way a new row cannot fix:', ...blocking.map((f) => `  ✗ ${f.kind}  ${f.family}: ${f.text}`)]);
  const g = (...a: string[]) => spawnSync('git', ['-C', repo, ...a], { encoding: 'utf8' });
  const by = arg('--by') ?? g('branch', '--show-current').stdout.trim();
  if (!by) fail(['--accept needs a name for the row: run it on a branch, or pass --by <name>.']);
  const note = arg('--note');
  // What origin/main holds (review S1 of #4515). A ref that cannot be read leaves `onMain` null, and a rewrite then
  // refuses: it cannot tell a row on main from one that is not. A readable ref without the file holds no rows.
  const mainOk = g('rev-parse', '--verify', '--quiet', 'origin/main^{commit}').status === 0;
  const recordOnMain = `origin/main:${relative(repo, RECORD)}`;
  const onMain: Record_ | null = !mainOk ? null
    : g('cat-file', '-e', recordOnMain).status === 0 ? JSON.parse(g('show', recordOnMain).stdout) : { note: '', formats: {} };
  let changed = 0;
  for (const l of live) {
    const rows = (record.formats[l.family] ??= []);
    const at = rows.findIndex((r) => r.version === l.version);
    if (at < 0) {
      if (!note) fail([`--accept adds a row for ${l.family} ${l.version}, and a row needs --note "<what ${l.version} adds>".`]);
      rows.push({ version: l.version, by, shape: l.shape, note: note! });
      console.log(`  + ${l.family} ${l.version}  ${l.shape}  by ${by}`);
      changed++;
    } else if (rows[at].shape !== l.shape) {
      if (!onMain) fail([`${l.family} ${l.version} would be rewritten, and origin/main cannot be read, so whether that row is already merged is unknown.`,
        '  A rewrite needs to know it. Run: git fetch origin main, then --accept again. (Appending a new version needs no origin/main.)']);
      const merged = onMain!.formats[l.family]?.some((r) => r.version === l.version);
      if (rows[at].by !== by || at !== rows.length - 1 || merged)
        fail([`${l.family} ${l.version} is recorded by "${rows[at].by}"${merged ? ' and is on origin/main' : ''}, and the schema's shape moved since.`,
          `  A recorded version never takes a second shape. Raise ${l.constName} and the schema's $id above ${rows.at(-1)!.version}, then --accept.`]);
      rows[at] = { ...rows[at], shape: l.shape, note: note ?? rows[at].note };
      console.log(`  ~ ${l.family} ${l.version}  ${l.shape}  (this branch's own row, not yet on origin/main)`);
      changed++;
    }
  }
  if (changed) write(record);
  console.log(changed ? `✅ ${TAG}: ${changed} row(s) written to ${relative(repo, RECORD)}.` : `✅ ${TAG}: nothing to record.`);
  process.exit(0);
}

const failures = judge(record, live, registered, published);
if (failures.length) fail([`${failures.length} failure(s):`, ...failures.map((f) => `  ✗ ${f.kind}  ${f.family}: ${f.text}`)]);
const rows = Object.values(record.formats).reduce((n, r) => n + r.length, 0);
console.log(`✅ ${TAG}: ${live.length} formats, each at its recorded version and shape (${live.map((l) => `${l.family}/${l.version} ${l.shape}`).join(', ')}); ${rows} rows, no version recorded twice; ${published.length} published schemas, each registered; self-check: 10 planted records and 11 shape probes answered as expected.`);
