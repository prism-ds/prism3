/**
 * THE COMPONENT MANIFEST (#4469 part 2, owner decision "The manifest → A", 2026-11-25).
 *
 * WHAT IT IS. A small, machine-readable list of the component sets Prism3 built in this file, kept in the file's root
 * SHARED plugin data (namespace `prism3`, key `MANIFEST_KEY`), where an agent reads it with one call instead of
 * hunting through the file's whole library listing. Per set: the def it was built from, the set's name, the node id an
 * agent places it by, and each property the set carries with its allowed values and its default. Nothing is drawn on
 * the canvas. The plugin also offers it as a download (Docs › Spec drawings › Export manifest).
 *
 * WHY SHARED PLUGIN DATA. Private plugin data (`setPluginData`) is readable only by the plugin that wrote it. An agent
 * reaches the file through its own plugin run (a desktop bridge, an MCP that runs plugin code), which has another
 * plugin id, so it could never read it. Shared plugin data is "readable by any plugin" (docs/18 §8a), which is the
 * point. It holds node ids and the names a designer already sees in the file: never a file key or a file name, so a
 * copy is safe to keep beside the file. Those still never go into this repo, which `skills/prism3-rebind` states.
 *
 * GENERATED, NEVER WRITTEN BY HAND. Every field below is read off the plans the executor builds the set from
 * (`figmaAnatomySet` of the def materialized for the file's brand), the same plans a build and an update hand
 * `applyComponentPlan`. The variant properties are the member names' coordinates (`planComponentName`), which is what
 * Figma derives a set's variant properties from when it combines the members; the others are `planSetProperties`,
 * the list the executor creates with `addComponentProperty`. The one live fact is the node id, taken from the set the
 * executor just built or updated.
 *
 * A VARIANT'S DEFAULT is the coordinate of the set's first member, the first plan: Figma's `defaultVariant` is the
 * set's first child, which is the first member the executor creates (`write-components.ts`, `CompSetRef`). So the
 * default here is the variant an agent gets from `set.defaultVariant.createInstance()`.
 *
 * IT DOUBLES AS A PARITY CHECK against the component contract (`manifestParity`): every set names a contract component,
 * and every variant axis it carries, its values and its default agree with the contract's. `test-component-manifest.ts`
 * runs it over the whole catalog against the committed baseline (`schema/component-contract.json`), which only
 * `component-contract.ts --accept` writes, so the two sides come from different places.
 *
 * WHAT IT DOES NOT LIST: a def built as standalone components (`figmaProperties.emitAsComponents`: the icons, the
 * spinner). There is no set, so no one id to place it by.
 *
 * Pure: the root is passed in, so a Node test drives it on a fake. A missing, unreadable or malformed record reads as
 * empty, never a throw.
 */
import { planComponentName, planSetProperties, type AnatomyPlan } from '@prism3/engine/components';

/** The shared-plugin-data namespace and key. DRAFT names, for owner approval (#4469). */
export const MANIFEST_NS = 'prism3';
export const MANIFEST_KEY = 'componentManifest';
/** The record's format. A record in another one reads as empty and is rewritten whole. */
export const MANIFEST_V = 1;
/** Figma's ceiling for one shared-plugin-data entry: "The total size of your entry (`namespace`, `key`, `value`) cannot
 *  exceed 100 kB" (docs/18 §8a). A record over it is refused here, by name, before Figma refuses it. */
export const MANIFEST_MAX_BYTES = 100_000;

/** One property of a set, as Figma shows it in the properties panel. `name` is the panel's name. A non-variant
 *  property's key in `componentPropertyDefinitions` is this name plus Figma's `#<id>` suffix.
 *  · VARIANT: `values` in the order the members carry them; `default` the first member's; `axis` the def's code name
 *    where the panel's name differs; `slot` on a slot-presence coordinate (`leading icon=true`), which the code
 *    contract carries as a slot, not a variant.
 *  · INSTANCE_SWAP: `default` is the NAME of the component the swap starts on.
 *  · SLOT: a native slot; Figma gives it no default. */
export type ManifestProperty =
  | { readonly name: string; readonly type: 'VARIANT'; readonly values: readonly string[]; readonly default: string; readonly axis?: string; readonly slot?: true }
  | { readonly name: string; readonly type: 'TEXT'; readonly default: string }
  | { readonly name: string; readonly type: 'BOOLEAN'; readonly default: boolean }
  | { readonly name: string; readonly type: 'INSTANCE_SWAP'; readonly default: string }
  | { readonly name: string; readonly type: 'SLOT' };
export type ManifestSet = { readonly def: string; readonly name: string; readonly id: string; readonly properties: readonly ManifestProperty[] };
/** `engine`: the `ENGINE_VERSION` of the plugin that last wrote the record. `sets` in the order they were first recorded. */
export type Manifest = { readonly v: typeof MANIFEST_V; readonly engine: string; readonly sets: readonly ManifestSet[] };

type DataRoot = { getSharedPluginData?(ns: string, key: string): string; setSharedPluginData?(ns: string, key: string, value: string): void };

/** The member name's coordinate, `key=value, …`, as pairs in name order. */
const coordOf = (plan: AnatomyPlan): [string, string][] =>
  planComponentName(plan).split(', ').filter(Boolean).map((seg) => {
    const i = seg.indexOf('=');
    return [seg.slice(0, i), seg.slice(i + 1)];
  });

/**
 * A set's manifest entry, from the plans it is built from and the node the executor built. Throws where the plans
 * cannot be a set (no plans, or a coordinate key the first member does not carry), as the executor would refuse them.
 */
export const manifestSetOf = (def: string, plans: readonly AnatomyPlan[], id: string): ManifestSet => {
  if (!plans.length) throw new Error(`${def}: no plans, so no set to list`);
  const first = plans[0];
  // The panel name → the def's code name, for an axis or a slot whose panel name differs (#2571, #1309).
  const codeOf = new Map<string, string>();
  for (const [code, fig] of Object.entries(first.axisFigmaNames ?? {})) codeOf.set(fig, code);
  for (const [code, fig] of Object.entries(first.slotFigmaNames ?? {})) codeOf.set(fig, code);
  const slots = new Set(first.slotAxes);
  const values = new Map<string, string[]>();
  for (const p of plans) for (const [k, v] of coordOf(p)) {
    const vs = values.get(k) ?? [];
    if (!vs.includes(v)) vs.push(v);
    values.set(k, vs);
  }
  const defaults = new Map(coordOf(first));
  const variants: ManifestProperty[] = [...values].map(([name, vs]) => {
    const d = defaults.get(name);
    if (d === undefined) throw new Error(`${def}: the first member carries no '${name}', so the set has no default for it`);
    const code = codeOf.get(name) ?? name;
    return { name, type: 'VARIANT', values: vs, default: d, ...(code !== name ? { axis: code } : {}), ...(slots.has(code) ? { slot: true as const } : {}) };
  });
  const others: ManifestProperty[] = planSetProperties([...plans]).map((p) =>
    p.type === 'TEXT' ? { name: p.name, type: 'TEXT', default: p.default }
      : p.type === 'BOOLEAN' ? { name: p.name, type: 'BOOLEAN', default: p.default }
        : p.type === 'INSTANCE_SWAP' ? { name: p.name, type: 'INSTANCE_SWAP', default: p.swapTarget }
          : { name: p.name, type: 'SLOT' });
  return { def, name: first.component, id, properties: [...variants, ...others] };
};

const isSet = (x: unknown): x is ManifestSet => {
  const s = x as ManifestSet | null;
  return !!s && typeof s.def === 'string' && typeof s.name === 'string' && typeof s.id === 'string' && Array.isArray(s.properties);
};

/** The record in the file, or `null` when there is none or it cannot be read (another format, malformed). */
export const readManifest = (root: DataRoot): Manifest | null => {
  let raw = '';
  try { raw = root.getSharedPluginData?.(MANIFEST_NS, MANIFEST_KEY) ?? ''; } catch { return null; }
  if (!raw) return null;
  try {
    const m = JSON.parse(raw) as Manifest;
    return m && m.v === MANIFEST_V && typeof m.engine === 'string' && Array.isArray(m.sets) && m.sets.every(isSet) ? m : null;
  } catch { return null; }
};

/** The record as it is stored: compact JSON. */
export const manifestText = (m: Manifest): string => JSON.stringify(m);

/** The bytes the entry takes against `MANIFEST_MAX_BYTES`: namespace, key and value, UTF-8. Counted by hand: the
 *  plugin's main thread has no `TextEncoder`. A surrogate pair is one 4-byte code point. */
export const entryBytes = (text: string): number => {
  const all = MANIFEST_NS + MANIFEST_KEY + text;
  let n = 0;
  for (let i = 0; i < all.length; i++) {
    const c = all.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c < 0xdc00 && i + 1 < all.length) { n += 4; i++; }
    else n += 3;
  }
  return n;
};

/**
 * The record after a run: `sets` replaces the entry of each def it names (or adds one, at the end), every entry whose
 * id `exists` no longer finds is dropped, and the record is stamped with `engine`.
 */
export const mergeManifest = (was: Manifest | null, sets: readonly ManifestSet[], engine: string, exists: (id: string) => boolean): Manifest => {
  const byDef = new Map<string, ManifestSet>();
  for (const s of was?.sets ?? []) byDef.set(s.def, s);
  for (const s of sets) byDef.set(s.def, s);
  return { v: MANIFEST_V, engine, sets: [...byDef.values()].filter((s) => exists(s.id)) };
};

/** Write the record. Throws, by name, when it would pass Figma's ceiling, so nothing half-written lands. */
export const writeManifest = (root: DataRoot, m: Manifest): void => {
  const text = manifestText(m);
  const bytes = entryBytes(text);
  if (bytes > MANIFEST_MAX_BYTES) throw new Error(`the component manifest is ${bytes} bytes, over Figma's ${MANIFEST_MAX_BYTES} for one plugin-data entry`);
  if (typeof root.setSharedPluginData !== 'function') throw new Error('this file root cannot hold plugin data');
  root.setSharedPluginData(MANIFEST_NS, MANIFEST_KEY, text);
};

/** The slice of `schema/component-contract.json` the parity check reads. */
export type ContractSlice = {
  readonly components: Readonly<Record<string, {
    readonly props: Readonly<Record<string, { readonly default?: unknown; readonly values?: readonly unknown[] }>>;
    readonly states: readonly string[];
    readonly variants: Readonly<Record<string, readonly unknown[]>>;
  }>>;
};

/**
 * WHERE THE MANIFEST AND THE COMPONENT CONTRACT DISAGREE, one line each, empty when they agree. Per set:
 *   · `component`  the def is a component in the contract;
 *   · `axis`       each variant property (a slot-presence coordinate aside, which the contract holds as a slot) is a
 *                  contract variant axis, or the state axis;
 *   · `values`     a variant axis carries exactly the contract's values; the state axis carries only contract states
 *                  (a state the code has and Figma draws no member for, `pending` or `read-only`, is the code's alone);
 *   · `default`    a variant axis's default, the set's first member, is the contract prop's default where it has one.
 * NOT the other direction: a contract axis the set does not carry is often kept out of Figma on purpose (Button's
 * `width`, the fields' `style`), and a declared Figma axis the projection drops is the axis-parity gate's
 * (`figmaAxisNames`, `packages/engine/test.ts`), so it is not restated here.
 */
export const manifestParity = (m: Manifest, contract: ContractSlice): string[] => {
  const out: string[] = [];
  const same = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x) => b.includes(x));
  for (const s of m.sets) {
    const c = contract.components[s.def];
    if (!c) { out.push(`${s.def} component: the set '${s.name}' names no component in the contract`); continue; }
    for (const p of s.properties) {
      if (p.type !== 'VARIANT' || p.slot) continue;
      const code = p.axis ?? p.name;
      if (code === 'state') {
        const extra = p.values.filter((v) => !c.states.includes(v));
        if (extra.length) out.push(`${s.def} values: state carries ${extra.join(', ')}, which the contract's states do not`);
        continue;
      }
      const want = c.variants[code];
      if (!want) { out.push(`${s.def} axis: '${p.name}' is not a variant axis in the contract`); continue; }
      const w = want.map(String);
      if (!same(p.values, w)) out.push(`${s.def} values: '${p.name}' carries [${p.values.join(', ')}], the contract [${w.join(', ')}]`);
      const d = c.props[code]?.default;
      if (d !== undefined && String(d) !== p.default) out.push(`${s.def} default: '${p.name}' defaults to ${p.default} in Figma, ${String(d)} in the contract`);
    }
  }
  return out;
};
