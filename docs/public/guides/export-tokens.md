# Export tokens

<!-- DRAFT for owner review (#2637, lane 4; corrected to the Export area for #3264). -->

There are two ways to get token files out, and they start from different places:

- Export, an area of Studio on the web and in the plugin, writes the brand you set in Studio. <!-- src: apps/studio/src/shell/pages.ts@"{ id: 'export', label"#a3230059 --> <!-- src: apps/studio/src/export-settings.ts@"export type ExportSource".."\u007c 'file-variables';"#64340234 -->
- TokenPress, a separate Figma plugin, writes what a Figma file holds: its variables, text styles, effect styles and gradient paint styles, whoever made them. <!-- src: apps/tokenpress/README.md@"A Figma plugin that "#9efac648 --> <!-- src: apps/tokenpress/README.md@"## Output Structure".."└── gradients.json  "#07079251 -->

## Export from Studio

1. Open **Export** in the rail. <!-- src: apps/studio/src/shell/pages.ts@"{ id: 'export', label" -->
2. Choose **Design tokens**: "The token set in the W3C design-token format, aliases intact: a base file and one overlay per mode. These are the files a build reads." <!-- src: apps/studio/src/export-settings.ts@"label: 'Design tokens".."desc: 'The token set" -->
3. Set the options. The file list and a preview beside them update as you change them. <!-- src: apps/studio/src/main.ts@"right.push({ kind: 'cap', text: files".."right.push({ kind: 'cap', text: '"#20676384 -->
4. Choose **Download tokens**. <!-- src: apps/studio/src/main.ts@"go: { text: exportArtifact" -->

*[Screenshot placeholder: the Export area with Design tokens selected and the file list.]*

| Option | Choices |
|---|---|
| **Token names** | `color.on-fill` or `color.on_fill` <!-- src: apps/studio/src/export-settings.ts@"key: 'tokenNameCase'".."options: [" --> |
| **Grouping** | **Nested groups** or **One flat level** <!-- src: apps/studio/src/export-settings.ts@"key: 'formatDotNotation".."desc: 'Groups nest by" --> |
| **Files** | **One per mode** or **One per group** <!-- src: apps/studio/src/export-settings.ts@"label: 'Files',".."]," --> |
| **Formatting** | **Indented** or **Compact** <!-- src: apps/studio/src/export-settings.ts@"label: 'Formatting',".."]," --> |
| **Include build metadata** | **Off** by default. "For internal use. Adds how each token was built, and what built the file. A consumer's build never reads it, so the handoff leaves it out." <!-- src: apps/studio/src/export-settings.ts@"* the same base + overlays".."options: [" --> |

### What you get

With **One per mode** <!-- src: apps/studio/src/export-settings.ts@"{ value: 'single', label" -->, the download is a base file plus one overlay file per extra mode: <!-- src: packages/engine/emit-dtcg-overlay.ts@"* So this emits a second".."*     <brand>.<mode>"#cb75b242 -->

- `<brand>.base.tokens.json` holds every token at its default-mode value.
- `<brand>.<mode>.overlay.tokens.json`, for example `<brand>.dark.overlay.tokens.json`, holds only the tokens whose value changes in that mode.

A build reads the base and then the overlay for the mode it wants. Style Dictionary does this with its stock setup, and Prism3's automated tests check on every change that it still does. <!-- src: packages/engine/emit-dtcg-overlay.ts@"* A consumer sources".."* we ship is an adapter"#827e558d --> <!-- src: packages/tokens/check-consumability.mjs@"const baseSrc = readSource".."const ov = readSource"#306a7f75 -->
The modes here are the appearance modes (such as dark and the high-contrast pair). Breakpoint values travel inside the layout tokens themselves; the per-breakpoint detail the engine keeps for its own use is left out of these files. <!-- src: packages/engine/emit-dtcg-overlay.ts@"* SCOPE — read this ".."* implementation covers"#daf3ffcf -->

Several files arrive as several downloads, not as one ZIP. <!-- src: apps/studio/src/main.ts@"*  The set, and a split".."download(file.name, "#12963735 -->

The same brand exports the same files from the web Studio and from the plugin; Prism3's automated tests compare the two byte for byte on every change. <!-- src: apps/studio/test-export-parity.mjs@"/**\n * `test:export-parity` — the web studio's token export and the plugin's token export of the same brand are the".."* same bytes, and those"#2bb0d110 --> <!-- src: apps/studio/test-export-parity.mjs@"ok(a === b, `${id}: "#21ecd0a3 -->

To hand over the brand itself rather than its tokens, choose **Brand brief** instead; see [Theme a brand](theme-a-brand.md#import-and-export-a-designmd-brief). <!-- src: apps/studio/src/export-settings.ts@"{\n    id: 'design-md',".."}," -->

## Export any Figma file with TokenPress

TokenPress is listed in Figma as "Token Press - DTCG Exporter". <!-- src: apps/tokenpress/manifest.json@"\"name\": \"Token Press" --> It exports a file's variables, text styles, effect styles and gradient paint styles as DTCG JSON in one ZIP. It works on any file, not only one Prism3 wrote, and it makes no network requests. <!-- src: apps/tokenpress/README.md@"A Figma plugin that "#9efac648 --> <!-- src: apps/tokenpress/manifest.json@"\"allowedDomains\": [\""#8e160138 -->

1. Run TokenPress in the file.
2. Choose **Scan & Validate**. It lists the variables and styles and flags anything that would not export cleanly. <!-- src: apps/tokenpress/src/ui.html@"<button class=\"button\" id=\"scan" --> <!-- src: apps/tokenpress/README.md@"1. **Scan & Validate" -->
3. Set the options, such as units (px or rem), token name case, color space and a namespace prefix, and choose which collections to include. <!-- src: apps/tokenpress/README.md@"### Export Options".."- **Collection include"#c46ac19b -->
4. Choose **Export Tokens** to download the ZIP. <!-- src: apps/tokenpress/src/ui.html@"<button class=\"button\" id=\"export".."Export Tokens" -->

The ZIP holds one file per collection and mode, plus `typography.json` for text styles and `shadows.json` for effect styles. <!-- src: apps/tokenpress/README.md@"## Output Structure".."├── shadows.json    " -->

When TokenPress exports a file Prism3 themed, Prism3's automated tests check that it writes the same token paths, with the same types, as the engine's own token files for that brand. Values are compared in a report, not checked, because the two write colors in different forms that are both valid DTCG. <!-- src: apps/plugin/test-readback-parity.ts@"/**\n * READ-BACK PARITY GATE (#2351, gap 2, offline) — after the plugin's Apply Theme writes a brand into a file, the".."* (#697: two valid serializations"#750fb90a --> <!-- src: tools/exporter-comparison/gate.ts@"/**\n * EXPORTER AGREEMENT GATE (#697) — the two DTCG exporters agree where a disagreement would be a".."* because its number"#851c165f --> <!-- src: tools/exporter-comparison/gate.ts@"* ── WHAT IS DELIBERATELY".."* a naive ZIP merge "#5a5c2342 -->

## Which one to use

| You want | Use |
|---|---|
| The tokens for the brand you set in Prism3 | **Export**, in Studio's rail |
| The tokens a Figma file holds now, including hand changes or non-Prism3 collections | TokenPress |
| The brand settings, to rebuild or share the brand | **Export** › **Brand brief** |
| Each component's props, states, parts and tokens, for building it in code | **Export** › **Component specs** <!-- src: apps/studio/src/export-settings.ts@"label: 'Component specs" --> |
