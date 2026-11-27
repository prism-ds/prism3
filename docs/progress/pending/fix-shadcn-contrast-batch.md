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

### After review (owner decisions 2026-11-24 on #4575)

- **Every focus-ring form (Ring scope → A).** The first version's selector named one form, `focus-visible:ring-ring/50`.
  The review found the Slider thumb, the Calendar and the Input OTP slot drawing at 50% through other forms. A scan of
  all 61 `new-york-v4` components found four more: `focus-within:` (Combobox, Attachment), the Input Group's
  `has-[[data-slot=input-group-control]:focus-visible]:` and Bubble's `[button,a]:focus-visible:`. `SHADCN_RING_FORMS`
  lists all eight, each the selector stock Tailwind 4.3.3 compiles for it, so the override applies exactly where stock
  fades the ring. It is still one rule, with a selector list.
- **The invalid exclusion reaches descendants.** The Combobox flags an invalid field on a field inside it
  (`has-aria-invalid:ring-destructive/20`), so `:not([aria-invalid="true"])` alone would have repainted that ring in
  `--ring`. The rule now excludes `:has([aria-invalid="true"])` too.
- **The gate.** `RING_PROBES` gives each form a probe in its focused or active state, with a premise that stock paints it
  at 50%, and rows on the four grounds (`ring/50 <form> on <ground>`). `INVALID_PROBES` holds both invalid cases to
  `destructive/20`, with and without the rule. `STOCK_UTILITIES` grew to every form, typed from Tailwind's output in its
  output order, which decides the invalid cases.
- **Note home (→ A).** The note moved under a `### The shadcn/ui theme` heading, and the registry item gains a `docs`
  line pointing there (`SHADCN_DOCS`, wording approved).
- **The ranges stayed.** The review asked for 3.61, 4.22–4.25 and 4.04, read from `KNOWN` over all five brands the gate
  measures. The note's ranges are the three hosted brands', and they matched: those three low ends come from the two
  regression fixtures that aren't hosted. On that finding the owner kept the hosted ranges (2026-11-24). The note now
  says "the three hosted brands' floors in that gate's `KNOWN`", and its ring range is corrected to 2.0–2.8:1 against
  the page (1.9 was a `muted` ground, not the page).
- **Trap.** A shadcn component's focus classes can change form between releases (`focus-visible:` to `focus-within:`, a
  `has-[…]` variant) with no rename. Re-scan the sources for `ring-ring/50` when the scaffold moves, not only the class
  name.
