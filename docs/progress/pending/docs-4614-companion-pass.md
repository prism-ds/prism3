## (2026-11-26) — prism3-build-ui recommends a general web-interface companion pass (#4614)

**What changed.** One sentence in `prism3-build-ui`, in "The self-check", after the contrast check. No engine behavior changes.
- **The pass:** after the token check, review the build against a brand-neutral web-interface rule set, such as Vercel's Web Interface Guidelines (public, MIT-licensed), for what the skill doesn't cover: focus, keyboard, forms, reduced motion and performance.
- **Linked, not copied.** Copying its rules in would mean maintaining a fork, so the skill names the source and nothing else.
- **Who wins:** Prism3's tokens on every value (a color, a size, a radius, a duration); the companion on general web behavior. Its brand-specific copywriting rules don't apply, because Prism3's shipped voice is `docs/voice-standard.md`.

**A finding for the owner.** The issue says the rule set ships as an agent skill pinned to an upstream commit with a SHA-256 hash. The guidelines repo's README, read on 2026-11-26, gives the install as an unpinned `npx skills add` with no commit or hash. The sentence links the repo only, so it doesn't depend on either.

**Held by.** `lint-skills.ts` check 8 holds a new owner rule, `#4614 a companion pass for general web quality`, to the self-check section: "companion pass", the link, and both halves of the tie-break in one paragraph. Dropping the link or either half fails by that id. What it cannot see: whether the linked page still says what the sentence claims.

**Lands after #4613.** Both edit the same section of the same skill. This branch is off `main`, not stacked; it is refreshed onto `main` once #4613 merges.

**Wording.** Shipped prose, so the exact text is in the PR body for the owner's approval.
