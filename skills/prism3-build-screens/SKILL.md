---
name: prism3-build-screens
description: >-
  Build working screens from a brief with Prism3, in code and on the Figma
  canvas: pick the stack, set up the brand's theme, compose from Prism3's own
  components, render and check every view, and close with a ledger whose
  Stand-ins list is the hardening backlog. A workflow that leans on
  prism3-build-ui for every token rule, prism3-motion for movement and
  prism3-rebind for Figma file mechanics.
when_to_use: >-
  When asked to build a screen, a page or a flow for a Prism3 brand, from a
  prototype toward production, in web code (React with shadcn/ui and Tailwind
  by default) or as instances on the Figma canvas. Not for authoring a brand
  (prism3-theme), not for moving an existing Figma file onto Prism3
  (prism3-rebind), and not for authoring a new component definition
  (prism3-build-component).
---

# prism3-build-screens — from a brief to working screens, in code and in Figma

You have a brief for one or more screens and a Prism3 brand to build them in. This skill is the
order of work: six steps from the brief to a hand-off. It holds no token rules of its own. Every
rule about which token to bind, which surface an ink sits on and how to check contrast is in
`prism3-build-ui`, the rulebook; read it first, and apply it at every step here. How things move
is in `prism3-motion`. How to work in a Figma file through the plugin is in `prism3-rebind`.

**One workflow, two targets.** The same six steps build web code and the Figma canvas. Where a step
differs by target, it says so. Figma Make is a later phase, taken up once the code Stand-ins list
is short; this skill doesn't cover it yet.

## 1. Start

1. **Name the brand and get its brief.** Get the brand's `design.md` brief or its BrandInput. The
   scoring tools need it: `score_consumption` takes the brand to resolve names and score pairs. If
   neither exists, say at the start that the build can't be scored, and say it again in the
   hand-off.
2. **Pick the stack.** Use the stack the brief names. When it names none, use React with shadcn/ui
   and Tailwind, themed with the brand's exported shadcn/ui theme (step 2).
3. **List, then get.** List the components, then get each one you expect to place, as
   `prism3-build-ui` says under "If you have the MCP surface". Without the MCP, read the component
   catalog and each component's page.
4. **Read the brief against each component's `avoidWhen` before you build.** Raise each conflict
   as an owner question, and build only once it is answered. For example, a brief that asks for
   settings switches and a Save button conflicts with `switch-row`: its `avoidWhen` says a change
   committed by a Save button takes a checkbox row. A conflict found after the build costs a
   rebuild. One conflict is already decided: until #4604 lands, the rule in step 3 that the
   routine action is neutral beside a destructive one wins over the `avoidWhen` of `button` and
   `button-neutral`, so don't raise it.

## 2. Set up the theme

**Code.** Five steps, in this order:

1. **Install the brand's registry item, not the plain CSS.** `npx shadcn add` with the registry
   URL or the exported registry item: `<brand>.shadcn.registry-item.json` from Studio, or
   `shadcn/<brand>.registry-item.json` from the CLI or the MCP. The item carries the focus-ring
   rules that the plain CSS (`<brand>.shadcn.css` from Studio, `shadcn/<brand>.css` from the CLI or
   the MCP) leaves out. The install steps are in `apps/studio/README.md`, under "The shadcn/ui
   theme".
2. **Make the three stock class edits** listed in the same section. Without them, three stock
   classes draw text under 4.5:1. One stays under it after its edit: the Alert `destructive`
   description, at 4.25:1 in dark. It is a known exception, listed in that table, so the check in
   step 4 doesn't treat it as new.
3. **Add the token CSS for the same brand.** The shadcn/ui variables cover only shadcn's own names.
   A component spec binds `space.*`, `size.*`, `radius.*` and the other Prism3 roles, so the page
   needs those as CSS custom properties too. For the house brand, install `@prism3/tokens`
   (`packages/tokens/README.md`). For any other brand, build them from the brand's base and
   overlay files with a stock Style Dictionary, as `prism3-build-ui` rule 3 says, and emit each
   mode as a `[data-theme="<mode>"]` block, as `packages/tokens` does, so the mode switch below
   reaches it.
4. **Use one mode switch for both themes.** shadcn/ui reads dark mode from a `dark` class on the
   root element; Prism3's token CSS reads it from `data-theme`. Set both from the same switch, in
   the same place, so the two can never disagree:

   ```js
   function setMode(mode) {               // "light" or "dark"
     const root = document.documentElement;
     root.classList.toggle("dark", mode === "dark");
     root.dataset.theme = mode;
   }
   ```

   Pick the first mode from `prefers-color-scheme` before the page paints, so it never flashes the
   wrong mode.
5. **Load the brand font.** The theme names the font family but does not load it. Load the face
   the brief names, and confirm in the render (step 4) that it is the face on screen, not the
   fallback.

**Figma.** Prism3's variables, text styles and components are either in the file, materialized by
the plugin, or published as a team library the file enables. Check which before the first write
(`prism3-rebind`, sections 2 and 8). Bind each frame's variable mode, so switching light and dark
switches the whole frame.

## 3. Compose

**Prefer Prism3's own component on each surface.** Where Prism3 has the component on the target
you are building, place it. Where it doesn't, use the stack's equivalent, restyled to the Prism3
spec, and record it as a stand-in under **Stand-ins** in the ledger, naming the Prism3 component
it stands in for. Never use a stack component where Prism3's own exists on that surface.

- **Figma:** Prism3's components are in the file or its library. Place each one as an instance,
  attached; never detach one, and never restyle its layers to match a mockup (`prism3-rebind`,
  section 1). A piece no component covers is a frame you build by hand and name `GAP / `, then
  what it stands for, as that section says. That includes a component Prism3 only plans: a card
  is a hand-built frame named "GAP / Card", counted in the ledger. Build the phone-width frame
  from the same components as the desktop frame.
- **Code:** Prism3's components don't ship as code yet; coded components are planned (#3408). So
  in code, each Prism3 component you place is the stack's equivalent, restyled to that
  component's spec, and each one is a stand-in. As each Prism3 code component ships, its stand-ins
  are swapped for it.

**Build each stand-in from its spec, not from the stock component.** For each one:

1. Get the component's spec resolved for your brand: `get_component` with the brand, or the
   brand's component contracts (`prism3-build-ui`, "Say what you can't build").
2. Bind the stack primitive's height, padding, gap, radius, colors and type to the tokens the spec
   names. Stock sizes are not Prism3's: measure each stock primitive against its spec, because a
   stock button or switch drawn smaller than the spec passes every name check and still fails the
   44px target floor (`size.md.min-height`).
3. Remove the stock motion and use the recipe in `prism3-motion`.
4. Note in the ledger what still differs from the spec, such as a switch thumb with no glyph.

**In code, a piece Prism3 has no component for is still left out.** A stand-in always names the Prism3
component it stands in for. A name that appears only in a `planned` list, or nowhere in the
catalog, has no spec to restyle to, so it gets no stand-in: leave it out and name it, as
`prism3-build-ui` says under "Say what you can't build". On the Figma canvas it is a `GAP / `
frame instead, as above.

**Next to a destructive action, the routine action uses the neutral button.** On a screen that
also has a destructive action (Delete account beside Save), the routine action is `button-neutral`,
not the primary `button`, and the destructive one is `button-destructive`. This holds for every
brand, not only one whose primary is close to its destructive color, so the routine action never
looks like the destructive one.

**Lay out the page shell with the layout tokens.** The content width is a `container.*` role and
each layout change happens at a `breakpoint.*` step. Don't type a pixel width for either.

## 4. Render and check

**Render every screen and check it before the ledger.** This is the rendered check and the
companion pass in `prism3-build-ui` ("The self-check"), at fixed sizes and with three more passes:

- **Every view.** Screenshot each screen at 1280px and 390px wide, in light and dark, with each
  dialog, menu or popover both open and closed. At each width, check for horizontal overflow: the
  page must not scroll sideways.
- **Contrast on resolved colors.** Measure each ink against the real surface under it, per mode,
  from the rendered colors, not from the token names. A stand-in's stock class can paint a color
  no token names, and only the render shows it.
- **The keyboard path.** Tab through each screen: the order follows the reading order, every
  control shows its focus ring, Escape closes each dialog, and focus returns to the control that
  opened it.
- **Reduced motion.** Turn on `prefers-reduced-motion` and repeat the moving parts: each movement
  becomes a fade, as `prism3-motion` says under "Before you finish".
- **Hover.** Hover each interactive element and check that its hover state is the spec's.

Fix what is wrong, then render again. In Figma, check the light and dark modes on each frame, and
run the consistency audit (`prism3-rebind`, section 10) on a set of screens. Each view you could
not render goes under **Unsure** in the ledger.

## 5. Ledger

**End with the ledger from `prism3-build-ui`, plus a fifth heading: Stand-ins.** The four headings
**Used**, **Composed**, **Invented** and **Unsure** mean what that skill says. **Stand-ins** lists
each stack component you placed in place of a Prism3 one: the stack component, the Prism3 `id` it
stands in for, and what is still off spec. Write **none** when there are none.

The Stand-ins list is the hardening backlog. Each entry is a Prism3 code component someone needs,
and the gap between the stock component and the spec is the work.

> **Stand-ins:** shadcn `Button` for `button-neutral` (restyled to the spec's height and padding;
> matches). shadcn `Switch` for `switch-control` (restyled to the spec's track and thumb; no thumb
> glyph yet). shadcn `Dialog` for `dialog` (stock motion removed; matches).

## 6. Hand off

Hand back, in this order:

1. **The screenshots**, one per view rendered in step 4, named by screen, width and mode.
2. **What you didn't build**, each with the reason, as `prism3-build-ui` says.
3. **The owner questions still open**, including each `avoidWhen` conflict from step 1.
4. **The ledger**, with Stand-ins.

In Figma, add the end-of-job note from `prism3-rebind`, section 9: the instances you placed, the
`GAP / ` layers you built by hand, and the components worth suggesting.
