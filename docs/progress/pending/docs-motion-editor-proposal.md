## (2026-11-26) — Studio motion editor: the proposal (#4571)

#4571 asks for a proposal before any build. It is `docs/superpowers/motion-editor-proposal.md`: what a designer can do
before and after, the model the editor edits, the previews, how edits flow to every output, a seven-PR build plan with
the gates each adds, two wireframes in words, and eight owner questions (Q-ME1 to Q-ME8).

### What the reading found

- **The engine already accepts almost everything the editor needs.** Since motion phases 1 and 2 (#4597, #4601),
  `motionPersonality` takes tempo, easing roles, brand curves, each preset's duration, easing and delay (and an
  arriving preset's exit half), and each pattern track's preset, distance, start scale and reduced kind, all refused
  by name and all carried by design.md (`lint-design-md-round-trip.ts`). Studio exposes only tempo and the easing
  roles, and `levers.ts` lists only tempo. So the editor is mostly a surface over existing levers, with no new token
  name and no `CONTRACT_VERSION` change unless the owner opens a new lever.
- **Three behaviors a designer won't guess**, which the editor has to show: a preset pointed straight at a curve stops
  following its role (and with it the per-mode role re-point); an exit half follows its entrance until it is set; and
  the delay steps are 300–500ms perception thresholds, not choreography offsets.
- **One output carries no motion:** the shadcn/ui and Tailwind themes (#2997). Raised as Q-ME8 rather than built.

Nothing is decided. Docs only: no engine, Studio or plugin change.
