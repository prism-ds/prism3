# Theme a brand

<!-- DRAFT for owner review (#2637, lane 4; corrected to the rail's areas and Update file for #3264). -->

Studio is the same app on the web and inside the Figma plugin: the plugin's panel loads the web Studio whole and adds its Figma controls. <!-- src: apps/plugin/src/ui/entry.ts@"import './component-catalog".."mountAgentLink();"#6258203d --> <!-- src: apps/plugin/build.mjs@"const WEB_UI = resolve"#184e229f -->
Everything in this guide works in both places. Writing the brand to a Figma file is covered in [Write the theme to a Figma file](apply-a-theme.md).

## Start a brand

The first time Studio opens, a start window offers three ways in. <!-- src: apps/studio/src/shell/start.ts@"const c1 = card('Start".."const c4 = card('Import"#387884c8 -->

| Card | What it does |
|---|---|
| **Start from your color** | Takes your primary brand color and fills every other setting with a default you can change. **Start blank** begins from a neutral gray instead. <!-- src: apps/studio/src/shell/start.ts@"const c1 = card('Start".."const blank = button" --> |
| **Explore an example** | Opens one of the example brands, fully built. A few words under each example say what it is, such as "Muted teal, calm, square." <!-- src: apps/studio/src/shell/start.ts@"const c2 = card('Explore" --> <!-- src: packages/engine/example-registry.ts@"export const EXAMPLES".."] as const satisfies" --> |
| **Import a design.md** | Loads a whole brand from a `design.md` brief. Paste it into the box and choose **Import**, or choose **Upload…** to pick a file. <!-- src: apps/studio/src/shell/start.ts@"// alternative, and ".."const file = hook(h(" --> |

To come back to these later, open the brand menu at the left of the top bar and choose **New brand**. The same menu lists the examples, each with its few words, and has **Import design.md…**. <!-- src: apps/studio/src/shell/bar.ts@"menu.append(h('div', 'p3-menu-cap".."nb.onclick = () => act" -->
After you load an example or import a brief over a brand you had edited, **Undo load** appears beside the brand switcher and puts that brand back, edits included. It stays until your next edit or load. <!-- src: apps/studio/src/shell/bar.ts@"// #1037: Undo load,".."undo.textContent = '" -->

If opening another brand would replace edits that aren't saved anywhere else, Studio asks first. Before you choose **Replace brand** or **Cancel**, you can keep a copy with **Download design.md** or **Download tokens**; a download leaves the question open. <!-- src: apps/studio/src/state/leave-guard.ts@"export const SAVE_FIRST".."} as const;" --> <!-- src: apps/studio/src/shell/bar.ts@"/** The overwrite confirm".."can.type = 'button';" --> On the web, the browser also asks before you leave the page while the brand has unsaved edits. <!-- src: apps/studio/src/main.ts@"/** #3982 (Q-WS1 A):".."subscribe('origin', "#b587cb67 -->

*[Screenshot placeholder: the start window with its three cards.]*

## Set the levers

A lever is one brand setting, such as the primary color, the type scale or the corner radius. The **Theme** area of the rail groups them into tabs. <!-- src: apps/studio/src/shell/pages.ts@"{ id: 'theme', label" -->

| Tab | What it holds |
|---|---|
| **Brand** | The brand's name and namespace (**Identity**), **Personality** and **Modes**. <!-- src: apps/studio/src/shell/pages.ts@"id: 'brand', label: ".."{ title: 'Modes', rows" --> |
| **Color** › **Palettes** | **Primary**, **Brand colors**, **Neutrals** and **Status colors**: the ramps every color role draws from. <!-- src: apps/studio/src/shell/pages.ts@"id: 'palettes', label".."title: 'Status colors" --> |
| **Color** › **Surfaces & fills** | Background and foreground fills, scrim, glass, text, borders, icons, fields and gradients. <!-- src: apps/studio/src/shell/pages.ts@"id: 'fills', label: " --> |
| **Color** › **Interactive** | How actions, links and disabled states draw from the palettes. <!-- src: apps/studio/src/shell/pages.ts@"id: 'interactive', label" --> |
| **Type** | A typeface library, a font family for each text type, and the scale. <!-- src: apps/studio/src/shell/pages.ts@"id: 'type', label: '".."// with it on, inside" --> |
| **Shape** | **Density**, **Radius** and the base radius. <!-- src: apps/studio/src/shell/pages.ts@"id: 'shape', label: ".."{ title: 'Base radius" --> |
| **Depth** | **Elevation** and the shadow tint. <!-- src: apps/studio/src/shell/pages.ts@"id: 'depth', label: ".."{ title: 'Shadow tint" --> |
| **Motion** | **Motion** (the tempo and the easing for each role) and **Presets**. <!-- src: apps/studio/src/shell/pages.ts@"id: 'motion', label: ".."{ title: 'Presets" --> |
| **Layout** | **Grid**, **Breakpoints** and **Containers**. <!-- src: apps/studio/src/shell/pages.ts@"id: 'layout', label:".."{ title: 'Containers" --> |

Component settings, such as how buttons place their icons, are in the **Components** area, beside the list of component sets. See [Build components](build-components.md). <!-- src: apps/studio/src/shell/pages.ts@"id: 'components', label: 'Components', home".."{ title: 'Component " -->

Some sections start folded. Open them with the "Show N advanced settings" button under the section list. <!-- src: apps/studio/src/ui/lever-kit.ts@"export const advancedLabel" -->

**Personality** words fill the settings you have not set yet. Settings you set win. <!-- src: apps/studio/src/shell/pages.ts@"{ title: 'Personality" -->
Picking a word turns its opposite off: soft and sharp, dense and generous, calm and energetic, bold and restrained. Where two words fill the same setting, the first one picked wins. <!-- src: packages/engine/vocabulary.ts@"export const TRAIT_OPPOSITES".."];"#26cbcd4d --> <!-- src: apps/studio/src/state/brand-input.ts@"export const oppositeOf".."else delete authored().personality;\n};"#5e35eb13 -->
On **Palettes**, your colors are pinned as anchors on their ramps and never shifted. <!-- src: apps/studio/src/shell/pages.ts@"id: 'palettes', label" -->

## Read the preview

Each tab shows its levers on one side and a preview on the other. <!-- src: apps/studio/src/shell/frame.ts@"* WHAT EACH PAGE SHOWS".."* below), each mounted"#7ed29f7d -->

- The row of mode names in the preview header (Light, Dark, …) switches the preview between the brand's modes. <!-- src: apps/studio/src/shell/preview.ts@"select.setAttribute("#d4f6626b -->
- The **Palettes** tab always shows Light, and the mode control is off while it is open: "Palettes always show Light. Ramps are the same in every mode." <!-- src: apps/studio/src/preview/palettes.ts@"export const PALETTES_LIGHT_NOTE " -->
- A derived mode, such as a high-contrast one, is shown but not edited. Studio says "is auto-derived and can't be edited here. Switch the preview to Light or Dark to edit." <!-- src: apps/studio/src/shell/frame.ts@"export const DERIVED_READONLY_NOTE" -->
- **Inspect** opens two views over any tab: **Contrast**, each pair against its floor, and **Tokens**. <!-- src: apps/studio/src/shell/pages.ts@"export const INSPECT" --> <!-- src: apps/studio/src/shell/preview.ts@"btn.append(glyph('layers" -->

A contrast miss is reported, never blocked. On **Foreground fills**, for example, a pick below its floor is marked, not refused. <!-- src: apps/studio/src/shell/pages.ts@"{ title: 'Foreground " -->

## Where your work is kept

- On the web, Studio keeps your working brand in this browser and reopens it next time. <!-- src: apps/studio/src/persist-local.ts@"/** Storage key for the working".."return null; // corrupt / version-drifted local cache — same as first-run, no file to warn about\n  }\n};"#8ee27da6 -->
- After a reload, Studio still knows you have edits: choosing another brand asks before it replaces them. <!-- src: apps/studio/src/persist-local.ts@"export const restoreSession".."}\n};"#8ee40881 -->
- In the Figma plugin, the brand is kept in the Figma file each time Update file writes the theme, and the plugin restores it when the file opens again. <!-- src: apps/plugin/src/apply-theme.ts@"// Persist the exact".."persistInput(host.root"#ede61fb0 --> <!-- src: apps/plugin/src/main.ts@"const restoreToUi = ".."if (input) postToUi("#e56247fc -->

If a stored brand can't be opened, the web Studio offers it as a `design.md` download instead of discarding it. <!-- src: apps/studio/src/entry.ts@"// Web only (`refusedBrand".."setTimeout(() => URL"#6cbbdc42 -->

## Import and export a design.md brief

A `design.md` is a brand written as a short document: settings at the top, prose below. <!-- src: packages/engine/mcp.ts@"description: 'Generate a token" -->
Studio reads both the Prism3 form and the standard design.md form, <!-- src: apps/studio/src/state/start-input.ts@"export const validateDesignMd".."try { input = parseDesignMd(text).input; }\n    catch (e) { return parseRefusal(text, e); }"#a5f87d82 --> which lists colors as a flat `colors:` map. <!-- src: packages/engine/standard-design-md.ts@"export const isStandardDesignMd".."Object.keys(std.colors" -->

- Import: **Import design.md…** in the brand menu, then paste the brief and choose **Import**, or choose **Upload…**. The **Import a design.md** card in the start window works the same way, with the same two buttons. <!-- src: apps/studio/src/shell/bar.ts@"// #3977: the example".."const importBox = (v" -->
- Export: open **Export** in the rail, choose **Brand brief**, then **Download brief**. The file is named `<brand>.design.md`. The brief has no settings: "Nothing to set — the brief is written one way." <!-- src: apps/studio/src/export-settings.ts@"label: 'Brand brief'" --> <!-- src: apps/studio/src/main.ts@"brand: { name: shownName".."right.push({ kind: '" -->

A brief is the way to hand a brand to someone else, or to an agent: importing it rebuilds the same brand. For token files, see [Export tokens](export-tokens.md).
