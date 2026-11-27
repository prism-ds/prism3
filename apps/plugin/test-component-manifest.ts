/**
 * THE COMPONENT MANIFEST (#4469 part 2, owner decision "The manifest → A") — `src/component-manifest.ts`.
 *
 *   npx tsx apps/plugin/test-component-manifest.ts
 *
 *   parity/…    THE PARITY CHECK. Every set the catalog projects, listed as the plugin lists it (the plans of the def
 *               materialized for a brand, the same `figmaAnatomySet` call a build makes), agrees with the COMMITTED
 *               component contract, `packages/engine/schema/component-contract.json`. That file is written only by
 *               `component-contract.ts --accept`, never by regen, so it is not derived from the plans (docs/34).
 *               Mutation: give a def's variant axis one more value (`spinner` aside, any set: a value added to
 *               `tooltip`'s `placement` in `components/tooltip.ts`) → `parity/catalog` fails naming
 *               `tooltip values: 'placement' carries [...]`.
 *   detects/…   the check reports each kind of disagreement by its own word (`component`, `axis`, `values`,
 *               `default`), on a contract changed here in memory, so a check that went quiet would fail.
 *   entry/…     one set's entry, typed here by hand from the def and the contract, never read off the module.
 *   default/…   a variant's default is the set's FIRST MEMBER, what Figma's `defaultVariant` reads: the set the real
 *               executor builds in the shim has, as its first child, the member the manifest's defaults name.
 *   size/…      the whole catalog's record fits in one shared-plugin-data entry (Figma's 100 kB), with room to grow.
 *   store/…     read, merge and write on a fake root: shared plugin data under `prism3`, a set replaced by def, a set
 *               whose node is gone dropped, a malformed record read as none, an oversize one refused by name.
 *   key/…       owner decision Q2 A: each entry carries the set's component key as the host gives it, `null` while the
 *               set is not published, the field always present. Read off a set the real executor builds in a shim
 *               that mints keys (`identities`), so every key here is the shim's obviously fake `K:<n>`, never a real
 *               one. Mutations: `mergeManifest` dropping `key` from each entry → `key/published`, `key/unpublished`,
 *               `key/record`; `liveKeyOf` ignoring the publish status → `key/unpublished`; returning a constant →
 *               `key/published`.
 *   skill/…     `skills/prism3-rebind` names the namespace and the key the module writes, so an agent reading the
 *               skill reads the record the plugin wrote.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { componentDefs, figmaAnatomySet, planComponentName, type AnatomyPlan } from '@prism3/engine/components';
import { materializeForBrand } from './src/brand-def';
import { SWAP_TARGET } from './src/build-deps';
import { applyComponentPlan } from './src/write-components';
import { makeShim } from './component-shim';
import {
  MANIFEST_KEY, MANIFEST_MAX_BYTES, MANIFEST_NS, MANIFEST_V, entryBytes, manifestParity, manifestSetOf, manifestText,
  liveKeyOf, mergeManifest, readManifest, writeManifest, type ContractSlice, type KeyedNode, type Manifest, type ManifestEntry, type ManifestSet,
} from './src/component-manifest';

let failures = 0;
let executed = 0;
const ok = (cond: boolean, label: string): void => {
  executed++;
  if (!cond) failures++;
  console.log(`  ${cond ? '✓' : '✗'} ${label}`);
};

const ROOT = join(import.meta.dirname, '../..');
const contract = JSON.parse(readFileSync(join(ROOT, 'packages/engine/schema/component-contract.json'), 'utf8')) as ContractSlice;

// The sets a file can hold: every def that projects a set. A def built as standalone components has no set.
const setDefs = componentDefs.filter((d) => d.figmaProperties && !d.figmaProperties.emitAsComponents);
const plansOf = (id: string): AnatomyPlan[] => figmaAnatomySet(materializeForBrand(componentDefs.find((d) => d.id === id)!, null), { swapTarget: SWAP_TARGET });

console.log('1. the parity check, over the whole catalog');
const sets: ManifestEntry[] = [];
const unplanned: string[] = [];
for (const d of setDefs) {
  try { sets.push(manifestSetOf(d.id, plansOf(d.id), `0:${sets.length + 1}`)); } catch (e) { unplanned.push(`${d.id} (${(e as Error).message})`); }
}
ok(unplanned.length === 0, `#4469 parity/premise: every set def is listed — ${unplanned.length ? unplanned.join('; ') : `${sets.length} sets`}`);
ok(sets.length >= 60, `#4469 parity/represented: the catalog lists at least 60 sets (${sets.length}), so the check reads the catalog, not a corner of it`);
const catalog: Manifest = { v: MANIFEST_V, engine: 'test', sets: sets.map((s) => ({ ...s, key: null })) };
const drift = manifestParity(catalog, contract);
ok(drift.length === 0, `#4469 parity/catalog: the manifest and the component contract agree${drift.length ? `:\n      ${drift.join('\n      ')}` : ''}`);
const variants = sets.reduce((n, s) => n + s.properties.filter((p) => p.type === 'VARIANT' && !p.slot).length, 0);
ok(variants >= 150, `#4469 parity/represented: ${variants} variant properties were compared`);

console.log('2. the check names each kind of disagreement');
const one: Manifest = mergeManifest(null, [manifestSetOf('tooltip', plansOf('tooltip'), '9:9')], 'test', () => null);
ok(manifestParity(one, contract).length === 0, '#4469 detects/premise: tooltip agrees before any change');
const tip = contract.components.tooltip;
const withTip = (t: unknown): ContractSlice => ({ components: { ...contract.components, tooltip: t as ContractSlice['components'][string] } });
const has = (lines: string[], word: string): boolean => lines.some((l) => l.startsWith(`tooltip ${word}:`));
ok(has(manifestParity(one, { components: Object.fromEntries(Object.entries(contract.components).filter(([k]) => k !== 'tooltip')) }), 'component'), '#4469 detects/component: a def the contract lacks');
ok(has(manifestParity(one, withTip({ ...tip, variants: { ...tip.variants, placement: [...tip.variants.placement, 'center'] } })), 'values'), '#4469 detects/values: an axis value only the contract has');
ok(has(manifestParity(one, withTip({ ...tip, props: { ...tip.props, placement: { ...tip.props.placement, default: 'bottom' } } })), 'default'), '#4469 detects/default: a default that differs');
const { placement: _p, ...noPlacement } = tip.variants;
ok(has(manifestParity(one, withTip({ ...tip, variants: { ...noPlacement, size: ['x'] } })), 'axis'), '#4469 detects/axis: a set property the contract has no axis for');
const stated: Manifest = mergeManifest(null, [manifestSetOf('text-field', plansOf('text-field'), '9:8')], 'test', () => null);
const tf = contract.components['text-field'];
ok(manifestParity(stated, contract).length === 0 && manifestParity(stated, { components: { ...contract.components, 'text-field': { ...tf, states: tf.states.filter((s) => s !== 'hover') } } }).some((l) => l.startsWith('text-field values: state carries hover')),
  '#4469 detects/state: a state Figma draws that the contract lacks is named; a code-only state (pending) is not');

console.log('3. one entry, typed by hand');
const want = {
  def: 'tooltip', name: 'tooltip', id: '9:9', key: null,
  properties: [
    { name: 'placement', type: 'VARIANT', values: ['top', 'bottom', 'start', 'end'], default: 'top' },
    { name: 'label', type: 'TEXT', default: 'Tooltip text' },
    { name: 'arrow', type: 'BOOLEAN', default: true },
  ],
};
ok(JSON.stringify(one.sets[0]) === JSON.stringify(want), `#4469 entry/tooltip: ${JSON.stringify(one.sets[0])}`);
const button = sets.find((s) => s.def === 'button');
const lead = button?.properties.find((p) => p.name === 'leading icon');
ok(!!lead && lead.type === 'VARIANT' && lead.axis === 'leading' && lead.slot === true, `#4469 entry/slot axis: Button's 'leading icon' is a slot-presence variant whose code name is 'leading' — ${JSON.stringify(lead)}`);
const swap = button?.properties.find((p) => p.type === 'INSTANCE_SWAP');
ok(!!swap && swap.type === 'INSTANCE_SWAP' && swap.default === SWAP_TARGET, `#4469 entry/swap: a swap's default is its starting component's name — ${JSON.stringify(swap)}`);

console.log('4. a variant default is the first member the executor builds');
{
  const plans = plansOf('field-message');
  const page = { id: '0:1', children: [] as { type?: string; id?: string; children?: { name?: string }[] }[] };
  const r = await applyComponentPlan(plans, makeShim({ page: page as never }) as never);
  const set = page.children.find((n) => n.type === 'COMPONENT_SET');
  const entry = manifestSetOf('field-message', plans, r.id);
  const defaults = entry.properties.flatMap((p) => (p.type === 'VARIANT' ? [`${p.name}=${p.default}`] : [])).join(', ');
  ok(!!set && set.children?.[0]?.name === defaults, `#4469 default/first member: the built set's first child is '${set?.children?.[0]?.name}', the manifest's defaults '${defaults}'`);
  ok(!!r.id && set?.id === r.id, `#4469 default/id: the id listed is the built set's (${r.id})`);
  ok(planComponentName(plans[0]) === defaults, '#4469 default/plan: and it is the first plan\'s coordinate');
}

console.log('4a. each entry carries the set\'s key, as the host gives it (owner decision Q2 A)');
{
  const plans = plansOf('field-message');
  const page = { id: '0:1', children: [] as KeyedNode[] };
  const shim = makeShim({ page: page as never, identities: true }) as Record<string, unknown>;
  const r = await applyComponentPlan(plans, shim as never);
  const set = page.children.find((n) => n.type === 'COMPONENT_SET');
  const shimKey = set?.key;
  ok(typeof shimKey === 'string' && /^K:\d+$/.test(shimKey), `#4469 key/premise: the shim gives the built set a placeholder key in its own K:<n> form (${shimKey})`);
  const entry = manifestSetOf('field-message', plans, r.id);
  const recordWith = async (): Promise<ManifestSet | undefined> => {
    const k = await liveKeyOf(set);
    return mergeManifest(null, [entry], 'test', (id) => (id === r.id ? k : undefined)).sets[0];
  };
  const unpub = await recordWith();
  ok(!!unpub && Object.prototype.hasOwnProperty.call(unpub, 'key') && unpub.key === null, `#4469 key/unpublished: a set that is not published is listed with key null, the field present (${JSON.stringify(unpub && { key: unpub.key })})`);
  (shim.publish as (n: unknown, s: string) => void)(set, 'CURRENT');
  const pub = await recordWith();
  ok(!!pub && pub.key === shimKey, `#4469 key/published: a published set is listed by the key the host gives it (${JSON.stringify(pub && { key: pub.key, host: shimKey })})`);
  (shim.publish as (n: unknown, s: string) => void)(set, 'CHANGED');
  ok((await recordWith())?.key === shimKey, '#4469 key/published: and so is one published and edited since (CHANGED)');
  ok(await liveKeyOf(null) === undefined && await liveKeyOf({ type: 'FRAME', key: 'K:0' }) === undefined, '#4469 key/gone: a node that is not a set answers no key, so its entry is dropped');
  ok(await liveKeyOf({ type: 'COMPONENT_SET', key: 'K:0', getPublishStatusAsync: async () => { throw new Error('no'); } }) === null, '#4469 key/refused: a publish status the host refuses reads as not published, never a guess');
}

console.log('5. the record fits one plugin-data entry');
// A published set's key is 40 characters on Figma; a placeholder of that length, plainly not one, stands in for each.
const bytes = entryBytes(manifestText({ ...catalog, sets: sets.map((s) => ({ ...s, id: '12345:67890', key: `K:${'x'.repeat(38)}` })) }));
ok(bytes < MANIFEST_MAX_BYTES * 0.75, `#4469 size/catalog: every set listed, with long ids and 40-character keys, is ${bytes} bytes, under three quarters of Figma's ${MANIFEST_MAX_BYTES}`);

ok(entryBytes('') === Buffer.byteLength(MANIFEST_NS + MANIFEST_KEY) && entryBytes('a↳é😀') === Buffer.byteLength(`${MANIFEST_NS}${MANIFEST_KEY}a↳é😀`),
  '#4469 size/bytes: the hand count of UTF-8 bytes agrees with Node\'s, across one-, two-, three- and four-byte characters');

console.log('6. the store');
type Root = { data: Map<string, string>; getSharedPluginData(ns: string, k: string): string; setSharedPluginData(ns: string, k: string, v: string): void };
const fakeRoot = (): Root => {
  const data = new Map<string, string>();
  return { data, getSharedPluginData: (ns, k) => data.get(`${ns}/${k}`) ?? '', setSharedPluginData: (ns, k, v) => { data.set(`${ns}/${k}`, v); } };
};
const root = fakeRoot();
ok(readManifest(root) === null, '#4469 store/fresh: a file with no record reads none');
const a = manifestSetOf('tooltip', plansOf('tooltip'), '1:1');
const b = manifestSetOf('field-message', plansOf('field-message'), '1:2');
writeManifest(root, mergeManifest(null, [a, b], '1.0.0', (id) => (id === '1:1' ? 'K:1' : null)));
ok(root.data.has('prism3/componentManifest') && MANIFEST_NS === 'prism3' && MANIFEST_KEY === 'componentManifest', '#4469 store/where: shared plugin data, namespace prism3, key componentManifest');
const back = readManifest(root);
ok(back?.sets.map((s) => s.def).join() === 'tooltip,field-message' && back.engine === '1.0.0', `#4469 store/round trip: ${back?.sets.map((s) => s.def).join()}`);
const stored = JSON.parse(root.data.get('prism3/componentManifest') ?? '{}') as { sets?: Record<string, unknown>[] };
ok(JSON.stringify(stored.sets?.map((s) => [s.id, s.key])) === '[["1:1","K:1"],["1:2",null]]', `#4469 key/record: the written record holds each set's key, a string or null, by name (${JSON.stringify(stored.sets?.map((s) => [s.id, s.key]))})`);
const moved = { ...a, id: '2:1' };
const merged = mergeManifest(back, [moved], '1.0.1', (id) => (id !== '1:2' ? 'K:2' : undefined));
ok(merged.sets.length === 1 && merged.sets[0].id === '2:1' && merged.sets[0].key === 'K:2' && merged.engine === '1.0.1', `#4469 store/merge: a set is replaced by def and one whose node is gone is dropped — ${JSON.stringify(merged.sets.map((s) => [s.def, s.id]))}`);
root.setSharedPluginData(MANIFEST_NS, MANIFEST_KEY, '{"v":0,"sets":[]}');
ok(readManifest(root) === null, '#4469 store/other format: a record in another format reads as none');
root.setSharedPluginData(MANIFEST_NS, MANIFEST_KEY, JSON.stringify({ v: MANIFEST_V, engine: 'x', sets: [{ ...a, id: '1:1' }] }));
ok(readManifest(root) === null, '#4469 key/missing: a record whose entry has no key field reads as none, and is rewritten whole');
root.setSharedPluginData(MANIFEST_NS, MANIFEST_KEY, '{not json');
ok(readManifest(root) === null, '#4469 store/malformed: an unreadable record reads as none');
let refused = '';
const huge: Manifest = { v: MANIFEST_V, engine: 'x', sets: Array.from({ length: 400 }, (_, i) => ({ ...sets.find((s) => s.def === 'button')!, key: null, def: `d${i}` })) };
try { writeManifest(root, huge); } catch (e) { refused = (e as Error).message; }
ok(/over Figma's 100000/.test(refused) && root.getSharedPluginData(MANIFEST_NS, MANIFEST_KEY) === '{not json', `#4469 store/ceiling: an oversize record is refused by name and nothing is written — ${refused}`);

console.log('7. the skill names the record the plugin writes');
const skill = readFileSync(join(ROOT, 'skills/prism3-rebind/SKILL.md'), 'utf8');
ok(skill.includes(`getSharedPluginData('${MANIFEST_NS}', '${MANIFEST_KEY}')`), `#4469 skill/key: prism3-rebind reads getSharedPluginData('${MANIFEST_NS}', '${MANIFEST_KEY}')`);

console.log(failures ? `\n❌ ${failures} FAILED — ${executed} assertions executed` : `\n✅ ALL PASS — ${executed} assertions executed`);
process.exit(failures ? 1 : 0);
