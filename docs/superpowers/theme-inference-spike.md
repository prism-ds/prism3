# Theme inference from a file with no Prism3: research spike (#2853)

**Date:** 2026-11-26 · **Type:** working note, research only, no product code · **Issue:** #2853 (epic #2852, the
third file state of #1145) · **Started by:** the owner, 2026-11-26

This note answers the spike #2853 describes. It covers what each lever can be inferred from, and how confidently.
It names what to build on and the output shape, proposes how a scan takes a scope, specifies the read-only
extraction job for the private five-file corpus, and describes the plugin flow in words. Every design and naming
call is left as an owner question at the end. Nothing here is built, and nothing in the engine changes.

## 0. Read this first

**Most of the scanning already exists, and this spike builds on it.** #2075 (closed) shipped two pieces this issue
should reuse instead of rebuilding:

| Piece | What it does | Status |
|---|---|---|
| `packages/engine/file-facts.ts` (`prism3-file-facts/0.1`) | A deterministic, read-only scan of one Figma document into a JSON evidence report: every variable and its alias chain per mode, every style, and per-layer usage of paints, fonts, sizes, weights, line heights, radii, gaps and paddings, each tagged `variable`, `style` or `raw`, by layer role (`name-and-type/1`). It proposes nothing. | Built, `0.x` (D3685.1 C) |
| `packages/engine/file-seed.ts` (`facts-seed/1`) | Reads one facts report and proposes six picks (primary, accent, families, density, radius, action palette) plus a neutral, each with a confidence and an evidence list, then writes a `design.md`. | Built. On the four repo rows, 26 of 28 checks match. |
| `tools/file-seed-comparison/` | Scores the engine seed and an agent seed against a hand-written answer key. `scan-script.ts` is a chunked `use_figma` capture that runs the facts scan inside an open file. | Built. The external rows are pending. |
| `docs/superpowers/2075-seed-comparison-findings.md` | The findings. The raw-file path, with no variables, is **unmeasured**: no repo row has layers. | Read it before this note. |

So #2853 adds five things #2075 does not have:
1. coverage for every lever the issue lists, beyond the six picks;
2. the conflict and snap list ("10px → 8px", "45px → 48px") as a first-class output;
3. per-value provenance that follows #3022's ledger;
4. a **scope**, since today's scan reads every page;
5. **mode pairing**, finding light and dark frames.

**Two terms in the issue do not match the engine one to one**, and the inference has to respect that:
- **There is no type scale ratio and no free base.** The engine's type sizes are a fixed ladder (`theme-type.ts`
  `fontSizeLadder`: 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 112, 128, 144, 160).
  The `typography.typeScale` lever is an enum (`compact` / `default` / `expressive`) that shifts the heading sizes
  one ladder step. Body is fixed at 16px for `md`. A file's ratio can be measured and reported, but no lever takes
  it. What *can* be inferred is which enum, which ceilings and floors, and which heading sizes to pin
  (`typography.sizes`).
- **There is no spacing base lever.** `SPACE_BASE` is a constant 8px (`scale.ts`). The scale is a fixed ladder of
  multiples (0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40 … 96px), and `density` moves each component's spacing one ladder
  step. A file built on a 5px or 6px rhythm has no lever to land on. Its spacings snap to the ladder, and each snap
  is a conflict to confirm.

**Not evaluated here: the prior-art brand-skills CLI's Figma adapter** (#2852, #2853's 2026-10-25 comment). Its
repository is outside this lane's access. The comparison is left to a lane that can read it (owner question Q8).

## 1. Per lever: what a raw file can tell us, and how confidently

**Confidence bands.** The numbers follow `file-seed.ts` (0 to 1, where 0 means defaulted). The labels follow the
rebind skill's mapping pass (`skills/prism3-rebind/SKILL.md` §2.1: exact, close, judgment, gap), so one vocabulary
serves both:

| Band | Number | Rebind label | Meaning |
|---|---|---|---|
| high | ≥ 0.8 | exact | A named variable or style states it, and usage agrees. |
| medium | 0.5–0.8 | close | Usage clearly states it, or a name states it but usage is thin. A snap of one ladder step or less. |
| low | 0.01–0.5 | judgment | Inferred by a rule over weak or conflicting evidence. Always an owner question. |
| defaulted | 0 | gap | No evidence. The engine default stands, named as such. |

**Three file kinds** shape every row below, and each row gives a confidence for each:
- **V**: the file binds to variables or styles, local or from a library (file A, file E).
- **S**: some styles and raw values (typical of an exploratory file, file D).
- **R**: raw values only (file C, the pitch file).

### 1.1 Color

| Lever | Evidence | V | S | R | Notes |
|---|---|---|---|---|---|
| `primary` | Hue family weight plus name hints (`facts-seed/1` COLOR). | high | medium | medium–low | R relies on button-like fills, and the role rule calls a button in a frame named "Frame 12" a background. The anchor *rung* is the weak part: actions often sit a step darker than the brand color (#2075's two "close" rows). |
| `brandColors` (accent and others) | A second hue family ≥ 15° away. The accent rule exists. Further families need a weight floor. | high | medium | low | In pitch files, a hero illustration or photo-overlay color can pose as an accent. Image fills are not colors, but a flat illustration's vectors are counted (as `icon`). |
| `neutral.hue`, `neutral.chroma` | Weighted grays (`facts-seed/1` NEUTRAL). | high | high | medium | Grays are the most used colors in any file, so the evidence is plentiful. A pure-gray file reads chroma 0, which is valid. |
| `neutral.anchor` | A gray the file holds as a named variable at a fixed step. | medium | low | defaulted | Pin only when the file names the step. Otherwise the ramp derives it. |
| `actionPalette` | Main-action fills (`facts-seed/1` ACTION PALETTE). | high | medium | medium | Already the sixth pick. |
| `linkPalette` | The fill of text layers named `link`, or of text that differs in color from its siblings mid-paragraph. | medium | low | low | The facts report doesn't read underline or per-run color today. That is a scan gap (§2). |
| `status.*` | Status-named roles. On raw files, hue windows (red, amber, green, blue) on small text or icon fills next to the words error, success and so on. | high | low | low | The words on a layer (its characters) are not in the facts report, so on R files this is hue-only. That makes it judgment, never auto-applied. |
| `surfaces` | Frame background fills of top-level frames in scope. The lightest is the page and the next is the card. | medium | medium | medium | Needs the per-frame read (§5). The usage `background` role mixes page, card and chip. |
| `raisedSurface`, `scrimStrength`, `interactiveGround` | A dialog-shaped frame (a centered child over a translucent full-bleed fill) and its fills. | low | low | low | Rarely present. Default unless the file holds a dialog. |
| `glassRoles`, `gradients` | Fills with alpha under 1 over content; gradient paints. | medium | medium | medium | `gradients` is a toggle: on when a gradient is a brand fill, not a photo scrim. Judgment. |
| `strictInteractiveContrast`, `linkStateRungs`, `interactivePalettes` | Hover and pressed variants exist only in component sets. | medium (component states) | low | defaulted | A pitch file has no states. |

### 1.2 Form

| Lever | Evidence | V | S | R | Notes |
|---|---|---|---|---|---|
| `radiusScale` + `baseMd` | Corners on button- and field-like layers, fitted to the radius ladder (`scale.ts`: none 0, sm 0.5, md 1, lg 1.5, xl 2, 2xl 3, 3xl 4 × `baseMd` × scale). Fit the scale that minimizes error over every observed corner. Prefer `baseMd = 4` and move it only when the scale alone can't fit (advanced lever). | high | medium | medium | Today's seed uses one corner. A fit over the whole set of corners also yields the per-corner snaps for the conflict list (6px → 4px). Card corners are evidence too, but weaker: they're often pinned for art direction. |
| `controlShape` | Button corners relative to their height. Corner ≥ height ÷ 2 means `pill`; 0 means `boxed`; 1px means `hairline`; otherwise `rounded`. | high | high | medium | Among the most reliable reads, since a pill button is unmistakable. R needs a button-like layer to exist. |
| `density` | The medium control height (36 / 44 / 56px), else the median padding (`facts-seed/1` DENSITY). | high | medium | low–medium | A raw file's buttons come in every height. Take the most common button-like height, and pass the spread as evidence. |
| `fieldStyle`, `searchFieldStyle` | Field-like layers (named `input`, `field` or `search`) with a full stroke, or a bottom stroke only. | medium | low | low | Needs stroke sides, which the facts report doesn't read (§2). |
| `tagStyle`, `bannerStyle`, `currentIndicator`, `radioDot`, `buttonIcons`, `buttonContentSize`, `buttonLabelWeight`, `buttonTextHover`, `buttonBorderWeight`, `buttonMinWidthMultiplier`, `dialogTitleSize` | Each needs that component to be present and recognized. | medium (component sets) | low | defaulted | Component-specific. Read these from recognized component instances (§1.6). Otherwise they default, listed as "not seen in scope". `buttonLabelWeight` is the exception: it's the weight on button-like text, often readable even on R files. |
| `radiusHairline` | 1px corners on controls. | medium | medium | medium | Tied to `controlShape: hairline`. |

### 1.3 Spacing (no lever of its own)

Spacing is read for two outputs, neither of which sets a base:
- **Density evidence.** The median padding on button- and field-like layers adds to `density`.
- **The snap list.** Every observed gap and padding is snapped to the nearest step of the 8px space ladder. A value
  that isn't a ladder step is a conflict ("10px → 8px", "14px → 12px or 16px", "5px → 4px or 6px"). A value
  halfway between two steps is a **tie**, and the conflict names both. A file whose values cluster off the ladder
  (say, mostly multiples of 5) is reported once as a **rhythm conflict**, not 40 times. The report gives its share of
  layers and the nearest ladder mapping, and names the absence of a spacing-base lever as the cause (owner question
  Q2).

Confidence: V high (bound spacing variables are explicit), S medium, R medium. Raw auto-layout gaps are explicit
numbers. Absolute-positioned layouts have no gaps at all, so they count as no evidence (`coverage` says how many
frames had auto layout).

### 1.4 Type

| Lever | Evidence | V | S | R | Notes |
|---|---|---|---|---|---|
| `typography.families` | Text style and usage families, display vs body by name (`facts-seed/1` FAMILIES). | high | high | medium–high | On R files, display vs body falls back to size: the family on the largest sizes is display, the most-used family on 14–18px text is body. Icon fonts are dropped. |
| `typography.weightRoles` | Observed weights, mapped onto the five roles in order (subtle, regular, emphasis, strong, max; defaults 300 / 400 / 600 / 700 / 900). The body text weight is `regular`, and the heading weight is `strong` or `emphasis`. | high | medium | medium | A file using 500 for emphasis and 800 for headings maps cleanly. A file with seven weights reports the ones that don't fit as conflicts. |
| `typography.typeScale` | Rank the heading sizes in use (largest is display, next titles), then pick the enum shift (−1, 0, +1) whose ladder positions fit them with the least error. | medium | medium | low | A judgment call whenever two shifts fit about equally well. Report the file's measured ratio alongside (for example "about 1.25 between heading ranks") as context for the owner. No lever takes it. |
| `typography.sizes` (heading pins) | Heading sizes that are ladder steps but not where the enum puts them. | medium | medium | low | Pins are absolute. Propose them only when one enum leaves a heading two or more steps off. |
| Size snaps | Every observed size not on the ladder snaps to the nearest step: 45 → 48, 15 → 14 or 16 (a tie), 13 → 12 or 14 (a tie). | — | — | — | The snap list. Body text at 14px or 15px is a **body-size conflict**: body `md` is fixed at 16px, so the choice is between `body.sm` as the file's body text and a 16px body (owner question Q3). |
| `displayCeiling`, `titleFloor`, `captionFloor`, `sizeFloor` | The largest heading, the smallest title, and the smallest caption and type sizes used. | high | medium | medium | Direct reads, but bounded by what's in scope. A pitch file's 120px hero sets the ceiling, so the report says which frame drove it. |
| `typography.responsive` | Paired desktop and mobile frames of the same screen, with heading sizes compared. | medium | medium | low | Uses the same pairing as modes (§1.5), keyed on width instead of fill. |
| `typography.links`, `underline`, `italics`, `italicDefault`, `weights` | Text decoration and italic styles. | medium | low | low | Underline and italic per run aren't in the facts report (§2). |
| Line height, tracking | Usage `lineHeights` and text style letter spacing. | — | — | — | No brand-level lever: the engine derives line height from size. Report as information only (the "no home" list) unless a pattern contradicts the derivation by a lot. |

### 1.5 Modes (light and dark pairs)

**What exists:** `modes` (which built-in modes ship), `customModes`, and per-mode `overrides`, `modeAnchors` and
`modeLevers`. Dark is **derived** by the engine from the same anchors. So a file's dark frames are evidence for two
things: (1) that the brand ships dark at all, and (2) where the file's dark differs from what the engine would derive.

**How to find pairs** (needs the per-frame inventory, §5):
1. **By name.** Top-level frames or sections whose names differ only by a mode word (`light` / `dark`, `day` /
   `night`, `default` / `inverse`). Confidence high.
2. **By variables.** A frame with an explicit variable mode set (`explicitVariableModes`) on a multi-mode
   collection. That is the strongest signal on V files. Confidence high.
3. **By structure.** Two frames with the same size and the same structural fingerprint (a hash of child types and
   their order, text characters excluded), where the background lightness is inverted (one above 0.85, the other
   below 0.3 in OKLCH). Confidence medium. On an exploratory file's handoff page this is the expected case.

Each pair yields a color correspondence (light layer color → dark layer color, by matching node path). That is a
sample of the file's own dark mapping. The output sets `modes: [light, dark]`. It also lists where the file's dark
role colors fall more than ΔE 0.05 from the engine's derived dark for the same role (owner question Q9: report
only, or write `overrides` and `modeAnchors`). Confidence: V high (variable modes), S medium (paired frames), R
defaulted (pitch files rarely have dark).

### 1.6 Components (recognition only, feeding the form levers)

Recognized components come from instance and main-component names (`button`, `input`, `checkbox`, `tag` or `chip`,
`banner` or `alert`, `tabs`, `dialog` or `modal`), matched to Prism3 component ids. This is the owner's
2026-10-25 "components it recognizes" item. It is evidence for the form levers in §1.2 and a list in the report.
It never places or swaps a component (rebind does that, and rebind is a separate flow).

### 1.7 Motion, elevation, layout, advanced

| Lever | Evidence | Confidence |
|---|---|---|
| `motionPersonality.tempo` | Prototype transition durations on reactions, if any. | low (often absent). Defaulted otherwise. |
| `shadow.softness`, `shadow.tint` | Effect styles and drop-shadow effects on card-like layers: blur relative to offset, and shadow color hue. | medium on V and S (effect styles), low on R. Effects usage isn't in the facts report today (§2). |
| `layout.breakpoints`, `columns`, `containerMax`, `containerNarrow` | Grid styles and layout grids on top-level frames; frame widths in scope (1440 / 1280 / 768 / 390). | medium when grids exist. Widths alone give breakpoints at low confidence. |
| `iconContrast`, `disabledStrategy`, `disabledMin`, `outlineInteraction`, `outlineHoverFill`, `outlineWash.*`, `neutralEmphasis` | Disabled and hover states of component sets. | low. Defaulted unless component states exist. |

## 2. What to build on, and what the facts scan lacks

**Build on:**
- **`file-facts.ts`** is the evidence layer. Keep it the single read of the file, so the engine path and the agent
  path start from the same facts (its own rule, #2075 part 1).
- **`file-seed.ts`** holds the six picks and their rules. Extend it rather than writing a second seeder. The new
  levers in §1 become new picks with the same `Pick<T>` shape (value, confidence, evidence).
- **`apps/plugin/src/read-figma.ts`** is the pattern for reading `figma.variables.*` under
  `documentAccess: dynamic-page`, with alias targets resolved to names and honest `null`s for dangling ones. It reads
  only Prism3's own collections, positionally, so it's the right reader for file state one (and two, #1145), not
  three. Its test pattern carries over directly: an in-memory shim plus a write-logging check.
- **The rebind skill's mapping pass** (`skills/prism3-rebind/SKILL.md` §2.1) supplies the table shape (one row per
  distinct value, mapped once, referenced by id) and the confidence labels. Its §6 sorting (Prism3 improvement,
  Prism3 gap, brand-only) is the right split for the "no home" list.
- **`fidelity.ts`** compares observed and generated values for color today, and #3022 extends it to every category.
  The conflict report is the same comparison run *before* compile instead of after.

**What the facts scan lacks for #2853** (each is an addition to `file-facts.ts` under `0.x`, which allows fields to
be added):

| Gap | Needed for | Size |
|---|---|---|
| **Scope**: scan a set of pages or nodes, not every page | everything (§4) | small. `FactsSource.pages` already accepts a filtered list. |
| **Per-frame inventory**: top-level frames with size, background fill, explicit variable modes, structural fingerprint | modes, `surfaces`, breakpoints | medium |
| Effects usage (drop shadows by layer role) | `shadow.*` | small |
| Stroke sides (`strokeTopWeight` and the like) | `fieldStyle` | small |
| Per-run underline, italic and fill color | links, italics, `linkPalette` | small. Styled segments are already read. |
| Text characters near status hues | `status.*` on R files | Deliberately left out. Reading copy widens what the report holds; owner question Q10. |
| Layer geometry (height of button-like layers) | `density`, `controlShape` on R files | small |

## 3. The output shape

Two files per scan, plus the report a reviewer reads.

### 3.1 The draft brand input: `design.md`, engine-native dialect

This is the shape `file-seed.ts`'s `seedDesignMd` already writes and `cli.ts` already compiles. Every inferred value
carries a `#` comment that names its provenance id, so the file stays readable and compiles unchanged:

```yaml
---
id: draft
primary: { l: 0.56, c: 0.19, h: 254 }   # P-01 inferred · medium 0.71 · 412 button-like fills, no name hint
density: comfortable                     # P-07 snapped · high 0.86 · 44px medium buttons (38 of 41 layers)
radiusScale: 1.5                         # P-08 inferred · medium 0.64 · fit over 9 corners, 2 snapped (C-03, C-04)
typography:
  typeScale: expressive                  # P-11 judgment · low 0.42 · default fits within 0.4 steps (Q-T1)
---
```

Only a value with evidence is written. A defaulted lever is left out, so the engine default applies, and it is
listed in the report as defaulted. That matches `file-seed.ts`'s rule that a null pick goes to the default.

### 3.2 The sidecar: machine-readable provenance and conflicts

One JSON file per scan. Here is a sketch (field names are technical and change freely under `0.x`):

```jsonc
{
  "format": "prism3-inference/0.1",
  "factsFormat": "prism3-file-facts/0.2",       // the scan that produced the evidence
  "seedRule": "facts-seed/2",
  "scope": { "kind": "nodes", "ids": ["…"], "label": "Handoff" },   // §4; ids stay in the private capture
  "coverage": { "layers": 18240, "inScope": 2210, "autoLayoutFrames": 0.83, "bound": { "variable": 0.0, "style": 0.31, "raw": 0.69 } },
  "values": [
    {
      "id": "P-08",
      "lever": "radiusScale",
      "value": 1.5,
      "class": "inferred",                    // observed | snapped | inferred | defaulted  (→ #3022 ledger, below)
      "confidence": 0.64,
      "band": "medium",
      "rule": "radius-fit/1",
      "evidence": [ { "from": "usage", "role": "button-like", "value": "6px", "layers": 212 } ],
      "conflicts": ["C-03", "C-04"]
    }
  ],
  "conflicts": [
    {
      "id": "C-03", "kind": "snap",            // snap | tie | rhythm | body-size | no-lever | disagreement
      "category": "spacing", "observed": "10px", "proposed": "8px", "alternatives": ["12px"],
      "layers": 96, "share": 0.07, "delta": "-2px", "frames": 14,
      "status": "open"                         // open | accepted | overridden | kept-as-brand
    }
  ],
  "noHome": [ { "what": "letter-spacing −0.02em on display", "layers": 40, "sort": "brand-only" } ],
  "components": [ { "observed": "Btn/Primary", "prism3": "button", "instances": 88, "confidence": 0.9 } ],
  "modes": { "pairs": [ { "light": "…", "dark": "…", "by": "structure", "confidence": 0.7 } ], "darkDeltas": [] }
}
```

**The four classes map onto #3022's ledger** once the owner confirms each value: `observed` (taken as found) →
*authored*; `snapped` (moved to a ladder step) → *adjusted*, keeping the before and after values; `inferred` (a
rule over evidence) → *derived*, naming the rule; `defaulted` → *defaulted*. So #3022's coverage summary can read an
inferred brand the same way it reads an authored one.

### 3.3 The confidence and conflict report

This is a Markdown rendering of the sidecar for the owner, in four sections, conflicts first:
1. **Conflicts to confirm.** One row each, grouped by kind, sorted by layers affected. Each row says what was
   observed, what's proposed, the alternatives, how many layers it affects, and where. A rhythm conflict collapses
   its member snaps into one row.
2. **Values found.** Each lever with its value, class, band and the top evidence. Judgment rows are marked as
   questions.
3. **Defaulted.** Levers with no evidence in scope. #3022's "most consequential defaults" go first: body font,
   radius, neutral temperature and density.
4. **No home in Prism3.** Sorted with the rebind skill's §6 three-way split (Prism3 improvement, Prism3 gap to file,
   brand-only). Each Prism3-gap item is filed as its own issue after review, not left in the report (CLAUDE.md
   principle 3).

**Nothing is snapped silently** (epic #2852's shared shape). The draft `design.md` carries the proposed values, but
the sidecar marks each conflict `open`, and the flow in §6 doesn't let the draft be applied while any conflict is
open (owner question Q6 sets the default action).

## 4. Scope input

A scan reads only the nodes in scope. Everything outside it is invisible to the inference, though the
variable and style *definitions* stay readable, since a library is file-wide. The report always shows the scope it
used.

**Proposed model** (how scope is *given* is the question, and the plugin UI choice is the owner's):

| Form | What counts | Suits |
|---|---|---|
| **Whole file** | Every page. Today's behavior. | Library-bound product files, kits |
| **Pages** | A chosen set of pages | Files organized by page (a "Final" or "Handoff" page) |
| **Nodes** | A chosen set of frames or sections, anywhere | Exploratory files where concepts sit side by side on one canvas |

The scope travels as data (`{ kind, ids, label }`). The same scan core runs for the plugin, the agent path and the
extraction job, so the agent run the owner asked for first (2026-10-25) and the later plugin flow give identical
reports for an identical scope.

**Two aids that help any UI the owner picks:**
- **Concept clusters.** The per-frame inventory groups top-level frames by font-family set and primary hue. When a
  whole-file scan finds two or more clusters that disagree (two primary hues, two body fonts), the report says so
  and suggests scoping to one. On file D this is the expected outcome of a whole-file scan.
- **Scope sensitivity in the report.** A value that changes when the scope narrows is less trustworthy. The
  extraction job measures this by scanning file D both whole and scoped (§5.4).

Owner question Q1 offers three UI options and stays neutral on the screen design.

## 5. The read-only extraction job spec (for the Mac agent, files A–E)

The orchestrator posts these jobs privately. **Nothing from a capture enters this repo**: not the reports, the
names, the colors, the fonts or the keys. Only verdicts come back (the rule from `tools/file-seed-comparison/README.md`,
"The external rows").

### 5.1 The corpus, by letter only

| File | Kind | Role in scoring | Answer key |
|---|---|---|---|
| A | library-bound product file | subject (kind V, library) | file B |
| B | the library file A consumes | **answer key** for A; also scanned as its own row (kind V, local) | its own variables and styles |
| C | hard-coded pitch file | subject (kind R) | written by the owner from the brand's guidance, before any output is read |
| D | exploratory file whose final page is a light and dark handoff | subject (kind S), scanned twice: whole file, and scoped to the handoff page | written by the owner from the handoff page, before any output is read |
| E | commercial white-label kit with clean variables | subject (kind V, local) | the stock shadcn theme's published values, mapped to levers by the orchestrator, not by the inference |

### 5.2 Rules for the agent running the job

1. **Read-only.** Open each file as a viewer, or on a duplicate. Call no method that creates, changes or deletes a
   node, variable, style, page or comment. The facts scan is proven write-free under a write-logging shim (#2075
   part 1). Any extra snippet in this spec uses only getters, and the agent shouldn't run anything else.
2. **No network** from inside a script, no `figma.clientStorage`, no plugin data writes.
3. **Don't edit a file between the chunked calls** of one capture. `join` refuses chunks that disagree.
4. **Save everything to a private directory** on the Mac, and return it over a private channel. Never a commit, PR,
   issue or comment.
5. **Name rows by letter only** (`A`, `B`, `C`, `D-whole`, `D-handoff`, `E`), never by the file's name or key.

### 5.3 What to read, per file

**Step 1: the facts report (exists today).** Follow `tools/file-seed-comparison/README.md` "Capture, on the Mac
mini" steps 1–5 unchanged: `scan-script.ts print <n>`, run each chunk as one `use_figma` call, then `join` into
`<row>.report.json`. This is the whole-file report.

**Step 2: the inventory (one read-only `use_figma` call per file).** For every page (load it with
`page.loadAsync()`), and for every top-level child that is a `FRAME`, `SECTION` or `COMPONENT_SET`, read:

| Field | Plugin API |
|---|---|
| `page`, `pageIndex`, `id`, `type`, `name` | `figma.root.children`, `page.children` |
| `width`, `height`, `x`, `y` | node geometry |
| `background` | the topmost visible solid fill, as `#rrggbb[aa]`, or `null` |
| `explicitModes` | `node.explicitVariableModes`, as `{ collectionName: modeName }` (names via `figma.variables.getVariableCollectionByIdAsync`) |
| `layoutMode`, `layoutGrids` count | node properties |
| `fingerprint` | a hash over the subtree of child `type` and depth, in order, with text characters and colors excluded |
| `textLayers`, `instances`, `descendants` | counts from the subtree walk (visible only) |
| `families`, `topHue` | the font families in the subtree, and the primary hue family by fill weight (for concept clusters) |

Output it as `<row>.inventory.json`. Optionally, take `get_screenshot` of each frame the owner names as in scope.
The screenshots stay private and are for the human reviewer only, never an input to scoring.

**Step 3: a scoped facts report (needs a small tools change first; owner question Q5).** The same chunked capture
with a scope argument (`print <n> --scope <page-or-node ids>`), run for `D-handoff`, and for any other row the owner
scopes. Until that lands, steps 1 and 2 still run, and the scoped row is captured later.

**Step 4: the answer key for A, from B.** Scan B with step 1. The orchestrator then builds A's key from B's
variables and styles, reading the variables A actually binds (A's `libraries` and `variables[*].key` sections), so
the key covers what A uses, not the whole library.

**Figma MCP tools allowed:** `create_session`, `use_figma` (with only the scripts above), `get_metadata` (to
check the page and frame tree against the inventory), `get_variable_defs` (a second read of variables, to
cross-check), and `get_screenshot`. Nothing that writes.

### 5.4 The capture's output, per row

```jsonc
// <row>.capture.json — private
{
  "format": "theme-inference-capture/0.1",
  "row": "D-handoff",                       // A | B | C | D-whole | D-handoff | E
  "fileKind": "S",                          // V | S | R, as the agent observed it
  "scope": { "kind": "page", "ids": ["…"] }, // or { "kind": "file" }
  "facts": "D-handoff.report.json",         // prism3-file-facts/0.x, joined
  "inventory": "D.inventory.json",
  "hasLocalVariables": false,
  "libraries": { "variableCollections": 0, "styles": 3, "components": 12 },
  "coverage": { "pages": 7, "layers": 18240, "hiddenLayers": 512, "unreadableLayers": 0 },
  "toolVersions": { "engine": "<ENGINE_VERSION>", "facts": "prism3-file-facts/0.1", "scanScript": "<git sha>" },
  "notes": "free text: anything surprising, for example a page that failed to load"
}
```

### 5.5 Scoring against an answer key

The answer key uses the same shape as `tools/file-seed-comparison/answer-key.json`, extended per lever, and each
value cites its source (for example "B: variable `…/radius/md`", or "owner, from the guidelines"). A key is written
**before** either the engine or the agent output for that row is read.

| Category | Metric | match | close | miss |
|---|---|---|---|---|
| Colors (primary, accents, status, neutral anchor) | ΔE in OKLab and hue gap | ≤ 0.03 | ≤ 0.10, or the same hue family (≤ 15°) | otherwise |
| Neutral hue and chroma | hue gap, chroma gap | ≤ 10° and ≤ 0.005 | ≤ 25° and ≤ 0.01 | otherwise |
| Families | name, case-insensitive | equal | same family, different stack order | otherwise |
| Weight roles | per role | equal | ±100 | otherwise |
| Radius | nearest engine stop, and `baseMd` | equal | one stop off | otherwise |
| Enums (density, controlShape, typeScale, actionPalette, fieldStyle …) | equality | equal | — | otherwise |
| Floors and ceilings | ladder steps | equal | one step | otherwise |
| Modes | the set of modes, and pairs found vs pairs in the key | equal | a subset | otherwise |
| Shadow softness | slider value | ±0.2 | ±0.5 | otherwise |

Each row also gets three scores that are not per lever:
- **Conflict recall and precision.** The key lists the snaps a careful designer would raise (for file E, the
  kit's off-ladder values against the stock theme). Recall = key conflicts the scan raised. Precision = raised
  conflicts the key agrees are real. A silently snapped value that the key lists as a conflict is a **miss by
  definition**: it's the failure the epic forbids.
- **Provenance completeness.** Every value in the draft has an evidence entry or the `defaulted` class. Target:
  100%.
- **Confidence calibration.** Within each band, the share of `match` verdicts. High should be ≥ 90% match, and low
  should hold most misses. A miss at high confidence is reported by lever, because it's the most expensive error.
- **Scope sensitivity, file D.** The values that differ between `D-whole` and `D-handoff`, and which of the two
  matches the key. The expectation to test: the scoped row beats the whole-file row on primary, families and
  modes.

The scorer is `compare.ts --external <ext>` today (the six picks). Its extension to these categories lands with
the seed extension, in a later PR. Verdicts only (match, close, miss, extra, and the counts) come back into a
findings note in this repo, never the values.

## 6. The plugin flow, in words (for the owner to approve before any build)

This is the single mapping and review screen #2075 left for later. Q-FS2 A (on #2852) says the brand-skills web
and PDF adapters feed the same screen, so it is written source-agnostic. The words below describe structure only,
and the wording, entry point and layout are all the owner's.

1. **Entry.** A start option, "Start from this file" or similar, offered when the file has no Prism3 theme (the
   plugin's `seed-info` already knows this on boot). G16 B decided against a "From this Figma file" option,
   because that option would only have reopened a saved Prism3 brand. This would be a different option, so it needs
   its own decision (Q7).
2. **Scope.** The designer says what counts, through whichever form Q1 picks. The panel shows what's in scope as a
   count: pages, frames and layers. When concept clusters disagree, a short notice suggests narrowing.
3. **Scan.** Read-only, with progress by page. It ends with the coverage line: layers read, hidden and unreadable,
   and how much was bound vs raw. Nothing in the file changes.
4. **Review: conflicts first.** A list of the open conflicts, each with observed → proposed, its alternatives, and
   where it occurs (selecting a row selects those layers on the canvas, read-only). Per row, the choices are:
   accept the proposal, choose an alternative, or keep it as a brand-only value (it goes to the no-home list). A
   rhythm conflict is one row with an expander.
5. **Review: values.** The draft levers, grouped the way the plugin's editor already groups them (`leverGroups`:
   Color, Form factor, Typography, Motion, Elevation, Layout, Advanced). Each lever shows its value, a confidence
   band, and "why", which opens the evidence. Judgment rows sit at the top of each group. Defaulted levers are
   listed but collapsed.
6. **Modes.** The pairs found, shown as thumbnails side by side, to confirm or drop. Where the file's dark departs
   from the derived dark, the deltas are listed (what happens to them is Q9).
7. **Preview.** Compile the draft and show the contract results (contrast and aliases), plus a before and after on
   one in-scope frame, in the plugin's existing preview, not on the canvas.
8. **Finish.** Two separate outcomes, each its own decision: **open the draft in the editor** as the starting brand
   (the designer keeps tuning), and **export** the `design.md` and the sidecar. Applying the theme to the file is
   the existing Apply flow, after this one, never part of the scan. Rebinding the screens is the rebind skill's job,
   later and separate.

**Not in this flow:** placing components, rebinding layers, editing the source file, or any network call.

## 7. What this spike does not settle, and the risks

- **The raw-file path is still unmeasured.** Every confidence above for kind R is a judgment from reading the rules,
  not a measured number. File C is the first real test. Expect the R column to move once it's scored.
- **The role rule is name-based.** `name-and-type/1` calls an unnamed button a background. Geometry-aware roles
  (a small, rounded, filled frame with one centered text child is button-like) would lift kind R. That is a change
  to the facts scan, measured on file C before it's adopted.
- **The anchor rung.** Both #2075 "close" verdicts were the action rung sitting darker than the brand color. On a
  raw file there's no ramp to read, so the darkest common button fill may be the hover state. The seed should
  prefer the most-used button fill over the darkest.
- **Pitch files lie about the system.** A pitch file is art-directed: one-off sizes, a hero font, photo-led color.
  Its "brand input" is partly a judgment of intent. That is why its key is the owner's, written from guidance, and
  why most of its rows will be judgment.
- **Determinism.** The engine path is deterministic. The agent path is one sample per run (#2075 findings, point 4).
  Recording two agent runs on one row would show the variance.

## 8. Proposed next steps (after the owner answers)

1. A tools PR: scope and inventory in `scan-script.ts` and `file-facts.ts` (`0.2`), per Q5. Engine-adjacent, no
   lever changes.
2. The capture jobs on files A–E (private), then the six-pick scores on those rows: this fills #2075's pending
   external table.
3. Extending `file-seed.ts` lever by lever, in confidence order: neutral, controlShape, radius fit, weight roles,
   floors and ceilings, typeScale, modes, then the rest. Each pick ships with its scorer category and a mutation that
   fails a test by name.
4. The conflict list and sidecar (`prism3-inference/0.1`), then the agent-run report the owner asked for on
   2026-10-25.
5. The plugin flow, only after the wireframe in §6 is approved and the scores say which levers are safe to propose.

## OWNER QUESTIONS

Each option is a direction, not a design. "(rec)" marks the lane's recommendation, and the choice is yours.

**Q1. How is the scan's scope given?**
(A) **(rec)** The current selection: the designer selects frames or sections on the canvas, and no selection means
the current page. It reuses a Figma habit and needs no new list UI. (B) A page checklist in the plugin, with
frames as an optional second level. (C) A naming convention: the scan reads only pages or sections whose name
carries a marker the team adds. That needs no UI, but it means editing the file.

**Q2. A file whose spacing rhythm isn't 8px (say, multiples of 5 or 6).**
(A) **(rec)** Report it as one rhythm conflict, propose the nearest 8px-ladder steps, and file "a spacing-base
lever" as its own issue if the corpus shows it's common. (B) Add a spacing-base lever to the engine now, before
inference ships. (C) List it under no-home only, with no proposal.

**Q3. Body text at 14px or 15px, when body `md` is fixed at 16px.**
(A) **(rec)** A body-size conflict with two proposals: use 16px (the engine's body), or keep 14px as `body.sm` with
a note on what changes. The owner picks per brand. (B) Always propose 16px. (C) File a body-size lever issue and
hold body until it exists.

**Q4. The draft's format.**
(A) **(rec)** An engine-native `design.md` with a `#` provenance comment per value, plus the JSON sidecar. It
compiles today and keeps every lever reachable. (B) The standard dialect with an `x-prism3:` block, to match the
brand-skills output, though it reads only ten levers. (C) The sidecar only, with the plugin building the input in
memory.

**Q5. The extraction jobs need a scope and an inventory that the capture script lacks.**
(A) **(rec)** A small tools PR first (scope and inventory in `scan-script.ts` and `file-facts.ts` `0.2`), then
all jobs run once. (B) Run steps 1 and 2 now (whole file plus the inventory snippet in §5.3), and capture
`D-handoff` later. (C) Let the Mac agent write its own scoped variant per job. Faster, but the captures aren't
reproducible from the repo.

**Q6. What a conflict does by default in the review.**
(A) **(rec)** Each conflict starts `open` with the proposal preselected, and the draft can't be applied until every
conflict is confirmed (one "accept all proposals" action is allowed, as an explicit choice). (B) High-confidence
snaps of one ladder step are accepted automatically and listed, and the rest stay open. (C) Nothing is preselected.

**Q7. The entry point.**
(A) **(rec)** Agent-run report first, as your 2026-10-25 note asked: no plugin work until the corpus scores are in.
Then a plugin start option, shown only when the file has no Prism3 theme. (B) Build the plugin start option and
the review screen together, now. (C) Keep it agent-only, with no plugin flow.

**Q8. The prior-art brand-skills Figma adapter (#2852) was out of this lane's reach.**
(A) **(rec)** A short read-only lane with access compares its Figma adapter with `file-facts.ts` before step 3 of
§8, reusing anything the facts scan lacks. (B) Skip it: the facts scan covers the Figma side. (C) Replace the
facts scan with the adapter.

**Q9. A file's own dark mode, when it differs from the derived dark.**
(A) **(rec)** Set `modes` from the pairs found, and *report* the role colors where the file's dark departs by more
than ΔE 0.05, without writing per-mode overrides. You decide per brand afterward. (B) Also write `modeAnchors` and
`overrides` so the draft reproduces the file's dark. (C) Ignore the file's dark beyond detecting that it exists.

**Q10. Reading text characters (for status colors on raw files).**
(A) **(rec)** Don't read copy. Status on raw files stays hue-only, at judgment confidence. (B) Read the characters
of short text layers only (under about 40 characters, labels and badges) for status words. (C) Read all text.

---

## Gaps

This note scores nothing: the corpus is private, and the capture jobs haven't run. The confidence columns for
kinds S and R are judgments from the rules, to be replaced by measured numbers from files C and D.
