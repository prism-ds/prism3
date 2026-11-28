/** Prism3 engine — the motion editor's read model (#4571, `docs/superpowers/motion-editor-proposal.md` §5 PR 1).
 *
 * Pure helpers a motion editor reads, in Studio and (on the same UI, Q-ME4 A) in the plugin. None decides anything the
 * engine doesn't: each one reads the lists the engine checks a brand's input against, or the motion the engine
 * resolved, so the editor offers exactly what `buildMotion` and `resolvePatterns` accept.
 *
 *   - `presetSlotTargets`: every target each preset slot accepts (Q-ME1 A: anything the engine accepts), grouped the
 *     way a picker lists them, roles first, then curves, then springs. The lists are `presetTargets`, the same
 *     function the engine's refusals name, so the two cannot disagree.
 *   - `durationTargetsFor`: the spring rule, as a picker needs it. A preset eased by a spring plays for that spring's
 *     settle time, so its duration slot offers only that; any other easing offers the steps.
 *   - `slotPathsOf`: a resolved half's slots back as the paths a brand writes, for a picker's current value.
 *   - `easingSourceOf`: whether an easing slot follows a role (so a role re-point reaches it) or is fixed to a curve
 *     or a spring (so it doesn't). The proposal's §2.1 behavior 1.
 *   - `presetSlotsSet`: which slots the brand set on a preset and on its exit half, for a "changed" mark and a reset.
 *     An unset exit slot follows the entrance (`exitStepOf`): the proposal's §2.1 behavior 2.
 *   - `presetUsedBy`, `patternsReachedBy`: each preset path's tracks, in pattern order, read from the patterns the engine resolved, so a
 *     brand's track override that moves a track to another preset moves it here too.
 *   - `trackTargets`: what a track override may set: a preset path, a distance and a reduced kind.
 *   - `presetAdvisories`: where a preset's slots would draw an objection, as codes (Q-ME1 A: warn, never block).
 *
 * Copy is not here: a label or a sentence the editor shows is the surface's, and the owner's (#4571).
 *
 * PURE: no `node:*`, no I/O. It is bundled into the Studio and the plugin.
 */
import { MOTION_DISTANCE_NAMES, presetTargets, PRESET_SLOTS, ARRIVING_PRESETS } from './theme-motion';
import type { MotionAxis, MotionPersonality, MotionPresetHalf } from './theme-motion';
import { presetPaths, trackKey, REDUCED_KINDS } from './motion-patterns';
import type { MotionPattern, ReducedKind } from './motion-patterns';
import { spaceScale } from './scale';

/** A target's group, the heading a picker lists it under. */
export type SlotTargetGroup = 'step' | 'spring-duration' | 'role' | 'curve' | 'spring' | 'delay';
export type SlotTarget = { path: string; group: SlotTargetGroup };
/** The slice of the resolved motion the read model needs. */
export type MotionTargets = Pick<MotionAxis, 'easing' | 'spring' | 'easingRoles'>;

const GROUP_OF: Record<string, SlotTargetGroup> = {
  duration: 'step', 'spring-duration': 'spring-duration', 'easing-role': 'role', easing: 'curve', spring: 'spring', delay: 'delay',
};
const grouped = (paths: readonly string[]): SlotTarget[] =>
  paths.map((path) => ({ path, group: GROUP_OF[path.slice(0, path.indexOf('.'))]! }));

/** Every target each preset slot accepts, in the order a picker lists them. `delay` omits "no delay", which is the
 *  slot left unset. */
export const presetSlotTargets = (m: MotionTargets): { duration: SlotTarget[]; easing: SlotTarget[]; delay: SlotTarget[] } => {
  const t = presetTargets(m.easing, m.spring, m.easingRoles.map((r) => r.role));
  return { duration: grouped(t.duration), easing: grouped(t.easing), delay: grouped(t.delay) };
};

/** The duration targets that go with an easing target (the spring rule): `spring.<s>` takes only
 *  `spring-duration.<s>`; any other easing takes the steps of the scale. */
export const durationTargetsFor = (m: MotionTargets, easingPath: string): SlotTarget[] => {
  const all = presetSlotTargets(m).duration;
  if (easingPath.startsWith('spring.')) return all.filter((t) => t.path === `spring-duration.${easingPath.slice('spring.'.length)}`);
  return all.filter((t) => t.group === 'step');
};

/** A resolved half's slots, as the paths a brand writes. A `delay` of null is the slot unset: the preset starts at once. */
export const slotPathsOf = (h: MotionPresetHalf): { duration: string; easing: string; delay: string | null } => ({
  duration: 'step' in h.duration ? `duration.${h.duration.step}` : `spring-duration.${h.duration.spring}`,
  easing: 'role' in h.easing ? `easing-role.${h.easing.role}` : 'curve' in h.easing ? `easing.${h.easing.curve}` : `spring.${h.easing.spring}`,
  delay: h.delay === null ? null : `delay.${h.delay}`,
});

/** Where an easing slot's curve comes from: a role it follows, or a curve or spring it is fixed to. */
export type EasingSource = { follows: string } | { fixed: 'curve' | 'spring'; name: string };
export const easingSourceOf = (h: MotionPresetHalf): EasingSource =>
  'role' in h.easing ? { follows: h.easing.role } : 'curve' in h.easing ? { fixed: 'curve', name: h.easing.curve } : { fixed: 'spring', name: h.easing.spring };

/** Which slots a brand set on a preset (`own`) and on its exit half (`exit`, arriving presets only). A slot it didn't
 *  set keeps the default; an unset exit slot follows the entrance as resolved. */
export const presetSlotsSet = (p: MotionPersonality | undefined, preset: string): { own: string[]; exit?: string[] } => {
  const g = p?.presets?.[preset] ?? {};
  const own = PRESET_SLOTS.filter((s) => g[s] !== undefined);
  if (!ARRIVING_PRESETS.includes(preset)) return { own };
  return { own, exit: PRESET_SLOTS.filter((s) => g.exit?.[s] !== undefined) };
};

/** One track that names a preset: the pattern it is in, and its key (`<element>.<property>`). */
export type PresetUse = { pattern: string; track: string };
/** Each preset path's uses, read from resolved patterns (`theme.motion.patterns`). Every path a track may name is a
 *  key, so a preset no pattern names maps to an empty list (the proposal's §3.1: it plays on a plain specimen). */
export const presetUsedBy = (patterns: readonly MotionPattern[], presets?: readonly string[]): Record<string, PresetUse[]> => {
  const out: Record<string, PresetUse[]> = Object.fromEntries(presetPaths(presets).map((p) => [p, [] as PresetUse[]]));
  for (const p of patterns) for (const tr of p.tracks) (out[tr.preset] ??= []).push({ pattern: p.name, track: trackKey(tr) });
  return out;
};
/** The patterns a preset reaches, both halves together, each once, in pattern order: what one edit to it re-times. */
export const patternsReachedBy = (patterns: readonly MotionPattern[], preset: string): string[] =>
  patterns.filter((p) => p.tracks.some((tr) => tr.preset === preset || tr.preset === `${preset}.exit`)).map((p) => p.name);

/** What a track override may set (Q-PT15 A): a preset path (`preset.<name>` or `preset.<name>.exit`), a distance (a
 *  `distance.*` name or a space step; a px number is also accepted), a start scale (above 0, at most 1) and a reduced
 *  kind. The lists `resolvePatterns` checks. */
export const trackTargets = (presets?: readonly string[]): { preset: string[]; distance: string[]; reduced: readonly ReducedKind[] } => ({
  preset: presetPaths(presets).map((p) => `preset.${p}`),
  distance: [...MOTION_DISTANCE_NAMES.map((n) => `distance.${n}`), ...spaceScale().map((s) => `space.${s.key}`)],
  reduced: REDUCED_KINDS,
});


/** One advisory: a preset half whose slots a motion rule objects to. A code, never copy (the surface words it). */
export type PresetAdvisory = { preset: string; half: 'own' | 'exit'; code: 'exit-not-shorter' | 'delay' };
/** Where a preset's slots would draw an objection (#4571, Q-ME1 A: warn, never block), in the mode in view, since a
 *  mode's tempo moves the milliseconds. The two the owner named:
 *  - `exit-not-shorter` (the motion skill's R3): an exit half that plays as long as its entrance, or longer, unless
 *    no duration step is shorter than the entrance (an `instant` entrance): there is nothing shorter to point it at;
 *  - `delay` (G6 B, the proposal's section 2.1 behavior 3): a delay step on a half, so every pattern on it waits.
 *  The engine's defaults raise none. */
export const presetAdvisories = (m: MotionAxis, mode?: string): PresetAdvisory[] => {
  const dur = (mode !== undefined ? m.motionByMode?.[mode]?.duration : undefined) ?? m.duration;
  const ms = (h: MotionPresetHalf): number => ('step' in h.duration ? dur[h.duration.step] ?? 0 : m.springSettle[h.duration.spring] ?? 0);
  const out: PresetAdvisory[] = [];
  for (const p of m.presets) {
    if (p.delay !== null) out.push({ preset: p.preset, half: 'own', code: 'delay' });
    if (!p.exit) continue;
    const shorterStep = Object.values(dur).some((v) => v < ms(p));
    if (shorterStep && ms(p.exit) >= ms(p)) out.push({ preset: p.preset, half: 'exit', code: 'exit-not-shorter' });
    if (p.exit.delay !== null) out.push({ preset: p.preset, half: 'exit', code: 'delay' });
  }
  return out;
};
