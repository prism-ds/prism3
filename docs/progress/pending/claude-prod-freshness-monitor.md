## (2026-11-28) — A daily check fails when production falls more than a day behind main (#4634)

On 2026-11-20 the Vercel production deploy stopped without a word. The project was still linked to the repository's
old location after its transfer to the org, so no push reached it. The site served a week-old build until a 404 on a
newly added registry item gave it away. The owner re-linked the project on 2026-11-27 and asked for a small daily check
that warns when production falls more than a day behind main, and no deploy-hook workflow.

### The change

- **`apps/studio/build-site.mjs` writes `/build.json`**, `{"commit": <VERCEL_GIT_COMMIT_SHA>}`, or `null` on a local
  build. It is on the publishable manifest, so the build fails if it goes missing.
- **`.github/scripts/deploy-freshness.mjs`** reads that marker from production, then judges every later commit on
  main with that commit's own `apps/studio/vercel-ignore.sh`, against the served commit, as Vercel does. The lag is the
  time since the first commit Vercel would have built landed on main. Over 24 hours fails, naming the served commit,
  main's tip, that first commit and the lag. A missing marker, a short or `null` commit, a commit outside this history
  or off main each fail too: a monitor that is green when it cannot see is docs/34 shape 9.
- **`.github/workflows/deploy-freshness.yml`** runs it daily at 07:23 UTC and by hand. No secret: the site is public
  and the history comes from the checkout.
- **`.github/scripts/test-deploy-freshness.ts`** runs in CI (engine job, `verify.ts`, and the three gate lists). It
  holds the decision by literal cases and the git half in a throwaway repository that carries the real
  `vercel-ignore.sh`.

### Why these choices

- **What production serves, not what a deploy record says.** GitHub's deployment records come from the same Vercel
  link that broke. A record can also disagree with the site after a rollback or a dashboard override. Reading the
  site is the independent oracle.
- **Only commits Vercel would build start the clock.** `vercel-ignore.sh` skips commits that cannot change the site,
  such as a progress note, so a served commit older than main's tip is normal. Comparing with the tip alone would go
  red after a day of docs-only merges.
- **A monitor, not a merge gate.** Nothing that merges reads its result. Its test is a CI step because the decision
  logic is code that a PR can break.

### Trap for whoever re-verifies

Production serves no `/build.json` until the first deploy after this merges, and until then the check fails with
"answered 404". That is the marker missing, not production lagging. Run it by hand once the deploy lands:
`SITE_URL=https://prism3-ds.vercel.app node .github/scripts/deploy-freshness.mjs`.
