/**
 * THE FILE FACTS REPORT (#2075 part 1, owner direction Q189): a deterministic scan of one Figma document into a
 * versioned JSON evidence report. It states what the file holds and how each value is applied. It proposes nothing:
 * no seed, no primary color, no "this looks like the brand font". Interpretation is #2075 part 2, and it reads this
 * report rather than the file, so the two paths it compares start from the same evidence.
 *
 *   scanFileFacts(source) → FileFactsReport          // pure over `FactsSource`; the plugin adapter builds the source
 *   npx tsx packages/engine/file-facts-cli.ts <snapshot.json>   // the same scan over a plain-data snapshot
 *
 * WHERE IT RUNS. `FactsSource` is the minimal slice of the plugin API the scan reads: the local collections, variables
 * and styles, the pages' node trees, and four lookups (a variable, a collection, a style and an instance's main
 * component by id) for what lives in a library. Figma's own objects satisfy it structurally, so the plugin adapter
 * (`apps/plugin/src/file-facts-figma.ts`) passes them through without copying. A snapshot on disk satisfies it too,
 * which is how the CLI below runs the scan with no Figma at all. Dependency-free and node-free, so the plugin bundles it.
 *
 * READ-ONLY. It calls no method that changes a node, a variable or a style. The plugin suite runs it against a
 * write-logging node shim and fails on any write.
 *
 * WHAT IS COUNTED, and how.
 *   · A "use" is one LAYER. A node with two identical fills counts once for that color; a text node whose runs mix
 *     two sizes counts once for each size. Every count in `usage`, `styles[*].layers` and `components` is layers.
 *   · Every visible layer on every page is walked, inside instances too: what an instance draws is on screen. Each
 *     usage row splits its count into `layers` and `inInstances`, so a reader can tell drawn-here from inherited.
 *     A hidden layer (`visible: false`) and everything under it is skipped and counted in `coverage.hiddenLayers`;
 *     a hidden paint is skipped. A layer whose properties cannot be read is counted in `coverage.unreadableLayers`
 *     and adds no usage row and no count, even when the read fails partway; its children are still walked. A
 *     variable or style its bindings name still enters `variables`, `styles` and `libraries`, since the binding was
 *     read, with that layer uncounted (`boundLayers`, `layers`). When the layer's own
 *     visibility cannot be read, or its child list cannot, the subtree is not walked, and only the layer is counted.
 *   · Every value carries its BINDING: `variable` (with the variable), `style` (with the style) or `raw`. A paint on
 *     a layer with a fill or stroke style is the style's, even when the style's own paint is bound to a variable.
 *     A text property is the text style's when the layer (or the run) has one, else a variable's, else raw.
 *
 * THE NODE-ROLE RULE (the one classification in the report; `ROLE_RULE` names its revision, and the report carries
 * it so a reader knows which rule produced the counts). Applied in order, per layer and paint property:
 *   1. icon        the layer is a vector shape (VECTOR, BOOLEAN_OPERATION, STAR, POLYGON), or it or an ancestor is
 *                  named as an icon: the word `icon` or `icons` in its layer name or its main component's name.
 *   2. text        a fill on a TEXT layer.
 *   3. border      any stroke (a TEXT layer's stroke too).
 *   4. button-like a fill on a layer whose own name, or whose parent's name, has the word `button`, `btn` or `cta`
 *                  (singular or plural), the main component's and its set's names included for an instance.
 *   5. background  every other fill.
 * Names are compared lowercased with separators (space, `/`, `_`, `-`, `.`, `=`, `:`) read as word breaks. It is a
 * name-and-type rule and no more: a button drawn in a frame named "Frame 12" is a background here, and the report
 * says so rather than guessing.
 *
 * VALUES. A color is `#rrggbb`, or `#rrggbbaa` when its alpha (the color's own times the paint's opacity) is under 1,
 * each channel `Math.round(c * 255)`. A line height is `AUTO`, `<n>px` or `<n>%`. Numbers are reported as stored.
 * A variable alias into another collection is resolved in that collection's DEFAULT mode, the mode Figma uses when
 * nothing sets one explicitly; an alias chain that meets a missing variable or loops stops and says which.
 *
 * DETERMINISTIC. No timestamp, no file name, no file key, no random order: every list is sorted by a stated key, so
 * the same file scans to the same bytes. The report names pages, layers' components and styles by the names the file
 * gives them, and nothing about the file itself.
 *
 * SCHEMA. `schema/file-facts.schema.json`, authored by hand; `format` equals its `$id`. The plugin suite validates
 * every fixture's report against it, so a field added here without the schema moving fails there.
 *
 * SCOPE (0.2, #2853 Q5 A). A scan reads the pages its source holds, and the report names that set in `scope`. The
 * whole file is `{ kind: 'file' }`. `scopePages` narrows it, the one place the rule lives, so the plugin, the capture
 * script and the CLI scope alike:
 *   · `selection` (owner decision Q1 A): the layers selected on the current page; with nothing selected, the current page.
 *   · `ids`: an explicit list of page ids, or of layer ids (a frame or section anywhere). Not both in one list.
 * A layer inside another named layer is covered by it, and only the outer one is a root. Ids are reported in file
 * order, so the order of a selection does not move the bytes. An id the file does not hold refuses the scan by name
 * (`ScopeError`): a scope that silently lost a frame would read as a smaller file. Variable and style definitions stay
 * file-wide, since a library is. Everything outside the scope is unread by the usage walk; the scope search reads
 * only ids and child lists to find the roots. LIMIT: the walk starts fresh at each root, so a root nested inside an
 * icon, a button or an instance does not inherit that ancestor's role or its `inInstances` count. Scope to frames,
 * sections or pages, which have no such ancestor.
 *
 * INVENTORY (0.2, the spike's §5.3 step 2). One row per visible FRAME, SECTION or COMPONENT_SET at the top of the
 * scope: a page's own children, or the roots themselves, and a section's children in turn (a section groups frames).
 * Each row reads the node's geometry, its topmost visible solid fill, its explicit variable modes, its layout mode
 * and grid count, and a walk of its visible subtree: a structural fingerprint (FNV-1a over each layer's depth and
 * type in order; names, text and colors excluded, so a light and a dark copy of one screen share it), counts, the
 * font families, and the most-used solid fills. Evidence for mode pairing and concept clusters; it pairs nothing.
 *
 * UNSTABLE: 0.x (owner decision D3685.1 C). The format id is `prism3-file-facts/0.<n>` until #2075 part 2's findings
 * are in. Under 0.x any field may be added, renamed or removed, and each such change raises `<n>`; nothing here is a
 * promise yet. A reader checks the exact id and refuses one it does not know. Leaving 0.x (`/1.0`) is the owner's
 * call, made when part 2 has shown which fields earn their place.
 */
import { ENGINE_VERSION } from './version';

export const FILE_FACTS_FORMAT = 'prism3-file-facts/0.2';
/**
 * The ids a reader of this engine accepts, oldest first. 0.2 only adds `scope` and `inventory` and narrows what
 * `coverage.pages` counts to the pages in scope, so a 0.1 report reads as a whole-file scan with no inventory. Any
 * other id is refused by name (`requireFactsFormat`), never read on trust.
 */
export const FACTS_FORMATS_READ = ['prism3-file-facts/0.1', FILE_FACTS_FORMAT] as const;
export const requireFactsFormat = (format: unknown): void => {
  if (!(FACTS_FORMATS_READ as readonly unknown[]).includes(format))
    throw new Error(`file facts report format ${JSON.stringify(format)} is not one this engine reads (${FACTS_FORMATS_READ.join(', ')})`);
};
export const ROLE_RULE = 'name-and-type/1';

/* ── the source: the slice of the plugin API the scan reads ─────────────────────────────────────────────────────────── */

/** Figma marks a property that varies across a text layer's runs with a unique symbol (`figma.mixed`). */
type Maybe<T> = T | symbol | undefined;
type Alias = { type: 'VARIABLE_ALIAS'; id: string };
type Rgb = { r: number; g: number; b: number; a?: number };

export type FactsCollection = {
  id: string; name: string; key?: string; remote?: boolean; hiddenFromPublishing?: boolean;
  modes: readonly { modeId: string; name: string }[]; defaultModeId?: string;
};
export type FactsVariable = {
  id: string; name: string; key?: string; remote?: boolean; variableCollectionId: string; resolvedType: string;
  valuesByMode: { [modeId: string]: unknown }; scopes?: readonly string[]; description?: string; hiddenFromPublishing?: boolean;
};
export type FactsStyle = {
  /** PAINT, TEXT, EFFECT or GRID. Read for a library style only: a local one's kind is the list it came in. */
  id: string; name: string; type?: string; key?: string; remote?: boolean; description?: string;
  paints?: readonly unknown[]; effects?: readonly unknown[]; layoutGrids?: readonly unknown[];
  fontName?: { family: string; style: string }; fontSize?: number; lineHeight?: unknown; letterSpacing?: unknown;
  boundVariables?: unknown;
};
export type FactsComponent = { id: string; name: string; key?: string; remote?: boolean; setName?: string; setKey?: string };
/** A layer, as the scan reads it. Every field optional: a field a layer type lacks is simply absent. */
export type FactsNode = {
  readonly id: string; readonly type: string; readonly name: string; readonly visible?: boolean;
  readonly children?: readonly FactsNode[];
  readonly fills?: unknown; readonly strokes?: unknown;
  readonly fillStyleId?: unknown; readonly strokeStyleId?: unknown; readonly textStyleId?: unknown;
  readonly effectStyleId?: unknown; readonly gridStyleId?: unknown;
  readonly boundVariables?: unknown;
  readonly cornerRadius?: unknown; readonly topLeftRadius?: unknown; readonly topRightRadius?: unknown;
  readonly bottomLeftRadius?: unknown; readonly bottomRightRadius?: unknown;
  readonly layoutMode?: unknown; readonly layoutWrap?: unknown; readonly primaryAxisAlignItems?: unknown;
  readonly itemSpacing?: unknown; readonly counterAxisSpacing?: unknown;
  readonly paddingTop?: unknown; readonly paddingRight?: unknown; readonly paddingBottom?: unknown; readonly paddingLeft?: unknown;
  readonly fontName?: unknown; readonly fontWeight?: unknown; readonly fontSize?: unknown; readonly lineHeight?: unknown;
  readonly x?: unknown; readonly y?: unknown; readonly width?: unknown; readonly height?: unknown;
  readonly explicitVariableModes?: unknown; readonly layoutGrids?: unknown;
};
export type FactsPage = { readonly id: string; readonly name: string; readonly children: readonly FactsNode[] };

export type FactsSource = {
  collections: readonly FactsCollection[];
  variables: readonly FactsVariable[];
  styles: { paint: readonly FactsStyle[]; text: readonly FactsStyle[]; effect: readonly FactsStyle[]; grid: readonly FactsStyle[] };
  pages: readonly FactsPage[];
  /** A variable or collection by id, local or from a library; null when the file cannot reach it. */
  variableById(id: string): Promise<FactsVariable | null>;
  collectionById(id: string): Promise<FactsCollection | null>;
  styleById(id: string): Promise<FactsStyle | null>;
  /** An INSTANCE's main component; null when it is missing. */
  mainComponent(node: FactsNode): Promise<FactsComponent | null>;
  /** A mixed text layer's runs, when the host can give them (Figma's `getStyledTextSegments`). */
  textRuns?(node: FactsNode): readonly TextRun[] | null;
  /** What `pages` holds, from `scopePages`. Absent: `pages` is the whole file. */
  scope?: FactsScope;
};
/** The scan's scope, as the report states it. `ids` are the roots (pages or layers), in file order; empty for a file. */
export type FactsScope = {
  kind: 'file' | 'pages' | 'nodes';
  from: 'whole-file' | 'selection' | 'current-page' | 'ids';
  ids: string[];
  pages: { id: string; name: string; index: number }[];
};
export type TextRun = {
  fontName?: unknown; fontWeight?: unknown; fontSize?: unknown; lineHeight?: unknown;
  fills?: unknown; fillStyleId?: unknown; textStyleId?: unknown; boundVariables?: unknown;
};

/* ── the report ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

export type Binding =
  | { kind: 'variable'; id: string; name: string | null; collection: string | null; remote: boolean }
  | { kind: 'style'; id: string; name: string | null; remote: boolean }
  | { kind: 'raw' };
export type Role = 'button-like' | 'text' | 'background' | 'border' | 'icon';
export type Use = { layers: number; inInstances: number };
export type ModeValue = {
  mode: string; modeId: string;
  value: unknown;                         // the stored value, normalized; null for an alias
  alias: { id: string; name: string | null } | null;
  chain: string[];                        // the alias chain, by variable name, ending at the variable that holds a value
  resolved: unknown;                      // the value at the end of the chain; null when it could not be reached
  unresolved: 'missing-variable' | 'cycle' | 'no-value' | null;
};
export type FileFactsReport = {
  format: typeof FILE_FACTS_FORMAT;
  engineVersion: string;
  roleRule: typeof ROLE_RULE;
  scope: FactsScope;
  coverage: { pages: number; layers: number; hiddenLayers: number; unreadableLayers: number; textLayers: number; instances: number };
  inventory: InventoryRow[];
  variables: {
    collections: { id: string; name: string; key: string | null; remote: boolean; modes: { modeId: string; name: string }[]; defaultMode: string; variables: number }[];
    variables: {
      id: string; name: string; key: string | null; remote: boolean; collectionId: string; collection: string | null; type: string;
      scopes: string[]; description: string; hiddenFromPublishing: boolean; values: ModeValue[]; boundLayers: number;
    }[];
  };
  styles: {
    paint: (StyleBase & { paints: unknown[] })[];
    text: (StyleBase & { fontFamily: string | null; fontStyle: string | null; fontSize: number | null; lineHeight: string | null; letterSpacing: string | null; boundVariables: string[] })[];
    effect: (StyleBase & { effects: unknown[] })[];
    grid: (StyleBase & { grids: unknown[] })[];
  };
  usage: {
    paints: ({ property: 'fill' | 'stroke'; role: Role; paint: string; color: string | null; binding: Binding } & Use)[];
    typography: {
      fontFamilies: TypeRow[]; fontStyles: TypeRow[]; fontWeights: TypeRow[]; fontSizes: TypeRow[]; lineHeights: TypeRow[];
    };
    radii: ({ value: number; binding: Binding } & Use)[];
    spacing: ({ property: 'gap' | 'wrap-gap' | 'padding'; value: number | 'auto'; binding: Binding } & Use)[];
  };
  components: {
    used: ({ id: string; key: string | null; name: string; set: string | null; remote: boolean; pages: string[] } & Use)[];
    missingMain: number;
    localDefinitions: { components: number; componentSets: number };
  };
  libraries: {
    variableCollections: { id: string; key: string | null; name: string; variables: number; boundLayers: number }[];
    styles: { kind: string; remote: number; boundLayers: number }[];
    components: { components: number; instances: number };
  };
  bindingSummary: Record<'paints' | 'typography' | 'radii' | 'spacing', { variable: number; style: number; raw: number }>;
};
type StyleBase = { id: string; name: string; key: string | null; remote: boolean; description: string; layers: number };
export type InventoryRow = {
  page: string; pageIndex: number; id: string; type: string; name: string;
  /** The section this row sits in, when it is a section's child; null at the top of the scope. */
  section: string | null;
  x: number | null; y: number | null; width: number | null; height: number | null;
  background: string | null;
  explicitModes: { collectionId: string; collection: string | null; modeId: string; mode: string | null }[];
  layoutMode: string | null; layoutGrids: number;
  fingerprint: string;
  descendants: number; textLayers: number; instances: number; hiddenLayers: number; unreadableLayers: number;
  families: string[];
  fills: { color: string; layers: number }[];
};
type TypeRow = { value: string | number; binding: Binding } & Use;

/* ── value helpers ──────────────────────────────────────────────────────────────────────────────────────────────────── */

const isMixed = (v: unknown): v is symbol => typeof v === 'symbol';
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
const isAlias = (v: unknown): v is Alias => isObj(v) && v.type === 'VARIABLE_ALIAS' && typeof v.id === 'string';
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

const hex2 = (c: number): string => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0');
/** `#rrggbb`, or `#rrggbbaa` when the alpha is under 1. */
export const colorHex = (c: Rgb, opacity = 1): string => {
  const a = (typeof c.a === 'number' ? c.a : 1) * opacity;
  return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}${a < 1 ? hex2(a) : ''}`;
};
const isRgb = (v: unknown): v is Rgb => isObj(v) && typeof v.r === 'number' && typeof v.g === 'number' && typeof v.b === 'number';
const lineHeightOf = (v: unknown): string | null => {
  if (!isObj(v)) return null;
  if (v.unit === 'AUTO') return 'AUTO';
  if (v.unit === 'PIXELS' && typeof v.value === 'number') return `${v.value}px`;
  if (v.unit === 'PERCENT' && typeof v.value === 'number') return `${v.value}%`;
  return null;
};
const letterSpacingOf = (v: unknown): string | null => {
  if (!isObj(v) || typeof v.value !== 'number') return null;
  return v.unit === 'PERCENT' ? `${v.value}%` : `${v.value}px`;
};
/** Every alias id in a `boundVariables` value, at any depth (Figma binds text properties as arrays, one per run). */
const aliasIds = (v: unknown): string[] => {
  if (isAlias(v)) return [v.id];
  if (Array.isArray(v)) return v.flatMap(aliasIds);
  if (isObj(v)) return Object.values(v).flatMap(aliasIds);
  return [];
};
const boundIn = (bv: unknown, field: string): string | null => {
  if (!isObj(bv)) return null;
  const ids = [...new Set(aliasIds(bv[field]))];
  return ids.length === 1 ? ids[0] : null;
};
/** A variable value as the report writes it: a color as hex, an alias as null (it is reported beside), the rest as stored. */
const plainValue = (v: unknown): unknown => {
  if (isAlias(v)) return null;
  if (isRgb(v)) return colorHex(v);
  if (v === undefined) return null;
  return v;
};
/** A paint, an effect or a layout grid, reduced to the fields a reader compares. */
const paintOf = (p: Record<string, unknown>): Record<string, unknown> => ({
  type: String(p.type ?? ''),
  color: p.type === 'SOLID' && isRgb(p.color) ? colorHex(p.color, num(p.opacity) ?? 1) : null,
  stops: Array.isArray(p.gradientStops) ? p.gradientStops.filter(isObj).map((s) => ({ position: num(s.position), color: isRgb(s.color) ? colorHex(s.color) : null })) : null,
  variable: boundIn(p.boundVariables, 'color'),
  visible: p.visible !== false,
});
const effectOf = (e: Record<string, unknown>): Record<string, unknown> => ({
  type: String(e.type ?? ''),
  color: isRgb(e.color) ? colorHex(e.color) : null,
  offsetX: isObj(e.offset) ? num(e.offset.x) : null,
  offsetY: isObj(e.offset) ? num(e.offset.y) : null,
  radius: num(e.radius),
  spread: num(e.spread),
  visible: e.visible !== false,
});
const gridOf = (g: Record<string, unknown>): Record<string, unknown> => ({
  pattern: String(g.pattern ?? ''),
  sectionSize: num(g.sectionSize),
  count: num(g.count),
  gutterSize: num(g.gutterSize),
  offset: num(g.offset),
  alignment: str(g.alignment),
});

const WORDS = (s: string): string => ` ${s.toLowerCase().replace(/[\s/_\-.=:]+/g, ' ').trim()} `;
const ICON_WORD = / icons? /;
const BUTTON_WORD = / (buttons?|btns?|ctas?) /;
const VECTOR_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON']);

/* ── the scan ───────────────────────────────────────────────────────────────────────────────────────────────────────── */

export async function scanFileFacts(src: FactsSource): Promise<FileFactsReport> {
  // Every variable, collection and style the scan meets, local first; library ones join as bindings reach them.
  const vars = new Map<string, FactsVariable | null>(src.variables.map((v) => [v.id, v]));
  const colls = new Map<string, FactsCollection | null>(src.collections.map((c) => [c.id, c]));
  type Kind = 'paint' | 'text' | 'effect' | 'grid';
  const KINDS: Kind[] = ['paint', 'text', 'effect', 'grid'];
  const styles = new Map<string, FactsStyle | null>(KINDS.flatMap((k) => src.styles[k].map((s) => [s.id, s] as const)));
  const kindOf = new Map<string, Kind>(KINDS.flatMap((k) => src.styles[k].map((s) => [s.id, k] as const)));
  const variable = async (id: string): Promise<FactsVariable | null> => {
    if (!vars.has(id)) vars.set(id, await src.variableById(id).catch(() => null));
    const v = vars.get(id) ?? null;
    if (v && !colls.has(v.variableCollectionId)) colls.set(v.variableCollectionId, await src.collectionById(v.variableCollectionId).catch(() => null));
    return v;
  };
  const style = async (id: string): Promise<FactsStyle | null> => {
    if (!styles.has(id)) {
      const s = await src.styleById(id).catch(() => null);
      styles.set(id, s);
      const k = String(s?.type ?? '').toLowerCase();
      if (s && (KINDS as string[]).includes(k)) kindOf.set(id, k as Kind);
    }
    return styles.get(id) ?? null;
  };
  const varBinding = async (id: string): Promise<Binding> => {
    const v = await variable(id);
    const c = v ? colls.get(v.variableCollectionId) ?? null : null;
    return { kind: 'variable', id, name: v?.name ?? null, collection: c?.name ?? null, remote: !!v?.remote };
  };
  const styleBinding = async (id: string): Promise<Binding> => {
    const s = await style(id);
    return { kind: 'style', id, name: s?.name ?? null, remote: !!s?.remote };
  };

  // Tallies: one key per (row identity); each layer adds to a key at most once.
  type Row<T> = { row: T } & Use;
  const tally = <T>() => new Map<string, Row<T>>();
  const paintRows = tally<{ property: 'fill' | 'stroke'; role: Role; paint: string; color: string | null; binding: Binding }>();
  const typeRows = {
    fontFamilies: tally<{ value: string | number; binding: Binding }>(),
    fontStyles: tally<{ value: string | number; binding: Binding }>(),
    fontWeights: tally<{ value: string | number; binding: Binding }>(),
    fontSizes: tally<{ value: string | number; binding: Binding }>(),
    lineHeights: tally<{ value: string | number; binding: Binding }>(),
  };
  const radiusRows = tally<{ value: number; binding: Binding }>();
  const spacingRows = tally<{ property: 'gap' | 'wrap-gap' | 'padding'; value: number | 'auto'; binding: Binding }>();
  const styleLayers = new Map<string, number>();
  const varLayers = new Map<string, number>();
  const compRows = new Map<string, { comp: FactsComponent; pages: Set<string> } & Use>();
  const coverage = { pages: src.pages.length, layers: 0, hiddenLayers: 0, unreadableLayers: 0, textLayers: 0, instances: 0 };
  let missingMain = 0;
  const localDefs = { components: 0, componentSets: 0 };

  const bindKey = (b: Binding): string => (b.kind === 'raw' ? 'raw' : `${b.kind}:${b.id}`);
  // A layer's counts wait here and reach the report only once every read of that layer has succeeded (`walk`), so a
  // layer that throws partway leaves no row behind.
  let pending: (() => void)[] = [];
  const add = <T>(m: Map<string, Row<T>>, key: string, row: T, seen: Set<string>, inInstance: boolean): void => {
    if (seen.has(key)) return;
    seen.add(key);
    pending.push(() => {
      const r = m.get(key) ?? { row, layers: 0, inInstances: 0 };
      r.layers++;
      if (inInstance) r.inInstances++;
      m.set(key, r);
    });
  };

  const readPaints = async (prop: 'fills' | 'strokes', paints: unknown, styleId: unknown, role: Role, seen: Set<string>, inInstance: boolean): Promise<void> => {
    if (!Array.isArray(paints)) return;
    const sid = str(styleId);
    for (const p of paints) {
      if (!isObj(p) || p.visible === false) continue;
      const shown = paintOf(p);
      let binding: Binding;
      if (sid) binding = await styleBinding(sid);
      else if (shown.variable) binding = await varBinding(shown.variable as string);
      else binding = { kind: 'raw' };
      const property = prop === 'fills' ? 'fill' : 'stroke';
      const row = { property, role, paint: shown.type as string, color: shown.color as string | null, binding } as const;
      add(paintRows, `${property}|${role}|${row.paint}|${row.color}|${bindKey(binding)}`, row, seen, inInstance);
    }
  };

  const typeBinding = async (styleId: unknown, bv: unknown, field: string): Promise<Binding> => {
    const sid = str(styleId);
    if (sid) return styleBinding(sid);
    const vid = boundIn(bv, field);
    return vid ? varBinding(vid) : { kind: 'raw' };
  };
  const readType = async (run: TextRun, styleId: unknown, seen: Set<string>, inInstance: boolean): Promise<void> => {
    const fn = isObj(run.fontName) ? run.fontName : null;
    const fields: [keyof typeof typeRows, string, string | number | null][] = [
      ['fontFamilies', 'fontFamily', fn ? str(fn.family) : null],
      ['fontStyles', 'fontStyle', fn ? str(fn.style) : null],
      ['fontWeights', 'fontWeight', num(run.fontWeight)],
      ['fontSizes', 'fontSize', num(run.fontSize)],
      ['lineHeights', 'lineHeight', lineHeightOf(run.lineHeight)],
    ];
    for (const [table, field, value] of fields) {
      if (value === null) continue;
      const binding = await typeBinding(styleId, run.boundVariables, field);
      add(typeRows[table], `${value}|${bindKey(binding)}`, { value, binding }, seen, inInstance);
    }
  };

  const CORNERS = ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius'] as const;
  const readRadii = async (node: FactsNode, seen: Set<string>, inInstance: boolean): Promise<void> => {
    if (node.cornerRadius === undefined) return;
    for (const corner of CORNERS) {
      const value = num(node[corner]) ?? num(node.cornerRadius);
      if (value === null) continue;
      const vid = boundIn(node.boundVariables, corner);
      if (value === 0 && !vid) continue;            // a square corner nobody set is not a radius
      const binding: Binding = vid ? await varBinding(vid) : { kind: 'raw' };
      add(radiusRows, `${value}|${bindKey(binding)}`, { value, binding }, seen, inInstance);
    }
  };

  const PADDING = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const;
  const readSpacing = async (node: FactsNode, seen: Set<string>, inInstance: boolean): Promise<void> => {
    if (node.layoutMode !== 'HORIZONTAL' && node.layoutMode !== 'VERTICAL') return;
    const one = async (property: 'gap' | 'wrap-gap' | 'padding', field: string, raw: unknown, auto = false): Promise<void> => {
      const value = auto ? 'auto' : num(raw);
      if (value === null) return;
      const vid = auto ? null : boundIn(node.boundVariables, field);
      const binding: Binding = vid ? await varBinding(vid) : { kind: 'raw' };
      add(spacingRows, `${property}|${value}|${bindKey(binding)}`, { property, value, binding }, seen, inInstance);
    };
    await one('gap', 'itemSpacing', node.itemSpacing, node.primaryAxisAlignItems === 'SPACE_BETWEEN');
    if (node.layoutWrap === 'WRAP') await one('wrap-gap', 'counterAxisSpacing', node.counterAxisSpacing);
    for (const f of PADDING) await one('padding', f, node[f]);
  };

  const countStyles = (node: FactsNode, runs: readonly TextRun[] | null): void => {
    const ids = new Set<string>();
    for (const k of ['fillStyleId', 'strokeStyleId', 'textStyleId', 'effectStyleId', 'gridStyleId'] as const) {
      const id = str(node[k]);
      if (id) ids.add(id);
    }
    for (const r of runs ?? []) for (const id of [str(r.textStyleId), str(r.fillStyleId)]) if (id) ids.add(id);
    for (const id of ids) pending.push(() => styleLayers.set(id, (styleLayers.get(id) ?? 0) + 1));
  };
  const countVars = async (node: FactsNode, runs: readonly TextRun[] | null): Promise<void> => {
    const ids = new Set<string>(aliasIds(node.boundVariables));
    for (const prop of [node.fills, node.strokes]) if (Array.isArray(prop)) for (const p of prop) if (isObj(p)) aliasIds(p.boundVariables).forEach((id) => ids.add(id));
    for (const r of runs ?? []) {
      aliasIds(r.boundVariables).forEach((id) => ids.add(id));
      if (Array.isArray(r.fills)) for (const p of r.fills) if (isObj(p)) aliasIds(p.boundVariables).forEach((id) => ids.add(id));
    }
    for (const id of ids) { await variable(id); pending.push(() => varLayers.set(id, (varLayers.get(id) ?? 0) + 1)); }
  };

  const walk = async (node: FactsNode, page: string, ctx: { icon: boolean; buttonParent: boolean; inInstance: boolean }): Promise<void> => {
    let type: string, name: string;
    try {
      if (node.visible === false) { coverage.hiddenLayers++; return; }
      type = node.type; name = String(node.name ?? '');
    } catch { coverage.unreadableLayers++; return; }   // visibility unknown: the subtree may be hidden, so it is not walked
    // What this layer passes to its children: inherited until the layer's own name has been read.
    let next = { ...ctx, inInstance: ctx.inInstance || type === 'INSTANCE' };
    let children: readonly FactsNode[] | null = null;
    pending = [];
    try {
      let names = WORDS(name);
      if (type === 'COMPONENT') pending.push(() => localDefs.components++);
      if (type === 'COMPONENT_SET') pending.push(() => localDefs.componentSets++);
      if (type === 'INSTANCE') {
        pending.push(() => coverage.instances++);
        const main = await src.mainComponent(node).catch(() => null);
        if (!main) pending.push(() => missingMain++);
        else {
          names += WORDS(main.name) + WORDS(main.setName ?? '');
          pending.push(() => {
            const r = compRows.get(main.id) ?? { comp: main, pages: new Set<string>(), layers: 0, inInstances: 0 };
            r.layers++;
            if (ctx.inInstance) r.inInstances++;
            r.pages.add(page);
            compRows.set(main.id, r);
          });
        }
      }
      const icon = ctx.icon || VECTOR_TYPES.has(type) || ICON_WORD.test(names);
      const buttonSelf = BUTTON_WORD.test(names);
      next = { icon, buttonParent: buttonSelf, inInstance: next.inInstance };
      const isText = type === 'TEXT';
      if (isText) pending.push(() => coverage.textLayers++);

      const runs = isText && src.textRuns && [node.fills, node.fontName, node.fontSize, node.fontWeight, node.lineHeight, node.textStyleId, node.fillStyleId].some(isMixed)
        ? src.textRuns(node) : null;
      const seen = new Set<string>();
      const fillRole: Role = icon ? 'icon' : isText ? 'text' : buttonSelf || ctx.buttonParent ? 'button-like' : 'background';
      const strokeRole: Role = icon ? 'icon' : 'border';
      if (runs && isMixed(node.fills)) for (const r of runs) await readPaints('fills', r.fills, r.fillStyleId, fillRole, seen, ctx.inInstance);
      else await readPaints('fills', node.fills, node.fillStyleId, fillRole, seen, ctx.inInstance);
      await readPaints('strokes', node.strokes, node.strokeStyleId, strokeRole, seen, ctx.inInstance);
      if (isText) {
        if (runs) for (const r of runs) await readType(r, r.textStyleId, seen, ctx.inInstance);
        else await readType(node, node.textStyleId, seen, ctx.inInstance);
      }
      await readRadii(node, seen, ctx.inInstance);
      await readSpacing(node, seen, ctx.inInstance);
      countStyles(node, runs);
      await countVars(node, runs);
      children = node.children ?? [];
      // Every read succeeded: the layer and everything it counted join the report together.
      coverage.layers++;
      for (const commit of pending) commit();
    } catch {
      // A read that throws partway: nothing the layer counted is kept, so `layers` and `unreadableLayers` stay
      // disjoint and no row comes from a layer the report calls unread. Its children are on screen and still walked.
      coverage.unreadableLayers++;
      try { children = node.children ?? []; } catch { children = null; }   // no list to walk: the subtree goes uncounted
    }
    pending = [];
    for (const child of children ?? []) await walk(child, page, next);
  };

  for (const page of src.pages) for (const n of page.children) await walk(n, page.name, { icon: false, buttonParent: false, inInstance: false });

  // ── inventory: the frame-like nodes at the top of the scope (header, INVENTORY) ──
  const scope: FactsScope = src.scope ?? { kind: 'file', from: 'whole-file', ids: [], pages: src.pages.map((p, index) => ({ id: p.id, name: p.name, index })) };
  const pageIndex = new Map(scope.pages.map((p) => [p.id, p.index]));
  // Its own cache, so a collection reached only through a frame's explicit modes does not join `variables`.
  const invColls = new Map<string, FactsCollection | null>();
  const collOf = async (id: string): Promise<FactsCollection | null> => {
    if (colls.has(id)) return colls.get(id) ?? null;
    if (!invColls.has(id)) invColls.set(id, await src.collectionById(id).catch(() => null));
    return invColls.get(id) ?? null;
  };
  const solids = (paints: unknown): string[] => (Array.isArray(paints) ? paints : [])
    .filter((p): p is Record<string, unknown> => isObj(p) && p.visible !== false && p.type === 'SOLID' && isRgb(p.color))
    .map((p) => colorHex(p.color as Rgb, num(p.opacity) ?? 1));
  const inventory: InventoryRow[] = [];
  const inventoryRow = async (node: FactsNode, page: FactsPage, index: number, section: string | null): Promise<void> => {
    let type: string;
    try { if (node.visible === false) return; type = node.type; } catch { return; }   // counted in `coverage` already
    if (!FRAME_LIKE.has(type)) return;
    let kids: readonly FactsNode[] = [];
    try {
      const sub = { descendants: 0, textLayers: 0, instances: 0, hiddenLayers: 0, unreadableLayers: 0 };
      const families = new Set<string>();
      const fills = new Map<string, number>();
      let print = '';
      const visit = (n: FactsNode, depth: number): void => {
        let t: string;
        let children: readonly FactsNode[];
        try { if (n.visible === false) { sub.hiddenLayers++; return; } t = n.type; } catch { sub.unreadableLayers++; print += `${depth}:?;`; return; }
        try {
          const runs = t === 'TEXT' && src.textRuns && (isMixed(n.fontName) || isMixed(n.fills)) ? src.textRuns(n) : null;
          const fams = runs ? runs.map((r) => r.fontName) : [n.fontName];
          const paints = runs && isMixed(n.fills) ? runs.flatMap((r) => (Array.isArray(r.fills) ? r.fills : [])) : n.fills;
          children = n.children ?? [];
          print += `${depth}:${t};`;
          if (depth > 0) sub.descendants++;
          if (t === 'TEXT') {
            sub.textLayers++;
            for (const f of fams) { const fam = isObj(f) ? str(f.family) : null; if (fam) families.add(fam); }
          }
          if (t === 'INSTANCE') sub.instances++;
          for (const c of new Set(solids(paints))) fills.set(c, (fills.get(c) ?? 0) + 1);
        } catch { sub.unreadableLayers++; print += `${depth}:?;`; return; }
        for (const k of children) visit(k, depth + 1);
      };
      visit(node, 0);
      const explicitModes: InventoryRow['explicitModes'] = [];
      const evm = node.explicitVariableModes;
      if (isObj(evm)) for (const [collectionId, modeId] of Object.entries(evm)) {
        const c = await collOf(collectionId);
        explicitModes.push({ collectionId, collection: c?.name ?? null, modeId: String(modeId), mode: c?.modes.find((m) => m.modeId === modeId)?.name ?? null });
      }
      explicitModes.sort((a, b) => cmp(a.collection ?? '', b.collection ?? '') || cmp(a.collectionId, b.collectionId));
      const bg = solids(node.fills);
      inventory.push({
        page: page.name, pageIndex: index, id: node.id, type, name: String(node.name ?? ''), section,
        x: num(node.x), y: num(node.y), width: num(node.width), height: num(node.height),
        background: bg.length ? bg[bg.length - 1] : null,           // the last paint is the topmost
        explicitModes, layoutMode: str(node.layoutMode), layoutGrids: Array.isArray(node.layoutGrids) ? node.layoutGrids.length : 0,
        fingerprint: fnv1a(print), ...sub, families: [...families].sort(cmp),
        fills: [...fills.entries()].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0])).slice(0, INVENTORY_FILLS).map(([color, layers]) => ({ color, layers })),
      });
      if (type === 'SECTION') kids = node.children ?? [];
    } catch { return; }                                                   // an unreadable root: counted in `coverage`
    for (const k of kids) await inventoryRow(k, page, index, node.id);
  };
  for (const [i, page] of src.pages.entries()) for (const n of page.children) await inventoryRow(n, page, pageIndex.get(page.id) ?? i, null);

  // ── variables: every collection and variable the file holds, plus the library ones a binding or alias reached ──
  const resolveValue = async (v: FactsVariable, modeId: string): Promise<Omit<ModeValue, 'mode' | 'modeId'>> => {
    const stored = v.valuesByMode[modeId];
    const first = isAlias(stored) ? await variable(stored.id) : null;
    const alias = isAlias(stored) ? { id: stored.id, name: first?.name ?? null } : null;
    const chain: string[] = [];
    const seenIds = new Set<string>([v.id]);
    let cur: FactsVariable = v;
    let mode = modeId;
    let val: unknown = stored;
    for (;;) {
      if (val === undefined) return { value: plainValue(stored), alias, chain, resolved: null, unresolved: 'no-value' };
      if (!isAlias(val)) return { value: plainValue(stored), alias, chain, resolved: plainValue(val), unresolved: null };
      const target = await variable(val.id);
      if (!target) return { value: null, alias, chain, resolved: null, unresolved: 'missing-variable' };
      chain.push(target.name);
      if (seenIds.has(target.id)) return { value: null, alias, chain, resolved: null, unresolved: 'cycle' };
      seenIds.add(target.id);
      if (target.variableCollectionId !== cur.variableCollectionId) {
        const tc = colls.get(target.variableCollectionId) ?? null;
        mode = tc?.defaultModeId ?? tc?.modes[0]?.modeId ?? mode;
      }
      cur = target;
      val = cur.valuesByMode[mode];
    }
  };
  // Resolve first, so a library variable the alias chains reach is in the maps before they are listed.
  const varRows: FileFactsReport['variables']['variables'] = [];
  const done = new Set<string>();
  for (let pending = [...vars.keys()]; pending.length; pending = [...vars.keys()].filter((id) => !done.has(id))) {
    for (const id of pending) {
      done.add(id);
      const v = vars.get(id);
      if (!v) continue;
      const c = colls.get(v.variableCollectionId) ?? null;
      const values: ModeValue[] = [];
      const modes = c?.modes.length ? c.modes : Object.keys(v.valuesByMode).map((modeId) => ({ modeId, name: modeId }));
      for (const m of modes) values.push({ mode: m.name, modeId: m.modeId, ...(await resolveValue(v, m.modeId)) });
      varRows.push({
        id: v.id, name: v.name, key: v.key ?? null, remote: !!v.remote, collectionId: v.variableCollectionId, collection: c?.name ?? null,
        type: v.resolvedType, scopes: [...(v.scopes ?? [])].sort(), description: v.description ?? '', hiddenFromPublishing: !!v.hiddenFromPublishing,
        values, boundLayers: varLayers.get(v.id) ?? 0,
      });
    }
  }
  varRows.sort((a, b) => cmp(a.collection ?? '', b.collection ?? '') || cmp(a.name, b.name) || cmp(a.id, b.id));
  const collRows = [...colls.values()].filter((c): c is FactsCollection => !!c).map((c) => ({
    id: c.id, name: c.name, key: c.key ?? null, remote: !!c.remote,
    modes: c.modes.map((m) => ({ modeId: m.modeId, name: m.name })),
    defaultMode: c.modes.find((m) => m.modeId === (c.defaultModeId ?? c.modes[0]?.modeId))?.name ?? '',
    variables: varRows.filter((v) => v.collectionId === c.id).length,
  })).sort((a, b) => cmp(a.name, b.name) || cmp(a.id, b.id));

  // ── styles: local ones, and the library ones a layer uses ──
  for (const id of styleLayers.keys()) await style(id);
  const base = (s: FactsStyle): StyleBase => ({ id: s.id, name: s.name, key: s.key ?? null, remote: !!s.remote, description: s.description ?? '', layers: styleLayers.get(s.id) ?? 0 });
  const allStyles = [...styles.values()].filter((s): s is FactsStyle => !!s).sort((a, b) => cmp(a.name, b.name) || cmp(a.id, b.id));
  const styleOut: FileFactsReport['styles'] = { paint: [], text: [], effect: [], grid: [] };
  for (const s of allStyles) {
    const kind = kindOf.get(s.id);
    if (kind === 'paint') styleOut.paint.push({ ...base(s), paints: (s.paints ?? []).filter(isObj).map(paintOf) });
    else if (kind === 'effect') styleOut.effect.push({ ...base(s), effects: (s.effects ?? []).filter(isObj).map(effectOf) });
    else if (kind === 'grid') styleOut.grid.push({ ...base(s), grids: (s.layoutGrids ?? []).filter(isObj).map(gridOf) });
    else if (kind === 'text') styleOut.text.push({
      ...base(s),
      fontFamily: s.fontName ? str(s.fontName.family) : null, fontStyle: s.fontName ? str(s.fontName.style) : null,
      fontSize: num(s.fontSize), lineHeight: lineHeightOf(s.lineHeight), letterSpacing: letterSpacingOf(s.letterSpacing),
      boundVariables: isObj(s.boundVariables) ? Object.keys(s.boundVariables).filter((k) => aliasIds((s.boundVariables as Record<string, unknown>)[k]).length).sort() : [],
    });
  }

  // ── usage rows, sorted by count then identity ──
  const rows = <T>(m: Map<string, Row<T>>): (T & Use)[] =>
    [...m.entries()].sort((a, b) => b[1].layers - a[1].layers || cmp(a[0], b[0])).map(([, r]) => ({ ...r.row, layers: r.layers, inInstances: r.inInstances }));
  const paints = rows(paintRows);
  const typography = {
    fontFamilies: rows(typeRows.fontFamilies), fontStyles: rows(typeRows.fontStyles), fontWeights: rows(typeRows.fontWeights),
    fontSizes: rows(typeRows.fontSizes), lineHeights: rows(typeRows.lineHeights),
  };
  const radii = rows(radiusRows);
  const spacing = rows(spacingRows);

  const used = [...compRows.values()].map((r) => ({
    id: r.comp.id, key: r.comp.key ?? null, name: r.comp.name, set: r.comp.setName ?? null, remote: !!r.comp.remote,
    pages: [...r.pages].sort(), layers: r.layers, inInstances: r.inInstances,
  })).sort((a, b) => b.layers - a.layers || cmp(a.set ?? '', b.set ?? '') || cmp(a.name, b.name) || cmp(a.id, b.id));

  const summarize = (list: { binding: Binding; layers: number }[]) => {
    const s = { variable: 0, style: 0, raw: 0 };
    for (const r of list) s[r.binding.kind] += r.layers;
    return s;
  };
  const remoteKinds = KINDS.map((kind) => {
    const list = allStyles.filter((s) => kindOf.get(s.id) === kind && s.remote);
    return { kind, remote: list.length, boundLayers: list.reduce((n, s) => n + (styleLayers.get(s.id) ?? 0), 0) };
  });
  const remoteColls = collRows.filter((c) => c.remote).map((c) => ({
    id: c.id, key: c.key, name: c.name, variables: c.variables,
    boundLayers: varRows.filter((v) => v.collectionId === c.id).reduce((n, v) => n + v.boundLayers, 0),
  }));
  const remoteComps = used.filter((c) => c.remote);

  return {
    format: FILE_FACTS_FORMAT,
    engineVersion: ENGINE_VERSION,
    roleRule: ROLE_RULE,
    scope,
    coverage,
    inventory,
    variables: { collections: collRows, variables: varRows },
    styles: styleOut,
    usage: { paints, typography, radii, spacing },
    components: { used, missingMain, localDefinitions: localDefs },
    libraries: {
      variableCollections: remoteColls,
      styles: remoteKinds,
      components: { components: remoteComps.length, instances: remoteComps.reduce((n, c) => n + c.layers, 0) },
    },
    bindingSummary: {
      paints: summarize(paints),
      typography: summarize(Object.values(typography).flat()),
      radii: summarize(radii),
      spacing: summarize(spacing),
    },
  };
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const FRAME_LIKE = new Set(['FRAME', 'SECTION', 'COMPONENT_SET']);
/** How many of a row's most-used solid fills the inventory lists. */
const INVENTORY_FILLS = 5;
/** FNV-1a over UTF-16 code units, as 8 hex digits: the inventory's structural fingerprint. */
const fnv1a = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
};

/* ── the scope: which pages and layers a scan reads (header, SCOPE) ────────────────────────────────────────────────── */

export type ScopeRequest =
  | { from: 'whole-file' }
  | { from: 'ids'; ids: readonly string[] }
  /** The current page's id and the ids selected on it (owner decision Q1 A). */
  | { from: 'selection'; page: string; ids: readonly string[] };
export class ScopeError extends Error {}

/**
 * Narrow a file's pages to a scope. Pure over the page trees: it reads ids and child lists, nothing else, and returns
 * the pages to scan (a page in scope as itself; a page holding named layers as a plain `{ id, name, children }` of
 * those layers) with the `FactsScope` the report states. Throws `ScopeError`, by name, for an id the file does not
 * hold, a list naming both pages and layers, an empty explicit list, or a current page that is not in the file.
 */
export const scopePages = (all: readonly FactsPage[], req: ScopeRequest): { pages: FactsPage[]; scope: FactsScope } => {
  const ref = (p: FactsPage) => ({ id: p.id, name: p.name, index: all.indexOf(p) });
  if (req.from === 'whole-file') return { pages: [...all], scope: { kind: 'file', from: 'whole-file', ids: [], pages: all.map(ref) } };
  let search: readonly FactsPage[] = all;
  if (req.from === 'selection') {
    const current = all.find((p) => p.id === req.page);
    if (!current) throw new ScopeError(`scope: the current page ${req.page} is not a page of this file`);
    if (!req.ids.length) return { pages: [current], scope: { kind: 'pages', from: 'current-page', ids: [current.id], pages: [ref(current)] } };
    search = [current];
  } else if (!req.ids.length) throw new ScopeError('scope: an explicit scope names no ids');
  const wanted = new Set(req.ids);
  const pageHits = req.from === 'ids' ? all.filter((p) => wanted.has(p.id)) : [];
  const found = new Set(pageHits.map((p) => p.id));
  const roots = new Map<FactsPage, FactsNode[]>();
  const childrenOf = (n: FactsNode): readonly FactsNode[] => { try { return n.children ?? []; } catch { return []; } };
  const idOf = (n: FactsNode): string | null => { try { return n.id; } catch { return null; } };
  /** Mark every wanted id under a root as covered by it. */
  const cover = (n: FactsNode): void => { for (const k of childrenOf(n)) { const id = idOf(k); if (id && wanted.has(id)) found.add(id); cover(k); } };
  const find = (n: FactsNode, page: FactsPage): void => {
    const id = idOf(n);
    if (id && wanted.has(id)) { found.add(id); roots.get(page)!.push(n); cover(n); return; }
    for (const k of childrenOf(n)) find(k, page);
  };
  if (pageHits.length < wanted.size) for (const page of search) {
    roots.set(page, []);
    for (const n of page.children) find(n, page);
  }
  const missing = req.ids.filter((id) => !found.has(id));
  if (missing.length) throw new ScopeError(`scope: no ${req.from === 'selection' ? 'layer on the current page' : 'page or layer'} with id ${[...new Set(missing)].join(', ')}`);
  const layerPages = [...roots.entries()].filter(([, r]) => r.length);
  if (pageHits.length && layerPages.length)
    throw new ScopeError(`scope: name pages or layers, not both (pages ${pageHits.map((p) => p.id).join(', ')}; layers ${layerPages.flatMap(([, r]) => r.map((n) => n.id)).join(', ')})`);
  if (pageHits.length) return { pages: pageHits, scope: { kind: 'pages', from: 'ids', ids: pageHits.map((p) => p.id), pages: pageHits.map(ref) } };
  return {
    pages: layerPages.map(([p, r]) => ({ id: p.id, name: p.name, children: r })),
    scope: { kind: 'nodes', from: req.from, ids: layerPages.flatMap(([, r]) => r.map((n) => n.id)), pages: layerPages.map(([p]) => ref(p)) },
  };
};

/* ── the snapshot: the same source as plain data, for a CLI ────────────────────────────────────────────────────────── */

/**
 * `FactsSource` as JSON: the local lists and pages as above, an INSTANCE carrying `mainComponentId`, and the library
 * objects the lookups reach in `library`. A text layer's mixed runs are not modeled; a snapshot writes each run as its
 * own value instead. Working format for the #2075 part 2 harness, not a published contract.
 */
export type FactsSnapshot = {
  collections: FactsCollection[]; variables: FactsVariable[]; pages: FactsPage[];
  styles: { paint: FactsStyle[]; text: FactsStyle[]; effect: FactsStyle[]; grid: FactsStyle[] };
  components?: FactsComponent[];
  library?: { collections?: FactsCollection[]; variables?: FactsVariable[]; styles?: FactsStyle[] };
};
export const sourceFromSnapshot = (s: FactsSnapshot): FactsSource => {
  const all = <T extends { id: string }>(...lists: (T[] | undefined)[]) => new Map(lists.flatMap((l) => l ?? []).map((x) => [x.id, x]));
  const v = all(s.variables, s.library?.variables);
  const c = all(s.collections, s.library?.collections);
  const st = all(s.styles.paint, s.styles.text, s.styles.effect, s.styles.grid, s.library?.styles);
  const comps = all(s.components);
  return {
    collections: s.collections, variables: s.variables, styles: s.styles, pages: s.pages,
    variableById: async (id) => v.get(id) ?? null,
    collectionById: async (id) => c.get(id) ?? null,
    styleById: async (id) => st.get(id) ?? null,
    mainComponent: async (n) => comps.get(String((n as { mainComponentId?: unknown }).mainComponentId ?? '')) ?? null,
  };
};
