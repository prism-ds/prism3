/**
 * Prism3 engine — the MCP's component surface (#4467, owner decision A, 2026-11-25): `list_components` and
 * `get_component`, two read-only views over the component contract, so an agent asks for one component instead of
 * reading the whole export (about 1.5 MB brand-neutral, 3.7 MB for a brand, `export_theme include:["componentSpecs"]`).
 *
 * PURE — no `node:*`, no I/O. Both views are GENERATED: `list_components` reads `componentDefs`, and `get_component`
 * reads the one def's entry from `exportComponentDefs`, the function `regen` writes the committed export with and
 * `export_theme` writes a brand's with. Nothing here restates a def; a field a def gains reaches the export first.
 *
 * WITH A BRAND, `get_component` builds the entry the way a brand's export does: the def resolved against the brand's
 * component settings (`brandMaterializer`), so its token NAMES are the ones this brand binds (a pill brand's Button
 * binds `radius.capsule`, not `radius.md`). Then it adds `values`: each named token's value for that brand, a color's
 * hex in every mode (`resolveAllModes`, the resolver `score_consumption` checks contrast with) and any other token's
 * value at the end of its alias chain (`deref`). A composite (a text style) has no single value, so it is named only.
 * WITHOUT A BRAND, the answer is brand-neutral: token names only, at the default settings.
 *
 * MOTION: the def's prose, its `motion.*` bindings, and its patterns (#4601): each pattern it names, with the tracks
 * that move and the preset each plays on, a brand's track overrides applied.
 */
import type { BrandInput, Theme } from './theme';
import type { ComponentDef } from './component-schema';
import type { ComponentSpec } from './component-specs';
import { exportComponentDefs } from './component-defs-export';
import { resolveAllModes } from './modes';
import { at, deref } from './tree';
import { MOTION_PATTERNS, type MotionPattern } from './motion-patterns';

/** One row of `list_components`: enough to choose, nothing to build from. */
export type ComponentListing = { id: string; name: string; summary: string; status: string };

/** Every registered def, in registry order. */
export const listComponents = (defs: readonly ComponentDef[]): ComponentListing[] =>
  defs.map((d) => ({ id: d.id, name: d.name, summary: d.summary ?? '', status: d.status }));

/** The properties a part binds a token on, in the spec's reading order: geometry, then type, then paint. */
type PartTokens = Record<string, string[]>;

/** Each part of the spec, with every token it binds on any member, grouped by the property it binds. */
const partsOf = (spec: ComponentSpec): { part: string; kind: string; when?: Record<string, string[]>; tokens: PartTokens }[] => {
  const byPart = new Map<string, Map<string, Set<string>>>();
  const add = (part: string, prop: string, token: string | undefined) => {
    if (!token) return;
    const m = byPart.get(part) ?? byPart.set(part, new Map()).get(part)!;
    (m.get(prop) ?? m.set(prop, new Set()).get(prop)!).add(token);
  };
  for (const row of spec.redlines) for (const p of row.parts) for (const [prop, v] of Object.entries(p.values)) if (v && 'token' in v) add(p.part, prop, v.token);
  for (const row of spec.type) for (const p of row.parts) add(p.part, 'textStyle', p.textStyle);
  for (const row of spec.colors) for (const p of row.parts) {
    for (const prop of ['fill', 'stroke', 'ink', 'icon'] as const) add(p.part, prop, p[prop]);
    for (const g of p.gradient ?? []) add(p.part, 'gradient', g);
  }
  return spec.anatomy.map((a) => ({
    part: a.part, kind: a.kind, ...(a.when ? { when: a.when } : {}),
    tokens: Object.fromEntries([...(byPart.get(a.part) ?? new Map<string, Set<string>>())].map(([k, s]) => [k, [...s]])),
  }));
};

/** Each motion pattern the def names (#4601, motion phase 2: `motionOf` in the def), as the pattern file holds it: its
 *  tracks, each naming the preset it plays on. With a brand, the patterns the brand resolved (`theme.motion.patterns`:
 *  its track overrides applied, against its own presets), the same ones every other brand output reads. Absent on a
 *  def that names none. */
const motionPatternsOf = (def: ComponentDef, theme?: Theme): MotionPattern[] | undefined => {
  const names = (def.motion as { patterns?: string[] } | undefined)?.patterns;
  if (!names?.length) return undefined;
  const all: readonly MotionPattern[] = (theme?.motion as { patterns?: MotionPattern[] } | undefined)?.patterns ?? MOTION_PATTERNS;
  return names.flatMap((n) => all.filter((p) => p.name === n));
};

/** A token's value for a brand: a color's hex per mode, or another token's value at the end of its alias chain. */
const valueOf = (ref: string, tree: unknown, root: string, colors: Map<string, Record<string, string>>): unknown => {
  const role = ref.replace(/^color\./, '');
  if (ref.startsWith('color.') && colors.has(role)) return colors.get(role);
  const node = at(tree, `${root}.${ref}`);
  if (!node || node.$value === undefined) return undefined;
  const end = deref(tree, node);
  return end?.$value;
};

export type ComponentView = Record<string, unknown>;

/**
 * One def's contract, condensed for an agent: its code API (props, variants, states), its parts with the tokens each
 * may bind, when to use it and when not, its partners, and its motion. `brand` adds the brand's names and values.
 * `undefined` when no registered def has the id.
 */
export const getComponent = (defs: readonly ComponentDef[], id: string, brand?: { input: BrandInput; theme: Theme; tree: unknown }): ComponentView | undefined => {
  const d = defs.find((x) => x.id === id);
  if (!d) return undefined;
  const entry = exportComponentDefs([d], brand ? { brand: brand.input } : {}).components[d.id];
  const def = entry.def as Record<string, any>;
  const spec = entry.spec;
  const parts = spec ? partsOf(spec) : Object.entries(d.anatomy?.parts ?? {}).map(([part, p]) => ({ part, kind: p.kind, tokens: {} }));
  const named = [...new Set([...parts.flatMap((p) => Object.values(p.tokens).flat()), ...Object.values(spec?.motion ?? {})])];
  let values: Record<string, unknown> | undefined;
  if (brand) {
    const colors = new Map<string, Record<string, string>>();
    for (const m of resolveAllModes(brand.theme)) for (const [role, r] of Object.entries(m.roles)) if (r?.hex) (colors.get(role) ?? colors.set(role, {}).get(role)!)[m.mode] = r.hex;
    values = {};
    for (const ref of named) { const v = valueOf(ref, brand.tree, brand.theme.root, colors); if (v !== undefined) values[ref] = v; }
  }
  const patterns = motionPatternsOf(d, brand?.theme);
  return {
    id: d.id,
    name: def.name,
    status: def.status,
    summary: def.summary,
    brand: brand ? { id: brand.theme.id, root: brand.theme.root, modes: brand.theme.modes } : null,
    props: def.props ?? [],
    variants: def.variants ?? {},
    states: def.states ?? [],
    parts,
    ...(values ? { values } : {}),
    whenToUse: def.ai?.whenToUse,
    avoidWhen: def.ai?.avoidWhen,
    partners: {
      commonPartners: def.ai?.commonPartners ?? [],
      composesWith: def.composition?.composesWith ?? [],
      alternativeTo: def.composition?.alternativeTo ?? [],
    },
    motion: { ...(def.motion ? { prose: def.motion } : {}), bindings: spec?.motion ?? {}, ...(patterns !== undefined ? { patterns } : {}) },
    digest: entry.digest,
  };
};
