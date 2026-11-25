/** Prism3 engine — Motion patterns (#2857 phase 2): what each component's motion moves, as data.
 *
 * A PATTERN is one component half that moves ("dialog / enter"). It is a list of TRACKS (Q-MS7 A). Each track moves
 * one element through one property group and names a PRESET for its timing (Q-MP10 A), so a pattern holds no timing
 * of its own: every duration, curve and delay it plays on is a published `motion.preset.*` token. A track also holds
 * what is the element's own: the distance it travels (Q-MP6 A, Q-PT9 A), its start scale (Q-PT10 A) and its kind
 * under reduced motion (Q-PT11 A).
 *
 * WHERE IT GOES (Q-PT1 A): engine data, beside the presets, never in the token tree (DTCG has no type for it, and it
 * holds no value a token doesn't). It is emitted to the agent file (`motion_patterns`), into each component's docs
 * through the def's `motion` field (Q-PT2 A), and, in phase 3, to one Figma style per pattern.
 *
 * A BRAND OVERRIDES A TRACK, never which tracks exist (Q-PT15 A): `motionPersonality.patterns.<pattern>.<track>`,
 * where a track's key is `<element>.<property>`, with its preset, distance, start scale or reduced kind.
 *
 * Dependency-light by rule: the component defs import `motionOf` from here, and they are bundled into the plugin.
 */
import { MOTION_PRESET_DEFAULTS, ARRIVING_PRESETS, QUICK_ARRIVAL_PRESET, MOTION_DISTANCE_NAMES } from './theme-motion';
import { spaceScale } from './scale';
import type { MotionTrackInput } from './theme-motion';

/** The property groups a track moves (Q-MS7 A). */
export type TrackProperty = 'opacity' | 'transform' | 'size' | 'color';
/** What a transform track does: grow from its start scale, slide in from an edge or by a distance, turn in place, or
 *  travel to a new place in the layout (the in-place travels, Q-PT5 A). */
export type TransformKind = 'scale' | 'slide' | 'turn' | 'travel';
/** What a track does under reduced motion (Q-PT11 A): `keep` plays on its preset's reduced duration, `off` jumps to its
 *  end, and `fade` swaps its movement for a fade of the element, on the reduced duration. */
export type ReducedKind = 'fade' | 'keep' | 'off';
/** A distance: a token path (`distance.nudge`, `space.<step>`), the element's own size (`self`, a surface sliding in by
 *  its own height or width), or, in a brand override only, a number of px (Q-PT9 A). */
export type TrackDistance = { token: string } | { self: true } | { px: number };
/** Where a slide comes from: an edge of the viewport, or upward by its distance. */
export type SlideFrom = 'bottom' | 'end' | 'below';

export type MotionTrack = {
  element: string;
  property: TrackProperty;
  /** With `property: 'transform'`, what the transform does. */
  transform?: TransformKind;
  /** A preset path inside `motion.preset`: `<name>`, or `<name>.exit` for an arriving preset's closing half (Q-PT3 A). */
  preset: string;
  /** A slide's distance. */
  distance?: TrackDistance;
  /** A slide's origin. */
  from?: SlideFrom;
  /** A scale transform's start scale, above 0 and at most 1 (Q-PT10 A). */
  scale?: number;
  /** Set only where the default (Q-PT11 A) is not what the component does. */
  reduced?: ReducedKind;
};
/** `enter` and `exit` are a component arriving and leaving; `change` is a change in place (a selection, a toggle). */
export type PatternHalf = 'enter' | 'exit' | 'change';
export type MotionPattern = {
  /** The name agents, the docs and (phase 3) the Figma style use: `component[/placement]/half` (Q-PT17 A). */
  name: string;
  half: PatternHalf;
  /** For a component with several patterns per half, the placement the prose names ("a bottom sheet"). */
  label?: string;
  tracks: MotionTrack[];
};

const POP = QUICK_ARRIVAL_PRESET;
const t = (element: string, property: TrackProperty, preset: string, more: Partial<MotionTrack> = {}): MotionTrack => ({ element, property, preset, ...more });

/**
 * THE STARTER SET (Q-MP11 A, Q-PT16 A): the §2 table of the 2026-11-25 questions comment on #2857, every row on its
 * timing of today. The scrim names its panel's preset (Q-PT8 A). The in-place travels name `move` (Q-PT5 A). Start
 * scales are the owner's (Q-PT10 A): dialog 0.96, popover and menu 0.95, press 0.98 (Q-PS1 A).
 */
export const MOTION_PATTERNS: readonly MotionPattern[] = [
  { name: 'dialog/enter', half: 'enter', label: 'a centered dialog', tracks: [
    t('scrim', 'opacity', 'surface'), t('panel', 'opacity', 'surface'), t('panel', 'transform', 'surface', { transform: 'scale', scale: 0.96 }), t('content', 'opacity', 'fade')] },
  { name: 'dialog/exit', half: 'exit', label: 'a centered dialog', tracks: [
    t('scrim', 'opacity', 'surface.exit'), t('panel', 'opacity', 'surface.exit'), t('panel', 'transform', 'surface.exit', { transform: 'scale', scale: 0.96 }), t('content', 'opacity', 'fade.exit')] },
  { name: 'dialog/bottom/enter', half: 'enter', label: 'a bottom sheet or a full-screen dialog', tracks: [
    t('scrim', 'opacity', 'surface'), t('panel', 'transform', 'surface', { transform: 'slide', from: 'bottom', distance: { self: true } }), t('content', 'opacity', 'fade')] },
  { name: 'dialog/bottom/exit', half: 'exit', label: 'a bottom sheet or a full-screen dialog', tracks: [
    t('scrim', 'opacity', 'surface.exit'), t('panel', 'transform', 'surface.exit', { transform: 'slide', from: 'bottom', distance: { self: true } }), t('content', 'opacity', 'fade.exit')] },
  { name: 'dialog/end/enter', half: 'enter', label: 'an end panel', tracks: [
    t('scrim', 'opacity', 'surface'), t('panel', 'transform', 'surface', { transform: 'slide', from: 'end', distance: { self: true } })] },
  { name: 'dialog/end/exit', half: 'exit', label: 'an end panel', tracks: [
    t('scrim', 'opacity', 'surface.exit'), t('panel', 'transform', 'surface.exit', { transform: 'slide', from: 'end', distance: { self: true } })] },
  { name: 'toast/enter', half: 'enter', tracks: [
    t('toast', 'opacity', 'fade'), t('toast', 'transform', 'fade', { transform: 'slide', from: 'below', distance: { token: 'distance.nudge' } })] },
  { name: 'toast/exit', half: 'exit', tracks: [t('toast', 'opacity', 'fade.exit')] },
  { name: 'tooltip/show', half: 'enter', tracks: [t('tooltip', 'opacity', POP)] },
  { name: 'tooltip/hide', half: 'exit', tracks: [t('tooltip', 'opacity', `${POP}.exit`)] },
  { name: 'popover/open', half: 'enter', tracks: [
    t('popover', 'opacity', POP), t('popover', 'transform', POP, { transform: 'scale', scale: 0.95 })] },
  { name: 'popover/close', half: 'exit', tracks: [t('popover', 'opacity', `${POP}.exit`)] },
  { name: 'accordion/expand', half: 'enter', tracks: [
    t('panel', 'size', 'expand'), t('panel', 'opacity', 'expand'), t('indicator', 'transform', 'move', { transform: 'turn', reduced: 'off' })] },
  { name: 'accordion/collapse', half: 'exit', tracks: [
    t('panel', 'size', 'expand'), t('panel', 'opacity', 'expand'), t('indicator', 'transform', 'move', { transform: 'turn', reduced: 'off' })] },
  { name: 'fade/in', half: 'enter', tracks: [t('element', 'opacity', 'fade')] },
  { name: 'fade/out', half: 'exit', tracks: [t('element', 'opacity', 'fade.exit')] },
  { name: 'hover', half: 'change', tracks: [t('control', 'color', 'state')] },
  { name: 'pressed', half: 'change', tracks: [t('control', 'transform', 'press', { transform: 'scale', scale: 0.98, reduced: 'off' }), t('control', 'color', 'press')] },
  { name: 'pressed/release', half: 'change', tracks: [t('control', 'transform', 'state', { transform: 'scale', scale: 0.98, reduced: 'off' }), t('control', 'color', 'state')] },
  { name: 'tabs/select', half: 'change', tracks: [t('underline', 'transform', 'move', { transform: 'travel', reduced: 'off' }), t('panel', 'opacity', 'crossfade')] },
  { name: 'switch/toggle', half: 'change', tracks: [t('thumb', 'transform', 'move', { transform: 'travel', reduced: 'off' }), t('track', 'color', 'move')] },
  { name: 'segmented/select', half: 'change', tracks: [t('pill', 'transform', 'move', { transform: 'travel', reduced: 'off' }), t('label', 'color', 'move')] },
];

/** A track's key, the name a brand override uses: `<element>.<property>`. Unique within a pattern. */
export const trackKey = (tr: MotionTrack): string => `${tr.element}.${tr.property}`;

/** A track's kind under reduced motion (Q-PT11 A): its own if set; else opacity and color keep, and a transform or a
 *  size change goes off when the same element also fades, so the fade carries the cue, and fades otherwise. */
export const reducedKindOf = (tr: MotionTrack, pattern: { tracks: readonly MotionTrack[] }): ReducedKind => {
  if (tr.reduced) return tr.reduced;
  if (tr.property === 'opacity' || tr.property === 'color') return 'keep';
  return pattern.tracks.some((o) => o.element === tr.element && o.property === 'opacity') ? 'off' : 'fade';
};

/** The preset paths a track may name: every preset, and an arriving preset's exit half. */
export const presetPaths = (presets: readonly string[] = MOTION_PRESET_DEFAULTS.map((d) => d.preset)): string[] =>
  [...presets, ...presets.filter((p) => ARRIVING_PRESETS.includes(p)).map((p) => `${p}.exit`)];

/** Everything wrong with a set of patterns, each named (the engine's data, and a brand's resolved patterns):
 *  - a track naming a preset that doesn't exist;
 *  - two tracks with one key in a pattern;
 *  - a distance on a track that isn't a slide, a scale on one that doesn't scale, a scale outside (0, 1];
 *  - a track on the opposite half's preset (owner decision A, #4601): an entrance on an exit half, or an exit on an
 *    arriving preset's entering half. The exit half is the lever for an exit's timing; an in-place preset, which has
 *    no exit half, plays either way, and a change in place is not held to a half;
 *  - a pattern whose every track goes off under reduced motion, so it shows no cue at all (rule R7). */
export const patternProblems = (patterns: readonly MotionPattern[], presets?: readonly string[]): string[] => {
  const paths = new Set(presetPaths(presets));
  const out: string[] = [];
  for (const p of patterns) {
    const seen = new Set<string>();
    for (const tr of p.tracks) {
      const at = `pattern '${p.name}' track '${trackKey(tr)}'`;
      if (seen.has(trackKey(tr))) out.push(`${at}: two tracks share this key; each element moves one property group once`);
      seen.add(trackKey(tr));
      if (!paths.has(tr.preset)) out.push(`${at}: unknown preset '${tr.preset}' (have: ${[...paths].join(', ')})`);
      if (tr.distance && !(tr.property === 'transform' && tr.transform === 'slide')) out.push(`${at}: a distance belongs to a slide`);
      if (tr.scale !== undefined && !(tr.property === 'transform' && tr.transform === 'scale')) out.push(`${at}: a start scale belongs to a scale`);
      if (tr.scale !== undefined && !(Number.isFinite(tr.scale) && tr.scale > 0 && tr.scale <= 1)) out.push(`${at}: a start scale is above 0 and at most 1 (got ${tr.scale})`);
      if (tr.property === 'transform' && !tr.transform) out.push(`${at}: a transform track says what it does (scale, slide, turn or travel)`);
      if (p.half === 'enter' && tr.preset.endsWith('.exit'))
        out.push(`${at}: an entrance plays on an entering half, not '${tr.preset}' (to retime the entrance, use another entering preset)`);
      if (p.half === 'exit' && ARRIVING_PRESETS.includes(tr.preset))
        out.push(`${at}: an exit plays on an exit half, '${tr.preset}.exit', not '${tr.preset}' (to retime the exit, re-point presets.${tr.preset}.exit)`);
    }
    if (p.tracks.length && p.tracks.every((tr) => reducedKindOf(tr, p) === 'off'))
      out.push(`pattern '${p.name}': every track goes off under reduced motion, so it shows no cue that anything changed; one track keeps or fades (R7)`);
  }
  return out;
};

/** The engine's patterns with a brand's overrides applied, each checked by name (Q-PT15 A). A brand changes a track's
 *  preset (`preset.<name>` or `preset.<name>.exit`), distance (`distance.<name>`, `space.<step>` or px), start scale or
 *  reduced kind, never which tracks exist. The result must still pass `patternProblems`, R7 included. */
export const resolvePatterns = (overrides: Record<string, Record<string, MotionTrackInput>> = {}, presets?: readonly string[]): MotionPattern[] => {
  const byName = new Map(MOTION_PATTERNS.map((p) => [p.name, p]));
  for (const name of Object.keys(overrides))
    if (!byName.has(name)) throw new Error(`motionPersonality.patterns: unknown pattern '${name}' (have: ${[...byName.keys()].join(', ')})`);
  const out = MOTION_PATTERNS.map((p) => {
    const given = overrides[p.name];
    if (!given) return p;
    const at = `motionPersonality.patterns.${p.name}`;
    if (typeof given !== 'object' || Array.isArray(given)) throw new Error(`${at}: a pattern override is an object of tracks, keyed '<element>.<property>'`);
    const keys = new Set(p.tracks.map(trackKey));
    for (const k of Object.keys(given))
      if (!keys.has(k)) throw new Error(`${at}: unknown track '${k}'; a brand changes a track, never which tracks exist (have: ${[...keys].join(', ')})`);
    return { ...p, tracks: p.tracks.map((tr) => {
      const o = given[trackKey(tr)];
      if (!o) return tr;
      const ta = `${at}.${trackKey(tr)}`;
      for (const f of Object.keys(o))
        if (!['preset', 'distance', 'scale', 'reduced'].includes(f)) throw new Error(`${ta}: unknown field '${f}' (have: preset, distance, scale, reduced)`);
      const next: MotionTrack = { ...tr };
      if (o.preset !== undefined) {
        if (typeof o.preset !== 'string' || !o.preset.startsWith('preset.')) throw new Error(`${ta}.preset: a preset is a path, 'preset.<name>' or 'preset.<name>.exit' (got ${JSON.stringify(o.preset)})`);
        next.preset = o.preset.slice('preset.'.length);
      }
      if (o.distance !== undefined) {
        if (typeof o.distance === 'number') {
          if (!(Number.isFinite(o.distance) && o.distance > 0)) throw new Error(`${ta}.distance: a distance in px is a number above 0 (got ${o.distance})`);
          next.distance = { px: o.distance };
        } else if (typeof o.distance === 'string' && /^distance\.[a-z][a-z0-9-]*$/.test(o.distance)) {
          // #4601 review: the token must exist, or the agent file ships a reference to nothing.
          if (!MOTION_DISTANCE_NAMES.includes(o.distance.slice('distance.'.length)))
            throw new Error(`${ta}.distance: unknown distance '${o.distance}' (have: ${MOTION_DISTANCE_NAMES.map((n) => `distance.${n}`).join(', ')})`);
          next.distance = { token: o.distance };
        } else if (typeof o.distance === 'string' && /^space\.[0-9]+$/.test(o.distance)) {
          const steps = spaceScale().map((s) => s.key);
          if (!steps.includes(o.distance.slice('space.'.length)))
            throw new Error(`${ta}.distance: unknown space step '${o.distance}' (have: ${steps.map((k) => `space.${k}`).join(', ')})`);
          next.distance = { token: o.distance };
        } else throw new Error(`${ta}.distance: a distance is a token path ('distance.nudge', 'space.<step>') or a number of px (got ${JSON.stringify(o.distance)})`);
      }
      if (o.scale !== undefined) {
        if (typeof o.scale !== 'number') throw new Error(`${ta}.scale: a start scale is a number (got ${JSON.stringify(o.scale)})`);
        next.scale = o.scale;
      }
      if (o.reduced !== undefined) {
        if (!['fade', 'keep', 'off'].includes(o.reduced)) throw new Error(`${ta}.reduced: a reduced kind is fade, keep or off (got ${JSON.stringify(o.reduced)})`);
        next.reduced = o.reduced;
      }
      return next;
    }) };
  });
  const bad = patternProblems(out, presets);
  if (bad.length) {
    // Name the owner: a problem in a pattern the brand overrode is the brand's input; one in a pattern it didn't touch
    // is the engine's own data (a brand with no overrides cannot cause it).
    const owned = bad.filter((m) => Object.keys(overrides).some((n) => m.startsWith(`pattern '${n}'`)));
    const engine = bad.filter((m) => !owned.includes(m));
    throw new Error([
      ...(owned.length ? [`motionPersonality.patterns: ${owned.join('; ')}`] : []),
      ...(engine.length ? [`the engine's motion patterns (MOTION_PATTERNS in motion-patterns.ts): ${engine.join('; ')}`] : []),
    ].join('; '));
  }
  return out;
};

// ---- the prose a component's docs carry, generated from its patterns (Q-PT2 A) --------------------------------------

const pct = (s: number): string => `${Math.round(s * 100)}%`;
const presetToken = (path: string): string => `motion.preset.${path}`;
/** What a track does, in plain words, for the half it plays in, without its subject ("fades in"). */
const verbOf = (tr: MotionTrack, half: PatternHalf): string => {
  if (tr.property === 'opacity') return half === 'enter' ? 'fades in' : half === 'exit' ? 'fades out' : 'cross-fades';
  if (tr.property === 'color') return 'changes color';
  if (tr.property === 'size') return half === 'exit' ? 'eases closed' : 'eases open to its content height';
  if (tr.transform === 'scale') return half === 'enter' ? `scales up from ${pct(tr.scale ?? 1)}` : half === 'exit' ? `scales down to ${pct(tr.scale ?? 1)}` : `scales to ${pct(tr.scale ?? 1)} and back`;
  if (tr.transform === 'slide') {
    const by = tr.distance && 'token' in tr.distance ? ` by motion.${tr.distance.token}` : '';
    if (tr.from === 'bottom') return half === 'exit' ? 'slides back down' : 'slides up from the bottom edge';
    if (tr.from === 'end') return half === 'exit' ? 'slides back out' : 'slides in from the end edge';
    return half === 'exit' ? `slides back down${by}` : `slides up${by}`;
  }
  if (tr.transform === 'turn') return half === 'exit' ? 'turns back' : 'turns to its open position';
  return 'travels to its new place';
};
const list = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const sentence = (s: string): string => `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
/** Consecutive tracks on one element share their subject: "the panel fades in and scales up from 96%". */
const clausesOf = (tracks: readonly MotionTrack[], verb: (tr: MotionTrack) => string): string[] => {
  const out: { element: string; verbs: string[] }[] = [];
  for (const tr of tracks) {
    const last = out[out.length - 1];
    if (last && last.element === tr.element) last.verbs.push(verb(tr));
    else out.push({ element: tr.element, verbs: [verb(tr)] });
  }
  return out.map((c) => `the ${c.element} ${list(c.verbs)}`);
};
/** One pattern as a sentence. A run of tracks on one preset shares it: "…, on motion.preset.surface; …". */
const patternSays = (p: MotionPattern, named: boolean): string => {
  const runs: { preset: string; tracks: MotionTrack[] }[] = [];
  for (const tr of p.tracks) {
    const last = runs[runs.length - 1];
    if (last && last.preset === tr.preset) last.tracks.push(tr);
    else runs.push({ preset: tr.preset, tracks: [tr] });
  }
  const body = runs.map((r) => `${list(clausesOf(r.tracks, (tr) => verbOf(tr, p.half)))} on ${presetToken(r.preset)}`).join('; ');
  return sentence(`${named && p.label ? `for ${p.label}, ` : ''}${body}`);
};
/** What one element does under reduced motion, its tracks together: what still plays, on which reduced duration, and
 *  what doesn't ("the panel fades in on motion.preset.surface.duration-reduced, with no scale"). */
const OFF_SAYS: Record<TransformKind, string> = { scale: 'scale', slide: 'slide', turn: 'turn', travel: 'travel' };
const reducedOfElement = (element: string, tracks: readonly MotionTrack[], p: MotionPattern): string => {
  const plays: string[] = [];
  const stills: string[] = [];
  let sized = false, travels = false;
  for (const tr of tracks) {
    const kind = reducedKindOf(tr, p);
    const on = `on ${presetToken(tr.preset)}.duration-reduced`;
    if (kind === 'keep') plays.push(tr.property === 'color' ? `fades to its new color ${on}` : `${verbOf(tr, p.half)} ${on}`);
    else if (kind === 'fade') plays.push(`fades ${p.half === 'exit' ? 'out' : 'in'} ${on}, instead of ${tr.transform === 'slide' ? 'sliding' : tr.transform === 'scale' ? 'scaling' : 'moving'}`);
    else if (tr.property === 'size') sized = true;
    else if (tr.transform === 'travel') travels = true;
    else stills.push(OFF_SAYS[tr.transform ?? 'travel']);
  }
  const once = [...(sized ? [`its size changes at once`] : []), ...(travels ? [`it takes its new place at once`] : [])];
  if (!plays.length) {
    if (sized) return `the ${element}'s size changes at once`;
    if (travels) return `the ${element} takes its new place at once`;
    return `the ${element} doesn't ${list(stills)}`;
  }
  return `the ${element} ${list(plays)}${once.length ? `, and ${list(once)}` : ''}${stills.length ? `, with no ${list(stills)}` : ''}`;
};
/** A pattern under reduced motion, element by element in track order. */
const reducedSays = (p: MotionPattern): string => {
  const order: string[] = [];
  const by = new Map<string, MotionTrack[]>();
  for (const tr of p.tracks) {
    if (!by.has(tr.element)) { by.set(tr.element, []); order.push(tr.element); }
    by.get(tr.element)!.push(tr);
  }
  return order.map((el) => reducedOfElement(el, by.get(el)!, p)).join('; ');
};

/** A component's `motion` field, generated from the patterns it names (Q-PT2 A), so its prose and its data cannot
 *  disagree. `notes` adds the component's own sentences after the generated ones. */
export type MotionNotes = { enter?: string; exit?: string; reduceMotion?: string };
export type ComponentMotion = { patterns: string[]; enter: string; exit: string; reduceMotion: string };
export const motionProse = (names: readonly string[], notes: MotionNotes = {}, patterns: readonly MotionPattern[] = MOTION_PATTERNS): Omit<ComponentMotion, 'patterns'> => {
  const byName = new Map(patterns.map((p) => [p.name, p]));
  const ps = names.map((n) => {
    const p = byName.get(n);
    if (!p) throw new Error(`motionOf: unknown pattern '${n}' (have: ${[...byName.keys()].join(', ')})`);
    return p;
  });
  const of = (half: PatternHalf) => ps.filter((p) => p.half === half);
  const join = (xs: string[], note?: string) => [...xs, ...(note ? [note] : [])].join(' ');
  const enters = of('enter'), exits = of('exit'), changes = of('change');
  const many = (xs: MotionPattern[]) => xs.length > 1;
  const enter = enters.length
    ? join(enters.map((p) => patternSays(p, many(enters))), notes.enter)
    : join([changes.length ? `None. On a change, ${changes.map((p) => patternSays(p, false).replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase())).join('; ')}.` : 'None.'], notes.enter);
  const exit = exits.length ? join(exits.map((p) => patternSays(p, many(exits))), notes.exit) : join(['None.'], notes.exit);
  const reduced = ps.map((p, i) => {
    const lead = many(ps) && p.label ? `for ${p.label} ${p.half === 'exit' ? 'closing' : 'opening'}, ` : '';
    const body = `${lead}${reducedSays(p)}`;
    return i === 0 ? `Under prefers-reduced-motion, ${body}.` : sentence(body);
  });
  const reduceMotion = join(reduced, notes.reduceMotion);
  return { enter, exit, reduceMotion };
};
/** What a def writes for its `motion` field: the pattern names, and its prose generated from them, each of the def's
 *  own `notes` appended after the generated sentences of its field. */
export const motionOf = (names: readonly string[], notes?: MotionNotes): ComponentMotion => ({ patterns: [...names], ...motionProse(names, notes) });
