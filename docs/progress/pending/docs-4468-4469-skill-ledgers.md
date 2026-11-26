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

**After review.** The review (CHANGES at `b4734fb0`) and the owner's decision (Composed is built only from Prism3's own parts, never a stand-in) found the worked ledger teaching the opposite of its rule. Its **Composed** entry was a card, which Prism3 only plans, and its link was hand-styled.
- **The example now:** the brief still asks for a card. The report names it as not built ("Prism3 has no card component yet (it is planned)"). **Composed** is the sign-in form itself, a column of Prism3 components with spacing between them, and **Used** lists `link`.
- **Held:**
  - a new `lint-skills` check holds every component id on the worked ledger's **Used** line to the registry; the review's `password-field` → `password-input` mutation had passed;
  - a new owner rule holds the not-built card;
  - the worked-ledger rule now requires `link` under **Used**.

**After the delta review.** The delta review (CHANGES at `575197e4`) found the card could sit under **Composed** again, as long as the "Not built" sentence stayed: nothing read the Composed entry.
- **Check 8b now reads it too:** each of its code spans is a registered component or a token path; it names at least one registered component; and no component that exists only in a `planned` list (`card`, `form`, `split-button` …) appears in it, in code or prose.
- **The wording:** the example's Composed entry is now "the sign-in layout", naming its parts as `text-field`, `password-field`, `button` and `link`. A planned `form` component would carry behavior a plain column doesn't.
- **The M5 nit:** an owner rule can now name the section it must sit in, and the four #4469 rules are held to sections 1, 7, 7 and 9.
