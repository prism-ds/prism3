/**
 * prism3 #4475 — a color variable that aliases another variable, with an opacity applied on the referencing variable,
 * exported `null` for its value.
 *
 * THE CONSTRUCT. In the Plugin API it is a COLOR variable whose mode value is Figma's `VariableComposedColor`,
 * `{ color: VariableAlias, opacity: number | VariableAlias }`, the opacity a PERCENT (`@figma/plugin-typings`
 * `VariableValue`). Read as a plain RGB, its `r`, `g` and `b` are undefined, so a channel is NaN, and
 * `JSON.stringify` writes NaN as `null`: `components: [null, null, null]` in the DTCG export (fixed for that file by
 * #2365 / #4299), and `rgb(NaN, NaN, NaN)` in the dot-notation format, which reads the raw variable.
 *
 * THE SHAPE is #2365's owner decision A: `$value` is the color the alias resolves to, its alpha multiplied by the
 * opacity, and with Figma extensions on `$extensions.figma.aliasOf` keeps the reference AND the opacity — as its alias,
 * or (#4475) as the literal percent it is.
 *
 * Every assertion runs the REAL export (`exportToZip`, the multi-format `exportToZipWithFormats`) over a stubbed
 * `figma`, so a path that writes the value as `null` is caught wherever it is.
 *
 * THE EXPECTED VALUES ARE NOT DERIVED FROM THE CODE UNDER TEST (docs/34). The target is `#ff8000`, written out by hand
 * (1, 128/255, 0; 128/255 = 0.50196, rounded to 4 places as the exporter's other colors are, is 0.502; as 8-bit,
 * 255, 128, 0). 40% is an alpha of 0.4, and 30% of 0.3.
 */

import JSZip from 'jszip';
import { describe, test, expect } from '../../test-harness';
import { TokenExporter } from '../../src/plugin/exporter';
import { MultiFormatTokenExporter } from '../../src/plugin/multi-format-exporter';

const MODE = '1:0';
const COLLECTION = 'VariableCollectionId:1:0';
const alias = (id: string) => ({ type: 'VARIABLE_ALIAS', id });

function makeVariable(id: string, name: string, resolvedType: string, value: unknown): Variable {
  return {
    id,
    name,
    key: id,
    remote: false,
    resolvedType,
    scopes: [],
    description: '',
    variableCollectionId: COLLECTION,
    valuesByMode: { [MODE]: value },
  } as unknown as Variable;
}

const variables = [
  makeVariable('VariableID:1:1', 'color/brand', 'COLOR', { r: 1, g: 128 / 255, b: 0, a: 1 }),
  makeVariable('VariableID:1:2', 'opacity/30', 'FLOAT', 30),
  // The reported construct: an alias, with the opacity on the variable that references it.
  makeVariable('VariableID:1:3', 'color/brand-faded', 'COLOR', { color: alias('VariableID:1:1'), opacity: 40 }),
  makeVariable('VariableID:1:4', 'color/brand-wash', 'COLOR', {
    color: alias('VariableID:1:1'),
    opacity: alias('VariableID:1:2'),
  }),
  // A plain alias to the faded color.
  makeVariable('VariableID:1:5', 'color/brand-faded-ref', 'COLOR', alias('VariableID:1:3')),
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

async function files(buffer: ArrayBuffer): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(buffer);
  const out: Record<string, string> = {};
  for (const name of Object.keys(zip.files)) {
    if (!zip.files[name].dir) out[name] = await zip.files[name].async('string');
  }
  return out;
}

async function exportDTCG(options: Record<string, unknown> = {}): Promise<Record<string, string>> {
  installFigma();
  const exporter = new TokenExporter(Object.assign({ tokenNameCase: 'preserve' }, options) as never);
  return files(await exporter.exportToZip());
}

/** Every path in a JSON tree whose value is null. */
function nullPaths(node: unknown, path: string[] = []): string[] {
  if (node === null) return [path.join('.')];
  if (typeof node !== 'object') return [];
  const out: string[] = [];
  Object.keys(node as object).forEach(k => {
    out.push(...nullPaths((node as Record<string, unknown>)[k], path.concat(k)));
  });
  return out;
}

async function token(path: string[], options: Record<string, unknown> = {}): Promise<any> {
  const out = await exportDTCG(options);
  for (const name of Object.keys(out)) {
    let node = JSON.parse(out[name]);
    for (const key of path) node = node && typeof node === 'object' ? node[key] : undefined;
    if (node && node.$value !== undefined) return node;
  }
  return undefined;
}

describe('a color alias with an opacity on the referencing variable (#4475)', () => {
  test('the DTCG export writes no null, in every color format and space', async () => {
    const found: string[] = [];
    for (const options of [{}, { colorSpace: 'hsl' }, { colorFormat: 'css' }, { includeFigmaExtensions: true }]) {
      const out = await exportDTCG(options);
      Object.keys(out).forEach(name => {
        nullPaths(JSON.parse(out[name])).forEach(p => found.push(`${JSON.stringify(options)} ${name}: ${p}`));
      });
    }
    expect(found).toEqual([]);
  });

  test('the faded color is the alias target, #ff8000, at an alpha of 0.4', async () => {
    const t = await token(['color', 'brand-faded']);
    expect(t.$type).toBe('color');
    expect(t.$value).toEqual({ colorSpace: 'srgb', components: [1, 0.502, 0], alpha: 0.4 });
  });

  test('with Figma extensions on, aliasOf keeps the reference and a literal opacity', async () => {
    const t = await token(['color', 'brand-faded'], { includeFigmaExtensions: true });
    expect(t.$extensions.figma.aliasOf).toEqual({ color: '{color.brand}', opacity: 40 });
  });

  test('with Figma extensions on, aliasOf keeps the reference and an opacity alias', async () => {
    const t = await token(['color', 'brand-wash'], { includeFigmaExtensions: true });
    expect(t.$extensions.figma.aliasOf).toEqual({ color: '{color.brand}', opacity: '{opacity.30}' });
  });

  test('the dot-notation format writes the reference, the opacity and the resolved color, never NaN or null', async () => {
    installFigma();
    const exporter = new MultiFormatTokenExporter({
      tokenNameCase: 'preserve',
      includeDTCG: false,
      additionalFormats: [{ format: 'dot-notation' }],
    } as never);
    const out = await files(await exporter.exportToZipWithFormats());
    const text = Object.keys(out).filter(n => n.startsWith('dot-notation/')).map(n => out[n]).join('\n');
    const lines = text.split('\n').filter(l => l.startsWith('color.brand-'));
    expect(lines).toEqual([
      'color.brand-faded: "{color.brand} @ 40%" -> "rgba(255, 128, 0, 0.40)"',
      'color.brand-faded-ref: "{color.brand-faded}" -> "rgba(255, 128, 0, 0.40)"',
      'color.brand-wash: "{color.brand} @ {opacity.30}" -> "rgba(255, 128, 0, 0.30)"',
    ]);
  });
});
