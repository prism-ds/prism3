/**
 * The Motion page's preset writes (#4571, the motion editor's PR 2), in Node, against the real store and the real engine.
 *
 *   npx tsx apps/studio/test-motion-input.ts
 *
 * `src/state/motion-input.ts` writes one preset slot at a time into `motionPersonality.presets.<preset>[.exit].<slot>`,
 * holds the spring rule in the write (a spring easing clears the duration; leaving a spring clears its settle time), and
 * resets a slot or a whole preset with the brand pruned back to its loaded bytes.
 *
 * INDEPENDENT OF WHAT IT CHECKS (docs/34). Every expected write is a JSON literal typed here. "The engine takes it" is
 * the engine's own `brandTheme`, and "it resolves to the edit" reads the engine's resolved preset, never the module's
 * own reader. A reset is held against the brand as loaded, serialized, so pruning is checked byte for byte.
 *
 * Mutations this fails by name (each run after a commit): the exit half written at the preset's own path →
 * `#4571 an exit slot writes under .exit`; the spring clear dropped → `#4571 a spring easing over a step clears the
 * duration, and the engine takes it`.
 */
import { brandTheme, type BrandInput } from '@prism3/engine';
import { EXAMPLE_BRANDS_JSON as exampleBrands } from '@prism3/engine';
import * as store from './src/state/store';
import * as M from './src/state/motion-input';

let executed = 0, failed = 0;
const ok = (cond: boolean, label: string): void => {
  executed++;
  if (cond) { console.log(`  ✓ ${label}`); return; }
  failed++;
  console.error(`  ✗ ${label}`);
};

const load = (id: string): void => {
  store.initSession(structuredClone((exampleBrands as unknown as Record<string, BrandInput>)[id]!), { kind: 'example', id });
};
const presets = (): unknown => (store.brandState as BrandInput).motionPersonality?.presets;
const resolved = (name: string) => brandTheme(structuredClone(store.brandState) as BrandInput).motion.presets.find((p) => p.preset === name)!;
const compiles = (): string => { try { brandTheme(structuredClone(store.brandState) as BrandInput); return ''; } catch (e) { return (e as Error).message; } };

console.log('\n#4571 1. One slot at a time, at its path');
load('harbor');
const loaded = JSON.stringify(store.brandState);
M.setPresetSlot('surface', 'own', 'duration', 'duration.slow');
ok(JSON.stringify(presets()) === '{"surface":{"duration":"duration.slow"}}' && compiles() === '' && JSON.stringify(resolved('surface').duration) === '{"step":"slow"}',
  `#4571 a duration writes motionPersonality.presets.surface.duration, and the engine plays it (${JSON.stringify(presets())})`);
M.setPresetSlot('surface', 'exit', 'easing', 'easing.calm');
ok(JSON.stringify(presets()) === '{"surface":{"duration":"duration.slow","exit":{"easing":"easing.calm"}}}' && JSON.stringify(resolved('surface').exit?.easing) === '{"curve":"calm"}',
  `#4571 an exit slot writes under .exit (${JSON.stringify(presets())})`);
// The exit's default duration follows the entrance as resolved: one step under slow is moderate.
ok(JSON.stringify(resolved('surface').exit?.duration) === '{"step":"moderate"}', '#4571 an unset exit duration follows the lengthened entrance, one step shorter');
M.setPresetSlot('fade', 'own', 'delay', 'delay.show');
ok(resolved('fade').delay === 'show' && M.presetSlotSet('fade', 'own', 'delay') === 'delay.show', '#4571 a delay writes and the engine waits on it');

console.log('\n#4571 2. The spring rule, held in the write');
M.setPresetSlot('press', 'own', 'duration', 'duration.fast');
M.setPresetSlot('press', 'own', 'easing', 'spring.snappy');
ok(JSON.stringify((presets() as Record<string, unknown>).press) === '{"easing":"spring.snappy"}' && compiles() === '' && JSON.stringify(resolved('press').duration) === '{"spring":"snappy"}',
  `#4571 a spring easing over a step clears the duration, and the engine takes it (${JSON.stringify((presets() as Record<string, unknown>).press)}; ${compiles() || 'compiles'})`);
M.setPresetSlot('press', 'own', 'duration', 'spring-duration.snappy');
M.setPresetSlot('press', 'own', 'easing', 'easing-role.default');
ok(JSON.stringify((presets() as Record<string, unknown>).press) === '{"easing":"easing-role.default"}' && compiles() === '' && JSON.stringify(resolved('press').duration) === '{"step":"instant"}',
  `#4571 leaving a spring clears its settle time, back to the default step (${JSON.stringify((presets() as Record<string, unknown>).press)})`);

console.log('\n#4571 3. Resets prune back to the loaded brand');
M.setPresetSlot('press', 'own', 'easing', undefined);
M.setPresetSlot('fade', 'own', 'delay', undefined);
ok(JSON.stringify(presets()) === '{"surface":{"duration":"duration.slow","exit":{"easing":"easing.calm"}}}', `#4571 a slot reset removes its key and an emptied preset (${JSON.stringify(presets())})`);
M.resetPreset('surface');
ok(JSON.stringify(store.brandState) === loaded, '#4571 resetting the last edited preset leaves the brand byte-identical to the one loaded');

console.log(`\n${executed - failed}/${executed} motion preset-write assertions passed.`);
if (failed) process.exitCode = 1;
