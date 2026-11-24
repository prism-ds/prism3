/**
 * A FONT WEIGHT VARIABLE THE BRAND NO LONGER WRITES IS REMOVED ON RE-APPLY (#4474).
 *
 * `<root>/core/font/weight/<n>` is the numeric tier the weight roles alias into, one variable per weight the brand
 * uses (`weightsRef`). Change `typography.weightRoles.emphasis` from 600 to 700 and the next plan has no `weight/600`,
 * but the write path is create-or-update by name, so the old variable stayed in the file: a weight nothing in the
 * brand points at, still listed in the variable panel. Owner decision A on #4474 (2026-11-24): a re-apply removes it.
 *
 * NARROW BY DESIGN. Every other variable the plan stops writing is still reported and never deleted (#479); Update
 * file › Clean up is the delete path for those. This removes only names of the form `<prefix><digits>`, where
 * `<prefix>` is the `…/font/weight/` the font plan itself writes, inside the collection that plan writes, so it never
 * reaches a variable outside Prism3's own font tier. It runs after the type-vars stage, so every weight role already
 * aliases its new weight. A weight variable another variable still aliases (a designer's own alias into it) is kept
 * and reported, since removing it would break that alias.
 *
 * Compiled under `tsconfig.main.json`. Port-shaped, so the Node file shim drives it.
 */
import type { VarCollectionPlan } from '@prism3/engine/figma';
import type { VariablesApi } from './write-figma';

export type RetiredWeights = {
  /** weight variables removed, by name, sorted. */
  removed: string[];
  /** unplanned weight variables kept because another variable aliases them, by name, sorted. */
  kept: string[];
};

const WEIGHT_TAIL = /\/font\/weight\/\d+$/;

const aliasTargets = (v: { valuesByMode?: Record<string, unknown> }): string[] =>
  Object.values(v.valuesByMode ?? {}).flatMap((x) =>
    x && typeof x === 'object' && (x as { type?: unknown }).type === 'VARIABLE_ALIAS' ? [String((x as { id: unknown }).id)] : []);

export const retireUnusedWeights = async (vars: VariablesApi, plans: readonly VarCollectionPlan[]): Promise<RetiredWeights> => {
  const removed: string[] = [], kept: string[] = [];
  const collections = await vars.getLocalVariableCollectionsAsync();
  for (const p of plans) {
    const weights = p.rows.map((r) => r.name).filter((n) => WEIGHT_TAIL.test(n));
    if (!weights.length) continue;
    const prefix = weights[0].replace(/\d+$/, '');
    const col = collections.find((c) => c.name === p.name);
    if (!col) continue;
    const planned = new Set(p.rows.map((r) => r.name));
    const all = await vars.getLocalVariablesAsync();
    const stale = all.filter((v) => v.variableCollectionId === col.id && v.name.startsWith(prefix)
      && /^\d+$/.test(v.name.slice(prefix.length)) && !planned.has(v.name));
    if (!stale.length) continue;
    const staleIds = new Set(stale.map((v) => v.id));
    const aliased = new Set(all.filter((v) => !staleIds.has(v.id)).flatMap(aliasTargets));
    for (const v of stale) {
      const name = v.name;   // read first: a removed variable throws on every read, as the host's does
      if (aliased.has(v.id) || !v.remove) { kept.push(name); continue; }
      v.remove();
      removed.push(name);
    }
  }
  return { removed: removed.sort(), kept: kept.sort() };
};
