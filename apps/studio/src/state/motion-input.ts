/**
 * The Motion page's preset writes (#4571, the motion editor's PR 2): one preset slot at a time, into
 * `motionPersonality.presets.<preset>[.exit].<slot>`. Brand-wide only: preset slots have no per-mode form (the
 * proposal's §4.1), so the page draws them read-only in any mode but Light and never calls these there.
 *
 * THE SPRING RULE, kept in the write. A preset eased by a spring plays for that spring's settle time, so the two slots
 * move together: picking `spring.<s>` clears the duration (the engine pairs it with `spring-duration.<s>`), and
 * picking any other easing over a spring's settle time clears that duration too, back to the default step. A write
 * the engine would refuse is never made by this module. `undefined` is a reset: the slot returns to the engine
 * default, and an emptied preset, `presets` and `motionPersonality` are pruned (`setPath`), so a reset brand is
 * byte-identical to one never edited.
 */
import { brandState, getPath, setPath } from './store';

export type PresetHalf = 'own' | 'exit';
export type PresetSlot = 'duration' | 'easing' | 'delay';
const at = (preset: string, half: PresetHalf, slot: PresetSlot): string =>
  `motionPersonality.presets.${preset}${half === 'exit' ? '.exit' : ''}.${slot}`;

/** The path the brand set on a slot, or `undefined` when it keeps the default. */
export const presetSlotSet = (preset: string, half: PresetHalf, slot: PresetSlot): string | undefined =>
  getPath(brandState, at(preset, half, slot)) as string | undefined;

/** Point one slot at `path`, or reset it with `undefined`. */
export const setPresetSlot = (preset: string, half: PresetHalf, slot: PresetSlot, path: string | undefined): void => {
  if (slot === 'easing') {
    const dur = presetSlotSet(preset, half, 'duration');
    if (path?.startsWith('spring.') || dur?.startsWith('spring-duration.')) setPath(brandState, at(preset, half, 'duration'), undefined);
  }
  setPath(brandState, at(preset, half, slot), path);
};

/** Every slot of one preset back to the default, both halves. */
export const resetPreset = (preset: string): void => setPath(brandState, `motionPersonality.presets.${preset}`, undefined);
