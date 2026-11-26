/**
 * Plugin ANIMATION STYLES write-adapter test (#2857, motion phase 3): drives the REAL `applyAnimationStylesPlan` against
 * an in-memory shim of Figma's custom animation styles and its variables, so the styles are verified with no live Figma.
 *
 *   npx tsx apps/plugin/test-write-animation-styles.ts
 *
 * The shim models what the plugin typings and the 2026-11-24 app check on #2857 say the host does:
 *   - `createCustomAnimationStyle` mints a style with a stable `id` and `key`, `name`, `description` and its entries;
 *   - `addAnimationEntryAsync(styleId, props)` appends an entry, built from one of `figma.motion.figmaAnimationStyles()`,
 *     and an entry's props CANNOT be edited after it is added (the shim freezes them);
 *   - `removeAnimationEntry(id)` removes one, and throws for an id the style does not hold.
 * Its variables are the motion collection the plugin writes (`buildMotionVarPlan`), each with the published or hidden
 * flag the plan gives it, so "no primitive is bound" is read off the same flags Figma gets.
 *
 * INDEPENDENCE (docs/34): the expected style names, the patterns and which are style-guide only are TYPED here, never
 * read from `figma-animation-styles.ts` or `MOTION_PATTERNS`. What is read back is what landed in the shim.
 */
import { buildAnimationStylesPlan, buildMotionVarPlan } from '@prism3/engine/figma';
import { brandTheme, type BrandInput } from '@prism3/engine';
import { applyAnimationStylesPlan, FIGMA_ENTRY_KINDS } from './src/write-animation-styles';
import { planStyleGuide } from './src/style-guide';

let failed = 0;
let executed = 0;
const ok = (cond: boolean, label: string): void => {
  executed++;
  if (cond) console.log(`  ✓ ${label}`);
  else { failed++; console.error(`  ✗ ${label}`); }
};

// ---- the shim ----------------------------------------------------------------------------------------------------
type Entry = { id: string; name: string; styleId: string; props: Readonly<Record<string, unknown>> };
let nextId = 0;
class ShimAnimationStyle {
  readonly id = `S:${++nextId}`;
  readonly key = `key-${this.id}`;
  name = '';
  description = '';
  #entries: Entry[] = [];
  #plugin = new Map<string, string>();
  constructor(private readonly kinds: ReadonlyMap<string, string>) {}
  get animationEntries(): readonly Entry[] { return [...this.#entries]; }
  async addAnimationEntryAsync(styleId: string, props: Record<string, unknown> = {}): Promise<Entry> {
    const name = this.kinds.get(styleId);
    if (!name) throw new Error(`no Figma animation with styleId ${styleId}`);
    const e: Entry = Object.freeze({ id: `E:${++nextId}`, name, styleId, props: Object.freeze({ ...props }) });
    this.#entries.push(e);
    return e;
  }
  removeAnimationEntry(id: string): void {
    const i = this.#entries.findIndex((e) => e.id === id);
    if (i < 0) throw new Error(`this style has no entry ${id}`);
    this.#entries.splice(i, 1);
  }
  getSharedPluginData(ns: string, k: string): string { return this.#plugin.get(`${ns}:${k}`) ?? ''; }
  setSharedPluginData(ns: string, k: string, v: string): void { this.#plugin.set(`${ns}:${k}`, v); }
}
type ShimVar = { id: string; name: string; hidden: boolean; variableCollectionId: string };
const shimOf = (vars: ShimVar[], kindNames: readonly string[]) => {
  const kinds = new Map(kindNames.map((n, i) => [`A:${i}`, n] as const));
  const styles: ShimAnimationStyle[] = [];
  return {
    styles,
    getLocalCustomAnimationStylesAsync: async () => [...styles],
    createCustomAnimationStyle: () => { const s = new ShimAnimationStyle(kinds); styles.push(s); return s; },
    motion: { figmaAnimationStyles: () => [...kinds].map(([styleId, name]) => ({ styleId, name })) },
    variables: {
      getLocalVariablesAsync: async () => vars,
      getLocalVariableCollectionsAsync: async () => [{ id: 'C:motion', name: 'motion' }],
      createVariableAlias: (v: { id: string }) => ({ type: 'VARIABLE_ALIAS' as const, id: v.id }),
    },
  };
};
const varsOf = (theme: ReturnType<typeof brandTheme>): ShimVar[] =>
  buildMotionVarPlan(theme).flatMap((c) => c.rows.map((r, i) => ({ id: `V:${c.name}:${i}`, name: r.name, hidden: r.hidden, variableCollectionId: 'C:motion' })));

// ---- the expected side, typed ------------------------------------------------------------------------------------
// A brand with no `root` emits under the engine's default token root, `prism`.
const ROOT = 'prism';
const input: BrandInput = { id: 'probe', primary: { l: 0.55, c: 0.15, h: 262 }, neutral: { hue: 262, chroma: 0.008 } } as BrandInput;
/** Every style, by name, as the decisions name them (Q-PT17, Q-PT19, Q-PT20 A), with this build's switches: a style per
 *  moving element of a pattern that moves several, the reduced sibling a folder, no color entries until JOB 102. */
const EXPECTED_STYLES = [
  ...['dialog/enter', 'dialog/exit', 'dialog/bottom/enter', 'dialog/bottom/exit'].flatMap((p) => ['scrim', 'panel', 'content'].flatMap((e) => [`${p}/${e}`, `${p}/${e}/reduced`])),
  ...['dialog/end/enter', 'dialog/end/exit'].flatMap((p) => ['scrim', 'panel'].flatMap((e) => [`${p}/${e}`, `${p}/${e}/reduced`])),
  ...['toast/enter', 'toast/exit', 'tooltip/show', 'tooltip/hide', 'popover/open', 'popover/close', 'fade/in', 'fade/out'].flatMap((p) => [p, `${p}/reduced`]),
  'accordion/expand/panel', 'accordion/expand/panel/reduced', 'accordion/expand/indicator',
  'accordion/collapse/panel', 'accordion/collapse/panel/reduced', 'accordion/collapse/indicator',
  'tabs/select/underline', 'tabs/select/panel', 'tabs/select/panel/reduced',
  'switch/toggle/thumb', 'segmented/select/pill',
];
/** The 22 starter patterns (Q-PT16 A). */
const PATTERNS = ['dialog/enter', 'dialog/exit', 'dialog/bottom/enter', 'dialog/bottom/exit', 'dialog/end/enter', 'dialog/end/exit', 'toast/enter', 'toast/exit',
  'tooltip/show', 'tooltip/hide', 'popover/open', 'popover/close', 'accordion/expand', 'accordion/collapse', 'fade/in', 'fade/out', 'hover', 'pressed',
  'pressed/release', 'tabs/select', 'switch/toggle', 'segmented/select'];
/** Style-guide only until JOB 102 says a style carries a fill color (Q-PT18 A): hover and press entirely, and the
 *  switch's and the segmented control's reduced cue, which is their color change. */
const GUIDE_ONLY = ['hover', 'pressed', 'pressed/release'];
const REDUCED_GUIDE_ONLY = ['switch/toggle', 'segmented/select'];
const PRESET_VAR = new RegExp(`^${ROOT}/motion/preset/[a-z]+(/exit)?/(duration|easing|delay|duration-reduced)$`);

// ---- run ----------------------------------------------------------------------------------------------------------
const theme = brandTheme(input);
const plan = buildAnimationStylesPlan(theme);
const vars = varsOf(theme);
const byId = new Map(vars.map((v) => [v.id, v] as const));
const host = shimOf(vars, [...new Set(Object.values(FIGMA_ENTRY_KINDS))]);
const first = await applyAnimationStylesPlan(plan, host);
const written = host.styles.map((s) => s.name);

console.log('\nanimation styles: one per pattern (or moving element), and its reduced sibling');
const missing = EXPECTED_STYLES.filter((n) => !written.includes(n));
const extra = written.filter((n) => !EXPECTED_STYLES.includes(n));
ok(first.written && missing.length === 0 && extra.length === 0 && written.length === EXPECTED_STYLES.length,
  `every expected animation style is written, and nothing else (${written.length} written, ${EXPECTED_STYLES.length} expected; missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'})`);
const patternOf = (name: string) => PATTERNS.filter((p) => name === p || name.startsWith(`${p}/`) || name.startsWith(`state/${p}`)).sort((a, b) => b.length - a.length)[0];
const noStyle = PATTERNS.filter((p) => !GUIDE_ONLY.includes(p) && !written.some((n) => patternOf(n) === p && !n.endsWith('/reduced')));
const noReduced = PATTERNS.filter((p) => !GUIDE_ONLY.includes(p) && !REDUCED_GUIDE_ONLY.includes(p) && !written.some((n) => patternOf(n) === p && n.endsWith('/reduced')));
ok(noStyle.length === 0 && noReduced.length === 0,
  `every pattern has a style and a reduced style, but the style-guide-only ones (no style: ${noStyle.join(', ') || 'none'}; no reduced style: ${noReduced.join(', ') || 'none'})`);
const guide = new Set(plan.guideOnly.map((g) => `${g.pattern}${g.reduced ? ' (reduced)' : ''}`));
const wantGuide = [...GUIDE_ONLY.flatMap((p) => [p, `${p} (reduced)`]), ...REDUCED_GUIDE_ONLY.map((p) => `${p} (reduced)`)];
ok(wantGuide.every((g) => guide.has(g)) && guide.size === wantGuide.length,
  `the style-guide-only rows are hover and press, and the switch's and segmented control's reduced cue, each with its reason (${[...guide].join(', ')})`);

console.log('\nevery entry binds a published preset variable, never a primitive');
const entries = host.styles.flatMap((s) => s.animationEntries.map((e) => ({ style: s.name, e })));
const aliasesOf = (props: Readonly<Record<string, unknown>>) => Object.entries(props).filter(([, v]) => (v as { type?: string })?.type === 'VARIABLE_ALIAS').map(([k, v]) => [k, byId.get((v as { id: string }).id)] as const);
const unbound = entries.filter(({ e }) => { const a = Object.fromEntries(aliasesOf(e.props)); return !a.duration || !a.easing; }).map(({ style }) => style);
ok(entries.length > 0 && unbound.length === 0,
  `every entry binds a duration and an easing variable (${entries.length} entries; unbound: ${[...new Set(unbound)].join(', ') || 'none'})`);
const offPreset = entries.flatMap(({ style, e }) => aliasesOf(e.props).filter(([, v]) => !v || !PRESET_VAR.test(v.name)).map(([k, v]) => `${style} ${k} → ${v?.name ?? 'an unknown variable'}`));
ok(offPreset.length === 0, `every bound variable is a preset slot, motion/preset/<name>[/exit]/<slot> (off: ${offPreset.slice(0, 4).join('; ') || 'none'})`);
const primitives = entries.flatMap(({ style, e }) => aliasesOf(e.props).filter(([, v]) => v?.hidden).map(([k, v]) => `${style} ${k} → ${v!.name}`));
ok(primitives.length === 0, `no entry binds a hidden primitive (bound: ${primitives.slice(0, 4).join('; ') || 'none'})`);
const reducedOff = host.styles.filter((s) => s.name.endsWith('/reduced')).flatMap((s) => s.animationEntries.filter((e) => !String(byId.get((e.props.duration as { id: string })?.id)?.name).endsWith('/duration-reduced')).map(() => s.name));
const fullOff = host.styles.filter((s) => !s.name.endsWith('/reduced')).flatMap((s) => s.animationEntries.filter((e) => !String(byId.get((e.props.duration as { id: string })?.id)?.name).endsWith('/duration')).map(() => s.name));
ok(reducedOff.length === 0 && fullOff.length === 0,
  `a reduced style plays on each preset's duration-reduced, and a full one on its duration (wrong: ${[...new Set([...reducedOff, ...fullOff])].join(', ') || 'none'})`);
const panel = host.styles.find((s) => s.name === 'dialog/enter/panel');
ok(JSON.stringify(panel?.animationEntries.map((e) => [e.name, byId.get((e.props.duration as { id: string }).id)?.name, e.props.scale ?? null])) === JSON.stringify([
  ['Fade', `${ROOT}/motion/preset/surface/duration`, null], ['Scale', `${ROOT}/motion/preset/surface/duration`, 0.96]]),
`dialog/enter/panel fades and scales up from 0.96, both on the surface preset (got ${JSON.stringify(panel?.animationEntries.map((e) => e.name))})`);
const toast = host.styles.find((s) => s.name === 'toast/enter');
ok(toast?.animationEntries.find((e) => e.name === 'Position')?.props.distance === 8,
  `toast/enter slides by distance.nudge's 8px (got ${JSON.stringify(toast?.animationEntries.map((e) => e.props.distance ?? null))})`);
const exitPanel = host.styles.find((s) => s.name === 'dialog/exit/panel');
ok(byId.get((exitPanel?.animationEntries[0]?.props.easing as { id: string })?.id)?.name === `${ROOT}/motion/preset/surface/exit/easing`,
  'an exit pattern binds its preset\'s exit half (dialog/exit/panel on surface/exit/easing)');
ok(host.styles.every((s) => s.description.length > 0 && !/motion\.|preset/.test(s.description)),
  'every style has a plain-words description that names no token (Q-PT21 A)');

console.log('\nan update replaces the entries and keeps each style');
const idsBefore = new Map(host.styles.map((s) => [s.name, { id: s.id, key: s.key, entries: s.animationEntries.map((e) => e.id) }]));
const second = await applyAnimationStylesPlan(plan, host);
const kept = host.styles.filter((s) => idsBefore.get(s.name)?.id === s.id && idsBefore.get(s.name)?.key === s.key).length;
const stale = host.styles.filter((s) => s.animationEntries.some((e) => idsBefore.get(s.name)?.entries.includes(e.id))).map((s) => s.name);
ok(second.created === 0 && host.styles.length === EXPECTED_STYLES.length && kept === EXPECTED_STYLES.length,
  `a second apply creates no style and keeps every style's id and key (created ${second.created}, ${host.styles.length} styles, ${kept} kept)`);
ok(stale.length === 0 && second.entries === first.entries,
  `a second apply replaces every entry rather than editing one: none of the old entries is left, and as many are written (left: ${stale.slice(0, 3).join(', ') || 'none'}; ${second.entries} of ${first.entries})`);

console.log('\nre-pointing a preset re-times the styles without touching them');
// A brand whose surface preset is re-pointed to a longer step: the styles bind the same preset variables, so nothing in
// them changes. Only the variables' values would, and they are the motion stage's.
const slower = brandTheme({ ...input, motionPersonality: { presets: { surface: { duration: 'duration.slow' } } } } as BrandInput);
const host2 = shimOf(varsOf(slower), [...new Set(Object.values(FIGMA_ENTRY_KINDS))]);
await applyAnimationStylesPlan(buildAnimationStylesPlan(slower), host2);
const bindings = (h: typeof host, vs: ShimVar[]) => { const m = new Map(vs.map((v) => [v.id, v.name])); return JSON.stringify(h.styles.map((s) => [s.name, s.animationEntries.map((e) => [e.name, ...aliasesOf(e.props).map(([k, v]) => `${k}=${v && m.get(v.id)}`)])])); };
ok(bindings(host, vars) === bindings(host2, varsOf(slower)),
  'a brand that re-points the surface preset writes the same styles, bound to the same preset variables');

console.log('\nwhat is reported');
const noKinds = await applyAnimationStylesPlan(plan, shimOf(vars, ['Fade']));
ok(noKinds.misses.some((m) => /this Figma has no 'Scale' animation for its scale entry/.test(m)) && noKinds.misses.every((m) => !/Fade/.test(m)),
  `an entry kind this Figma does not list is a miss, named, and the rest are written (${noKinds.misses.length} misses, e.g. ${JSON.stringify(noKinds.misses[0])})`);
const noVars = await applyAnimationStylesPlan(plan, shimOf([], [...new Set(Object.values(FIGMA_ENTRY_KINDS))]));
ok(noVars.bound === 0 && noVars.misses.some((m) => m.endsWith(`${ROOT}/motion/preset/surface/duration`)),
  `a file without the preset variables reports each binding it could not make (${noVars.misses.length} misses)`);
const skipped = await applyAnimationStylesPlan(plan, { variables: host.variables });
ok(!skipped.written && /no animation styles/.test(skipped.skipped ?? ''),
  `a Figma with no animation styles skips them and says so (${JSON.stringify(skipped.skipped)})`);

console.log('\nthe style guide: one row per pattern, its reduced sibling in the same row (Q-PT22 A)');
// The catalog is built from what landed in the shim, as `readCatalog` reads a file: each style's name, description and
// its entries by the name of the Figma animation each was added from.
const catalog = {
  collections: [], variables: [],
  animationStyles: host.styles.map((s) => ({ id: s.id, name: s.name, description: s.description, entries: s.animationEntries.map((e) => e.name) })),
};
const sg = planStyleGuide(catalog, null, { types: ['animation'] });
const table = sg.tables.find((t) => t.type === 'animation');
const rowOf = (name: string) => table?.rows.find((r) => r.name === name);
const fullNames = EXPECTED_STYLES.filter((n) => !n.endsWith('/reduced'));
const rowNames = table?.rows.map((r) => r.name) ?? [];
const wantRows = [...fullNames, ...GUIDE_ONLY.map((p) => `state/${p}`)];
ok(sg.tables.length === 1 && rowNames.length === wantRows.length && wantRows.every((n) => rowNames.includes(n)),
  `one animation table, a row per style that is not a reduced sibling and one per style-guide-only pattern (${rowNames.length} rows, ${wantRows.length} expected; missing: ${wantRows.filter((n) => !rowNames.includes(n)).join(', ') || 'none'})`);
const toastRow = rowOf('toast/enter');
ok(toastRow?.extra?.[0]?.value === 'Fade · Position' && toastRow?.extra?.[1]?.value === 'The toast fades in quickly, with no slide.' && toastRow?.specimen?.kind === 'animation',
  `a row names what its style plays and carries its reduced sibling's words in the same row (toast/enter: ${JSON.stringify(toastRow?.extra?.map((x) => x.value))})`);
const hoverRow = rowOf('state/hover');
ok(hoverRow?.variableId === '' && hoverRow?.extra?.[0]?.value === 'Style guide only' && hoverRow?.description === 'The control changes color.',
  `a style-guide-only pattern is a row with no style, saying what it does (state/hover: ${JSON.stringify([hoverRow?.extra?.[0]?.value, hoverRow?.description])})`);
const noReducedRow = rowOf('accordion/expand/indicator');
ok(noReducedRow?.extra?.[1]?.value === '—', `a style with no reduced sibling says so in its row (accordion/expand/indicator: ${JSON.stringify(noReducedRow?.extra?.[1]?.value)})`);

console.log(`\nplugin ANIMATION STYLES write-adapter: ${failed === 0 ? 'ALL PASS' : failed + ' FAILED'} — ${executed} assertions executed`);
if (failed) process.exit(1);
