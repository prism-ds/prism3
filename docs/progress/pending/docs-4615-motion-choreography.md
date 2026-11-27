## (2026-11-26) — prism3-motion gets a choreography section and a plain-words-to-preset table (#4615)

**What changed.** Two new sections in `prism3-motion`, both phrased only in Prism3 presets, patterns and tokens. No engine behavior changes.
- **From plain words to a preset** (after the patterns, before the rules): a reverse lookup from a loose description ("the bouncy thing when a popover opens") to the preset or pattern that does it, fifteen rows. The `pop` row says it doesn't overshoot, and points real bounce at `motion.spring.bouncy`, which R4 keeps for releases a person drives. A number someone asks for is answered with the preset, not the number (R1).
- **Choreography** (after the rules, before the recipes), six points: **C1** cut moving parts first; **C2** run the rest in parallel; **C3** sequence only for reading order, cause and effect, or arrival, each element `motion.stagger` after the last without waiting for it to finish; **C4** a stagger has a cap, the last staggered sibling starting no later than one `motion.preset.fade.duration` after the first; **C5** exits bind their `.exit` halves and start at once, never waiting on children; **C6** what the person is working with stays still. Under reduced motion there is no stagger or sequence (R12).

**Decisions in the wording, flagged for the owner.**
- **The cap (C4)** is new: the issue asks for one and names no measure. It is set in tokens, so it moves with the brand's tempo, and it gives R11's "the first few" a measure. In the house brand, at its tempo, `motion.stagger` is 40ms and `motion.preset.fade.duration` is 200ms, so the first six siblings stagger and the rest arrive with the sixth.
- **`motion.delay.*` isn't the ordering token.** The issue says to phrase choreography in presets and `motion.delay.*`. The emitted `motion.delay.*` tokens are the tooltip and busy-indicator waits (`show`, `min-show`, `hide`, `skip`), so the section orders with `motion.stagger` and says `motion.delay.*` isn't for ordering.
- **A list doesn't stagger out (C5)** extends R3 to lists.

**Sources.** Ideas, not text, from the public motion guidance that circulates for agents. Their advice is in literal values; every point here binds to a token, and `lint-motion-literals` stays clean.

**Held by.** `lint-skills.ts` check 8 holds six new owner rules, one per choreography point and one for the table, each held to its section, each failing by its own id when its paragraph or row is dropped. The rules that name tokens also resolve them in the token tree. `lint-motion-literals` reads the new text too: no literal, and every `motion.*` name resolves in all five brands.

**Wording.** Shipped prose, so the exact text is in the PR body for the owner's approval.
