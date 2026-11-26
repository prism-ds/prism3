## (2026-11-26) — prism3-build-ui renders the build and looks at it before the ledger (#4613)

**What changed.** One paragraph in `prism3-build-ui`, at the end of "The self-check", so it is the last step before the ledger. No engine behavior changes.
- **The step:** render the build and look at it in light and dark, at a phone width (about 390px) and at a desktop width. Fix what is visibly wrong (overlap, clipping, text off the screen, a border or icon lost in dark mode, a component that draws differently from its spec), then write the ledger.
- **When it can't render:** each view the agent didn't see goes under **Unsure** in the ledger, so a reviewer knows what was never looked at.

**Why.** The contrast self-check and the ledger read names and ratios on paper. A test run for #4617 found a switch-thumb class clash that only the screenshots caught, and the issue names the other misses a render shows: overlap, an unseen dark mode, a layout that breaks at phone width.

**Held by.** `lint-skills.ts` check 8 holds a new owner rule, `#4613 render it and look before the ledger`, to the self-check section: the render, light and dark, the phone and desktop widths, "then write the ledger" and **Unsure** in one paragraph. Dropping the paragraph, or moving it out of the section, fails by that id. What it cannot see: the order of whole sections, so a self-check section moved after the ledger would still pass.

**Wording.** Shipped prose, so the exact text is in the PR body for the owner's approval.
