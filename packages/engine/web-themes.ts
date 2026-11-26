/**
 * Prism3 engine — THE WEB THEMES: the shadcn/ui theme and the Tailwind v4 `@theme` block, projected from a brand's
 * emitted handoff (#2997). PURE — no `node:*`, no I/O — so every surface runs this one projector: regen (`emit-shadcn.ts`,
 * `emit-tailwind.ts`, which only read and write files), the MCP's `export_theme`, the CLI, and Studio's and the plugin's
 * Export (the lane after #2997 that brought the export to a brand of the user's own; the byte-identical rule of #2351).
 *
 * THE HANDOFF is the consumer set a build reads: the base tree plus each mode's overlay, with no `$extensions`, as
 * `<brand>.base.tokens.json` and `<brand>.<mode>.overlay.tokens.json` carry it. On disk `emit-shadcn.ts` reads it; in
 * memory `webThemeHandoff` builds it from a brand's tree with the same `buildOverlaySet` the token export writes those
 * files with, so a brand of the user's own projects through exactly the path a committed brand does.
 *
 * Literal values, not `var(--pds3-…)` aliases: shadcn switches modes with `.dark`, `@prism3/tokens` with
 * `[data-theme="dark"]`, so an alias would not flip.
 *
 * COLOR FORMAT (Q2997.14 A). `oklch()`, converted from the emitted color (a DTCG 2025.10 object, #4123) with `color.ts`, as shadcn's stock themes are.
 * The precision is the smallest that keeps every corpus value on its own 8-bit hex; gate 2 (`lint-shadcn-roundtrip`,
 * #2997 PR 2) proves that through Chromium's own parser, which shares no code with this file. A value with alpha
 * keeps it in the `oklch(L C H / NN%)` form shadcn uses for its dark `border`.
 */
import { hexToRgb, rgbToOklch } from './color';
import { ENGINE_VERSION } from './version';
import {
  SHADCN_COLOR_VARS, SHADCN_DIMENSION_VARS, SHADCN_FONT_FALLBACK, SHADCN_MAP_VERSION, SHADCN_THEME_VARS,
} from './projections/shadcn';
import { shadowModeVar, TAILWIND_DIMENSIONS, TAILWIND_FONTS, TAILWIND_MAP_VERSION, TAILWIND_SHADOWS } from './projections/tailwind';
import { buildOverlaySet } from './emit-dtcg-overlay';

type Tree = Record<string, unknown>;
type Token = { $type?: string; $value?: unknown };

/** shadcn's two modes, and the emitted overlay that supplies each (light is the base itself). */
export const SHADCN_MODES = { light: null, dark: 'dark' } as const;
export type ShadcnMode = keyof typeof SHADCN_MODES;

export type Handoff = { brand: string; root: string; base: Tree; overlays: Partial<Record<string, Tree>> };

/**
 * THE BRAND'S NAME IN ITS THEME FILES (#4609 review): the one rule every surface names a brand by, in the file names,
 * the CSS header and the registry item's `name` and `title`. Studio's slug, word for word: the id trimmed, each run of
 * whitespace one `-`, and `brand` for an empty one. So `"  Acme Brand "` is `Acme-Brand` in Studio, in the plugin, in
 * `export_theme` and from the CLI alike, and a registry item's name is a slug. A committed brand's id already is one,
 * so its files do not move. `handoffOf` applies it, so no surface can build a handoff under another name.
 */
export const brandSlug = (id: unknown): string => String(id || 'brand').trim().replace(/\s+/g, '-') || 'brand';

/**
 * A handoff from the consumer set's files as objects: the base file (`{ <root>: … }`) and each mode's overlay file, as
 * `buildOverlaySet` returns them and as `<brand>.base.tokens.json` and its overlays hold them. Every mode shadcn needs
 * must have its overlay, and the base must have one root; either missing throws, naming the brand.
 */
export const handoffOf = (brand: string, base: unknown, overlays: ReadonlyArray<{ mode: string; tree: unknown }>): Handoff => {
  const baseFile = (base ?? {}) as Tree;
  const roots = Object.keys(baseFile);
  if (roots.length !== 1) throw new Error(`${brand}.base.tokens.json: expected one root, found ${roots.length}`);
  const root = roots[0]!;
  const byMode = new Map(overlays.map((o) => [o.mode, o.tree as Tree]));
  const out: Partial<Record<string, Tree>> = {};
  for (const m of Object.values(SHADCN_MODES)) {
    if (!m) continue;
    const t = byMode.get(m);
    if (!t) throw new Error(`${brand}: no ${brand}.${m}.overlay.tokens.json in the handoff`);
    out[m] = (t[root] ?? {}) as Tree;
  }
  return { brand: brandSlug(brand), root, base: baseFile[root] as Tree, overlays: out };
};

/** A brand's handoff, built in memory from its token tree (`buildTree(theme).tree`) with the consumer set's own
 *  `buildOverlaySet`, no metadata: the same files the token export downloads and regen commits. */
export const webThemeHandoff = (tree: unknown, brand: string): Handoff => {
  const set = buildOverlaySet(tree);
  return handoffOf(brand, set.base, set.overlays);
};

const at = (tree: Tree | undefined, path: string): Token | undefined => {
  let node: unknown = tree;
  for (const k of path.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Tree)[k];
  }
  return node && typeof node === 'object' && '$value' in (node as Tree) ? (node as Token) : undefined;
};

/** A role's resolved `$value` in one mode: the overlay's token first, then the base's, following brace aliases the same
 *  way at every hop. Throws naming the role when it does not resolve. */
export const resolveRole = (h: Handoff, role: string, mode: ShadcnMode): { type: string; value: unknown } => {
  const overlay = SHADCN_MODES[mode] ? h.overlays[SHADCN_MODES[mode]!] : undefined;
  let path = role;
  for (let hop = 0; hop < 16; hop++) {
    const tok = at(overlay, path) ?? at(h.base, path);
    if (!tok) throw new Error(`${h.brand} ${mode}: ${path} is not in the handoff${path === role ? '' : ` (aliased from ${role})`}`);
    const v = tok.$value;
    const alias = typeof v === 'string' ? /^\{([^}]+)\}$/.exec(v) : null;
    if (!alias) return { type: tok.$type ?? '', value: v };
    if (!alias[1]!.startsWith(`${h.root}.`)) throw new Error(`${h.brand} ${mode}: ${path} aliases outside ${h.root}: ${v}`);
    path = alias[1]!.slice(h.root.length + 1);
  }
  throw new Error(`${h.brand} ${mode}: ${role} — alias chain deeper than 16`);
};

const trim = (v: number, places: number): string => {
  const s = v.toFixed(places).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
};

/** An emitted color as its 8-bit channels and an alpha in [0, 1]. Two spellings reach it: the handoff's DTCG 2025.10
 *  Color-module object (#4123) — `{ colorSpace: "srgb", components: [r, g, b] (0–1), alpha?, hex? }`, read from its
 *  `components`, as stock Style Dictionary reads it — and a string, `#rrggbb`, `#rrggbbaa`, or `rgb()`/`rgba()` for a
 *  brand whose `colorFormat` is rgb (the canonical tree's spelling). Throws on anything else, a color space other than
 *  srgb included, so a new emitted format fails here by name. Its own reading of the spec: it shares no code with the
 *  engine's `conformColor`. */
export const parseEmittedColor = (value: unknown): { r: number; g: number; b: number; alpha: number } => {
  if (value && typeof value === 'object') {
    const o = value as { colorSpace?: unknown; components?: unknown; alpha?: unknown };
    const cs = Array.isArray(o.components) ? o.components : [];
    if (o.colorSpace !== 'srgb') throw new Error(`not an srgb color object (colorSpace ${JSON.stringify(o.colorSpace)}): ${JSON.stringify(value)}`);
    if (cs.length !== 3 || !cs.every((c) => typeof c === 'number' && c >= 0 && c <= 1)) throw new Error(`not a color object's three 0–1 components: ${JSON.stringify(value)}`);
    const alpha = o.alpha === undefined ? 1 : o.alpha;
    if (typeof alpha !== 'number' || alpha < 0 || alpha > 1) throw new Error(`not a color object's 0–1 alpha: ${JSON.stringify(value)}`);
    const [r, g, b] = (cs as number[]).map((c) => Math.round(c * 255));
    return { r: r!, g: g!, b: b!, alpha };
  }
  if (typeof value !== 'string') throw new Error(`not an emitted color: ${JSON.stringify(value)}`);
  const v = value.trim();
  const hx = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(v);
  if (hx) return { ...hexToRgb(hx[1]!), alpha: hx[2] ? parseInt(hx[2], 16) / 255 : 1 };
  const fn = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([0-9.]+)\s*)?\)$/.exec(v);
  if (fn) return { r: Number(fn[1]), g: Number(fn[2]), b: Number(fn[3]), alpha: fn[4] === undefined ? 1 : Number(fn[4]) };
  throw new Error(`not an emitted color: ${value}`);
};

/** An emitted dimension as a CSS length: the handoff's DTCG 2025.10 `{ value, unit }` (#4123), or the canonical
 *  tree's string (`"16px"`, `"0.5rem"`), passed through. Throws on anything else. */
export const dimensionCss = (value: unknown): string => {
  if (typeof value === 'string') return value;
  const o = (value && typeof value === 'object' ? value : {}) as { value?: unknown; unit?: unknown };
  if (typeof o.value !== 'number' || !Number.isFinite(o.value) || (o.unit !== 'px' && o.unit !== 'rem')) {
    throw new Error(`not an emitted dimension: ${JSON.stringify(value)}`);
  }
  return `${o.value}${o.unit}`;
};

/** An emitted color as CSS `oklch()`. L as a fraction, four places; C four places; H two places, and 0 for a color
 *  with no hue (CSS Color 4's convention, which shadcn's grays use). Alpha below 1 is written as a percentage. */
export const toOklchCss = (value: unknown): string => {
  const { r, g, b, alpha } = parseEmittedColor(value);
  const { l, c, h: hue } = rgbToOklch({ r, g, b });
  const cs = trim(c, 4);
  const hs = hue === null || cs === '0' ? '0' : trim(hue, 2);
  const body = `${trim(l, 4)} ${cs} ${hs}`;
  return alpha >= 1 ? `oklch(${body})` : `oklch(${body} / ${trim(alpha * 100, 2)}%)`;
};

const colorValue = (h: Handoff, role: string, mode: ShadcnMode): string => {
  const { type, value } = resolveRole(h, role, mode);
  if (type !== 'color') throw new Error(`${h.brand} ${mode}: ${role} is not a color (${type})`);
  return toOklchCss(value);
};

export const dimensionValue = (h: Handoff, role: string): string => {
  const { type, value } = resolveRole(h, role, 'light');
  if (type !== 'dimension') throw new Error(`${h.brand}: ${role} is not a dimension (${type})`);
  return dimensionCss(value);
};

export const fontValue = (h: Handoff, key: string, role: string): string => {
  const { type, value } = resolveRole(h, role, 'light');
  const families = (Array.isArray(value) ? value : [value]).map(String);
  if (type !== 'fontFamily' || !families.length) throw new Error(`${h.brand}: ${role} is not a font family (${type})`);
  const quote = (f: string): string => (/^[A-Za-z-]+$/.test(f) ? f : `"${f.replace(/"/g, '\\"')}"`);
  const fallback = SHADCN_FONT_FALLBACK[key];
  return [...families.map(quote), ...(fallback ? [fallback] : [])].join(', ');
};

/** One mode's shadcn variables, in map order: every color row, and `radius` in light only, as shadcn writes it. */
export const shadcnModeVars = (h: Handoff, mode: ShadcnMode): Array<[string, string]> => [
  ...Object.entries(SHADCN_COLOR_VARS).map(([k, role]): [string, string] => [k, colorValue(h, role, mode)]),
  ...(mode === 'light' ? Object.entries(SHADCN_DIMENSION_VARS).map(([k, role]): [string, string] => [k, dimensionValue(h, role)]) : []),
];

export const shadcnThemeVars = (h: Handoff): Array<[string, string]> =>
  Object.entries(SHADCN_THEME_VARS).map(([k, role]): [string, string] =>
    [k, k.startsWith('font-') ? fontValue(h, k, role) : dimensionValue(h, role)]);

const stamp = (brand: string): string =>
  `${brand} — a shadcn/ui theme generated by the Prism3 engine ${ENGINE_VERSION}, shadcn map ${SHADCN_MAP_VERSION}.`;

/** The plain CSS file: `:root` and `.dark`, the way shadcn's own `globals.css` carries a theme. */
export const shadcnCss = (h: Handoff): string => {
  const block = (sel: string, vars: Array<[string, string]>): string =>
    `${sel} {\n${vars.map(([k, v]) => `  --${k}: ${v};`).join('\n')}\n}\n`;
  return [
    `/* ${stamp(h.brand)} Do not edit: regenerate. */\n`,
    block(':root', shadcnModeVars(h, 'light')),
    block('.dark', shadcnModeVars(h, 'dark')),
  ].join('\n');
};

/** The stock selectors that fade the box-shadow focus ring to 50%, as stock Tailwind 4.3.3 compiles each `ring-ring/50`
 *  form shadcn/ui uses: `focus-visible:` (Button, Input, Select, Checkbox, Switch, Badge, Tabs, Textarea and more),
 *  the Slider thumb's unconditional class, the Calendar's `has-focus:` and its focused day, the Input OTP's active slot,
 *  `focus-within:` (Combobox, Attachment), the Input Group's control and Bubble's `[button,a]:` (#4386, owner decision
 *  2026-11-24 A on #4575: every shadcn focus ring at full strength). Each mirrors the stock rule's own selector, so the
 *  override applies exactly where stock fades the ring. */
export const SHADCN_RING_FORMS: readonly string[] = [
  '.focus-visible\\:ring-ring\\/50:focus-visible',
  '.ring-ring\\/50',
  '.has-focus\\:ring-ring\\/50:has(:focus)',
  '.group-data-\\[focused\\=true\\]\\/day\\:ring-ring\\/50:is(:where(.group\\/day)[data-focused="true"] *)',
  '.data-\\[active\\=true\\]\\:ring-ring\\/50[data-active="true"]',
  '.focus-within\\:ring-ring\\/50:focus-within',
  '.has-\\[\\[data-slot\\=input-group-control\\]\\:focus-visible\\]\\:ring-ring\\/50:has(:is([data-slot=input-group-control]:focus-visible))',
  '.\\[button\\,a\\]\\:focus-visible\\:ring-ring\\/50:is(button, a):focus-visible',
];
/** The one selector the ring rule carries: every form, minus an invalid field. Stock shadcn draws that ring in
 *  `destructive`, flagged on the element itself (`aria-invalid:ring-destructive/20`) or on a field inside it
 *  (`has-aria-invalid:`, the Combobox), and the rule leaves both alone. */
export const SHADCN_RING_SELECTOR = `:is(${SHADCN_RING_FORMS.join(', ')}):not([aria-invalid="true"], :has([aria-invalid="true"]))`;

/** Q2997.17 B: stock shadcn's scaffold fades the focus outline to 50% (`outline-ring/50`), below 3:1 on the page. The
 *  registry item restores the full-strength outline the theme's own `ring` was measured at.
 *
 *  #4386 (owner decision 2026-11-24, A for the ring): shadcn's components focus with a box-shadow ring instead, drawn
 *  in `ring-ring/50` through one of the forms in `SHADCN_RING_FORMS`, which the outline rule never reaches. The second
 *  rule sets that ring's color back to the full `--ring`. It is the one non-stock rule here: `!important` because the
 *  stock classes live in the later `utilities` layer, and an important declaration in an earlier layer outranks them.
 *  It is tied to shadcn's class names, so a renamed class orphans it; `lint-shadcn-contrast` measures every form at 50%
 *  with this rule applied, and fails by name if it stops reaching one. The plain `<brand>.css` carries neither rule. */
export const SHADCN_BASE_CSS = {
  '@layer base': {
    '*': { '@apply outline-ring': {} },
    [SHADCN_RING_SELECTOR]: { '--tw-ring-color': 'var(--ring) !important' },
  },
} as const;

/** The registry item's `docs` line (owner decision 2026-11-24 A on #4575, wording approved): a pointer to the full
 *  consumer note, the `### The shadcn/ui theme` section of `apps/studio/README.md`. */
export const SHADCN_DOCS = 'Focus rings draw at full strength. Three stock classes still draw text under 4.5:1; the one-class edit for each is in the Prism3 README: https://github.com/prism-ds/prism3/blob/main/apps/studio/README.md#the-shadcnui-theme';

/** The `registry:theme` item `npx shadcn add <url>` installs. */
export const shadcnRegistryItem = (h: Handoff): Record<string, unknown> => ({
  $schema: 'https://ui.shadcn.com/schema/registry-item.json',
  name: h.brand,
  type: 'registry:theme',
  title: h.brand,
  // DRAFT copy (#2997): the owner settles the wording.
  description: `Generated by the Prism3 engine ${ENGINE_VERSION}, shadcn map ${SHADCN_MAP_VERSION}.`,
  cssVars: {
    theme: Object.fromEntries(shadcnThemeVars(h)),
    light: Object.fromEntries(shadcnModeVars(h, 'light')),
    dark: Object.fromEntries(shadcnModeVars(h, 'dark')),
  },
  css: SHADCN_BASE_CSS,
  docs: SHADCN_DOCS,
});

/** A shadow layer as the handoff writes it: color and lengths in DTCG 2025.10 object forms (#4123), or a color alias. */
type Layer = { color: unknown; offsetX: unknown; offsetY: unknown; blur: unknown; spread: unknown; inset?: boolean };

/** A DTCG shadow (one layer or several) as a CSS `box-shadow` value, its colors in `oklch()`. */
export const shadowCss = (h: Handoff, role: string, mode: ShadcnMode): string => {
  const { type, value } = resolveRole(h, role, mode);
  const layers = (Array.isArray(value) ? value : [value]) as Layer[];
  if (type !== 'shadow' || !layers.length) throw new Error(`${h.brand} ${mode}: ${role} is not a shadow (${type})`);
  return layers.map((l) => {
    const color = typeof l.color === 'string' && /^\{/.test(l.color) ? resolveRole(h, l.color.slice(h.root.length + 2, -1), mode).value : l.color;
    const len = [l.offsetX, l.offsetY, l.blur, l.spread].map(dimensionCss).join(' ');
    return `${l.inset ? 'inset ' : ''}${len} ${toOklchCss(color)}`;
  }).join(', ');
};

export const tailwindThemeCss = (h: Handoff): string => {
  const block = (sel: string, vars: Array<[string, string]>): string =>
    `${sel} {\n${vars.map(([k, v]) => `  --${k}: ${v};`).join('\n')}\n}\n`;
  const shadows = (mode: ShadcnMode): Array<[string, string]> =>
    Object.entries(TAILWIND_SHADOWS).map(([k, role]): [string, string] => [shadowModeVar(k), shadowCss(h, role, mode)]);
  const theme: Array<[string, string]> = [
    ...Object.keys(SHADCN_COLOR_VARS).map((k): [string, string] => [`color-${k}`, `var(--${k})`]),
    ...Object.entries(TAILWIND_DIMENSIONS).map(([k, role]): [string, string] => [k, dimensionValue(h, role)]),
    ...Object.entries(TAILWIND_FONTS).map(([k, role]): [string, string] => [k, fontValue(h, k, role)]),
    ...Object.keys(TAILWIND_SHADOWS).map((k): [string, string] => [k, `var(--${shadowModeVar(k)})`]),
  ];
  return [
    `/* ${h.brand} — a Tailwind v4 theme generated by the Prism3 engine ${ENGINE_VERSION}, tailwind map ${TAILWIND_MAP_VERSION}. Do not edit: regenerate. */\n`,
    block(':root', [...shadcnModeVars(h, 'light'), ...shadows('light')]),
    block('.dark', [...shadcnModeVars(h, 'dark'), ...shadows('dark')]),
    block('@theme inline', theme),
  ].join('\n');
};


/** One web-theme file: `path` is where regen, the CLI and the MCP write it (`shadcn/<brand>.css`), `name` is what a
 *  browser download is called (no directories there), and `text` is its bytes. */
export type WebThemeFile = { path: string; name: string; text: string };

/** The shadcn/ui theme: the plain `:root`/`.dark` CSS, and the registry item (which alone carries the focus-ring rule
 *  and the `docs` pointer, `SHADCN_BASE_CSS`). The one serialization every surface writes. */
export const shadcnFiles = (h: Handoff): WebThemeFile[] => [
  { path: `shadcn/${h.brand}.css`, name: `${h.brand}.shadcn.css`, text: shadcnCss(h) },
  { path: `shadcn/${h.brand}.registry-item.json`, name: `${h.brand}.shadcn.registry-item.json`, text: `${JSON.stringify(shadcnRegistryItem(h), null, 2)}\n` },
];

/** The Tailwind v4 theme: one self-contained file a project imports after `tailwindcss`. */
export const tailwindFiles = (h: Handoff): WebThemeFile[] => [
  { path: `tailwind/${h.brand}.theme.css`, name: `${h.brand}.tailwind.theme.css`, text: tailwindThemeCss(h) },
];
