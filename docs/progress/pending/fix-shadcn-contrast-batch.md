## (2026-11-24) — The shadcn focus ring at full strength; faded stock pairs measured and recorded (#4386, #4387, #4388, #4411)

Owner decision 2026-11-24 on #4386: **A for the ring, C for the rest.**

- **#4386, the ring.** Q2997.17 B's `@apply outline-ring` restores the focus *outline*, but Button, Input, Select,
  Checkbox, Switch and Badge focus with a *box-shadow* ring, `focus-visible:ring-ring/50`, which that rule never
  touches. The registry item's `css` now carries one non-stock rule, `--tw-ring-color: var(--ring) !important` on
  `.focus-visible\:ring-ring\/50:focus-visible:not([aria-invalid="true"])`, in `@layer base`. `!important` is what
  lets an earlier layer beat the stock class in `utilities`; the `:not` keeps the stock `aria-invalid:ring-destructive/20`
  ring on an invalid field. The selector names the stock class, not every `[data-slot]`, so a variant that sets its own
  ring color (the destructive Button's `ring-destructive/20`, which `tailwind-merge` keeps over `ring-ring/50`) is untouched.
  The plain `shadcn/<brand>.css` carries neither rule, as before.
- **How the ring is measured.** `lint-shadcn-contrast` does not type the ring's ink. It focuses a button carrying the
  stock classes in Chromium, under the stock utility (typed from stock Tailwind 4.3.3's own output) plus the emitted
  registry item's `css`, and reads the computed `--tw-ring-color`. A premise check fails the run if the stock class alone
  does not paint at 50%. Stock 1.91–2.81:1, with the rule 3.76–7.82:1, over five brands × two modes × four grounds.
- **#4387, #4388: recorded, not overridden.** New `FADED` rows measure `destructive/90 on card` (both modes) and
  `muted-foreground on input/30 over background` (dark; `shadcn-browser.ts`'s `over` gained an `under` layer for the
  composite fill). The 14 failures are in `KNOWN`, each citing the decision, with the measured ratio as its floor.
- **#4411** was already `KNOWN`. The studio README now gives the one class edit for each recorded failure, with the
  measured ratio before and after.
- **Trap.** The ring rule is tied to shadcn's class name. If a shadcn release renames `ring-ring/50`, the stock
  utility typed in the gate goes stale with it, and the gate keeps passing on the old name: re-type `STOCK_UTILITIES`
  from the new output when the shadcn scaffold moves. No `SHADCN_MAP_VERSION` raise (no shadcn name added or dropped),
  no `CONTRACT_VERSION` raise.
