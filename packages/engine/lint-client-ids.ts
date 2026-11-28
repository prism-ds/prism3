/**
 * CLIENT-ID GATE (#4645, phase 1) — no client name or fixture id spreads further through the tree.
 *
 *   npx tsx packages/engine/lint-client-ids.ts
 *   npx tsx packages/engine/lint-client-ids.ts --accept         # rewrite the baseline to today's counts
 *   npx tsx packages/engine/lint-client-ids.ts --hash "<name>"  # print a deny-list hash entry; writes nothing
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * The repo is public, and two of its regression fixtures carry ids that read as client names. #4645 renames them in
 * phases (`docs/superpowers/brand-id-rename-proposal.md` §5). This gate lands first, as a ratchet (owner decision
 * Q7 A), so nothing grows while the renames are in flight: every later phase lowers the baseline, and phase 5 empties
 * it and makes the gate absolute.
 *
 * ── WHAT IT READS ───────────────────────────────────────────────────────────────────────────────
 *
 * Every tracked file (`git ls-files`): its PATH, and its CONTENTS unless it is binary (a NUL byte in its first 8 KiB).
 * Binary files are counted and reported, never skipped silently. Each is matched against `CLIENT_DENY_LIST` in
 * `client-ids.ts`, the one constant `lint-voice.ts` also reads:
 *
 *   - `names`  — the full display names (#1824), as patterns.
 *   - `ids`    — the fixture ids, as patterns; the two-letter id only in id positions.
 *   - `hashes` — every further client name, as the SHA-256 of its normalized form (Q6 A). The gate hashes each word
 *                and each phrase of each listed length in every path and file, and compares. So the list never
 *                spells a name out, and neither does this gate's output: a hashed hit is named by its hash prefix.
 *
 * Two hits that overlap are one hit, credited to the first rule in list order (ids before names), so `wendys` counts
 * once and not as both an id and a name.
 *
 * ── THE RATCHET ─────────────────────────────────────────────────────────────────────────────────
 *
 *   EXPECTED = `schema/client-id-baseline.json`: per file, per rule, the hit count when it was last accepted. Written
 *              by `--accept` only, never by `regen.ts` (CLAUDE.md principle 5: a gate allowed to rewrite what it reads
 *              has no memory).
 *   ACTUAL   = the counts read from the tree as it stands.
 *
 * A file whose count for a rule ROSE fails, and so does a file with hits that the baseline does not hold (NEW). Each
 * failure lists every hit of that rule in that file by `path:line`, so the reader finds the new one. A count that FELL
 * fails too, until `--accept` lowers the baseline, so the baseline never goes stale and a later rise cannot hide in
 * the slack. A file the baseline holds that is gone from the tree counts as fallen to zero.
 *
 * A rise that is not a new name (a regenerated fixture emission that gained a token, say) is still a rise. Run
 * `--accept` and let the reviewer read the baseline diff: that diff is the point of a ratchet.
 *
 * ── THE ALLOWLIST ───────────────────────────────────────────────────────────────────────────────
 *
 * `ALLOWLIST` names the paths that keep the names on purpose: the fold-owned history (owner decision Q3 A: forward
 * only), the fold's own inputs, the deny-list and the two gates that read it, the proposal, and the baseline itself.
 * Each entry is a path or a glob (`*` within a segment, `**` across them) and must match at least one tracked file,
 * so an entry left behind by a rename fails instead of quietly widening.
 *
 * ── PROOF THE GATE CAN SEE ──────────────────────────────────────────────────────────────────────
 *
 *   - `CLIENT_ID_SELF_CHECK` runs `hitsOf`, the function the scan runs, over planted strings that must and must not
 *     be flagged (the proposal's cases), plus the planted hash word.
 *   - `PLANTED_ARM` is a real tracked file outside the allowlist. The scan must reach it and find exactly its planted
 *     hits, the hashed one included. This proves the walk reaches real paths and the hash path reads real files, not
 *     only strings. Its hits are the gate's own and are never in the baseline. Moved into an allowlisted path, or
 *     out of the walk, it fails by name. (The proposal put it under `test-arms/`, but that directory is
 *     `lint-test-arms.ts`'s registry, which reads every file in it as an arm.)
 *   - `SURFACES`: each of `packages/`, `apps/`, `docs/`, `tools/`, `reference/` and `.github/` must contribute at least
 *     one scanned file, so a narrowed walk cannot pass by seeing less.
 *
 * ── ITS LIMIT ───────────────────────────────────────────────────────────────────────────────────
 *
 * It finds the names it is given. A client nobody has listed is not found; the owner extends the list (Q6). The
 * two-letter id is matched only in the positions the patterns name, so an id in a new position is missed until a
 * pattern and a self-check sample are added. It reads tracked files only, not the built bundles: those are
 * `lint-voice.ts`'s, and they are built from tracked sources this gate reads. And a ratchet counts, so a name moved
 * from one line to another in the same file passes.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLIENT_DENY_LIST } from './client-ids.ts';
import type { DenyHash } from './client-ids.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const BASELINE_REL = 'packages/engine/schema/client-id-baseline.json';
const TAG = 'lint-client-ids';

// ---- normalization and hashing (shared with `--hash`, so a pasted entry matches what the scan computes) ----------
/** The words of a text, normalized: lowercased, curly apostrophes made straight, letters and digits, with an
 *  apostrophe kept only inside a word. Each with its offset in the original text, for line numbers. */
export const normalizeWords = (txt: string): { word: string; index: number }[] =>
  [...txt.toLowerCase().replace(/[\u2018\u2019]/g, "'").matchAll(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu)]
    .map((m) => ({ word: m[0], index: m.index! }));
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

if (process.argv.includes('--hash')) {
  const name = process.argv[process.argv.indexOf('--hash') + 1] ?? '';
  const words = normalizeWords(name).map((w) => w.word);
  if (!words.length) { console.error(`${TAG}: --hash needs a name: --hash "<the name>"`); process.exit(2); }
  // The entry only. The name itself is never echoed, so a terminal log or a pasted transcript does not carry it.
  console.log(`{ sha256: '${sha256(words.join(' '))}', words: ${words.length} },`);
  process.exit(0);
}

// ---- the planted arm ------------------------------------------------------------------------------------------
// A made-up word, not a name, hashed the way a real entry is. It is scanned with the real hashes, so the hash path
// runs over the tree on every run, even while `CLIENT_DENY_LIST.hashes` is empty.
const PLANTED_WORD = 'quorvalinth';
const PLANTED_HASH: DenyHash = { sha256: 'c608275db08efdc338de13951301f91952032fb7a92dc9217d83ff6098ae273e', words: 1 };
const PLANTED_ARM = 'packages/engine/fixtures/client-id-arm.txt';
/** What the scan must find in `PLANTED_ARM`, as `rule@line`, in order. */
const PLANTED_EXPECT = (hashRule: string): string[] => [
  'client-id:wendys@3', 'client-id:nb@4', 'client-id:nbds@5', 'client-id:nb@6', `${hashRule}@7`,
];

// ---- the rules ------------------------------------------------------------------------------------------------
type Hit = { rule: string; index: number; end: number };
const hashRule = (h: DenyHash): string => `client-id:sha256:${h.sha256.slice(0, 12)}`;
const PATTERNS = [
  ...CLIENT_DENY_LIST.ids.map(({ name, re }) => ({ rule: `client-id:${name}`, re })),
  ...CLIENT_DENY_LIST.names.map(({ name, re }) => ({ rule: `client-name:${name}`, re })),
];
const HASHES: DenyHash[] = [...CLIENT_DENY_LIST.hashes, PLANTED_HASH];
const HASH_BY_DIGEST = new Map(HASHES.map((h) => [h.sha256, h]));
const PHRASE_LENGTHS = [...new Set(HASHES.map((h) => h.words))];
const digestMemo = new Map<string, string>();
const digestOf = (s: string): string => { let d = digestMemo.get(s); if (d === undefined) { d = sha256(s); digestMemo.set(s, d); } return d; };

/** Every hit in a text, overlaps collapsed to the first rule in list order (patterns, then hashes). */
export const hitsOf = (txt: string): Hit[] => {
  const raw: (Hit & { rank: number })[] = [];
  PATTERNS.forEach(({ rule, re }, rank) => {
    for (const m of txt.matchAll(re)) raw.push({ rule, index: m.index!, end: m.index! + m[0].length, rank });
  });
  const words = normalizeWords(txt);
  for (const n of PHRASE_LENGTHS) {
    for (let i = 0; i + n <= words.length; i++) {
      const h = HASH_BY_DIGEST.get(digestOf(n === 1 ? words[i].word : words.slice(i, i + n).map((w) => w.word).join(' ')));
      if (h) {
        const last = words[i + n - 1];
        raw.push({ rule: hashRule(h), index: words[i].index, end: last.index + last.word.length, rank: PATTERNS.length + HASHES.indexOf(h) });
      }
    }
  }
  // One sweep in text order: a hit that overlaps the last one kept replaces it only if its rule ranks higher.
  raw.sort((a, b) => a.index - b.index || a.rank - b.rank);
  const kept: (Hit & { rank: number })[] = [];
  for (const h of raw) {
    const last = kept[kept.length - 1];
    if (last && h.index < last.end) { if (h.rank < last.rank) kept[kept.length - 1] = h; continue; }
    kept.push(h);
  }
  return kept.map(({ rule, index, end }) => ({ rule, index, end }));
};

// ---- the self-check: does `hitsOf` see what it claims to? ---------------------------------------------------
const CLIENT_ID_SELF_CHECK: { sample: string; want: string | null }[] = [
  { sample: 'packages/engine/examples/wendys.design.md', want: 'client-id:wendys' },
  { sample: "brands: ['nb', 'aurora']", want: 'client-id:nb' },
  { sample: 'packages/engine/out/nb.tokens.json', want: 'client-id:nb' },
  { sample: '{nbds.pds.color.neutral-cool.850}', want: 'client-id:nbds' },
  { sample: 'import { nbTheme } from "./theme-nb.ts"', want: 'client-id:nb' },
  { sample: 'out/figma/nb/core.json', want: 'client-id:nb' },
  { sample: 'the regression gate, nb-regression.ts', want: 'client-id:nb' },
  { sample: 'reference/New Balance/tokens', want: 'client-name:new balance' },
  { sample: 'examples/nb-redesign.design.md', want: 'client-id:nb' },
  { sample: `a stray ${PLANTED_WORD.toUpperCase()} in prose`, want: hashRule(PLANTED_HASH) },
  { sample: 'const nb = box(x)', want: null },
  { sample: 'a snb-redesigned layout', want: null },
  { sample: 'a&nbsp;b and &nbsp;', want: null },
  { sample: 'the weights strike a new balance between the two', want: null },
];
const failures: string[] = [];
const fail = (s: string): void => { failures.push(s); };
for (const { sample, want } of CLIENT_ID_SELF_CHECK) {
  const rules = hitsOf(sample).map((h) => h.rule);
  if (want === null ? rules.length > 0 : !rules.includes(want)) {
    fail(`SELF-CHECK  "${sample}" should ${want ? `be flagged as ${want}` : 'not be flagged'} (got: ${rules.join(', ') || 'nothing'})`);
  }
}
if (sha256(PLANTED_WORD) !== PLANTED_HASH.sha256) fail(`SELF-CHECK  PLANTED_HASH is not the SHA-256 of the planted word, so the hash path is untested`);

// ---- the allowlist ------------------------------------------------------------------------------------------
const ALLOWLIST: { glob: string; why: string }[] = [
  { glob: 'docs/00-progress.md', why: 'fold-owned history (Q3 A)' },
  { glob: 'docs/progress/archive/**', why: 'fold-owned history (Q3 A)' },
  { glob: 'docs/progress/pending/**', why: 'the fold carries each entry verbatim into docs/00-progress.md' },
  { glob: 'packages/engine/CHANGELOG.md', why: 'fold-owned history (Q3 A)' },
  { glob: 'packages/engine/changes/**', why: 'the fold carries each note verbatim into the CHANGELOG and a release page' },
  { glob: 'docs/public/releases/**', why: 'fold-owned history (Q3 A)' },
  { glob: 'packages/engine/client-ids.ts', why: 'the deny-list itself' },
  { glob: 'packages/engine/lint-client-ids.ts', why: 'this gate: its self-check spells the cases' },
  { glob: 'packages/engine/lint-voice.ts', why: 'reads the deny-list; its client-name self-check spells the cases' },
  { glob: 'docs/superpowers/brand-id-rename-proposal.md', why: 'the proposal names the two ids it renames' },
  { glob: BASELINE_REL, why: "the ratchet's memory: it lists the paths it counts" },
];
const globRe = (g: string): RegExp => new RegExp(`^${g.split('**').map((p) => p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*')}$`);
const ALLOW_RES = ALLOWLIST.map((a) => ({ ...a, re: globRe(a.glob) }));
const allowed = (path: string): boolean => ALLOW_RES.some((a) => a.re.test(path));

// ---- the walk -----------------------------------------------------------------------------------------------
const SURFACES = ['packages/', 'apps/', 'docs/', 'tools/', 'reference/', '.github/'];
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);

// The baseline's own entry is exempt only while `--accept` writes it for the first time.
for (const a of ALLOW_RES) if (!tracked.some((p) => a.re.test(p)) && !(a.glob === BASELINE_REL && process.argv.includes('--accept'))) fail(`ALLOWLIST   '${a.glob}' matches no tracked file — remove it, or fix it after a rename`);

type FileHits = { path: string; counts: Record<string, number>; lines: Record<string, (number | 'path')[]> };
const actual = new Map<string, FileHits>();
const surfaceCount = new Map(SURFACES.map((s) => [s, 0]));
let scanned = 0;
let binary = 0;
let plantedSeen: string[] | null = null;
/** A line finder for one text: the offsets of its line starts, searched by bisection. */
const lineFinder = (txt: string): ((index: number) => number) => {
  const starts = [0];
  for (let i = txt.indexOf('\n'); i !== -1; i = txt.indexOf('\n', i + 1)) starts.push(i + 1);
  return (index) => { let lo = 0; let hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= index) lo = mid; else hi = mid - 1; } return lo + 1; };
};

for (const path of tracked) {
  if (allowed(path)) continue;
  let buf: Buffer;
  // A tracked symlink is stored as its target path, so that is what is read.
  try { const abs = join(repo, path); buf = lstatSync(abs).isSymbolicLink() ? Buffer.from(readlinkSync(abs)) : readFileSync(abs); } catch (e) {
    fail(`UNREADABLE  ${path} is tracked but could not be read (${(e as Error).message}); stage its deletion or restore it`);
    continue;
  }
  const isBinary = buf.subarray(0, 8192).includes(0);
  if (isBinary) binary++;
  else scanned++;
  for (const s of SURFACES) if (path.startsWith(s) && !isBinary) surfaceCount.set(s, surfaceCount.get(s)! + 1);
  const fh: FileHits = { path, counts: {}, lines: {} };
  const add = (rule: string, line: number | 'path'): void => { fh.counts[rule] = (fh.counts[rule] ?? 0) + 1; (fh.lines[rule] ??= []).push(line); };
  for (const h of hitsOf(path)) add(h.rule, 'path');
  if (!isBinary) { const txt = buf.toString('utf8'); const lineOf = lineFinder(txt); for (const h of hitsOf(txt)) add(h.rule, lineOf(h.index)); }
  if (path === PLANTED_ARM) { plantedSeen = Object.entries(fh.lines).flatMap(([r, ls]) => ls.map((l) => ({ r, l }))).sort((a, b) => (a.l === 'path' ? 0 : a.l) - (b.l === 'path' ? 0 : b.l)).map(({ r, l }) => `${r}@${l}`); continue; }
  if (Object.keys(fh.counts).length) actual.set(path, fh);
}

// The planted arm: reached, outside the allowlist, and found to hold exactly what was planted.
if (!tracked.includes(PLANTED_ARM)) fail(`PLANTED ARM ${PLANTED_ARM} is not a tracked file, so nothing proves the walk reaches a real path`);
else if (allowed(PLANTED_ARM)) fail(`PLANTED ARM ${PLANTED_ARM} is allowlisted, so its hits are not counted and nothing proves a hit outside the allowlist is reported`);
else if (plantedSeen === null) fail(`PLANTED ARM ${PLANTED_ARM} is tracked but the walk did not read it`);
else {
  const want = PLANTED_EXPECT(hashRule(PLANTED_HASH)).join(', ');
  const got = (plantedSeen as string[]).join(', ');
  if (got !== want) fail(`PLANTED ARM ${PLANTED_ARM} should report ${want}; the scan found ${got || 'nothing'}`);
}
for (const [s, n] of surfaceCount) if (!n) fail(`SCANNED BLIND  ${s} contributed no scanned file — a narrowed walk would pass by seeing less`);

// ---- --accept: the only writer of the baseline --------------------------------------------------------------
const sortObj = <T>(o: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
if (process.argv.includes('--accept')) {
  if (failures.length) {
    console.error(`❌ ${TAG}: --accept refused; the gate cannot see what it claims to:\n`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  const files = sortObj(Object.fromEntries([...actual.values()].map((f) => [f.path, sortObj(f.counts)])));
  // Pure data, no prose field: lint-schema-classification.ts exempts it on that ground, and a note would make it
  // prose that the two prose gates would have to read, with the names this file counts in its keys.
  writeFileSync(join(repo, BASELINE_REL), `${JSON.stringify({
    files,
  }, null, 2)}\n`);
  const total = Object.values(files).reduce((n, c) => n + Object.values(c).reduce((a, b) => a + b, 0), 0);
  console.log(`${TAG}: baseline written — ${Object.keys(files).length} files, ${total} hits (${BASELINE_REL})`);
  process.exit(0);
}

// ---- the ratchet ------------------------------------------------------------------------------------------------
let baseline: Record<string, Record<string, number>> = {};
try { baseline = JSON.parse(readFileSync(join(repo, BASELINE_REL), 'utf8')).files ?? {}; } catch (e) {
  fail(`BASELINE    ${BASELINE_REL} could not be read (${(e as Error).message})`);
}
const at = (path: string, lines: (number | 'path')[]): string => lines.map((l) => (l === 'path' ? `${path} (path)` : `${path}:${l}`)).join(', ');
for (const fh of actual.values()) {
  const base = baseline[fh.path];
  for (const [rule, n] of Object.entries(fh.counts)) {
    const b = base?.[rule] ?? 0;
    if (!base) fail(`NEW   ${rule} at ${at(fh.path, fh.lines[rule])} (not in baseline, not allowlisted)`);
    else if (n > b) fail(`ROSE  ${rule} in ${fh.path}: ${n} now, baseline ${b} — at ${at(fh.path, fh.lines[rule])}`);
    else if (n < b) fail(`FELL  ${rule} in ${fh.path}: ${n} now, baseline ${b} — lower the baseline with --accept`);
  }
}
for (const [path, counts] of Object.entries(baseline)) {
  for (const [rule, b] of Object.entries(counts)) {
    if (b > 0 && !actual.get(path)?.counts[rule]) fail(`FELL  ${rule} in ${path}: 0 now, baseline ${b} — lower the baseline with --accept`);
  }
}

const totalHits = [...actual.values()].reduce((n, f) => n + Object.values(f.counts).reduce((a, b) => a + b, 0), 0);
const summary = `${tracked.length} tracked paths, ${scanned} text files read, ${binary} binary (path only), ${tracked.length - scanned - binary} allowlisted by ${ALLOWLIST.length} entries; ${totalHits} hits in ${actual.size} files, held to the baseline; ${HASHES.length - 1} hashed names + the planted hash; ${CLIENT_ID_SELF_CHECK.length} self-check samples; ${SURFACES.length} surfaces represented`;
if (failures.length) {
  console.error(`❌ ${TAG}: ${failures.length} failure(s)\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`\n  ${summary}`);
  console.error(`  A rise or a new file: rename the id, or (only if it must stay) --accept and say why in the PR. A fall: --accept.`);
  process.exit(1);
}
console.log(`✅ ${TAG}: clean — ${summary}`);
