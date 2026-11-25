/** Prism3 engine — Motion: durations, easings, springs, delays and presets, generated from the tempo lever.
 *
 *  Split out of `theme.ts` (#3698 R5), which re-exports its public names unchanged.
 */
// ---------------------------------------------------------------------------
// Motion axis — generated from a single personality lever (`tempo`), the motion
// analog of the density/radius levers. Grounded in 18-motion-foundations + a
// 7-system field survey: a non-linear duration ramp scaled by tempo; the
// convergent easing roles (standard/enter=decelerate/exit=accelerate/emphasized)
// + a `calm` accessibility curve; M3-sourced springs by perceptual outcome;
// Atlassian-style composite transitions; and reduce-motion as a DERIVED output
// (Apple "substitute, don't delete": small informational motion preserved/floored,
// large/vestibular motion eliminated) — not a hand-maintained second list.
import { springSettleMs } from './spring';
import type { MotionPattern } from './motion-patterns';

export type Bezier = [number, number, number, number];
/** One preset's slots as a brand re-points them (#2857, Q-MS3 A), each a `motion` path. Absent slots keep the default.
 *  - `duration`: `duration.<step>`, or `spring-duration.<spring>` when the easing is that spring (the two go together).
 *  - `easing`: `easing-role.<role>` (the default kind), `easing.<curve>`, a brand curve included, or `spring.<spring>`.
 *  - `delay`: `delay.<step>`. Absent, the preset starts at once.
 *  The reduced duration is derived from the duration slot (Q-MS6 A) and cannot be set. */
export type MotionPresetSlotsInput = { duration?: string; easing?: string; delay?: string };
/** An arriving preset also takes `exit`, its closing half (#2857, Q-PT3 A), written with the same slots. */
export type MotionPresetInput = MotionPresetSlotsInput & { exit?: MotionPresetSlotsInput };
export type MotionPersonality = {
  tempo?: 'snappy' | 'standard' | 'relaxed';   // scales the base duration ramp
  // Which CURVE each motion role resolves to, brand-wide (#522 follow-up). The per-mode re-point in
  // `modeLevers.<mode>.easings` deviates from THIS, so without it a mode could override a baseline
  // nobody could set — you could change Dark but not Light, which is backwards. Same shape as the
  // per-mode map; absent entries keep the engine default.
  easingRoles?: Partial<Record<string, string>>;
  // The brand's own named curves (#2857, Q-MP3 D), added beside the six as a brand adds colors. Each is a
  // `cubicBezier` primitive, `motion.easing.<name>`, that a role or a preset may use. Guardrails: a valid curve that
  // does not overshoot, a name that is not one of the six, and a shape that fits a role that uses it
  // (`checkCurveForRole`).
  curves?: Record<string, Bezier>;
  // Each preset's slots, re-pointed brand-wide (#2857, Q-MS1 A, Q-MS3 A). A slot is always a path to a step,
  // role, curve or spring of the shared scale, never a number (Q-MS2 A), so a brand's timing snaps to the scale.
  // Absent entries keep the engine's default (`MOTION_PRESET_DEFAULTS`). An unknown preset, slot or target is
  // refused by name.
  presets?: Partial<Record<string, MotionPresetInput>>;
  // A brand's overrides of the engine's motion patterns (#2857, Q-PT15 A), per track: its preset, distance, start
  // scale and reduced kind, never which tracks exist. Keyed by pattern name, then by track key (`<element>.<property>`).
  // Checked and applied in `motion-patterns.ts`.
  patterns?: Record<string, Record<string, MotionTrackInput>>;
  // The brand-only motion group (#2857, Q-MP7 option 3 item 3): true one-offs that are not part of the guaranteed
  // contract. Each entry is emitted under `motion.brand.<name>` for this brand only. Omitted, nothing is emitted.
  brandOnly?: Record<string, MotionBrandOnly>;
};
/** One track's brand override (#2857, Q-PT15 A). `preset` is a path, `preset.<name>` or `preset.<name>.exit` (Q-P3 A).
 *  `distance` is a token path (`distance.nudge`, `space.<step>`) or a number of px (Q-PT9 A). `scale` is the start scale,
 *  above 0 and at most 1 (Q-PT10 A). `reduced` is the reduced-motion kind (Q-PT11 A). */
export type MotionTrackInput = { preset?: string; distance?: string | number; scale?: number; reduced?: 'fade' | 'keep' | 'off' };
/** One brand-only motion value (#2857). The three shapes the owner named: a spring, a duration that scales with the
 *  distance travelled, and gesture physics. The fields are DRAFT. No example brand sets one. */
export type MotionBrandOnly =
  | { kind: 'spring'; damping: number; stiffness: number }
  | { kind: 'distance'; baseMs: number; msPerPx: number; minMs?: number; maxMs?: number }
  | { kind: 'gesture'; coastTauMs?: number; rubberBand?: number; parallax?: number };
/** What a preset's duration slot aliases: a step of the scale, or a spring's settle time. */
export type PresetDuration = { step: string } | { spring: string };
/** What a preset's easing slot aliases: an easing role, a curve (a brand curve included), or a spring. */
export type PresetEasing = { role: string } | { curve: string } | { spring: string };
/** What a preset's reduced duration aliases, derived from its duration (Q-MS6 A, Q-MP17 A): a step's reduced twin,
 *  or, for a spring, the short fade `min(settle, 100ms)` (G3 B) as a millisecond primitive. */
export type PresetReduced = { step: string } | { ms: number };
/** A motion preset resolved through the brand's mapping (#2857, Q-MS1 A): what each of its slots aliases. A `delay`
 *  of null starts at once (0ms). */
export type MotionPresetHalf = { duration: PresetDuration; easing: PresetEasing; delay: string | null; reduced: PresetReduced };
/** An arriving preset's `exit` is its closing half (#2857, Q-PT3 A): by default one step shorter, on the `exit` role. */
export type MotionPreset = { preset: string } & MotionPresetHalf & { exit?: MotionPresetHalf };
export type MotionAxis = {
  tempo: 'snappy' | 'standard' | 'relaxed';
  duration: Record<string, number>;            // ms, semantic roles (tempo-scaled)
  durationReduced: Record<string, number>;     // ms, reduce-motion variants (derived)
  easing: Record<string, Bezier>;
  // The brand's own curves (Q-MP3 D), by name. Each is also in `easing`; this says which ones are the brand's.
  brandCurves: string[];
  spring: Record<string, { damping: number; stiffness: number }>;
  // Each spring's settle time in ms (`spring.ts`), the duration a preset eased by that spring plays for.
  springSettle: Record<string, number>;
  stagger: number;                             // ms between staggered siblings
  // Show and minimum-show delays (G6 B), in ms. Perception thresholds, not pace, so fixed across tempo.
  delay: Record<string, number>;
  // Per-mode tempo (Phase D) — only modes whose `modeLevers.tempo` differs from the baseline tempo. Each
  // carries the RE-DERIVED duration ramp (+ reduce-motion + stagger) at that mode's tempo; easing and springs are
  // tempo-invariant, so they're not duplicated. Presets reference `motion.duration.<step>` by alias, so they
  // inherit per-mode. Absent ⇒ byte-identical.
  motionByMode?: Record<string, { tempo: string; duration: Record<string, number>; durationReduced: Record<string, number>; stagger: number }>;
  // The ROLE tier (#522): which curve each motion intent uses. Exists so a mode has a semantic to re-point WITHOUT
  // redefining `motion.easing.*`, the same job `font.weight-role.*` does for `font.weight.*`.
  easingRoles: { role: string; curve: string }[];
  // Only modes that actually re-point get an entry; absent ⇒ byte-identical emit.
  easingRolesByMode?: Record<string, Record<string, string>>;
  // Every preset (the ten of Q-MP2 A), resolved through the brand's mapping (#2857). Emitted to the tree as the
  // `motion.preset.<name>.*` alias tier (Q-MS1 A, Q-MS8 A), to Figma as published variables, and named in the sidecar.
  presets: MotionPreset[];
  // The motion patterns (#2857 phase 2, Q-PT1 A): what each component's motion moves, as tracks naming presets, with
  // the brand's track overrides applied (`motion-patterns.ts`). Set by the theme builders, beside the presets.
  patterns?: MotionPattern[];
  // The brand-only group, validated, in input order. Absent when the brand sets none.
  brandOnly?: Record<string, MotionBrandOnly>;
};

// The engine's opinion about which curve each intent starts from. A brand overrides any of them via
// `motionPersonality.easingRoles`; a mode deviates further via `modeLevers.<mode>.easings`.
export const EASING_ROLE_DEFAULTS = [
  { role: 'default', curve: 'standard' },
  { role: 'enter', curve: 'decelerate' },
  { role: 'exit', curve: 'accelerate' },
  { role: 'emphasized', curve: 'expressive' },
] as const;
// The semantic duration scale, shortest to longest. `long`, `longer` and `longest` (#2857, Q-MP7 option 3) extend
// it past `slower` for surface and choreographed moves, near where a reference brand's long motions cluster. Every
// step scales with tempo, and each has a reduced twin at `min(full, 100ms)` (Q-MP17 A).
const DURATION_BASE: Record<string, number> = { instant: 50, fast: 100, normal: 200, moderate: 300, slow: 500, slower: 800, long: 900, longer: 1100, longest: 1300 };
/** The steps of the semantic duration scale, shortest to longest: what a preset may map to. Loop periods are not steps. */
export const DURATION_STEPS: readonly string[] = Object.keys(DURATION_BASE);
/** Reduced motion (Q-MP17 A, closing #3484 and #3493): every step's reduced twin is `min(full, REDUCED_CAP_MS)`, a
 *  short fade that always shows. Ordered at every tempo, and never 0, so a reduced transition still fires its end. */
export const REDUCED_CAP_MS = 100;
/** The six curves, named for their shape. A brand adds its own beside them (`motionPersonality.curves`). */
export const BUILTIN_CURVES: Readonly<Record<string, Bezier>> = {
  // Curves are named for their SHAPE, roles for their USE. They used to share names — `easing.enter`
  // and `easing-role.enter` — which made the role table read `enter → enter` and gave a reader no way
  // to tell which axis they were on (#527).
  linear: [0, 0, 1, 1],
  standard: [0.2, 0, 0, 1],           // symmetric in-place (M3 standard)
  decelerate: [0, 0, 0.2, 1],         // ease-out — fast, then settles into place
  accelerate: [0.4, 0, 1, 1],         // ease-in — eases off, then leaves
  expressive: [0.4, 0.14, 0.3, 1],    // the S-curve (Carbon expressive-standard)
  calm: [0.4, 0, 0.6, 1],             // a11y: soft onset for long/involuntary motion
};
/** The springs, by perceptual outcome. `effects` (Q-MP4 A, G1 A) moves opacity and color and never overshoots:
 *  critically damped, the M3 effects-default pair. Its Figma bounce is 0. */
export const SPRINGS: Readonly<Record<string, { damping: number; stiffness: number }>> = {
  snappy: { damping: 0.9, stiffness: 700 },   // M3 standard spatial — fast settle, no overshoot
  gentle: { damping: 0.8, stiffness: 380 },   // M3 expressive spatial — natural settle
  bouncy: { damping: 0.6, stiffness: 800 },   // M3 expressive fast — overshoot (expressive layer)
  effects: { damping: 1, stiffness: 1600 },   // M3 effects default — opacity and color, no overshoot (G1 A)
};
/** The delay steps (G6 B): how long a tooltip or a busy indicator waits before it shows, and the least time a shown
 *  one stays, so a fast result flashes nothing. Perception thresholds, not pace: the same at every tempo. */
export const MOTION_DELAYS: Readonly<Record<string, number>> = { show: 400, 'min-show': 500, hide: 300, skip: 300 };
// `hide` (Q-PT13 A): how long a tooltip stays after the pointer leaves, so the pointer can move onto it (WCAG 1.4.13).
// `skip` (Q-PT14 A): after one tooltip closes, how long the next shows at once, with no delay and no animation.
/** The eleventh preset's name (#2857, Q-PT4 A). The preset is approved; its NAME is still the owner's (the field
 *  offers the KB's "pop", `popup` and `contextual`), so it lives in this one constant: renaming it is mechanical. */
export const QUICK_ARRIVAL_PRESET = 'pop';
/**
 * The default preset slots (#2857): the ten presets of Q-MP2 A on the rows approved in Q-MP8 A, each slot aliasing
 * the role it plays on (Q-MS1 A). A brand re-points any slot with `motionPersonality.presets`. Every preset starts at
 * once (no delay), and its reduced duration follows its duration slot (Q-MS6 A).
 * - state: a micro state change or press → `fast`, in place.
 * - fade: an opacity change → `normal`, arriving.
 * - crossfade: one thing replaced by another in place → `normal`.
 * - move: a change of position within the layout → `normal`, in place (Q-PT5 A: the in-place travels, the tab underline,
 *   the switch thumb, the segmented pill, the accordion indicator, and Studio's eased scroll, Q-PT6 A).
 * - reveal: content arriving on view → `slow`, arriving.
 * - draw: a line drawn on → `slow`, in place. Under reduced motion it fades in (owner decision, 2026-11-20).
 * - surface: a dialog, sheet or drawer arriving → `moderate`, arriving.
 * - expand: a height change → `normal`, in place (owner decision, 2026-11-20).
 * - step: a carousel advancing one item → `moderate`, in place.
 * - settle: a moved thing coming to rest → `slow`, arriving.
 * - pop (the name is a placeholder, `QUICK_ARRIVAL_PRESET`; Q-PT4 A): a small surface or element arriving quickly, such
 *   as a tooltip, popover or menu → `fast`, arriving.
 * - press: a control pressed down → `instant`, in place (Q-PT7 A). Its release is `state`.
 */
export const MOTION_PRESET_DEFAULTS: readonly { preset: string; step: string; role: string }[] = [
  { preset: 'state', step: 'fast', role: 'default' },
  { preset: 'fade', step: 'normal', role: 'enter' },
  { preset: 'crossfade', step: 'normal', role: 'default' },
  { preset: 'move', step: 'normal', role: 'default' },
  { preset: 'reveal', step: 'slow', role: 'enter' },
  { preset: 'draw', step: 'slow', role: 'default' },
  { preset: 'surface', step: 'moderate', role: 'enter' },
  { preset: 'expand', step: 'normal', role: 'default' },
  { preset: 'step', step: 'moderate', role: 'default' },
  { preset: 'settle', step: 'slow', role: 'enter' },
  { preset: QUICK_ARRIVAL_PRESET, step: 'fast', role: 'enter' },
  { preset: 'press', step: 'instant', role: 'default' },
];
/** The presets that bring something in, each with an exit half (#2857, Q-PT3 A). An in-place preset has none: it
 *  plays the same both ways (an accordion collapses on `expand`). */
export const ARRIVING_PRESETS: readonly string[] = ['fade', 'reveal', 'surface', 'settle', QUICK_ARRIVAL_PRESET];
/** An exit half's default step: one shorter than its entrance (rule R3), never below the first step. */
export const exitStepOf = (step: string): string => DURATION_STEPS[Math.max(0, DURATION_STEPS.indexOf(step) - 1)]!;
/** The slots a brand may set on a preset. The reduced duration is derived, never set (Q-MS6 A). */
export const PRESET_SLOTS = ['duration', 'easing', 'delay'] as const;
/** The fields each brand-only kind takes, and which are required. */
const BRAND_ONLY_FIELDS: Record<MotionBrandOnly['kind'], { required: string[]; optional: string[] }> = {
  spring: { required: ['damping', 'stiffness'], optional: [] },
  distance: { required: ['baseMs', 'msPerPx'], optional: ['minMs', 'maxMs'] },
  gesture: { required: [], optional: ['coastTauMs', 'rubberBand', 'parallax'] },
};
/** The brand-only group, checked: a name is a token key, a kind is one of the three, every field is a finite number
 *  and none is unknown. Refused by name, so the input path that is wrong is in the message. */
const checkBrandOnly = (group: Record<string, MotionBrandOnly>): Record<string, MotionBrandOnly> => {
  for (const [name, v] of Object.entries(group)) {
    const at = `motionPersonality.brandOnly.${name}`;
    if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`${at}: a brand-only motion name is lowercase letters, digits and hyphens`);
    const shape = BRAND_ONLY_FIELDS[(v as { kind?: string })?.kind as MotionBrandOnly['kind']];
    if (!shape) throw new Error(`${at}: unknown kind '${(v as { kind?: string })?.kind}' (have: ${Object.keys(BRAND_ONLY_FIELDS).join(', ')})`);
    const fields = Object.keys(v).filter((k) => k !== 'kind');
    for (const f of fields) {
      if (![...shape.required, ...shape.optional].includes(f)) throw new Error(`${at}: unknown field '${f}' for kind '${v.kind}' (have: ${[...shape.required, ...shape.optional].join(', ')})`);
      if (!Number.isFinite((v as Record<string, unknown>)[f])) throw new Error(`${at}.${f}: must be a finite number`);
    }
    for (const f of shape.required) if (!fields.includes(f)) throw new Error(`${at}: kind '${v.kind}' needs '${f}'`);
  }
  return group;
};
const TEMPO_FACTOR = { snappy: 0.8, standard: 1, relaxed: 1.3 } as const;
/** The spinner's turn (#1670): `motion.duration.spin` / `motion.duration-reduced.spin`. Fixed, not tempo-scaled. */
export const SPIN_ROLE = 'spin';
export const SPIN_MS = 800;
export const SPIN_REDUCED_MS = 2600;
/** The progress bar's indeterminate sweep (#2670, owner call 6 A): `motion.duration.sweep` / `motion.duration-reduced.sweep`.
 *  A loop period like the spin, so fixed, not tempo-scaled: one pass of the segment across the track every 1.6s, and
 *  under reduced motion the same sweep, slower (2.6s, the spin's reduced period; owner call 7 A). */
export const SWEEP_ROLE = 'sweep';
export const SWEEP_MS = 1600;
export const SWEEP_REDUCED_MS = 2600;
/** The duration roles that are loop periods rather than steps of the tempo-scaled ramp. */
export const LOOP_ROLES: readonly string[] = [SPIN_ROLE, SWEEP_ROLE];
const round5 = (n: number) => Math.round(n / 5) * 5;

/** A curve's progress at half its time: `y` where the curve's `x` is 0.5, found by bisection on the curve's own
 *  parameter. Above 0.5 the curve has done most of its travel early (it decelerates); below, late (it accelerates). */
export const curveProgressAtHalf = (b: readonly number[]): number => {
  const [x1 = 0, y1 = 0, x2 = 1, y2 = 1] = b;
  const at = (p1: number, p2: number, t: number): number => 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t;
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (at(x1, x2, mid) < 0.5) lo = mid; else hi = mid; }
  return at(y1, y2, (lo + hi) / 2);
};
/** The brand's own curves, checked (Q-MP3 D's guardrails): a token-key name that is not one of the six, four finite
 *  numbers, both x in [0, 1] (CSS refuses any other), and both y in [0, 1]. A curve that overshoots is refused:
 *  overshoot is a spring's job, and a reduced-motion substitute removes it from springs only (G3 B). */
const checkBrandCurves = (curves: Record<string, Bezier>): Record<string, Bezier> => {
  for (const [name, b] of Object.entries(curves)) {
    const at = `motionPersonality.curves.${name}`;
    if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`${at}: a curve name is lowercase letters, digits and hyphens`);
    if (name in BUILTIN_CURVES) throw new Error(`${at}: '${name}' is one of Prism3's own curves; a brand curve takes a name of its own (have: ${Object.keys(BUILTIN_CURVES).join(', ')})`);
    if (!Array.isArray(b) || b.length !== 4 || !b.every((n) => Number.isFinite(n))) throw new Error(`${at}: a curve is four numbers, [x1, y1, x2, y2]`);
    if (b[0] < 0 || b[0] > 1 || b[2] < 0 || b[2] > 1) throw new Error(`${at}: x1 and x2 must be between 0 and 1`);
    if (b[1] < 0 || b[1] > 1 || b[3] < 0 || b[3] > 1) throw new Error(`${at}: y1 and y2 must be between 0 and 1; a curve that overshoots is a spring's job`);
  }
  return curves;
};
/** The roles a curve's shape has to fit (Q-MP3 D's role guardrail): `enter` decelerates and `exit` accelerates, so a
 *  brand curve on `enter` may not do less than half its travel by half its time, and one on `exit` no more. `default`
 *  and `emphasized` take any shape. Prism3's six are not held to it, so a role can still be re-pointed at `calm`. */
export const checkCurveForRole = (role: string, curve: string, easing: Record<string, readonly number[]>, brandCurves: readonly string[], at: string): void => {
  if (!brandCurves.includes(curve)) return;
  const b = easing[curve];
  if (!b) return;
  const half = curveProgressAtHalf(b);
  if (role === 'enter' && half < 0.5) throw new Error(`${at}: the brand curve '${curve}' accelerates (it is ${Math.round(half * 100)}% of the way at half its time), and the enter role decelerates`);
  if (role === 'exit' && half > 0.5) throw new Error(`${at}: the brand curve '${curve}' decelerates (it is ${Math.round(half * 100)}% of the way at half its time), and the exit role accelerates`);
};
/** One half's slots, resolved: the defaults, then the brand's re-points, each checked by name (Q-MS3 A), and the
 *  spring rule held: a half eased by a spring plays for that spring's settle time, so the two slots go together. */
const resolveHalf = (at: string, d: { step: string; role: string }, g: Record<string, unknown>, easing: Record<string, Bezier>,
  springs: Record<string, { damping: number; stiffness: number }>, roles: readonly string[]): MotionPresetHalf => {
  const path = (slot: string): string | undefined => {
    const v = g[slot];
    if (v === undefined) return undefined;
    if (typeof v !== 'string') throw new Error(`${at}.${slot}: a slot names a motion path, never a number (got ${JSON.stringify(v)})`);
    return v;
  };
  const e = path('easing');
  let ease: PresetEasing = { role: d.role };
  if (e !== undefined) {
    const [kind, name] = [e.slice(0, e.indexOf('.')), e.slice(e.indexOf('.') + 1)];
    if (kind === 'easing-role' && roles.includes(name)) ease = { role: name };
    else if (kind === 'easing' && name in easing) ease = { curve: name };
    else if (kind === 'spring' && name in springs) ease = { spring: name };
    else throw new Error(`${at}.easing: unknown easing '${e}' (have: ${[...roles.map((r) => `easing-role.${r}`), ...Object.keys(easing).map((c) => `easing.${c}`), ...Object.keys(springs).map((n) => `spring.${n}`)].join(', ')})`);
  }
  const du = path('duration');
  let duration: PresetDuration = { step: d.step };
  if (du !== undefined) {
    const [kind, name] = [du.slice(0, du.indexOf('.')), du.slice(du.indexOf('.') + 1)];
    if (kind === 'duration' && DURATION_STEPS.includes(name)) duration = { step: name };
    else if (kind === 'spring-duration' && name in springs) duration = { spring: name };
    else throw new Error(`${at}.duration: unknown duration '${du}' (have: ${[...DURATION_STEPS.map((x) => `duration.${x}`), ...Object.keys(springs).map((n) => `spring-duration.${n}`)].join(', ')})`);
  }
  // THE SPRING RULE: a spring has no duration of its own to scale; it lasts as long as it takes to settle.
  if ('spring' in ease) {
    if (du === undefined) duration = { spring: ease.spring };
    else if (!('spring' in duration) || duration.spring !== ease.spring)
      throw new Error(`${at}.duration: a preset eased by the spring '${ease.spring}' plays for its settle time, so its duration is 'spring-duration.${ease.spring}' (got '${du}')`);
  } else if ('spring' in duration)
    throw new Error(`${at}.duration: 'spring-duration.${duration.spring}' is the settle time of the spring '${duration.spring}', and goes with easing 'spring.${duration.spring}'`);
  const de = path('delay');
  if (de !== undefined && !(de.startsWith('delay.') && de.slice(6) in MOTION_DELAYS))
    throw new Error(`${at}.delay: unknown delay '${de}' (have: ${Object.keys(MOTION_DELAYS).map((k) => `delay.${k}`).join(', ')}; absent, the preset starts at once)`);
  // The reduced duration follows the duration slot (Q-MS6 A): a step's own reduced twin, or for a spring the short
  // fade it becomes under reduced motion (G3 B), `min(settle, 100ms)`.
  const reduced: PresetReduced = 'step' in duration ? { step: duration.step } : { ms: Math.min(springSettleMs(springs[duration.spring]!), REDUCED_CAP_MS) };
  return { duration, easing: ease, delay: de === undefined ? null : de.slice(6), reduced };
};
/** A preset, resolved: its own half, and for an arriving preset its exit half (Q-PT3 A), whose default is one step
 *  shorter than the entrance as resolved (so a brand that lengthens the entrance lengthens the exit with it), on the
 *  `exit` role. A brand re-points the exit half's slots under `exit`, checked the same way. */
const resolvePreset = (d: { preset: string; step: string; role: string }, given: unknown, easing: Record<string, Bezier>,
  springs: Record<string, { damping: number; stiffness: number }>, roles: readonly string[]): MotionPreset => {
  const at = `motionPersonality.presets.${d.preset}`;
  const arriving = ARRIVING_PRESETS.includes(d.preset);
  const slots = arriving ? [...PRESET_SLOTS, 'exit'] : [...PRESET_SLOTS];
  if (given !== undefined && (typeof given !== 'object' || given === null || Array.isArray(given)))
    throw new Error(`${at}: a preset is an object of slots, { ${slots.join(', ')} }, each a motion path (got ${JSON.stringify(given)})`);
  const g = (given ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(g)) if (!slots.includes(k))
    throw new Error(k === 'exit'
      ? `${at}.exit: only a preset that brings something in has an exit half (${ARRIVING_PRESETS.join(', ')}); '${d.preset}' plays the same both ways`
      : `${at}: unknown slot '${k}' (have: ${slots.join(', ')}; the reduced duration follows the duration)`);
  const own = resolveHalf(at, d, g, easing, springs, roles);
  if (!arriving) return { preset: d.preset, ...own };
  const ge = g.exit;
  if (ge !== undefined && (typeof ge !== 'object' || ge === null || Array.isArray(ge)))
    throw new Error(`${at}.exit: an exit half is an object of slots, { ${PRESET_SLOTS.join(', ')} }, each a motion path (got ${JSON.stringify(ge)})`);
  const gx = (ge ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(gx)) if (!(PRESET_SLOTS as readonly string[]).includes(k))
    throw new Error(`${at}.exit: unknown slot '${k}' (have: ${PRESET_SLOTS.join(', ')}; the reduced duration follows the duration)`);
  const exitStep = exitStepOf('step' in own.duration ? own.duration.step : d.step);
  return { preset: d.preset, ...own, exit: resolveHalf(`${at}.exit`, { step: exitStep, role: 'exit' }, gx, easing, springs, roles) };
};

export const buildMotion = (p: MotionPersonality = {}): MotionAxis => {
  const known = new Set(MOTION_PRESET_DEFAULTS.map((d) => d.preset));
  for (const name of Object.keys(p.presets ?? {}))
    if (!known.has(name)) throw new Error(`motionPersonality.presets: unknown preset '${name}' (have: ${[...known].join(', ')})`);
  const tempo = p.tempo ?? 'standard';
  const f = TEMPO_FACTOR[tempo];
  const duration: Record<string, number> = {};
  for (const [k, v] of Object.entries(DURATION_BASE)) duration[k] = round5(v * f);
  // Reduced motion (Q-MP17 A): every step plays a short fade of at most 100ms, never 0. What moves is substituted
  // downstream (a movement becomes a fade, Apple's "substitute, don't delete"); only the length is set here.
  const durationReduced: Record<string, number> = {};
  for (const [k, v] of Object.entries(duration)) durationReduced[k] = Math.min(v, REDUCED_CAP_MS);
  // ONE TURN OF A SPINNER (#1670, owner spec 2026-09-26) — a loop PERIOD, not a transition, so it sits
  // outside the tempo-scaled ramp and outside the reduce-motion rule above: 0.8s per turn at every tempo,
  // and under reduced motion a SLOW turn (2.6s) rather than a shorter or eliminated one. The spinner is
  // functional — it is how a sighted user knows work is still happening — so reduced motion slows it
  // instead of removing it. Written after the ramp loops so neither formula touches it.
  duration[SPIN_ROLE] = SPIN_MS;
  durationReduced[SPIN_ROLE] = SPIN_REDUCED_MS;
  // THE PROGRESS BAR'S SWEEP (#2670) — the same kind of thing as the turn above: a loop period, kept and slowed
  // under reduced motion, never removed, because the moving segment is the only busy cue an indeterminate bar has.
  duration[SWEEP_ROLE] = SWEEP_MS;
  durationReduced[SWEEP_ROLE] = SWEEP_REDUCED_MS;
  const brand = checkBrandCurves(p.curves ?? {});
  const easing: Record<string, Bezier> = { ...BUILTIN_CURVES, ...brand } as Record<string, Bezier>;
  const brandCurves = Object.keys(brand);
  const spring = { ...SPRINGS };
  const easingRoles = EASING_ROLE_DEFAULTS.map((r) => {
    const picked = p.easingRoles?.[r.role];
    if (picked !== undefined && !(picked in easing))
      throw new Error(`motionPersonality.easingRoles.${r.role}: unknown easing curve '${picked}' (have: ${Object.keys(easing).join(', ')})`);
    if (picked !== undefined) checkCurveForRole(r.role, picked, easing, brandCurves, `motionPersonality.easingRoles.${r.role}`);
    return { role: r.role, curve: picked ?? r.curve };
  });
  const roles = EASING_ROLE_DEFAULTS.map((r) => r.role);
  return {
    tempo, duration, durationReduced, easing, brandCurves, spring,
    springSettle: Object.fromEntries(Object.entries(spring).map(([k, v]) => [k, springSettleMs(v)])), stagger: round5(40 * f), delay: { ...MOTION_DELAYS },
    easingRoles,
    presets: MOTION_PRESET_DEFAULTS.map((d) => resolvePreset(d, p.presets?.[d.preset], easing, spring, roles)),
    ...(p.brandOnly && Object.keys(p.brandOnly).length ? { brandOnly: checkBrandOnly(p.brandOnly) } : {}),
  };
};
