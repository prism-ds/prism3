/**
 * TEST-ARMS GATE (#1834) — a named test arm, once registered, is not deleted without a line in the diff saying so.
 *
 *   npx tsx packages/engine/lint-test-arms.ts
 *   npx tsx packages/engine/lint-test-arms.ts --accept      # add a file for each NEW arm; never removes one
 *   npx tsx packages/engine/lint-test-arms.ts --self-test
 *
 * ── THE INCIDENT ────────────────────────────────────────────────────────────────────────────────
 *
 * On `lane/link-palette-default`, `d1990596` added the plugin half of the #1812 gate, about 56 lines in
 * `apps/plugin/test-write-components.ts`. The next merge of `origin/main` dropped every one of them. `npm run
 * verify` still read 67/67 PASS, and the PR body, progress entry and changelog all still described the arm. A
 * reviewer counting `#1812` lines in the output caught it. Nothing asserted that a named arm still exists, so a
 * suite could lose one and stay green. This is docs/34's silent deletion of a gate, arriving through merge
 * mechanics instead of a DRY edit.
 *
 * ── WHAT AN ARM IS HERE ─────────────────────────────────────────────────────────────────────────
 *
 * The repo names its test arms by issue: an assertion label cites the issue it guards (`#1812: …`), and that is
 * how the reviewer found the gap. So an ARM is a pair (suite file, `#NNNN`) where the tag occurs inside a string
 * or template literal of the suite. Comments do not count (a tag left in a comment above deleted assertions is
 * exactly the incident's leftover), and regex literals do not count (a pattern is not a label).
 *
 * ── INDEPENDENCE (docs/34) ──────────────────────────────────────────────────────────────────────
 *
 *   EXPECTED = `test-arms/`, an authored registry beside this file: one file per arm, named for the arm, holding
 *              its `<suite> #NNNN` line.
 *   ACTUAL   = the tags in each suite's literals, read from the suite as it stands.
 *
 * Neither is derived from the other. A merge that drops a suite's lines does not drop the registry's: the arm
 * fails by name (`ARM GONE`). To retire an arm on purpose, delete its registry file in the same diff, where a
 * reviewer sees it. `--accept` APPENDS and never removes: a gate allowed to rewrite what it reads has no memory
 * (CLAUDE.md principle 5, shape 6). A new arm in a suite fails as `UNREGISTERED` until it is accepted. Without
 * that arm, the PR that adds an arm could forget to register it, and the incident above would pass again.
 *
 * THE ALTERNATIVE THAT WAS REJECTED: compare against the merge base, or against the previous commit. The
 * incident's arm was added AND lost inside one branch, so the merge base never held it. The previous commit
 * holds it only at the one merge commit, and CI checks out shallow. `lint-shape-index.ts` rejects git-history
 * oracles for the same reason: "the history is not there" reads the same as "nothing changed".
 *
 * ── ONE FILE PER ARM (#4455) ────────────────────────────────────────────────────────────────────
 *
 * The registry was one sorted file, `test-arms.txt`. Almost every PR adds an arm, and arms named for issues opened
 * the same week sort next to each other, so two PRs that each registered one inserted adjacent lines and conflicted.
 * After each merge wave most of the queue went dirty on this one file (31 of 42 PRs on 2026-11-21). GitHub's
 * mergeability check ignores merge drivers, so `merge=union` could not help. Now each arm is its own file:
 * `packages/engine/test-arms/<suite, each / written __>__<NNNN>`, holding the line `<suite> #NNNN`. Two PRs that add
 * different arms add different files, which never conflict. Two that add the same arm add the same file with the same
 * bytes, which git merges as one. A file whose name and line disagree, or whose line is malformed, fails MALFORMED, so
 * a hand-copied file cannot register one arm under another's name. `README.md` in the directory is not an arm.
 *
 * ── SCOPE, ASSERTED REPRESENTED ─────────────────────────────────────────────────────────────────
 *
 * Every `test-*.ts` and `test-*.mjs` in `apps/studio/` and `apps/plugin/`, read from the directory, plus the two
 * engine suites, `packages/engine/test.ts` and `mcp-test.ts`. Each of those four surfaces must contribute at least
 * one suite and one arm, or the run fails as SCANNED BLIND. A glob that stopped matching would otherwise report
 * "no arm gone" over nothing.
 *
 * ── ITS LIMIT ───────────────────────────────────────────────────────────────────────────────────
 *
 * It proves the arm's NAME is still in the suite's code, not that the code still runs. An arm wrapped in a
 * branch that never executes passes here. A collapse of the suite (`ok()` neutered) is the assertion floors'
 * job (#1066). An arm that cites no issue is not named, so it is not protected. And a suite that keeps one
 * `#1812` label while losing the other forty is not caught: the registry holds names, not counts.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const REGISTRY = join(here, 'test-arms');
const REGISTRY_REL = 'packages/engine/test-arms';

/** The `#NNNN` tags inside a source's string and template literals. Comments and regex literals are skipped, and so
 *  is everything inside a `console.*(…)` call's arguments (#4196): a suite's header log names the issues it covers,
 *  and it stays when every assertion that carried the tag is gone, so a log line is never an arm. */
export const armTagsOf = (src: string): Set<string> => {
  const out = new Set<string>();
  const n = src.length;
  let i = 0;
  let depth = 0;
  let prev = '';
  const holes: number[] = []; // brace depth at each `${` of an open template
  let parens = 0;
  const mutes: number[] = []; // paren depth outside each open `console.*(` call, so its `)` is found
  const take = (text: string): void => { if (mutes.length) return; for (const m of text.matchAll(/#([1-9]\d{2,4})\b/g)) out.add(`#${m[1]}`); };
  // A `/` starts a regex literal where an expression may start, which is after punctuation or a keyword.
  const regexMayStart = (): boolean => prev === '' || /[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || /^(return|typeof|case|in|of|void|yield|await)$/.test(prev);
  const template = (): void => {
    let buf = '';
    while (i < n) {
      const c = src[i];
      if (c === '\\') { buf += src.slice(i, i + 2); i += 2; continue; }
      if (c === '`') { i++; take(buf); return; }
      if (c === '$' && src[i + 1] === '{') { take(buf); buf = ''; i += 2; holes.push(depth); depth++; code(true); continue; }
      buf += c; i++;
    }
    take(buf);
  };
  const code = (inHole: boolean): void => {
    while (i < n) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
      if (c === '"' || c === "'") {
        let j = i + 1;
        let buf = '';
        while (j < n && src[j] !== c && src[j] !== '\n') {
          if (src[j] === '\\') { buf += src.slice(j, j + 2); j += 2; continue; }
          buf += src[j]; j++;
        }
        take(buf); i = j + 1; prev = 'x'; continue;
      }
      if (c === '`') { i++; template(); prev = 'x'; continue; }
      if (c === '/' && regexMayStart()) {
        let j = i + 1;
        let cls = false;
        while (j < n && src[j] !== '\n') {
          const d = src[j];
          if (d === '\\') { j += 2; continue; }
          if (d === '[') cls = true;
          else if (d === ']') cls = false;
          else if (d === '/' && !cls) break;
          j++;
        }
        i = j + 1;
        while (i < n && /[a-z]/.test(src[i])) i++;
        prev = 'x'; continue;
      }
      if (c === '(') parens++;
      if (c === ')') { parens--; if (mutes.length && parens === mutes[mutes.length - 1]) mutes.pop(); }
      if (c === '{') depth++;
      if (c === '}') {
        depth--;
        if (inHole && holes.length && depth === holes[holes.length - 1]) { holes.pop(); i++; return; }
      }
      if (/[A-Za-z0-9_$]/.test(c)) {
        let j = i;
        while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
        prev = src.slice(i, j);
        // `console.log(` and its siblings: mute the literals until the call's own `)` (#4196).
        const call = prev === 'console' ? /^\s*\.\s*(?:log|error|warn|info|debug|table|dir|group|trace)\s*\(/.exec(src.slice(j, j + 40)) : null;
        if (call) { mutes.push(parens); parens++; i = j + call[0].length; prev = '('; continue; }
        i = j; continue;
      }
      if (!/\s/.test(c)) prev = c;
      i++;
    }
  };
  code(false);
  return out;
};

/** The suites in scope, repo-relative, grouped by the surface that promised them. */
export const SURFACES: ReadonlyArray<{ readonly name: string; readonly files: () => string[] }> = [
  { name: 'apps/studio', files: () => readdirSync(join(repo, 'apps/studio')).filter((f) => /^test-.*\.(ts|mjs)$/.test(f)).map((f) => `apps/studio/${f}`) },
  { name: 'apps/plugin', files: () => readdirSync(join(repo, 'apps/plugin')).filter((f) => /^test-.*\.(ts|mjs)$/.test(f)).map((f) => `apps/plugin/${f}`) },
  { name: 'packages/engine/test.ts', files: () => ['packages/engine/test.ts'].filter((f) => existsSync(join(repo, f))) },
  { name: 'packages/engine/mcp-test.ts', files: () => ['packages/engine/mcp-test.ts'].filter((f) => existsSync(join(repo, f))) },
];

export const key = (file: string, tag: string): string => `${file} ${tag}`;

/** The registry file that holds an arm: the suite's path with each `/` written `__`, then `__` and the issue number. */
export const fileOf = (line: string): string => {
  const [file, tag] = line.split(' ');
  return `${file.replace(/\//g, '__')}__${tag.slice(1)}`;
};

/** The registry's lines, read from its files. A file holds exactly one `<suite> #NNNN` line and is named for it
 *  (`fileOf`); anything else is returned whole in `registered` so `judge` refuses it as malformed, prefixed with the
 *  file it came from when the name is the problem. Pure over (name, text) pairs, so the self-test drives it. */
export const parseRegistry = (entries: ReadonlyArray<{ readonly name: string; readonly text: string }>): string[] => {
  const out: string[] = [];
  for (const { name, text } of entries) {
    if (name === 'README.md') continue;
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const line = lines.length === 1 ? lines[0] : `${name}: ${lines.length} lines (a registry file holds one)`;
    out.push(/^\S+ #[1-9]\d{2,4}$/.test(line) && fileOf(line) !== name ? `${name}: holds "${line}", which belongs in ${fileOf(line)}` : line);
  }
  return out;
};

const readRegistry = (): string[] => {
  if (!existsSync(REGISTRY)) return [];
  return parseRegistry(readdirSync(REGISTRY, { withFileTypes: true }).map((d) => ({ name: d.name, text: d.isFile() ? readFileSync(join(REGISTRY, d.name), 'utf8') : '' })));
};

/** The verdict: arms registered but gone, and arms present but unregistered. Pure, so the self-test drives it. */
export const judge = (registered: readonly string[], actual: ReadonlyMap<string, Set<string>>): { gone: string[]; unregistered: string[]; malformed: string[] } => {
  const reg = new Set<string>();
  const malformed: string[] = [];
  for (const line of registered) {
    if (!/^\S+ #[1-9]\d{2,4}$/.test(line)) { malformed.push(line); continue; }
    reg.add(line);
  }
  const gone = [...reg].filter((line) => {
    const [file, tag] = line.split(' ');
    return !actual.get(file)?.has(tag);
  });
  const unregistered: string[] = [];
  for (const [file, tags] of actual) for (const tag of tags) if (!reg.has(key(file, tag))) unregistered.push(key(file, tag));
  return { gone, unregistered: unregistered.sort(), malformed };
};

const selfTest = (quiet = false): number => {
  let bad = 0;
  const expect = (cond: boolean, label: string): void => { if (cond) { if (!quiet) console.log(`  ✓ ${label}`); } else { bad++; console.error(`  ✗ ${label}`); } };
  const tags = (s: string): string => [...armTagsOf(s)].sort().join(',');
  expect(tags("ok(x, '#1812: the arm');") === '#1812', 'a tag in a single-quoted label is an arm');
  expect(tags('ok(x, "#1812 x");') === '#1812', 'a tag in a double-quoted label is an arm');
  expect(tags('ok(x, `#1812 ${a ? `#2000` : "#2001"} tail #2002`);') === '#1812,#2000,#2001,#2002', 'template text and nested literals inside ${} are read');
  expect(tags('// #1812 the arm below\nok(x, "plain");') === '', 'a tag in a line comment is not an arm');
  expect(tags('/* #1812 */ ok(x, "plain");') === '', 'a tag in a block comment is not an arm');
  expect(tags('const re = /#1812/; ok(x, "#999");') === '#999', 'a tag in a regex literal is not an arm');
  expect(tags('const r = a / b; ok(x, "#4321 / #4322");') === '#4321,#4322', 'division is not a regex, so the label after it is still read');
  expect(tags("ok(x, 'it\\'s #3000');") === '#3000', 'an escaped quote does not end the literal');
  expect(tags('const u = "a://b#12"; ok(x, `x`);') === '', 'a two-digit fragment is not an issue tag');
  // #4196: a log line names the issues a suite covers and outlives the assertions that carried them.
  expect(tags("console.log('MCP paste (#111/#1553) — header');\nok(x, 'plain');") === '', '#4196: a suite whose only tag is in a console.log reads as having no arm');
  expect(tags('console.error(`✗ #1812 ${f("#2000")} (${a.map((b) => `#2001`)})`); ok(x, "#3000");') === '#3000', '#4196: nothing inside a console.error call is an arm, nested calls and templates included; the label after it is');
  expect(tags("console . warn ( '#1812' , ok(x, '#2000') ); ok(y, '#2001');") === '#2001', '#4196: a console call is muted to its own closing paren, and no further');
  expect(tags("const log = (s) => s; log('#1812'); ok(x, (console, '#2000'));") === '#1812,#2000', '#4196: only a console.<method>( call is muted, not the word console');
  const actual = new Map([['a.ts', new Set(['#1812', '#2000'])]]);
  const v = judge(['a.ts #1812', 'a.ts #2000'], actual);
  expect(!v.gone.length && !v.unregistered.length, 'a registry that matches the suites is clean');
  const merged = judge(['a.ts #1812', 'a.ts #2000'], new Map([['a.ts', new Set(['#2000'])]]));
  expect(merged.gone.join() === 'a.ts #1812', '#1834: a merge that drops the #1812 arm fails, naming the suite and the tag');
  expect(judge(['gone.ts #1812'], new Map()).gone.join() === 'gone.ts #1812', 'a registered arm in a deleted suite fails by name');
  expect(judge(['a.ts #1812'], actual).unregistered.join() === 'a.ts #2000', 'an arm nobody registered fails by name');
  expect(judge(['a.ts 1812'], actual).malformed.length === 1, 'a malformed registry line is refused, not skipped');
  // #4455: the registry is a directory, one file per arm.
  expect(fileOf('apps/plugin/test-x.ts #1812') === 'apps__plugin__test-x.ts__1812', '#4455: an arm\'s file is its suite path, / written __, then __ and the number');
  const dir = parseRegistry([{ name: 'README.md', text: 'not an arm' }, { name: 'a.ts__1812', text: 'a.ts #1812\n' }, { name: 'a.ts__2000', text: 'a.ts #2000' }]);
  expect(dir.join() === 'a.ts #1812,a.ts #2000' && !judge(dir, actual).malformed.length, '#4455: a directory of one-line files reads as the registry, README.md skipped');
  const misnamed = judge(parseRegistry([{ name: 'a.ts__1812', text: 'a.ts #2000' }]), actual);
  expect(misnamed.malformed.length === 1 && /belongs in a\.ts__2000/.test(misnamed.malformed[0]) && misnamed.unregistered.length === 2, '#4455: a file whose name and line disagree is refused, and registers neither arm');
  expect(judge(parseRegistry([{ name: 'a.ts__1812', text: 'a.ts #1812\na.ts #2000' }]), actual).malformed.length === 1, '#4455: a file holding two lines is refused');
  expect(judge(parseRegistry([{ name: 'a.ts__1812', text: '' }]), actual).malformed.length === 1, '#4455: an empty registry file is refused');
  console.log(bad ? `\n✗ lint-test-arms self-test: ${bad} failed` : '\n✓ lint-test-arms self-test: all passed');
  return bad ? 1 : 0;
};

const main = (): void => {
  if (process.argv.includes('--self-test')) process.exit(selfTest());
  // Every run proves its reader first: a lexer that stopped seeing labels, or started seeing comments, would read
  // every arm as gone or none as gone, so the self-test gates the scan rather than living behind a flag.
  if (selfTest(true)) process.exit(1);
  const actual = new Map<string, Set<string>>();
  const blind: string[] = [];
  for (const s of SURFACES) {
    const files = s.files();
    let arms = 0;
    for (const f of files) {
      const t = armTagsOf(readFileSync(join(repo, f), 'utf8'));
      actual.set(f, t);
      arms += t.size;
    }
    if (!files.length || !arms) blind.push(`${s.name}: ${files.length} suite(s), ${arms} arm(s) — a surface this gate promises read nothing`);
  }
  if (blind.length) {
    console.error(`✗ SCANNED BLIND:\n${blind.map((b) => `  - ${b}`).join('\n')}`);
    process.exit(1);
  }
  const registered = readRegistry();
  const { gone, unregistered, malformed } = judge(registered, actual);
  const suites = actual.size;
  const arms = [...actual.values()].reduce((n, t) => n + t.size, 0);

  if (process.argv.includes('--accept')) {
    if (malformed.length) { console.error(`✗ refusing to accept over malformed registry lines:\n${malformed.map((m) => `  - ${m}`).join('\n')}`); process.exit(1); }
    // One new file per arm, every existing file left as it is (#4455): two PRs that each register an arm add
    // different files, so neither conflicts with the other.
    if (unregistered.length) mkdirSync(REGISTRY, { recursive: true });
    for (const u of unregistered) writeFileSync(join(REGISTRY, fileOf(u)), `${u}\n`);
    console.log(`added ${unregistered.length} arm file(s) to ${REGISTRY_REL}/. Nothing removed${gone.length ? `; ${gone.length} registered arm(s) are still gone and still fail` : ''}.`);
    process.exit(gone.length ? 1 : 0);
  }

  for (const g of gone) console.error(`  ✗ ARM GONE  ${g} — registered, and no longer in the suite's code. If the arm was retired on purpose, delete ${REGISTRY_REL}/${fileOf(g)} in the same diff.`);
  for (const u of unregistered) console.error(`  ✗ UNREGISTERED  ${u} — a named arm the registry does not hold. Run: npx tsx packages/engine/lint-test-arms.ts --accept`);
  for (const m of malformed) console.error(`  ✗ MALFORMED  ${m} — each file in ${REGISTRY_REL}/ holds one "<repo-relative suite> #NNNN" line and is named for it`);
  if (gone.length || unregistered.length || malformed.length) {
    console.error(`\n✗ test arms: ${gone.length} gone, ${unregistered.length} unregistered, ${malformed.length} malformed (${suites} suites, ${arms} arms read)`);
    process.exit(1);
  }
  console.log(`✓ test arms: every registered arm is still in its suite — ${arms} arms over ${suites} suites, ${SURFACES.length} surfaces represented, ${registered.length} registry files in ${REGISTRY_REL}/`);
};

main();
