/**
 * Prism3 engine — Figma animation styles, one per motion pattern, and its reduced sibling (#2857, motion phase 3).
 *
 * PURE: no `node:*`, no I/O. The plugin writes this plan (`apps/plugin/src/write-animation-styles.ts`).
 *
 * WHAT A STYLE IS. Each motion pattern (`motion-patterns.ts`, Q-PT1 A) becomes a Figma animation style whose entries are
 * its tracks. Every entry binds the published PRESET variables the track names (`<root>/motion/preset/<name>[/exit]/
 * duration`, `…/easing`, `…/delay`), never a hidden primitive (Q-MS1 A; the structure review's Q-MO1 and Q-M7 A, as
 * revised). So re-pointing a preset, which is one alias move on its variables, re-times every style that plays on it,
 * live, with no style rewritten.
 *
 * THE REDUCED SIBLING (Q-PT20 A, Q-PT11 A). Each track plays as its reduced kind says: `keep` plays the same entry on the
 * preset's `duration-reduced`; `fade` swaps the movement for an opacity entry on `duration-reduced`; `off` adds nothing
 * (the element takes its end state at once). A reduced style with no entry is not written: the element does not move.
 *
 * WHAT IS STILL OPEN, each behind one switch below so it lands in one place:
 *   - JOB 102 (the Mac check, results on #2857): whether a style can carry a fill color (`colorEntries`; Q-PT18 A: hover
 *     and press are styles only if it can); whether "X/enter" and "X/enter/reduced" coexist in the picker
 *     (`reducedName`; Q-PT20 A, else B's "X/enter · reduced"). The entry kinds' Figma names and the TIMING unit are the
 *     host's, in `write-animation-styles.ts` and `emit-figma-dims.ts` (`FIGMA_TIMING_UNIT`).
 *   - OWNER DECISION (posted on #2857 by this build): `grain`. A Figma animation style plays on the one layer it is
 *     applied to, and a pattern can move several (a dialog's scrim, panel and content). As built, a pattern that moves
 *     more than one element is a style per element (`dialog/enter/panel`); one that moves one element is one style.
 */
import type { Theme } from './theme';
import { at, buildTree, deref } from './tree';
import { nsName } from './emit-figma-color';
import { MOTION_PATTERNS, motionPlainWords, reducedKindOf, type MotionPattern, type MotionTrack, type SlideFrom } from './motion-patterns';

export const ANIMATION_STYLE_SWITCHES: {
  /** JOB 102: can a Figma animation style carry a fill color? Until it says yes, a color track has no entry, and hover
   *  and press (whose cue is color) are style-guide rows only (Q-PT18 A). */
  colorEntries: boolean;
  /** JOB 102: Q-PT20 A's "dialog/enter/reduced" (a style and a folder of the same name, side by side) if the picker shows
   *  it cleanly, else Q-PT20 B's "dialog/enter · reduced". */
  reducedName: 'folder' | 'suffix';
  /** OWNER DECISION (this build): one style per moving element of a pattern that moves several (`element`), or one style
   *  per pattern holding every element's entries (`pattern`). */
  grain: 'element' | 'pattern';
} = { colorEntries: false, reducedName: 'folder', grain: 'element' };

/** The patterns under "State /" in the picker (Q-PT19 A): changes of a control's state, not a component arriving. Typed:
 *  a new state pattern is named here on purpose. */
export const STATE_PATTERNS: readonly string[] = ['hover', 'pressed', 'pressed/release'];

/** What an entry animates. The host maps each to one of its own animation kinds (`write-animation-styles.ts`). */
export type AnimationEntryKind = 'opacity' | 'scale' | 'slide' | 'travel' | 'turn' | 'size' | 'color';

export type AnimationEntryRow = {
  kind: AnimationEntryKind;
  /** The pattern element the entry moves (`panel`), for the description and the style guide. */
  element: string;
  /** The preset path the track names (`surface.exit`). */
  preset: string;
  /** The Figma variables the entry binds, by name: the preset's TIMING and EASING slots. */
  duration: string;
  easing: string;
  delay: string;
  /** A slide's distance: the px its token resolves to for this brand (no motion distance variable exists in Figma yet,
   *  #4589), a px a brand set, or the element's own size. */
  distance?: { px: number; token?: string } | { self: true };
  from?: SlideFrom;
  /** A scale's start scale (Q-PT10 A), a track value, not a token. */
  scale?: number;
};

export type AnimationStyleRow = {
  name: string;
  description: string;
  pattern: string;
  /** The element it moves, or null for a style holding a whole pattern. */
  element: string | null;
  reduced: boolean;
  entries: AnimationEntryRow[];
};

export type AnimationStylesPlan = {
  styles: AnimationStyleRow[];
  /** Patterns with no style, and why: a style-guide row only. */
  guideOnly: { pattern: string; reduced: boolean; why: string }[];
};

const entryKind = (tr: MotionTrack): AnimationEntryKind =>
  tr.property === 'transform' ? (tr.transform ?? 'travel') : tr.property;

/** The published variable of one preset slot, by its Figma name (`<root>/motion/preset/surface/exit/duration`). */
export const presetVariable = (root: string, preset: string, slot: 'duration' | 'easing' | 'delay' | 'duration-reduced'): string =>
  nsName(root, `motion/preset/${preset.split('.').join('/')}/${slot}`);

/** A style's name: the pattern's own path (Q-PT17 A, Q-PT19 A), under `state/` for a state change, then the element where
 *  the pattern moves several, then the reduced sibling's form (Q-PT20). */
export const animationStyleName = (pattern: string, element: string | null, reduced: boolean, sw = ANIMATION_STYLE_SWITCHES): string => {
  const base = `${STATE_PATTERNS.includes(pattern) ? 'state/' : ''}${pattern}${element ? `/${element}` : ''}`;
  return !reduced ? base : sw.reducedName === 'folder' ? `${base}/reduced` : `${base} · reduced`;
};

const pxOf = (v: unknown): number | undefined => {
  const m = typeof v === 'string' ? /^(-?\d+(?:\.\d+)?)px$/.exec(v) : null;
  return m ? Number(m[1]) : typeof v === 'number' ? v : undefined;
};

/** The plan: every pattern the brand resolved (its track overrides applied), as styles. */
export const buildAnimationStylesPlan = (theme: Theme, sw = ANIMATION_STYLE_SWITCHES): AnimationStylesPlan => {
  const root = theme.root;
  const patterns: readonly MotionPattern[] = (theme.motion as { patterns?: MotionPattern[] } | undefined)?.patterns ?? MOTION_PATTERNS;
  let tree: unknown;
  const distanceOf = (tr: MotionTrack): AnimationEntryRow['distance'] => {
    const d = tr.distance;
    if (!d) return undefined;
    if ('self' in d) return { self: true };
    if ('px' in d) return { px: d.px };
    tree ??= buildTree(theme).tree;
    const path = d.token.startsWith('distance.') ? `${root}.motion.${d.token}` : `${root}.${d.token}`;
    const node = at(tree, path);
    const px = node ? pxOf(deref(tree, node)?.$value) : undefined;
    if (px === undefined) throw new Error(`figma animation styles: track '${tr.element}.${tr.property}' names distance '${d.token}', which resolves to no px value`);
    return { px, token: d.token };
  };
  const entryOf = (tr: MotionTrack, kind: AnimationEntryKind, durationSlot: 'duration' | 'duration-reduced'): AnimationEntryRow => ({
    kind, element: tr.element, preset: tr.preset,
    duration: presetVariable(root, tr.preset, durationSlot),
    easing: presetVariable(root, tr.preset, 'easing'),
    delay: presetVariable(root, tr.preset, 'delay'),
    ...(kind === 'slide' || kind === 'travel' ? { ...(tr.distance ? { distance: distanceOf(tr) } : {}), ...(tr.from ? { from: tr.from } : {}) } : {}),
    ...(kind === 'scale' && tr.scale !== undefined ? { scale: tr.scale } : {}),
  });
  const styles: AnimationStyleRow[] = [];
  const guideOnly: AnimationStylesPlan['guideOnly'] = [];
  for (const p of patterns) {
    // Hover and press are styles only if a style can carry their color (Q-PT18 A); until then, style-guide rows only.
    if (!sw.colorEntries && STATE_PATTERNS.includes(p.name)) {
      const why = "a state change, which is a style only if an animation style can carry a fill color (JOB 102, Q-PT18 A)";
      guideOnly.push({ pattern: p.name, reduced: false, why }, { pattern: p.name, reduced: true, why });
      continue;
    }
    const elements = [...new Set(p.tracks.map((tr) => tr.element))];
    const split = sw.grain === 'element' && elements.length > 1;
    const groups: { element: string | null; tracks: MotionTrack[] }[] = split
      ? elements.map((el) => ({ element: el, tracks: p.tracks.filter((tr) => tr.element === el) }))
      : [{ element: null, tracks: [...p.tracks] }];
    const say = (el: string | null, reduced: boolean): string =>
      el ? motionPlainWords(p, el, reduced) : elements.map((e) => motionPlainWords(p, e, reduced)).join(' ');
    let wrote = 0, wroteReduced = 0;
    for (const g of groups) {
      const usable = g.tracks.filter((tr) => sw.colorEntries || tr.property !== 'color');
      const full = usable.map((tr) => entryOf(tr, entryKind(tr), 'duration'));
      if (!full.length) continue;
      styles.push({ name: animationStyleName(p.name, g.element, false, sw), description: say(g.element, false), pattern: p.name, element: g.element, reduced: false, entries: full });
      wrote++;
      const reduced = usable.flatMap((tr): AnimationEntryRow[] => {
        const k = reducedKindOf(tr, p);
        return k === 'off' ? [] : [entryOf(tr, k === 'fade' ? 'opacity' : entryKind(tr), 'duration-reduced')];
      });
      if (reduced.length) { styles.push({ name: animationStyleName(p.name, g.element, true, sw), description: say(g.element, true), pattern: p.name, element: g.element, reduced: true, entries: reduced }); wroteReduced++; }
    }
    const why = 'its cue is a color change, and an animation style carries no fill color (JOB 102, Q-PT18 A)';
    if (!wrote) guideOnly.push({ pattern: p.name, reduced: false, why });
    if (!wroteReduced) guideOnly.push({ pattern: p.name, reduced: true, why: wrote ? "under reduced motion its cue is a color change, and an animation style carries no fill color (JOB 102, Q-PT18 A)" : why });
  }
  return { styles, guideOnly };
};
