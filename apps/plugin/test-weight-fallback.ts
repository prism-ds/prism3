/**
 * A FAMILY WITH NO SEMI BOLD, AND A WEIGHT THE BRAND STOPPED USING (#4474) — against the file shim.
 *
 *   npx tsx apps/plugin/test-weight-fallback.ts
 *
 * Found in a demo rehearsal: a brand whose family had no Semi Bold applied with the default emphasis weight (600), and
 * Apply Theme skipped 9 emphasis text styles mid-run. Setting `typography.weightRoles.emphasis: 700` fixed the styles,
 * but the re-apply left the weight-600 font variable in the file. Owner decision A (2026-11-24): before applying, name
 * the missing face and point at the weight setting; write the nearest weight the family has, so no style is skipped;
 * a re-apply removes the orphan weight variable.
 *
 * Expected values are typed here, not read off the code under test: the face names, `Bold` as the nearest weight to a
 * missing 600 when 500 and 700 are both present (CSS's tie rule), and the variable name `…/core/font/weight/600`.
 *
 * Mutations, each failing by name:
 *   - `runApplyTheme` writing `exec.text` instead of the filled text plan → `fallback/none skipped`, `fallback/nearest style`
 *   - `fillMissingWeights` returning no fallbacks → `fallback/warned`
 *   - the cut rows left unfilled in `fillMissingWeights` → `fallback/nearest cut`
 *   - the `retireUnusedWeights` call dropped from `runApplyTheme` → `retire/no orphan`, `retire/reported`
 *   - the alias check dropped in `retireUnusedWeights` → `retire/aliased kept`
 *   - the `<digits>` test dropped in `retireUnusedWeights` (any unplanned name under the prefix) → `retire/narrow`
 *   - the `variableCollectionId === col.id` guard dropped in `retireUnusedWeights` → `retire/other collection`
 *   - the `resolveFontStyle` check dropped in `fillMissingWeights` (every face reported, present ones as themselves)
 *     → `fallback/only missing`, `fallback/none when stocked`
 */
import type { BrandInput } from '@prism3/engine';
import { EXAMPLE_BRANDS_JSON as exampleBrands } from '@prism3/engine';
import { FileShim } from './file-shim';
import { runApplyTheme, themePlans } from './src/apply-theme';
import { nearestWeightStyle, styleWeightOf } from './src/preload-fonts';
import { weightFallbackNote, retiredWeightsItem } from './src/apply-summary';

let executed = 0, failed = 0;
const ok = (cond: boolean, label: string): void => {
  executed++;
  if (cond) { console.log(`  ✓ ${label}`); return; }
  failed++;
  console.error(`  ✗ ${label}`);
};

const harbor = (exampleBrands as Record<string, BrandInput>).harbor;
const withEmphasis = (b: BrandInput, w: number): BrandInput =>
  ({ ...b, typography: { ...(b.typography ?? {}), weightRoles: { ...(b.typography?.weightRoles ?? {}), emphasis: w } } } as BrandInput);

console.log('\nnearest weight — the rule, on its own');
ok(nearestWeightStyle(['Regular', 'Medium', 'Bold'], 'Semi Bold') === 'Bold', 'nearest/tie heavier: a missing 600 between Medium and Bold takes Bold');
ok(nearestWeightStyle(['Regular', 'Medium'], 'Semi Bold') === 'Medium', 'nearest/one side: with no heavier face, a missing 600 takes Medium');
ok(nearestWeightStyle(['ExtraLight', 'Regular'], 'Light') === 'ExtraLight', 'nearest/tie lighter: a missing 300 between ExtraLight and Regular takes ExtraLight');
ok(nearestWeightStyle(['Regular', 'Bold', 'Italic', 'Bold Italic'], 'Semi Bold Italic') === 'Bold Italic', 'nearest/italic: an italic weight falls back to an italic face');
ok(nearestWeightStyle(['Regular', 'Bold'], 'Light Condensed') === undefined, 'nearest/width cut: a cut that is not a plain weight has no nearest');
ok(nearestWeightStyle(['Bold Italic'], 'Semi Bold') === undefined, 'nearest/no upright: an upright weight never takes an italic face');
ok(styleWeightOf('SemiBold')?.weight === 600 && styleWeightOf('Italic')?.weight === 400 && styleWeightOf('Italic')?.italic === true, 'nearest/parse: SemiBold is 600, Italic alone is Regular Italic');

console.log('\nfallback — a family with no Semi Bold');
{
  const plans = themePlans(harbor);
  const file = new FileShim();
  // Every face harbor names, except Inter's Semi Bold; Inter also has Medium, so the tie rule is what picks Bold.
  const faces = new Map<string, { family: string; style: string }>();
  for (const r of plans.textPlan) faces.set(`${r.fontFamilyPrimary}|${r.fontStyle}`, { family: r.fontFamilyPrimary, style: r.fontStyle });
  faces.set('Inter|Medium', { family: 'Inter', style: 'Medium' });
  faces.delete('Inter|Semi Bold');
  file.faces = [...faces.values()];
  const semi = plans.textPlan.filter((r) => r.fontFamilyPrimary === 'Inter' && r.fontStyle === 'Semi Bold');
  ok(semi.length > 0, `premise: harbor asks for Inter Semi Bold in ${semi.length} text styles`);

  const run = await runApplyTheme(harbor, file as any);
  ok(run.guarded.ok === true, 'premise: the apply ran');
  const fb = run.weightFallbacks?.find((x) => x.family === 'Inter' && x.asked === 'Semi Bold');
  ok(!!fb && fb.used === 'Bold' && fb.styles === semi.length,
    `fallback/warned: the run names Inter Semi Bold as missing, standing in Bold, for ${semi.length} text styles (got ${JSON.stringify(run.weightFallbacks)})`);
  ok(run.weightFallbacks?.length === 1,
    `fallback/only missing: the only face named is the missing one, Inter Semi Bold, not a face the host has (got ${JSON.stringify(run.weightFallbacks?.map((x) => `${x.family}|${x.asked}`))})`);
  const note = weightFallbackNote(run.weightFallbacks ?? []);
  ok(note.includes('Inter Semi Bold') && note.includes('Bold instead') && note.includes('Theme › Type › Weights and styles'),
    `fallback/note: the report line names the face and points at the weight setting (${note})`);
  const ts = run.guarded.ok ? run.guarded.result.ts : null;
  ok(!!ts && ts.skipped.length === 0, `fallback/none skipped: no text style is skipped (skipped ${JSON.stringify(ts?.skipped.map((x) => x.name))})`);
  const styles = new Map(file.styles.text.map((s: any) => [s.name, s]));
  ok(semi.every((r) => styles.get(r.name)?.fontName?.style === 'Bold' && styles.get(r.name)?.fontName?.family === 'Inter'),
    'fallback/nearest style: every style that asked for Inter Semi Bold is written in Inter Bold');
  const cutNames = new Set(semi.map((r) => r.fontStyleVar));
  const cuts = file.vars.filter((v: any) => cutNames.has(v.name));
  ok(cuts.length === cutNames.size && cuts.every((v: any) => Object.values(v.valuesByMode).every((x) => x === 'Bold')),
    `fallback/nearest cut: the cut variable those styles bind holds Bold, so the binding agrees with the style (${cuts.map((v: any) => `${v.name}=${JSON.stringify(v.valuesByMode)}`).join(' ')})`);
}

console.log('\nretire — a re-apply after the weight change');
{
  const file = new FileShim();
  const faces = new Map<string, { family: string; style: string }>();
  for (const b of [harbor, withEmphasis(harbor, 700)]) for (const r of themePlans(b).textPlan) faces.set(`${r.fontFamilyPrimary}|${r.fontStyle}`, { family: r.fontFamilyPrimary, style: r.fontStyle });
  file.faces = [...faces.values()];
  const first = await runApplyTheme(harbor, file as any);
  const w600 = file.vars.find((v: any) => /\/core\/font\/weight\/600$/.test(v.name));
  ok(first.guarded.ok === true && !!w600, `premise: the first apply writes ${w600?.name ?? 'a weight-600 variable'}`);
  ok(Array.isArray(first.weightFallbacks) && first.weightFallbacks.length === 0,
    `fallback/none when stocked: a host with every face the brand asks for warns about none (got ${JSON.stringify(first.weightFallbacks)})`);
  const name600 = w600?.name ?? '';
  const prefix = name600.replace(/600$/, '');
  // A hand-made variable under the same prefix that is not a weight: the pass must leave it.
  const core = (await file.getLocalVariableCollectionsAsync()).find((c: any) => c.id === w600?.variableCollectionId);
  const handMade = file.createVariable(`${prefix}display`, core, 'FLOAT');

  const second = await runApplyTheme(withEmphasis(harbor, 700), file as any);
  ok(second.guarded.ok === true, 'premise: the re-apply with emphasis 700 ran');
  ok(!file.vars.some((v: any) => v.name === name600), `retire/no orphan: ${name600} is gone after the re-apply`);
  const rw = second.guarded.ok ? second.guarded.result.rw : null;
  ok(!!rw && rw.removed.length === 1 && rw.removed[0] === name600 && retiredWeightsItem(rw.removed).includes('(600)'),
    `retire/reported: the run reports the one removal (${JSON.stringify(rw)})`);
  const w700 = file.vars.find((v: any) => v.name === `${prefix}700`);
  const emphasis = file.vars.find((v: any) => /\/core\/font\/weight-role\/emphasis$/.test(v.name));
  ok(!!w700 && !!emphasis && Object.values(emphasis.valuesByMode).every((x: any) => x?.type === 'VARIABLE_ALIAS' && x.id === w700.id),
    'retire/rebound: the emphasis role aliases the weight-700 variable');
  ok(file.vars.includes(handMade), 'retire/narrow: a non-numeric name under the weight prefix is left alone');
}

console.log('\nretire — the same name in another collection is not Prism3\'s');
{
  const file = new FileShim();
  const faces = new Map<string, { family: string; style: string }>();
  for (const b of [harbor, withEmphasis(harbor, 700)]) for (const r of themePlans(b).textPlan) faces.set(`${r.fontFamilyPrimary}|${r.fontStyle}`, { family: r.fontFamilyPrimary, style: r.fontStyle });
  file.faces = [...faces.values()];
  await runApplyTheme(harbor, file as any);
  const w600 = file.vars.find((v: any) => /\/core\/font\/weight\/600$/.test(v.name));
  const name600 = w600?.name ?? '';   // read first: a removed variable throws on every read
  const other = file.createVariableCollection('Mine');
  const twin = w600 ? file.createVariable(name600, other, 'FLOAT') : undefined;
  const second = await runApplyTheme(withEmphasis(harbor, 700), file as any);
  const rw = second.guarded.ok ? second.guarded.result.rw : null;
  ok(!!twin && file.vars.includes(twin) && !!w600 && !file.vars.includes(w600),
    `retire/other collection: a variable named ${name600} in another collection survives the re-apply, while Prism3's own is removed (${JSON.stringify(rw)})`);
}

console.log('\nretire — a weight variable someone aliases is kept');
{
  const file = new FileShim();
  const faces = new Map<string, { family: string; style: string }>();
  for (const b of [harbor, withEmphasis(harbor, 700)]) for (const r of themePlans(b).textPlan) faces.set(`${r.fontFamilyPrimary}|${r.fontStyle}`, { family: r.fontFamilyPrimary, style: r.fontStyle });
  file.faces = [...faces.values()];
  await runApplyTheme(harbor, file as any);
  const w600 = file.vars.find((v: any) => /\/core\/font\/weight\/600$/.test(v.name));
  const mine = file.createVariableCollection('Mine');
  const alias = file.createVariable('my-weight', mine, 'FLOAT');
  alias.setValueForMode(mine.modes[0].modeId, file.createVariableAlias(w600));
  const second = await runApplyTheme(withEmphasis(harbor, 700), file as any);
  const rw = second.guarded.ok ? second.guarded.result.rw : null;
  ok(!!w600 && file.vars.includes(w600) && !!rw && rw.kept.includes(w600.name) && rw.removed.length === 0,
    `retire/aliased kept: a weight variable another variable aliases stays, and is reported as kept (${JSON.stringify(rw)})`);
}

console.log(failed ? `\n❌ ${failed} FAILED — ${executed} assertions executed` : `\n✅ ALL PASS — ${executed} assertions executed`);
process.exit(failed ? 1 : 0);
