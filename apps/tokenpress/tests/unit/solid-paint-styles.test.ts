/**
 * prism3 #3884 — a paint style whose visible paints are solid colors was read and left out of the export, and nothing
 * said so: a file that keeps its colors as solid paint styles exported without them.
 *
 * Owner decision A (2026-11-24, on #3884 and #4511): report the skip in the export footer now. Exporting solid styles
 * (in their own file, with a naming policy for paths a color variable also uses) is a future feature.
 *
 * So the exporter names each paint style whose visible paints are all solid (`getSkippedSolidPaintStyles`). A gradient
 * still exports, a style that layers a gradient with a solid stays the layered-gradient skip (#3885), and a style with
 * no visible solid (an image, or every paint hidden) is not a solid style.
 *
 * THE EXPECTED VALUES ARE NOT DERIVED FROM THE CODE UNDER TEST (docs/34): the fixture names exactly two solid styles,
 * `brand/flat` and `brand/stacked`, in the order Figma lists them.
 */

import JSZip from 'jszip';
import { describe, test, expect } from '../../test-harness';
import { TokenExporter } from '../../src/plugin/exporter';

const solid = (r: number, g: number, b: number, visible = true) => ({ type: 'SOLID', visible, color: { r, g, b } });
const linear = {
  type: 'GRADIENT_LINEAR',
  visible: true,
  gradientStops: [
    { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
    { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 },
  ],
  gradientTransform: [
    [1, 0, 0],
    [0, 1, 0],
  ],
};
const paintStyles = [
  { id: 'S:1', name: 'brand/flat', description: '', paints: [solid(1, 0, 0)] },
  { id: 'S:2', name: 'brand/sunrise', description: '', paints: [linear] },
  { id: 'S:3', name: 'brand/layered', description: '', paints: [solid(0, 0, 0), linear] },
  { id: 'S:4', name: 'brand/photo', description: '', paints: [{ type: 'IMAGE', visible: true, scaleMode: 'FILL' }] },
  { id: 'S:5', name: 'brand/stacked', description: '', paints: [solid(0, 0, 0), solid(1, 1, 1)] },
  { id: 'S:6', name: 'brand/hidden', description: '', paints: [solid(0, 1, 0, false)] },
];

function installFigma(): void {
  (globalThis as Record<string, unknown>).figma = {
    variables: {
      getVariableByIdAsync: () => Promise.resolve(null),
      getVariableCollectionByIdAsync: () => Promise.resolve(null),
      getLocalVariableCollectionsAsync: () => Promise.resolve([]),
      getLocalVariablesAsync: () => Promise.resolve([]),
    },
    getLocalTextStylesAsync: () => Promise.resolve([]),
    getLocalEffectStylesAsync: () => Promise.resolve([]),
    getLocalPaintStylesAsync: () => Promise.resolve(paintStyles),
  };
}

async function exported(): Promise<{ exporter: TokenExporter; files: string[] }> {
  installFigma();
  const exporter = new TokenExporter({ tokenNameCase: 'preserve' } as never);
  const zip = await JSZip.loadAsync(await exporter.exportToZip());
  return { exporter, files: Object.keys(zip.files).filter(n => !zip.files[n].dir) };
}

describe('solid paint styles are named as skipped, not dropped silently (#3884)', () => {
  test('each paint style whose visible paints are all solid is named, in order', async () => {
    const { exporter } = await exported();
    expect(exporter.getSkippedSolidPaintStyles()).toEqual(['brand/flat', 'brand/stacked']);
  });

  test('a gradient still exports, and a layered gradient is still the layered skip', async () => {
    const { exporter, files } = await exported();
    expect(files).toContain('gradients.json');
    expect(exporter.getSkippedGradientStyles()).toEqual(['brand/layered']);
  });

  test('a second export starts from an empty list', async () => {
    const { exporter } = await exported();
    await exporter.exportToZip();
    expect(exporter.getSkippedSolidPaintStyles()).toEqual(['brand/flat', 'brand/stacked']);
  });
});
