/**
 * prism3 #4477 — with the export option Color Space: HSL, the CSS format wrote every color custom property as
 * `[object Object]`.
 *
 * THE CAUSE. The DTCG exporter writes an HSL color as `{ colorSpace: 'hsl', components: [h, s, l], alpha }`, the hue in
 * degrees and the saturation and lightness as percents (0–100). The CSS transformer handled `colorSpace: 'srgb'` only,
 * and fell through to `String(value)` for anything else.
 *
 * THE SHAPE. The CSS format writes an sRGB color as `rgb(r, g, b)`, or `rgba(r, g, b, a)` below full alpha. An HSL
 * color is written the same way in its own notation: `hsl(h, s%, l%)`, or `hsla(h, s%, l%, a)` below full alpha.
 *
 * Every assertion runs the REAL multi-format export (`exportToZipWithFormats`) over a stubbed `figma`.
 *
 * THE EXPECTED VALUES ARE NOT DERIVED FROM THE CODE UNDER TEST (docs/34). Pure red, `#ff0000`, is hsl(0, 100%, 50%) by
 * definition; `#3366cc` is hsl(220, 60%, 50%) (max 0.8, min 0.2: l = 0.5, s = 0.6 / 1.0 = 0.6, hue from blue,
 * ((0.2 − 0.4) / 0.6 + 4) × 60 = 220). The wash is 40% of full alpha, 0.4.
 */

import JSZip from 'jszip';
import { describe, test, expect } from '../../test-harness';
import { MultiFormatTokenExporter } from '../../src/plugin/multi-format-exporter';
import { CSSFormatExporter } from '../../src/plugin/format-exporters/css-exporter';
import { DTCGFile } from '../../src/types/dtcg';

const MODE = '1:0';
const COLLECTION = 'VariableCollectionId:1:0';
const alias = (id: string) => ({ type: 'VARIABLE_ALIAS', id });

function makeVariable(id: string, name: string, value: unknown): Variable {
  return {
    id,
    name,
    key: id,
    remote: false,
    resolvedType: 'COLOR',
    scopes: [],
    description: '',
    variableCollectionId: COLLECTION,
    valuesByMode: { [MODE]: value },
  } as unknown as Variable;
}

const variables = [
  makeVariable('VariableID:1:1', 'c/base', { r: 1, g: 0, b: 0, a: 1 }),
  makeVariable('VariableID:1:2', 'c/blue', { r: 0.2, g: 0.4, b: 0.8, a: 1 }),
  makeVariable('VariableID:1:3', 'c/wash', { color: alias('VariableID:1:1'), opacity: 40 }),
  makeVariable('VariableID:1:4', 'c/ref', alias('VariableID:1:2')),
];

function installFigma(): void {
  (globalThis as Record<string, unknown>).figma = {
    variables: {
      getVariableByIdAsync: () => Promise.resolve(null),
      getVariableCollectionByIdAsync: () => Promise.resolve(null),
      getLocalVariableCollectionsAsync: () =>
        Promise.resolve([{ id: COLLECTION, name: 'core', defaultModeId: MODE, modes: [{ modeId: MODE, name: 'Default' }] }]),
      getLocalVariablesAsync: () => Promise.resolve(variables),
    },
    getLocalTextStylesAsync: () => Promise.resolve([]),
    getLocalEffectStylesAsync: () => Promise.resolve([]),
    getLocalPaintStylesAsync: () => Promise.resolve([]),
  };
}

async function cssLines(colorSpace: string): Promise<string[]> {
  installFigma();
  const exporter = new MultiFormatTokenExporter({
    tokenNameCase: 'preserve',
    colorSpace,
    includeDTCG: false,
    additionalFormats: [{ format: 'css' }],
  } as never);
  const zip = await JSZip.loadAsync(await exporter.exportToZipWithFormats());
  const names = Object.keys(zip.files).filter(n => n.endsWith('.css'));
  const text = (await Promise.all(names.map(n => zip.files[n].async('string')))).join('\n');
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('--c-'));
}

describe('the CSS format with Color Space: HSL (#4477)', () => {
  test('no custom property is written as [object Object]', async () => {
    const bad = (await cssLines('hsl')).filter(l => l.indexOf('[object') !== -1);
    expect(bad).toEqual([]);
  });

  test('every color is written in hsl() notation, the wash at its alpha, the alias as var()', async () => {
    expect(await cssLines('hsl')).toEqual([
      '--c-base: hsl(0, 100%, 50%);',
      '--c-blue: hsl(220, 60%, 50%);',
      '--c-wash: hsla(0, 100%, 50%, 0.4);',
      '--c-ref: var(--c-blue);',
    ]);
  });

  test('the sRGB default is unchanged', async () => {
    expect(await cssLines('srgb')).toEqual([
      '--c-base: rgb(255, 0, 0);',
      '--c-blue: rgb(51, 102, 204);',
      '--c-wash: rgba(255, 0, 0, 0.4);',
      '--c-ref: var(--c-blue);',
    ]);
  });

  test('a shadow layer whose color is HSL keeps its color', async () => {
    const file: DTCGFile = {
      elevation: {
        $type: 'shadow',
        $value: {
          color: { colorSpace: 'hsl', components: [0, 100, 50], alpha: 0.25 },
          offsetX: { value: 0, unit: 'px' },
          offsetY: { value: 2, unit: 'px' },
          blur: { value: 4, unit: 'px' },
        },
      },
    } as unknown as DTCGFile;
    const [out] = await new CSSFormatExporter().export(file, { format: 'css' });
    const line = String(out.content)
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('--elevation'));
    expect(line).toEqual(['--elevation: 0px 2px 4px hsla(0, 100%, 50%, 0.25);']);
  });
});
