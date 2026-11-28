# 47 — Brands as modes

**Status:** decided by the owner, not yet built. This is the design record for #4472: it holds the owner's
decisions, the model they set, the build plan, and the questions still open. The proposal the decisions answer
is #4472's comment of 2026-11-26 (7200650159); the decisions are the owner's comment of the same day
(7203991436). Read from `origin/main` at `a573ee8`.

---

## 1. What changes, in one paragraph

Today a file holds one brand. A second brand can only arrive by replacing the first (Apply Theme) or by
rebuilding it by hand in a custom mode copied from light or dark. After this work, a designer adds a second
brand from its design.md, and the file holds both: each brand's colors, typefaces, corners, shadows, density
and motion, in every appearance the file has on, every pair contrast-checked. In Figma a frame picks a brand
and an appearance, and every component on it follows without being rebound. A report names anything in the
design.md that the file can't hold per brand, and the value it kept instead.

This is the model `docs/11-multi-brand-vision.md` aimed at ("brand as a selectable axis alongside mode"), on
the foundation `docs/11` §1 describes: names are the contract, values are the fill. A brand is another column
of values over the same names.

**Numbering.** The owner's decision comment numbers the questions one higher than the proposal did, because it
puts the architecture choice first as Q1. This record uses the owner's numbering throughout.

## 2. The decisions

### 2.1 Decided (2026-11-25, #4472): brands as modes — a new mode can start from a design.md and take its colors, type, shape and motion

The issue first asked for a mode started from a design.md. The owner chose the wider option, B: one file can
hold several brands, and a new brand takes its colors, type, shape and motion from its design.md. The owner
accepted that this is bigger than the issue: type, shape and motion become per-brand where today they are one
per file, which reaches the token structure, the Figma variables, components, contrast checks and Studio. The
decision required a design proposal before any build; §2.2 to §2.10 are the owner's answers to it.

### 2.2 Decided (2026-11-26, #4472): a brand axis next to the appearance axis, with a new `brand` collection, and components not rebound

Owner Q1, A (the proposal's option B of its §3). The engine learns a **brand** axis beside the existing
appearance axis.

- **Type, shape and motion vary by brand.** **Color varies by brand × appearance**, because the engine picks
  each role's shade per brand by contrast, so color can't be split into a brand part and an appearance part.
- **Tokens:** the consumer handoff becomes `base` + a brand overlay (type, shape, motion) + a brand-and-appearance
  overlay (color). This is the cross-axis composition `packages/engine/emit-dtcg-overlay.ts`'s header already
  plans for; only the theme axis is built today. Token names don't change.
- **Figma:** `color` stays one collection whose modes are the brand-and-appearance pairs. The non-color families
  gain one new `brand` collection whose modes are the brands. The existing `radius`, `core` font, `motion` and
  other variables keep their names and alias into `brand`, so **components bind the same variables and are not
  rebound**. A designer sets two things on a frame: the brand, and the color mode.
- **Rejected:** a flat model where each pair is one custom mode (it copies each brand's type, shape and motion
  once per appearance, and they drift apart; consumer CSS can't set brand and theme separately), and separate
  collections per brand (a component binds one brand's collections, so switching brand would mean a rebind,
  which breaks one set of components for several brands, and `docs/46-never-detach.md`'s direction).

### 2.3 Decided (2026-11-26, #4472): each brand gets every appearance the file has on, high contrast included

Owner Q2, A. A second brand is not light only, and it does not pick its own appearances: it gets each
appearance the file has on, including the high-contrast ones. The full contrast check runs for every
brand-and-appearance pair.

### 2.4 Decided (2026-11-26, #4472): colors, type, corners, shadow, density and motion vary per brand; spacing and breakpoints stay shared

Owner Q3, A. The per-brand families are colors, type, corners (radius), shadow, density and motion. The spacing
scale and the breakpoints stay one per file, shared by every brand.

### 2.5 Decided (2026-11-26, #4472): component style choices stay one per file until each is brought to the owner

Owner Q4: decide later, setting by setting. Settings that change component variants rather than values
(control shape, field style and the like) stay **one per file, shared by every brand**. The build does not
choose a per-brand answer for any of them. Each one comes to the owner as its own question when the build
reaches it.

### 2.6 Decided (2026-11-26, #4472): a field a brand can't hold is imported anyway, the file's value is kept, and the report names it

Owner Q5, A. When a design.md carries a field the file can't hold per brand (the proposal's examples: type
scale, display ceiling, logo and marks), the import still goes ahead. The file keeps its own value for that
field, and the import report names each dropped field. The import is not refused, and per-brand support for
each such field is not a precondition for shipping.

### 2.7 Decided (2026-11-26, #4472): a collection named `brand` whose modes are brand names, and color modes named like "B · dark"

Owner Q6, A. Designers see a collection named `brand` in the variables panel, whose modes are the brands'
names. The color collection's modes name a brand and an appearance, like "B · dark". §4 holds what this leaves
open.

### 2.8 Decided (2026-11-26, #4472): Studio shows one brand at a time with a switcher

Owner Q7, for the MVP. Studio shows one brand at a time, with a switcher between them. The two-brand compare
view is a future state, logged in #4616.

### 2.9 Decided (2026-11-26, #4472): the file's original brand stays the default brand

Owner Q8, A. CSS `:root` and Figma's first mode carry the file's original brand. An added brand is never the
default.

### 2.10 Decided (2026-11-26, #4472): the contract version is settled by docs/30's policy when the build reaches it

The owner made the contract version a technical call, not a design one. When a phase changes what a consumer
can observe, `docs/30-versioning-and-compatibility.md` decides whether `CONTRACT_VERSION` moves. The proposal's
reading, for whoever reaches it: guaranteed token names don't change, the new brand ramps are brand-dependent,
and `data-brand` is an additive change to the shipped CSS. That is a reading, not a decision; the phase that
emits them applies the policy to what it actually emits.

## 3. The build plan

From the proposal's §5, with the owner's answers applied. Each phase is one or two PRs off `main` that merge
on their own; none is based on another unmerged PR. **With no second brand declared, every artifact stays
byte-identical**, and each engine phase proves it with `regen --check` and `nb-regression`.

1. **Design record.** This page and its rows in `docs/42-current-decisions.md`.
2. **design.md → mode.** A pure translator from a parsed design.md to today's per-mode fields (`brandColors`,
   `modePalettes`, `modeLevers`, `surfaces`), with a named list of dropped fields (§2.6). It delivers the issue's
   original ask on today's modes. Tested by a round trip, and by a test that every dropped field is named.
3. **Close the per-brand gaps.** Neutral and status palette swaps (today only `primary` and `brandColors` swap
   per mode) and high contrast per brand (§2.3). The other §2.4 families already vary per mode through
   `modeLevers`; this phase checks each one reaches every surface and fills any gap it finds.
4. **Engine brand axis.** `brands` in the input, resolution per brand × appearance, overlays per axis. A new
   composition gate: `base` + brand overlay + pair overlay must equal a direct full resolve, for every pair.
5. **Figma emission.** The `brand` collection with aliases, the color pairs, shadow style sets per brand ×
   appearance, and heading sizes per brand in `type-sets` (type varies per brand, §2.4).
6. **Plugin.** Add a brand from a design.md, a mode-capacity preflight that counts pairs, a "set brand on
   selection" helper, and the conversion of existing files (§4, question B).
7. **Studio.** The brand switcher (§2.8), Add a brand, and contrast per pair.
8. **Consumers and MCP.** `data-brand` CSS, shadcn and Tailwind per brand, `theme_brand` taking brands, contrast
   failures keyed by brand and appearance.
9. **Guides and skills.** `prism3-theme`, `prism3-build-ui`, and a public guide.

The proposal's §2 survey of what exists today (custom modes, `modePalettes`, `modeLevers`, the per-mode
non-color collections, the shadow style sets, the plugin's capacity preflight) is the starting point for
phases 3 to 6, and is not restated here: it describes code that moves, and a copy here would go stale.

## 4. Open questions, held for the owner

These are left open by the proposal and the owner's answers. None is decided here, and the phase that needs
each one stops and asks.

**A. The default brand's color mode names in a file with two brands.** §2.7 names an added brand's color modes
like "B · dark". It doesn't say whether the default brand's modes keep today's names (`light`, `dark`), or take
the same "A · dark" form. Keeping them means a single-brand file stays byte-identical and gaining a brand renames
nothing. Renaming them means every file that gains a brand gains new modes, under `docs/44` §9.1.
- A (recommended): the default brand's modes keep today's names; only added brands' modes carry a brand name.
- B: every color mode carries its brand's name, the default brand's included, once the file has two brands.

**B. Converting a custom mode already used as a brand.** The proposal's §4 had the plugin rename such a mode in
place. That conflicts with `docs/44` §9.1 (Q172 A): Prism3 never renames a mode in a built file, custom modes
included. The owner's answers didn't address migration.
- A (recommended): follow §9.1. Conversion adds the brand's new modes beside the old custom mode, which keeps its
  values and its frames until the designer moves them and Clean up removes it. The plugin names every move.
- B: make this conversion a named exception to §9.1, and rename in place.

---

*Cross-refs: `11` (the multi-brand north star this realizes), `30` (§2.10's policy), `44` §9.1 (no mode
renames, question B), `46` (never detach, why components are not rebound), #4616 (the compare view).*
