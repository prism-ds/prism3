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
 * WHAT JOB 102 PINS, here and nowhere else (the Mac check, results on #2857): the name of each of Figma's own
 * animations an entry is added from (`FIGMA_ENTRY_KINDS`), and the property each value is written under
 * (`FIGMA_ENTRY_PROPS`). The 2026-11-24 check confirmed `Position` as the move, and that an entry's distance, duration
 * and easing bind FLOAT, TIMING and EASING variables; the rest are the names the typings and that check suggest. A kind
 * this Figma does not list is a miss, named, never a guess.
 *
 * Compiled under `tsconfig.main.json`. The `AnimationStylesApi` port is the slice of `figma` this touches, so it runs
 * against the in-memory shim in `test-write-animation-styles.ts`; the real `figma` satisfies it structurally.
 */
import type { AnimationEntryKind, AnimationStylesPlan } from '@prism3/engine/figma';
import { bindingTargets } from './binding-targets';
import { markOwned, type Markable } from './provenance';

/** JOB 102: the Figma animation each entry kind is added from, by its name in `figma.motion.figmaAnimationStyles()`. */
export const FIGMA_ENTRY_KINDS: Record<AnimationEntryKind, string> = {
  opacity: 'Fade', scale: 'Scale', slide: 'Position', travel: 'Position', turn: 'Rotate', size: 'Size', color: 'Color',
};
/** JOB 102: the property each value is written under on an entry. `null` is a value this build does not write until the
 *  check names its property: a preset's delay (0 for every default preset), and the direction a self-sized slide comes
 *  from (`dialog/bottom`, `dialog/end`). */
export const FIGMA_ENTRY_PROPS: { duration: string; easing: string; delay: string | null; distance: string; scale: string; from: string | null } = {
  duration: 'duration', easing: 'easing', delay: null, distance: 'distance', scale: 'scale', from: null,
};

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
  motion: { figmaAnimationStyles(): readonly { styleId: string; name: string }[] };
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
  const kinds = new Map(api.motion.figmaAnimationStyles().map((s) => [s.name, s.styleId] as const));
  const byName = new Map((await api.getLocalCustomAnimationStylesAsync()).map((s) => [s.name, s] as const));
  const misses: string[] = [];
  let created = 0, entries = 0, bound = 0;
  for (const row of plan.styles) {
    let s = byName.get(row.name);
    if (!s) { s = api.createCustomAnimationStyle(); s.name = row.name; byName.set(row.name, s); created++; }
    markOwned(s);   // the ownership mark (#1884), as every style this plugin writes carries
    s.description = row.description;
    for (const e of [...s.animationEntries]) s.removeAnimationEntry(e.id);
    for (const entry of row.entries) {
      const kindName = FIGMA_ENTRY_KINDS[entry.kind];
      const styleId = kinds.get(kindName);
      if (!styleId) { misses.push(`${row.name}: this Figma has no '${kindName}' animation for its ${entry.kind} entry`); continue; }
      const props: Record<string, unknown> = {};
      const bind = (key: string | null, name: string): void => {
        if (!key) return;
        const v = varByName.get(name);
        if (!v) { misses.push(`${row.name}: ${name}`); return; }
        props[key] = api.variables.createVariableAlias(v);
        bound++;
      };
      bind(FIGMA_ENTRY_PROPS.duration, entry.duration);
      bind(FIGMA_ENTRY_PROPS.easing, entry.easing);
      bind(FIGMA_ENTRY_PROPS.delay, entry.delay);
      // A distance is written as its px (no motion distance variable exists in Figma yet, #4589); a self-sized slide
      // writes none, and plays the host's own default distance until JOB 102 names how a slide takes its own size.
      if (entry.distance && 'px' in entry.distance) props[FIGMA_ENTRY_PROPS.distance] = entry.distance.px;
      if (entry.from && FIGMA_ENTRY_PROPS.from) props[FIGMA_ENTRY_PROPS.from] = entry.from;
      if (entry.scale !== undefined) props[FIGMA_ENTRY_PROPS.scale] = entry.scale;
      await s.addAnimationEntryAsync(styleId, props);
      entries++;
    }
    await tick?.();
  }
  return { written: true, total: plan.styles.length, created, entries, bound, misses };
};
