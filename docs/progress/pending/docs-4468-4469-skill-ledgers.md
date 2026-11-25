## (2026-11-25) — The skills ask for a ledger and name hand-built layers GAP (#4468, #4469)

**What changed.** Two decided rules, written into the shipped skills. No engine behavior changes.
- **#4468 (owner decision A), `prism3-build-ui`.** A new section, "End every build with a ledger", closes the report with four headings: **Used** (components and token roles), **Composed** (built from Prism3 parts because no single component is that piece), **Invented** (with the reason) and **Unsure**. A worked ledger for a sign-in card follows, and an empty heading reads **none** so a short ledger doesn't look cut off.
- **#4469 part 1 (owner decision A), `prism3-rebind`:**
  - **Section 1:** a layer built by hand because no component fits gets the prefix `GAP / ` ("GAP / Promo tile").
  - **Section 7:** the rogue-binding audit counts those layers by name, apart from rogue items. Figma's Outline view (View › Outline, Cmd/Ctrl+Y, also called wireframe view) is the owner's check by eye: library instances draw in purple.
  - **Section 9:** the end-of-job note lists the instances placed, the GAP layers and the components worth suggesting.
- **Not here:** #4469 part 2, the generated manifest, is its own plugin build.

**The reading of "Composed".** The skill already says that where no component fits, a stand-in is left out and named, never built. So **Composed** covers what that section allows: a layout or surface built from Prism3 components and roles, such as a card from surface roles. It does not cover a stand-in for a missing component. The PR flags this reading for the owner.

**Held by.** `lint-skills.ts` check 8 (owner rules) holds six new rules, one per placement, each by its own id. Removing any one fails by that id: the ledger sentence, the worked ledger's headings, the GAP naming, the audit count, the Outline check and the end-of-job note.

**Wording choice.** The decision says "wireframe view". Figma's own menu calls Cmd/Ctrl+Y **Outline**, so the skill uses that name, so an agent can find it, and gives "wireframe view" beside it.
