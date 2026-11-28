/**
 * Motion, the preview (#4571, owner decision Q-ME3 A: split from the Depth & motion preview, UI redesign S9.2).
 *
 * WHAT IT SHOWS, in the legacy Style guide's markup: one section, **Motion**, headed and described as the lever section
 * it pairs with (Q23): the brand's curves with the roles that use each; the durations, with the spinner's turn apart as a
 * loop (T9), the stagger and the millisecond building blocks; springs; and the presets traced, with Play or Replay and a
 * Slow motion choice (D7 A, D9 A). All of it in the previewed mode only. A Presets edit on the levers re-times the traces.
 *
 * WHEN THE TRACES PLAY (owner decision D9 A): once after any Motion edit, and on Play or Replay, at real speed unless a
 * Slow motion divisor is chosen. A Motion edit is a repaint from the `brand` topic that changes what the traces draw in
 * the same mode (a duration or a preset's curve); a mode change or a mount plays nothing. With reduced motion on they
 * never play by themselves, and the section says "Reduced motion is on: playing once on request."; Play still plays
 * them once. The Slow motion choice is view state, kept here across repaints, and never written to the brand (#574).
 *
 * LEGACY MARKUP IN A LIGHT-PINNED HOST, SPECIMENS ON THE BRAND'S PAGE (plan §9.1), as `preview/depth.ts`.
 *
 * HOW IT REPAINTS: by store subscription (`brand`, `mode`), never through a legacy tier.
 */
import { currentMode, rp, subscribe, theme } from '../state/store';
import { resolvedModes } from '../state/verdict';
import { h, hook } from '../shell/dom';
import { DOMAINS, type PageData } from '../shell/pages';
import { modeLabel } from '../shell/preview';
import {
  durationRampSection, motionCurvesSection, motionStageSection, motionTransitionsSection, presetCurveOf, springsSection,
  type DurationsCopy, type StageCopy, type TransitionsCopy,
} from './sections/index';
import { buildTree, pxOf, subNode, type Theme } from '@prism3/engine';
import { SG_SURFACES, ground, oppositeOf, palSection, sgContext, type SgRole } from './sections/kit';
import { must } from '../must';

const PAGE = DOMAINS.find((d) => d.id === 'motion') as PageData;
/** A lever section's heading and description, from the page data the levers draw them from (Q23). */
const copyOf = (title: string): { title: string; desc: string } => ({ title, desc: PAGE.sections.find((x) => x.title === title)?.desc ?? '' });

/** The preview's own copy. APPROVED (owner, 2026-10-04) unless marked DRAFT; the DRAFT strings are in the S9.2
 *  fragment's "Copy for owner approval" block. */
export const MOTION_PREVIEW_COPY = {
  curves: { title: 'Curves', desc: 'The six curves are fixed. Each role picks one.' },   // title DRAFT (concept v6's)
  durations: {
    title: 'Durations',
    desc: 'Each duration at this tempo, and its reduced-motion value.',
    head: ['Step', 'Duration', 'Reduced motion'],                     // DRAFT
    eliminated: 'none',                                               // DRAFT
    stagger: 'Between items that animate one after another.',         // DRAFT
    spinTitle: 'spin',                                                // the token's own name
    spinNote: 'A loop, not a step: the same at every tempo.',
    perTurn: (ms: number) => `${ms}ms per turn`,                       // DRAFT
    reducedTurn: (ms: number) => `reduced ${ms}ms`,                    // DRAFT
    blocksTitle: 'Building blocks',
    blocksDesc: 'Every millisecond value the durations use.',
  } satisfies DurationsCopy,
  springs: { title: 'Springs', desc: 'Physics presets for platforms that animate with springs. Read-only.' },
  transitions: {
    title: 'Presets',                                                 // DRAFT (#2857, for the owner)
    desc: 'Each motion preset traced at this tempo, along the curve its easing uses.',   // DRAFT (#2857, for the owner)
    play: 'Play', replay: 'Replay', slow: 'Slow motion', off: 'Off',
    reduced: 'Reduced motion is on: playing once on request.',
  } satisfies TransitionsCopy,
  /** #4571 PR 3: the stage. Every string here is DRAFT, in the PR's "Strings for owner approval". */
  stage: {
    title: 'In motion',
    desc: 'The chosen preset playing on each pattern that uses it, at this tempo, with one bar per moving part.',
    preset: 'Preset',
    usedBy: 'Used by',
    specimen: 'No pattern uses this preset yet, so it plays on a specimen.',
    timeline: 'Timeline',
    play: 'Play', replay: 'Replay', slow: 'Slow motion', off: 'Off',
    reduced: 'Reduced motion is on: playing once on request.',
    ms: (ms: number) => `${ms}ms`,
    delay: (ms: number) => `waits ${ms}ms`,
  } satisfies StageCopy,
} as const;

/** Whether the viewer asked for reduced motion. Read on every paint, so a change applies at the next one. */
const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The Slow motion divisor: view state, kept for the session (a page visit never resets it), never a token. */
let slowmo = 1;
/** The stage's preset and pattern (#4571 PR 3): view state, kept for the session, never written to the brand. A
 *  pattern of null plays the preset's first user. */
let stagePreset: string | null = null;
let stagePattern: string | null = null;

/** A distance token's px (`distance.nudge`, `space.<step>`), read from the brand's tree once per theme. Drawing only:
 *  where an element travels, never when. */
const treeOf = new WeakMap<Theme, unknown>();
const distancePxOf = (t: Theme) => (token: string): number => {
  let tree = treeOf.get(t);
  if (!tree) { tree = buildTree(t).tree; treeOf.set(t, tree); }
  const n = subNode(tree, `${t.root}.motion.${token}`) ?? subNode(tree, `${t.root}.${token}`);
  return n ? pxOf(tree, n) : 0;
};

/** Mount the Motion preview into `host`. Subscriptions are released through `cleanups`. */
export const mountMotionPreview = (host: HTMLElement, cleanups: (() => void)[]): void => {
  const stack = hook(h('div', 'p3-stack p3-preview-stack'), 'motion-preview');
  const card = hook(h('div', 'p3-legacy-card'), 'motion-style-guide');
  card.dataset.theme = 'light';
  stack.append(card);
  host.replaceChildren(stack);
  /** Whether the traces have played on this visit: Play becomes Replay. */
  let played = false;
  /** What the traces drew last, and in which mode: a change in the same mode is a Motion edit. */
  let lastDrawn: string | null = null;
  let lastMode: string | null = null;
  let play: () => void = () => {};

  const paint = (why: 'mount' | 'brand' | 'mode'): void => {
    const all = resolvedModes(theme);
    const rolesByMode = new Map<string, Record<string, SgRole | undefined>>(all.map((x) => [x.mode as string, x.roles as Record<string, SgRole | undefined>]));
    const cur: string = rolesByMode.has(currentMode) ? currentMode : must(rp.modes[0], 'the first mode');
    const c = sgContext({
      rolesByMode, cur, opp: oppositeOf(cur, rp.modes, (m) => rolesByMode.has(m)), namespace: theme.namespace, modeLabel, badges: false,
      paletteHex: (p, s) => theme.palettes.find((x) => x.palette === p)?.steps.find((x) => x.key === s)?.hex ?? null,
    });
    const page = SG_SURFACES[0];
    const mo = theme.motion;
    const C = MOTION_PREVIEW_COPY;

    const mot = copyOf('Motion');
    const m = palSection(mot.title, mot.desc);
    const reduced = reducedMotion();
    const traces = motionTransitionsSection(mo, cur, {
      slowmo, reduced, played,
      onSlowmo: (v) => { slowmo = v; paint('mode'); },
      onPlay: () => { played = true; },
    }, C.transitions);
    if (!stagePreset || !mo.presets.some((p) => p.preset === stagePreset)) stagePreset = mo.presets[0]?.preset ?? '';
    const stage = motionStageSection(c, mo, cur, distancePxOf(theme), {
      preset: stagePreset, pattern: stagePattern, slowmo, reduced, played,
      onPick: (preset, pattern) => { stagePreset = preset; stagePattern = pattern; paint('mode'); },
      onSlowmo: (v) => { slowmo = v; paint('mode'); },
      onPlay: () => { played = true; },
    }, C.stage);
    play = () => { traces.play(); stage.play(); };
    m.append(stage.node, motionCurvesSection(mo, cur, C.curves), durationRampSection(mo, cur, C.durations), springsSection(mo.spring, C.springs), traces.node);

    const secs = [m];
    // Q24: each section's container on the levers panel's gray, as the other previews' are.
    for (const s of secs) s.classList.add('p3-sgsec');
    card.replaceChildren(...secs.map((s) => ground(c, s, page)));

    // D9: a Motion edit plays the traces once, at the chosen speed, unless reduced motion is on.
    const drawn = JSON.stringify([mo.motionByMode?.[cur]?.duration ?? mo.duration, mo.presets, mo.patterns, mo.presets.map((p) => presetCurveOf(mo, cur, p))]);
    if (why === 'brand' && lastDrawn !== null && lastMode === cur && drawn !== lastDrawn && !reduced) {
      played = true;
      play();
      card.querySelector<HTMLElement>('[data-p3="motion-play"]')!.textContent = C.transitions.replay;
      card.querySelector<HTMLElement>('[data-p3="motion-stage-play"]')!.textContent = C.stage.replay;
    }
    lastDrawn = drawn;
    lastMode = cur;
  };
  cleanups.push(subscribe('brand', () => paint('brand')), subscribe('mode', () => paint('mode')));
  paint('mount');
};
