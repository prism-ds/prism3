## (2026-11-25) — The MCP serves components: list_components and get_component (#4467)

**What changed.** Two read-only MCP tools, as decided (owner decision A, 2026-11-25), so an agent asks for one component instead of reading the contract export (about 1.5 MB brand-neutral, 3.7 MB for a brand).
- **`list_components`:** every registered def's `id`, `name`, `summary` and `status`, in registry order. 12,585 characters for 74 components.
- **`get_component { id, brand? }`:** one def's contract, condensed:
  - its props (type, allowed values, default, required), variants and states;
  - each part, with the tokens it may bind on any member, grouped by the property it binds;
  - `whenToUse`, `avoidWhen`, the partners (`commonPartners`, `composesWith`, `alternativeTo`), and its motion prose and `motion.*` bindings;
  - with `brand`, the token names that brand's settings bind (a pill brand's Button binds `radius.capsule`, not `radius.md`), plus `values`: a color as a hex in every mode (`resolveAllModes`), anything else at the end of its alias chain (`deref`). Without `brand`, it's brand-neutral.
  - The largest result is 17,179 characters (`button-destructive` with a brand), under the stated ceiling of 25,000.
- **Generated, not written:** `mcp-components.ts` reads `componentDefs` and the entry `exportComponentDefs` builds, the function `regen` and `export_theme` already write the export with, so a field a def gains reaches both.
- **Refusals:** an unknown `id` is refused by name before any brand is built, with the nearest ids. A `brand` that isn't a BrandInput object, or that the schema fails, is refused as the other brand-taking tools refuse it (#4120).
- **Motion patterns (#4601, merged while this lane ran):** `get_component` returns each pattern the def names (`motionOf`), with its tracks and the preset each plays on. With `brand`, they're the patterns the brand resolved (`theme.motion.patterns`, its track overrides applied). Dialog returns six, at 11,025 characters.
- **Also moved:**
  - `prism3-build-ui`'s MCP section tells an agent to list, then get, before it composes, held by a new `lint-skills` owner rule;
  - `llms.txt` gives an example call for each tool;
  - `commands.json` lists both;
  - the three literal tool lists (`lint-us-english`, `lint-voice`, `test.ts`) name the two new tools, and `test.ts`'s two protocol-version arms count eight tools;
  - the ecosystem map has a new agent-only feature, "Read one component's contract", its tools on the MCP connection, and `lint-ecosystem`'s `TOOL_MODULE` names `mcp-components.ts` as what both run.
- **`tools/list`:** 48,530 characters, under its 55,000 gate.

**Held by.** `mcp-test.ts`, over real stdio:
- both tools, against the committed component catalog as the oracle (not `componentDefs`, which the list reads);
- brand vs neutral (`radius.md` → `radius.capsule`, 999px, and the fill as a hex in every mode);
- an unknown id, and an unknown brand (a string, and a BrandInput the schema fails);
- the list's stated size within 15%, and every component, neutral and for a brand, at or under the ceiling its description states.

Dropping a def from the list fails by its id.

**After review.** The review (CHANGES at `4d3ac099`) found `mcp-test` checked a brand's colors only by format: every color resolved to the page background, or an alias left as its `{…}` reference, passed.
- **The oracle now:** `mcp-test` holds every value `get_component` gives, for every component with a brand, to the brand's own token tree from `theme_brand include:["tokens"]`, walked by the test's own alias resolution: each color in every mode, and every other token in the first mode. It also types three values: the pinned primary `#0065b4`, `size.md.height` → `44px`, and `space.200` → `16px`.
- **The defect it found:** a translucent color lost its alpha. `color.interactive.primary.overlay.hover` came back `#000000` where the tokens say `#0000001a`; `field.fill` and the subtle fills likewise. `resolveAllModes` gives a role's opaque `hex`. The value now keeps the alpha as the tree writes it: a translucent palette leaf as it is, and an alpha a role applies, quantized by `emittedAlpha`.
- **Measured:** 651 colors in 4 modes and 714 other values across the 74 components match.
