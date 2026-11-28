/**
 * #4634 — the test for `deploy-freshness.mjs`, the daily production-freshness monitor.
 *
 *   npx tsx .github/scripts/test-deploy-freshness.ts
 *
 * The monitor itself reads production and so runs only on its schedule (`.github/workflows/deploy-freshness.yml`),
 * never in CI. This runs in CI, with no network: the verdict (`decide`) and the marker read (`parseMarker`) by literal
 * cases, and the git half (`pendingCommits`) against a throwaway repository in $TMPDIR that carries the REAL
 * `apps/studio/vercel-ignore.sh`, so "would Vercel build this commit?" is answered by the same script Vercel runs.
 *
 * Cases, by name:
 *   decide/…   current, inside and past the allowance, the boundary, and the rule that only a commit Vercel would
 *              build starts the clock (an old docs-only commit does not; a later one does not reset it).
 *   message/…  a failure names both commits and the lag.
 *   marker/…   only a full 40-hex `commit` is a served commit; a local build's `null`, a short SHA and non-JSON fail.
 *   git/…      a docs-only commit is skipped and an app commit builds, each judged against the served commit.
 * Mutations, each failing here by name (measured): `<= maxLagHours` made `< maxLagHours` → `decide/boundary is
 * inside`; `find((c) => c.builds)` made `pending[0]` → `decide/skipped commits only`, `decide/an old skipped commit does
 * not start the clock`, `message/names the lag`; the `!due` branch made to return a failure →
 * `decide/skipped commits only`; `builds: r.status === 1` made `=== 0` → `git/docs-only commit is skipped`,
 * `git/app commit builds` and one more `git/…`; the 40-hex check loosened to `{7,40}` → `marker/short SHA is refused`.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error — a plain .mjs module with no type declarations; the workflow runs it with bare node.
import { decide, parseMarker, pendingCommits } from './deploy-freshness.mjs';

let failed = 0;
const ok = (cond: boolean, label: string, detail = ''): void => {
  if (cond) console.log(`  ✓ ${label}`);
  else { failed += 1; console.log(`  ✗ ${label}${detail ? `\n      ${detail}` : ''}`); }
};

const H = 3_600_000;
const NOW = Date.parse('2026-11-28T12:00:00Z');
const S = 'a'.repeat(40), T = 'f'.repeat(40);
const c = (n: number, hoursAgo: number, builds: boolean) => ({ sha: String(n).repeat(40), landedAt: NOW - hoursAgo * H, builds });

console.log('\ndecide');
ok(decide({ served: T, tip: T, pending: [], now: NOW }).ok, 'decide/current');
ok(decide({ served: S, tip: T, pending: [c(1, 23, true)], now: NOW }).ok, 'decide/inside the allowance');
ok(!decide({ served: S, tip: T, pending: [c(1, 25, true)], now: NOW }).ok, 'decide/past the allowance');
ok(decide({ served: S, tip: T, pending: [c(1, 24, true)], now: NOW }).ok, 'decide/boundary is inside');
ok(!decide({ served: S, tip: T, pending: [c(1, 24 + 1 / 60, true)], now: NOW }).ok, 'decide/one minute past the boundary fails');
ok(decide({ served: S, tip: T, pending: [c(1, 300, false), c(2, 200, false)], now: NOW }).ok, 'decide/skipped commits only');
ok(decide({ served: S, tip: T, pending: [c(1, 72, false), c(2, 2, true)], now: NOW }).ok, 'decide/an old skipped commit does not start the clock');
ok(!decide({ served: S, tip: T, pending: [c(1, 30, true), c(2, 1, true)], now: NOW }).ok, 'decide/the first building commit starts the clock');

console.log('\nmessage');
const late = decide({ served: S, tip: T, pending: [c(1, 72, false), c(2, 30, true)], now: NOW });
ok(late.message.includes(S.slice(0, 9)) && late.message.includes(T.slice(0, 9)), 'message/names the served commit and main\'s tip', late.message);
ok(late.message.includes('30h00m behind'), 'message/names the lag', late.message);
ok(late.message.includes('2'.repeat(9)), 'message/names the first commit that changes the site', late.message);

console.log('\nmarker');
ok(parseMarker(JSON.stringify({ commit: S })).commit === S, 'marker/full SHA is read');
ok(!!parseMarker(JSON.stringify({ commit: null })).error, 'marker/a local build (null) is refused');
ok(!!parseMarker(JSON.stringify({ commit: 'abcdef1' })).error, 'marker/short SHA is refused');
ok(!!parseMarker('<!doctype html>').error, 'marker/non-JSON is refused');
ok(!!parseMarker('{}').error, 'marker/no commit field is refused');

console.log('\ngit');
const here = dirname(fileURLToPath(import.meta.url));
const ignoreScript = resolve(here, '../../apps/studio/vercel-ignore.sh');
const repo = mkdtempSync(join(tmpdir(), 'p3-freshness-test-'));
const g = (...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: repo, encoding: 'utf8' }).trim();
const commitFile = (path: string, body: string, msg: string): string => {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), body);
  g('add', '-A'); g('commit', '-q', '-m', msg);
  return g('rev-parse', 'HEAD');
};
try {
  g('init', '-q', '-b', 'main');
  mkdirSync(join(repo, 'apps/studio'), { recursive: true });
  copyFileSync(ignoreScript, join(repo, 'apps/studio/vercel-ignore.sh'));
  const served = commitFile('apps/studio/index.html', '<p>one</p>\n', 'served');
  const docs = commitFile('docs/progress/pending/x.md', 'note\n', 'docs only');
  const app = commitFile('apps/studio/index.html', '<p>two</p>\n', 'app change');
  const after = commitFile('docs/progress/pending/y.md', 'note\n', 'docs after');
  const pending = pendingCommits(repo, served, after) as { sha: string; builds: boolean }[];
  ok(pending.map((p) => p.sha).join() === [docs, app, after].join(), 'git/every later commit, oldest first');
  ok(pending[0]?.builds === false, 'git/docs-only commit is skipped');
  ok(pending[1]?.builds === true, 'git/app commit builds');
  ok(pending[2]?.builds === true, 'git/a docs commit after an app commit still builds (diffed against the served commit)');
  ok(pendingCommits(repo, after, after).length === 0, 'git/none pending at the tip');
  ok(!g('worktree', 'list').includes('p3-deploy-freshness-'), 'git/the throwaway worktree is removed');
} finally {
  rmSync(repo, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} case(s) failed` : '\nall cases hold');
process.exit(failed ? 1 : 0);
