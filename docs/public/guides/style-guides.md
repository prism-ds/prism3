# Build style guides

<!-- DRAFT for owner review (#2637, lane 4; corrected to Documentation and Update file for #3264). -->

Style guides are tables, one for each group of tokens in the file, drawn from the file's own variables, text styles, effect styles, gradient styles, grid styles and animation styles. A rerun updates each table in place. <!-- src: apps/studio/src/shell/style-guides.ts@"const DOCS_INTRO = '"#46a11854 --> <!-- src: apps/studio/src/shell/style-guides.ts@"const KIND_LABEL: Record"#1c1d3984 -->
They are in the Figma plugin only. You choose what to draw in the **Docs** area, and **Update file** draws it. <!-- src: apps/studio/src/state/update-file.ts@"guides: 'Style guides".."go: 'Update file'," --> <!-- src: apps/studio/src/shell/pages.ts@"{ id: 'documentation" -->

Because the tables read the file rather than Studio, they show what the file holds right now, including anything you changed by hand. <!-- src: apps/plugin/src/style-guide.ts@"/**\n * THE STYLE-GUIDE GENERATOR (#259, phases 1–2: COLOR; DIMENSION, FONT VARIABLES, TEXT STYLES) — a table per token".."import { contrast, composite"#0c86094b -->

## Before you draw

The tables need the pages and the cell components that [setup](file-setup.md) adds. On a file that isn't set up, Docs says "This file isn't set up yet. The first Update file sets it up, then draws these tables." <!-- src: apps/studio/src/shell/style-guides.ts@"const DOCS_NOT_SET_UP" -->

Write the theme first if you want the color tables to show contrast. The contrast column reads the brand saved in the file; without one, it reads "—". <!-- src: apps/plugin/src/style-guide.ts@"*   4. For COLOR, a ".."*      description prose"#f7e88ee8 -->

## Choose what to draw

1. Open **Docs** in the rail, then the **Style guides** tab. <!-- src: apps/studio/src/shell/pages.ts@"{ id: 'documentation" --> <!-- src: apps/studio/src/shell/pages.ts@"export const DOC_TABS".."] as const;" -->
2. Under **What to draw**, choose a **Collection** (or **Every collection**) and the **Kinds** to include, then tick the groups you want. One button works on the list in view: it reads **Select all**, or **Deselect all** once anything in view is ticked. <!-- src: apps/studio/src/shell/style-guides.ts@"const h2 = h('h2', 'p3-sg-sec-title', 'What".."btn('p3-btn p3-btn-page" --> What you see is what is drawn: with one collection chosen, only the tables ticked in it are drawn. <!-- src: apps/studio/src/state/style-guides.ts@"/** WHAT YOU SEE IS ".."};"#06623eb5 --> Tables ticked in another collection stay ticked, and **Every collection** draws them again. <!-- src: apps/studio/src/shell/style-guides.ts@"[['', 'Every collection" -->
3. To draw only some tables, open **Draw by table title** and enter one title per line. Empty draws every table. <!-- src: apps/studio/src/shell/style-guides.ts@"sum.append(glyph('chevr".."const hint = h('p', " -->
4. Set the **Options**. <!-- src: apps/studio/src/shell/style-guides.ts@"const h2 = h('h2', 'p3-sg-sec-title', 'Options" --> Docs keeps your choices in the file. <!-- src: apps/studio/src/shell/documentation.ts@"/**\n * Documentation, the plugin rail's third area (#2909 IA v2 phase 1; owner decisions Q667 A, Q2909.21 A, Q2909.23 A, and".."*     settings-only "#c1d00ceb -->

## Draw the tables

1. Choose **Update file** in the top bar.
2. Tick **Style guides**: "Drawn with the settings in Docs. A rerun updates each table in place." It is ticked by default only on a file that isn't set up yet. <!-- src: apps/studio/src/state/update-file.ts@"guides: 'Style guides".."guidesSub: 'Drawn with" --> Beside it, the row says how many tables the run will draw, such as "2 tables". <!-- src: apps/studio/src/state/update-file.ts@"guidesCount: (n: number" -->
3. Choose **Update file**.

The status strip says "Style guides drawn" when the run ends, and the Activity drawer lists each table. If the run went wrong, the drawer's **Update again** opens Update file again. <!-- src: apps/studio/src/state/status-strip.ts@"done: { setup: 'File".."updated: (n: number)" --> <!-- src: apps/studio/src/shell/activity.ts@"update: 'Update again" -->

*[Screenshot placeholder: the Style guides tab in Docs, with groups ticked and the options column.]*

## Options

| Option | What it does |
|---|---|
| **Table header** | **Dark** or **Light**: the header row's fill. |
| **Aliases** | Shows the variable each value aliases, as a chip beside it. |
| **Description** | Adds each variable's description to its row. |
| **Token names** | **Full path** prints each variable's whole name. **Short** drops the part the table's title already names. |
| **Name cell** | Adds a name you can edit to each row, such as "Text Primary". A rerun keeps your edits. |
| **REM** | Shows each length in REM too, in its own cell, at a 16px base. |
| **Color value** | **Hex**, **RGB-A**, **HSL** or **HSB**. |
| **Color sample** | How each swatch is drawn: from each token's role, as a generic sample, or as text, border, icon or transparency. |
| **Dimension display** | **Filled bar** or **Bracket**, drawn at the value. |
| **Font sample** | What each font variable's sample shows: family, size, weight, letter spacing or line height. |
| **Paragraph spacing**, **Text decoration** | Extra columns for text styles. |

<!-- src: apps/studio/src/shell/style-guides.ts@"body.append(grp('sg-group-all".."lever('Text decoration"#2d85d92a -->
Options appear only for the kinds you picked. <!-- src: apps/studio/src/state/style-guides.ts@"/** The kinds a selection".."export const hasLengths"#865e16a3 -->

## Where the tables go

Primitive collections, such as the palette ramps, go on `↳ Primitive tokens`. Semantic ones, such as color roles, space and radius, go on `↳ Semantic tokens`. Grid styles go on `↳ Grids & layouts`. If the page is missing, the table is skipped and the result says so, and the plugin never creates the page itself. <!-- src: apps/plugin/src/style-guide.ts@"export const PRIMITIVE_PAGE".."export const GRIDS_PAGE" --> <!-- src: apps/plugin/src/file-taxonomy.ts@"{ page: 'Primitive tokens', defs".."{ page: 'Grids & layouts" -->

Each mode gets its own column, side by side, and each swatch stays bound to its variable, so it updates with the file. <!-- src: apps/plugin/src/style-guide.ts@"*   2. MODES SIDE BY".."*      the value text"#2befb111 -->

## Running it again

A rerun finds each table it drew before and updates it in place, reporting tokens added, removed and changed. <!-- src: apps/plugin/src/style-guide.ts@"*   5. RERUN updates".."*      added, removed"#f5fe555c -->
A table whose group is gone is deleted only if the plugin drew it and nobody has changed it since. A table someone edited, moved or copied is left in place and reported. <!-- src: apps/plugin/src/style-guide.ts@"*   6. A SUPERSEDED ".."*      it and nothing"#bc3b7afd -->
A run filtered by table title never deletes another table. <!-- src: tools/figma-mcp/README.md@"`result.verdict.summary` with".."table as stale; run "#f9dbf31e -->

Tables for groups Prism3 no longer draws are offered for removal in Update file's **Clean up** tab. <!-- src: apps/studio/src/state/update-file.ts@"tabClean: 'Clean up'" --> See [Update a Figma file](update-a-file-safely.md#remove-what-the-brand-no-longer-uses).
