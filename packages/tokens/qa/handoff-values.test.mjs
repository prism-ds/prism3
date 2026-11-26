// The handoff value forms `render-qa.mjs` reads (#4382). Run: npm run -w @prism3/tokens qa:test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseColor, px } from './handoff-values.mjs';

test('parseColor: a DTCG 2025.10 color object, hex plus alpha', () => {
  assert.deepEqual(parseColor({ colorSpace: 'srgb', components: [1, 1, 1], hex: '#ffffff' }), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor({ colorSpace: 'srgb', components: [0.0392, 0.0706, 0.1569], alpha: 0.1216, hex: '#0a1228' }),
    { r: 10, g: 18, b: 40, a: 0.1216 });
});
test('parseColor: a DTCG 2025.10 color object with no hex reads its components', () => {
  assert.deepEqual(parseColor({ colorSpace: 'srgb', components: [1, 0, 0.2], alpha: 0.5 }), { r: 255, g: 0, b: 51, a: 0.5 });
});
test('parseColor: the string forms still read', () => {
  assert.deepEqual(parseColor('#1e1eff'), { r: 30, g: 30, b: 255, a: 1 });
  assert.deepEqual(parseColor('#00000080'), { r: 0, g: 0, b: 0, a: 128 / 255 });
  assert.deepEqual(parseColor('rgba(10, 20, 30, 0.5)'), { r: 10, g: 20, b: 30, a: 0.5 });
});
test('parseColor: anything else throws, naming the value', () => {
  assert.throws(() => parseColor({ colorSpace: 'oklch', components: [0.7, 0.2, 30] }), /unparsed handoff color \{"colorSpace":"oklch"/);
  assert.throws(() => parseColor({ colorSpace: 'srgb', components: [1, 1, 1], alpha: 2 }), /unparsed handoff color/);
  assert.throws(() => parseColor('oklch(0.7 0.2 30)'), /unparsed handoff color oklch\(0\.7 0\.2 30\)/);
});
test('px: the DTCG 2025.10 { value, unit } form and the string form', () => {
  assert.equal(px({ value: 0, unit: 'px' }), 0);
  assert.equal(px({ value: -3, unit: 'px' }), -3);
  assert.equal(px('4px'), 4);
});
test('px: any unit but px throws, naming the value', () => {
  assert.throws(() => px({ value: 1, unit: 'rem' }), /not a px dimension: \{"value":1,"unit":"rem"\}/);
  assert.throws(() => px('1rem'), /not a px dimension: 1rem/);
});
