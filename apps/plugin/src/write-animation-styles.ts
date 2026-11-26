/**
 * Prism3 Figma plugin — the ANIMATION STYLES write adapter (#2857, motion phase 3).
 *
 * The live executor for the engine's `AnimationStylesPlan` (`figma-animation-styles.ts`): one Figma custom animation
 * style per motion pattern (or per moving element of one), and its reduced sibling. Each entry binds the published
 * preset variables (`<root>/motion/preset/<name>[/exit]/duration`, `…/easing`), never a hidden primitive, so re-pointing
 * a preset re-times every style that plays on it with no style rewritten.
 *
 * REPLACE, NEVER EDIT. An animation entry's properties cannot be edited after it is added (the 2026-11-24 app check on
 * #2857). So an update keeps the STYLE, found by name, which keeps its id and key, and so every layer and instance that
 * uses it, and replaces its ENTRIES: every entry the style holds is removed, then the plan's are added. A re-apply with
 * nothing changed writes the same entries again; the style the layers point at never changes.
 *
 * NOT EVERY FIGMA HAS IT. `supportsAnimationStyles` reads the host for the API; a host without it (an older Figma, the
 * paste harness) skips the stage and says so, and every other stage of the apply is unaffected.
 *
 * THE HOST'S NAMES. Figma offers exactly seven animations an entry can be added from: `Position`, `Scale`, `Rotation`,
 * `Size`, `Opacity`, `Path` and `TextStagger` (the 2026-11-26 check on #2857). None animates a fill, so a color track has
 * no entry (`FIGMA_ENTRY_KINDS.color` is null, and the engine's plan writes none). Each value is written under the
 * property `FIGMA_ENTRY_PROPS` names; the 2026-11-24 check bound an entry's distance, duration and easing. The executor
 * reads each animation's own property list from `figma.motion.figmaAnimationStyles()` and names a property the
 * animation does not have as a miss, rather than write it blind. A kind this Figma does not list is a miss too.
 *
 * Compiled under `tsconfig.main.json`. The `AnimationStylesApi` port is the slice of `figma` this touches, so it runs
 * against the in-memory shim in `test-write-animation-styles.ts`; the real `figma` satisfies it structurally.
 */
import type { AnimationEntryKind, AnimationStylesPlan } from '@prism3/engine/figma';
import { bindingTargets } from './binding-targets';
import { markOwned, type Markable } from './provenance';

/** The Figma animation each entry kind is added from, by its name in `figma.motion.figmaAnimationStyles()` (the seven the
 *  2026-11-26 check found). `null`: no animation does it, so the kind has no entry. */
export const FIGMA_ENTRY_KINDS: Record<AnimationEntryKind, string | null> = {
  opacity: 'Opacity', scale: 'Scale', slide: 'Position', travel: 'Position', turn: 'Rotation', size: 'Size', color: null,
};
/** The property each value is written under on an entry. `null` is a value this build does not write: a preset's delay
 *  (0 for every default preset; a delayed preset plays at once in Figma until its property is named), and the edge a
 *  self-sized slide comes from (`Dialog / bottom`, `Dialog / end`). */
export const FIGMA_ENTRY_PROPS: { duration: string; easing: string; delay: string | null; distance: string; scale: string; from: string | null } = {
  duration: 'duration', easing: 'easing', delay: null, distance: 'distance', scale: 'scale', from: null,
};

/** What a style doesn't carry, in the plain words the style guide's row says them in (DRAFT copy, #2857). */
export const NOT_CARRIED = { delay: 'its delay', edge: 'the edge it slides from', distance: 'its own-size distance' } as const;
/** Where the list rides on the style: Prism3's shared plugin data, as the ownership mark does. */
export const NOT_CARRIED_NS = 'prism3';
export const NOT_CARRIED_KEY = 'animation-not-carried';

type Alias = { type: 'VARIABLE_ALIAS'; id: string };
export type AnimationEntryNode = { readonly id: string; readonly name: string; readonly props?: Readonly<Record<string, unknown>> };
/** The slice of Figma's `CustomAnimationStyle` this writes. */
export interface AnimationStyleNode extends Markable {
  readonly id: string;
  name: string;
  description: string;
  readonly animationEntries: readonly AnimationEntryNode[];
  addAnimationEntryAsync(styleId: string, props?: Record<string, unknown>): Promise<AnimationEntryNode>;
  removeAnimationEntry(id: string): void;
}
export interface AnimationStylesApi {
  getLocalCustomAnimationStylesAsync(): Promise<AnimationStyleNode[]>;
  createCustomAnimationStyle(): AnimationStyleNode;
  motion: { figmaAnimationStyles(): readonly { styleId: string; name: string; props?: Readonly<Record<string, unknown>> }[] };
  variables: {
    getLocalVariablesAsync(type?: string): Promise<{ id: string; name: string; variableCollectionId?: string }[]>;
    getLocalVariableCollectionsAsync(): Promise<readonly { id: string; name: string }[]>;
    createVariableAlias(target: { id: string }): Alias;
  };
}

/** True when this host can hold custom animation styles. */
export const supportsAnimationStyles = (host: unknown): host is AnimationStylesApi => {
  const h = host as Partial<AnimationStylesApi> | null;
  return !!h && typeof h.createCustomAnimationStyle === 'function' && typeof h.getLocalCustomAnimationStylesAsync === 'function'
    && typeof h.motion?.figmaAnimationStyles === 'function';
};

export type AnimationStylesResult = {
  /** False when the host has no animation styles: nothing was written, and `skipped` says why. */
  written: boolean;
  skipped?: string;
  total: number;
  created: number;
  /** Entries added, across every style, after the style's old entries were removed. */
  entries: number;
  /** Entry values bound to a variable. */
  bound: number;
  misses: string[];
};

/** Writes the plan. Idempotent: a style is found by name and keeps its identity; its entries are replaced. */
export const applyAnimationStylesPlan = async (plan: AnimationStylesPlan, host: unknown, tick?: () => Promise<void>, bindIn?: readonly string[]): Promise<AnimationStylesResult> => {
  if (!supportsAnimationStyles(host)) {
    return { written: false, skipped: 'this Figma has no animation styles, so none were written', total: plan.styles.length, created: 0, entries: 0, bound: 0, misses: [] };
  }
  const api = host;
  const varByName = await bindingTargets(api.variables, bindIn);
  // Each animation's id, and the properties it takes where the host lists them (a host that lists none is not second-guessed).
  const kinds = new Map(api.motion.figmaAnimationStyles().map((s) => [s.name, { styleId: s.styleId, props: s.props ? new Set(Object.keys(s.props)) : null }] as const));
  const byName = new Map((await api.getLocalCustomAnimationStylesAsync()).map((s) => [s.name, s] as const));
  const misses: string[] = [];
  let created = 0, entries = 0, bound = 0;
  for (const row of plan.styles) {
    let s = byName.get(row.name);
    if (!s) { s = api.createCustomAnimationStyle(); s.name = row.name; byName.set(row.name, s); created++; }
    markOwned(s);   // the ownership mark (#1884), as every style this plugin writes carries
    s.description = row.description;
    for (const e of [...s.animationEntries]) s.removeAnimationEntry(e.id);
    // WHAT THIS STYLE DOESN'T CARRY (#4608 review, finding 3): a value the plan holds that the host gives no property for
    // yet (#2857). Each is a named miss in the report, never a silent drop, and the list rides on the style itself
    // (`NOT_CARRIED_KEY`), so the style guide's row says it to a designer who never saw the report.
    const notCarried = new Set<string>();
    const unwritten = (what: string, detail: string): void => {
      if (!notCarried.has(what)) misses.push(`${row.name}: ${detail} is not written yet, because Figma's property for it is not named (#2857)`);
      notCarried.add(what);
    };
    for (const entry of row.entries) {
      const kindName = FIGMA_ENTRY_KINDS[entry.kind];
      const kind = kindName ? kinds.get(kindName) : undefined;
      if (!kindName || !kind) { misses.push(`${row.name}: this Figma has no ${kindName ? `'${kindName}' animation` : 'animation'} for its ${entry.kind} entry`); continue; }
      const props: Record<string, unknown> = {};
      const takes = (key: string): boolean => {
        if (!kind.props || kind.props.has(key)) return true;
        misses.push(`${row.name}: the '${kindName}' animation has no '${key}' property`);
        return false;
      };
      const bind = (key: string | null, name: string): void => {
        if (!key || !takes(key)) return;
        const v = varByName.get(name);
        if (!v) { misses.push(`${row.name}: ${name}`); return; }
        props[key] = api.variables.createVariableAlias(v);
        bound++;
      };
      bind(FIGMA_ENTRY_PROPS.duration, entry.duration);
      bind(FIGMA_ENTRY_PROPS.easing, entry.easing);
      // A delay of 0 plays the same unwritten; any other is a miss until the host names a delay property.
      if (FIGMA_ENTRY_PROPS.delay) bind(FIGMA_ENTRY_PROPS.delay, entry.delay);
      else if (entry.delayMs > 0) unwritten(NOT_CARRIED.delay, `its ${entry.delayMs}ms delay (${entry.delay})`);
      // A distance is written as its px (no motion distance variable exists in Figma yet, #4589). A self-sized slide has
      // no px: it is a miss until the host names how a slide takes its own size.
      if (entry.distance && 'px' in entry.distance && takes(FIGMA_ENTRY_PROPS.distance)) props[FIGMA_ENTRY_PROPS.distance] = entry.distance.px;
      if (entry.distance && 'self' in entry.distance) unwritten(NOT_CARRIED.distance, 'its own-size distance');
      if (entry.from && FIGMA_ENTRY_PROPS.from && takes(FIGMA_ENTRY_PROPS.from)) props[FIGMA_ENTRY_PROPS.from] = entry.from;
      else if (entry.from && !FIGMA_ENTRY_PROPS.from) unwritten(NOT_CARRIED.edge, `the edge it slides from (${entry.from})`);
      if (entry.scale !== undefined && takes(FIGMA_ENTRY_PROPS.scale)) props[FIGMA_ENTRY_PROPS.scale] = entry.scale;
      await s.addAnimationEntryAsync(kind.styleId, props);
      entries++;
    }
    try { s.setSharedPluginData?.(NOT_CARRIED_NS, NOT_CARRIED_KEY, notCarried.size ? JSON.stringify([...notCarried]) : ''); } catch { /* best-effort, as the ownership mark is */ }
    await tick?.();
  }
  return { written: true, total: plan.styles.length, created, entries, bound, misses };
};

/** Apply Theme's summary line for this stage (DRAFT copy, #2857): how many styles, and how many values they don't carry
 *  yet, the first three named. Empty when this Figma has no animation styles, as for a host that skips them. */
export const animationStylesNote = (r: AnimationStylesResult): string => {
  if (!r.written) return '';
  const head = `Animation styles: ${r.total} (+${r.created})`;
  if (!r.misses.length) return head;
  const shown = r.misses.slice(0, 3).join('; ');
  return `${head}; ${r.misses.length} ${r.misses.length === 1 ? 'value' : 'values'} not written: ${shown}${r.misses.length > 3 ? '; …' : ''}`;
};
