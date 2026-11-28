#!/usr/bin/env node
/**
 * #4634 — IS PRODUCTION WITHIN A DAY OF MAIN? A monitor, not a merge gate.
 *
 *   SITE_URL=https://<site> node .github/scripts/deploy-freshness.mjs [main-ref]
 *
 * Run daily by `.github/workflows/deploy-freshness.yml`. Exits 0 when production is current enough, 1 (with a
 * `::error::` line naming both commits and the lag) when it is not, or when it cannot tell.
 *
 * WHY IT EXISTS. On 2026-11-20 the Vercel production deploy stopped without a word: the project was still linked to
 * the repository's old location after its transfer, so no push reached it, and nothing in the repo could notice. The
 * site served a week-old build until a 404 on a new file gave it away. CI runs inside the tree and cannot see
 * production (docs/34 shape 17), so this runs on a schedule, outside the merge gates, and reads production itself.
 *
 * THE SOURCE OF TRUTH IS WHAT PRODUCTION SERVES, never what the deployer reports. `build-site.mjs` writes
 * `/build.json` with the commit Vercel built (`VERCEL_GIT_COMMIT_SHA`), and this reads it back over HTTPS. A deploy
 * record would agree with itself while the site served something else (a rollback, a dashboard override, a stale
 * link), which is the failure this exists to catch. No secret and no Vercel token: the site is public, and the git
 * history comes from the workflow's own checkout.
 *
 * WHAT "BEHIND" MEANS. Production does not rebuild for every commit: `apps/studio/vercel-ignore.sh` skips a commit
 * that cannot change the site (a progress note, an engine gate), diffing against the last deployed commit. So a
 * served commit older than main's tip is normal, and lagging by docs-only commits is not lagging at all. For each
 * commit since the served one, oldest first, this runs THAT commit's own `vercel-ignore.sh` against the served
 * commit, exactly as Vercel would (`VERCEL_GIT_PREVIOUS_SHA`). The lag is the time since the first commit that would
 * have built landed on main; more than `MAX_LAG_HOURS` (24) fails. Each commit is checked out in a throwaway
 * worktree, never in the caller's tree.
 *
 * CANNOT TELL IS RED. No marker, a marker that is not a commit, a commit this history lacks or one that is not on
 * main: each fails by name. A monitor that goes green when it cannot see is the docs/34 shape 9 failure.
 *
 * The decision is `decide` (pure) and the marker read is `parseMarker`; both are tested, with the git half, by
 * `test-deploy-freshness.ts` beside this file.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_LAG_HOURS = 24;
export const MARKER_PATH = '/build.json';
const HOUR = 3_600_000;

const short = (sha) => sha.slice(0, 9);
const hours = (ms) => `${Math.floor(ms / HOUR)}h${String(Math.floor((ms % HOUR) / 60_000)).padStart(2, '0')}m`;

/** The served commit from `/build.json`'s text, or `{ error }`. Only a full 40-hex SHA counts: a short one could be
 *  ambiguous, and `null` (a local build) or anything else means production is not a build this can place. */
export const parseMarker = (text) => {
  let json;
  try { json = JSON.parse(text); } catch { return { error: `${MARKER_PATH} is not JSON` }; }
  const commit = json && typeof json === 'object' ? json.commit : undefined;
  if (typeof commit !== 'string' || !/^[0-9a-f]{40}$/.test(commit)) return { error: `${MARKER_PATH} names no full commit SHA (commit: ${JSON.stringify(commit)})` };
  return { commit };
};

/**
 * The verdict. `pending` is every commit after `served` up to `tip`, oldest first, each with when it landed on main
 * (`landedAt`, ms) and whether Vercel would have built it (`builds`). Returns `{ ok, message }`.
 */
export const decide = ({ served, tip, pending, now, maxLagHours = MAX_LAG_HOURS }) => {
  if (served === tip) return { ok: true, message: `Production serves ${short(served)}, main's tip.` };
  const due = pending.find((c) => c.builds);
  const behind = `Production serves ${short(served)}; main is at ${short(tip)}, ${pending.length} commit(s) ahead`;
  if (!due) return { ok: true, message: `${behind}, none of which changes the site (vercel-ignore.sh skips each).` };
  const lag = now - due.landedAt;
  const first = `the first that changes the site, ${short(due.sha)}, landed ${new Date(due.landedAt).toISOString()}`;
  if (lag <= maxLagHours * HOUR) return { ok: true, message: `${behind}; ${first}, ${hours(lag)} ago, within the ${maxLagHours}h allowance.` };
  return {
    ok: false,
    message: `Production is ${hours(lag)} behind main, more than ${maxLagHours}h. ${behind}; ${first}. ` +
      `Check the Vercel project's Git connection and its recent deployments.`,
  };
};

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

/** Every commit after `served` on `tip`'s first-parent line, oldest first, with whether Vercel would build it. Each
 *  commit's own `apps/studio/vercel-ignore.sh` runs in a throwaway detached worktree (exit 0 skip, 1 build). */
export const pendingCommits = (repo, served, tip) => {
  const log = git(repo, 'log', '--reverse', '--first-parent', '--format=%H %cI', `${served}..${tip}`);
  const commits = log ? log.split('\n').map((l) => { const [sha, at] = l.split(' '); return { sha, landedAt: Date.parse(at) }; }) : [];
  if (!commits.length) return [];
  const wt = mkdtempSync(join(tmpdir(), 'p3-deploy-freshness-'));
  git(repo, 'worktree', 'add', '--detach', '--quiet', wt, commits[0].sha);
  try {
    return commits.map((c) => {
      git(wt, 'checkout', '--detach', '--quiet', c.sha);
      const r = spawnSync('bash', ['apps/studio/vercel-ignore.sh'], { cwd: wt, env: { ...process.env, VERCEL_GIT_PREVIOUS_SHA: served } });
      if (r.status !== 0 && r.status !== 1) throw new Error(`vercel-ignore.sh at ${short(c.sha)} exited ${r.status}`);
      return { ...c, builds: r.status === 1 };
    });
  } finally {
    git(repo, 'worktree', 'remove', '--force', wt);
  }
};

const main = async () => {
  const site = process.env.SITE_URL;
  const ref = process.argv[2] ?? 'origin/main';
  const fail = (msg) => { console.log(`::error::${msg}`); process.exit(1); };
  if (!site) fail('SITE_URL is not set, so there is no production to read.');
  const url = new URL(MARKER_PATH, site).href;
  let res;
  try { res = await fetch(url, { headers: { 'cache-control': 'no-cache' } }); } catch (e) { fail(`Cannot tell which commit production serves: ${url} did not answer (${e.message}).`); }
  if (!res.ok) fail(`Cannot tell which commit production serves: ${url} answered ${res.status}.`);
  const marker = parseMarker(await res.text());
  if (marker.error) fail(`Cannot tell which commit production serves: ${marker.error}.`);
  const served = marker.commit;
  const repo = git(process.cwd(), 'rev-parse', '--show-toplevel');
  const tip = git(repo, 'rev-parse', `${ref}^{commit}`);
  if (spawnSync('git', ['cat-file', '-e', `${served}^{commit}`], { cwd: repo }).status !== 0) fail(`Production serves ${short(served)}, which this repository's history does not hold (main is at ${short(tip)}).`);
  if (spawnSync('git', ['merge-base', '--is-ancestor', served, tip], { cwd: repo }).status !== 0) fail(`Production serves ${short(served)}, which is not on main (main is at ${short(tip)}).`);
  const verdict = decide({ served, tip, pending: pendingCommits(repo, served, tip), now: Date.now() });
  if (!verdict.ok) fail(verdict.message);
  console.log(verdict.message);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
