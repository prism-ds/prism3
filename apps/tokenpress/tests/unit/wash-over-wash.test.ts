/**
 * prism3 #4478 — a tinted wash whose color aliases ANOTHER tinted wash lost its own opacity.
 *
 * THE CONSTRUCT. Figma's `VariableComposedColor` (`@figma/plugin-typings` 1.141+) is
 * `{ color: VariableAlias, opacity: number | VariableAlias }` (or a literal color at an aliased opacity). The alias half
 * is a plain `VariableAlias`: nothing in the type narrows its target to a COLOR variable holding an RGB(A), and a COLOR
 * variable's value may itself be a `VariableComposedColor` (`VariableValue` includes it). So a wash may alias a wash.
 * A live probe in Figma was not run (see the PR); the exporter now handles the construct the API types allow.
 *
 * THE BUG. `convertComposedColorToDTCG` resolved the color half with `resolveInMode`, which stopped at the inner
 * composed color (it is not an alias). That object is not RGB, so the exporter wrote the bare alias as `$value`: the
 * outer opacity was gone from `$value`, and with Figma extensions off, gone from the file.
 *
 * THE EXPECTED SHAPE is #2365's decision A, unchanged: `$value` is the inner wash's resolved color with its alpha
 * multiplied by the outer opacity. Each half resolves in its own collection and mode, as Figma resolves it.
 *
 * Every assertion runs the REAL export (`exportToZip`) over a stubbed `figma`.
 *
 * THE EXPECTED VALUES ARE NOT DERIVED FROM THE CODE UNDER TEST (docs/34). The base is `#ff8000` (1, 128/255 ≈ 0.502, 0).
 * The inner wash is 40% of it (alpha 0.4); the outer is 50% of that (alpha 0.2). In the second collection the inner
 * wash's own mode values differ (40% in Light, 80% in Dark), and its opacity is an alias to a FLOAT that is 40 in
 * Light and 80 in Dark too, so a wrong mode shows: Dark, outer 50%, is 0.4; Light is 0.2. A wash in a third collection
 * whose opacity aliases that FLOAT reads it in THEME's default mode, Light (40%), so outer 50% over it is 0.2 in Dark too;
 * resolved in the outer wash's mode instead, it would be 0.4.
 */

import JSZip from 'jszip';
import { describe, test, expect } from '../../test-harness';
import { TokenExporter } from '../../src/plugin/exporter';

const CORE = 'VariableCollectionId:1:0';
const CORE_MODE = '1:0';
const THEME = 'VariableCollectionId:2:0';
const SURFACE = 'VariableCollectionId:3:0';
const SURFACE_MODE = '3:0';
const LIGHT = '2:0';
const DARK = '2:1';
const alias = (id: string) => ({ type: 'VARIABLE_ALIAS', id });

function v(id: string, name: string, type: string, collection: string, valuesByMode: Record<string, unknown>): Variable {
  return {
    id,
    name,
    key: id,
    remote: false,
    resolvedType: type,
    scopes: [],
    description: '',
    variableCollectionId: collection,
    valuesByMode,
  } as unknown as Variable;
}

const variables = [
  v('VariableID:1:1', 'color/brand', 'COLOR', CORE, { [CORE_MODE]: { r: 1, g: 128 / 255, b: 0, a: 1 } }),
  v('VariableID:1:2', 'color/brand-40', 'COLOR', CORE, { [CORE_MODE]: { color: alias('VariableID:1:1'), opacity: 40 } }),
  // Same collection: a wash over a wash, literal opacity.
  v('VariableID:1:3', 'color/brand-40-half', 'COLOR', CORE, {
    [CORE_MODE]: { color: alias('VariableID:1:2'), opacity: 50 },
  }),
  // Across collections: a per-mode opacity and a per-mode inner wash.
  v('VariableID:2:1', 'opacity/tint', 'FLOAT', THEME, { [LIGHT]: 40, [DARK]: 80 }),
  v('VariableID:2:2', 'tint/brand', 'COLOR', THEME, {
    [LIGHT]: { color: alias('VariableID:1:1'), opacity: alias('VariableID:2:1') },
    [DARK]: { color: alias('VariableID:1:1'), opacity: alias('VariableID:2:1') },
  }),
  v('VariableID:2:3', 'tint/brand-half', 'COLOR', THEME, {
    [LIGHT]: { color: alias('VariableID:2:2'), opacity: 50 },
    [DARK]: { color: alias('VariableID:2:2'), opacity: 50 },
  }),
  // A third collection: its wash's opacity aliases back into THEME. Resolved where the inner wash lives (SURFACE, no
  // explicit THEME mode), that alias reads THEME's default mode, Light (40%), whichever mode the outer wash is in.
  v('VariableID:3:1', 'surface/wash', 'COLOR', SURFACE, {
    [SURFACE_MODE]: { color: alias('VariableID:1:1'), opacity: alias('VariableID:2:1') },
  }),
  v('VariableID:2:4', 'tint/surface-half', 'COLOR', THEME, {
    [LIGHT]: { color: alias('VariableID:3:1'), opacity: 50 },
    [DARK]: { color: alias('VariableID:3:1'), opacity: 50 },
  }),
];

const collections = [
  { id: SURFACE, name: 'surface', defaultModeId: SURFACE_MODE, modes: [{ modeId: SURFACE_MODE, name: 'Default' }] },
  { id: CORE, name: 'core', defaultModeId: CORE_MODE, modes: [{ modeId: CORE_MODE, name: 'Default' }] },
  {
    id: THEME,
    name: 'theme',
    defaultModeId: LIGHT,
    modes: [
      { modeId: LIGHT, name: 'Light' },
      { modeId: DARK, name: 'Dark' },
    ],
  },
];

function installFigma(): void {
  (globalThis as Record<string, unknown>).figma = {
    variables: {
      getVariableByIdAsync: () => Promise.resolve(null),
      getVariableCollectionByIdAsync: () => Promise.resolve(null),
      getLocalVariableCollectionsAsync: () => Promise.resolve(collections),
      getLocalVariablesAsync: () => Promise.resolve(variables),
    },
    getLocalTextStylesAsync: () => Promise.resolve([]),
    getLocalEffectStylesAsync: () => Promise.resolve([]),
    getLocalPaintStylesAsync: () => Promise.resolve([]),
  };
}

async function exportFiles(options: Record<string, unknown> = {}): Promise<Record<string, any>> {
  installFigma();
  const exporter = new TokenExporter(Object.assign({ tokenNameCase: 'preserve' }, options) as never);
  const zip = await JSZip.loadAsync(await exporter.exportToZip());
  const out: Record<string, any> = {};
  for (const name of Object.keys(zip.files)) {
    if (!zip.files[name].dir) out[name] = JSON.parse(await zip.files[name].async('string'));
  }
  return out;
}

function find(files: Record<string, any>, fileHint: string, path: string[]): any {
  const name = Object.keys(files).find(n => n.indexOf(fileHint) !== -1);
  let node = name ? files[name] : undefined;
  for (const key of path) node = node && typeof node === 'object' ? node[key] : undefined;
  return node;
}

describe('a tinted wash whose color aliases another wash (#4478)', () => {
  test('same collection: the outer opacity multiplies the inner wash alpha', async () => {
    const t = find(await exportFiles(), 'core', ['color', 'brand-40-half']);
    expect(t.$value).toEqual({ colorSpace: 'srgb', components: [1, 0.502, 0], alpha: 0.2 });
  });

  test('across collections, Light: the inner wash resolves in its own mode', async () => {
    const t = find(await exportFiles(), 'light', ['tint', 'brand-half']);
    expect(t.$value).toEqual({ colorSpace: 'srgb', components: [1, 0.502, 0], alpha: 0.2 });
  });

  test('across collections, Dark: the inner wash resolves in its own mode', async () => {
    const t = find(await exportFiles(), 'dark', ['tint', 'brand-half']);
    expect(t.$value).toEqual({ colorSpace: 'srgb', components: [1, 0.502, 0], alpha: 0.4 });
  });

  test('Dark, inner wash in a third collection: its own aliases resolve where it lives, not in the outer mode', async () => {
    const t = find(await exportFiles(), 'dark', ['tint', 'surface-half']);
    expect(t.$value).toEqual({ colorSpace: 'srgb', components: [1, 0.502, 0], alpha: 0.2 });
  });

  test('the css color format writes the washed rgba', async () => {
    const t = find(await exportFiles({ colorFormat: 'css' }), 'core', ['color', 'brand-40-half']);
    expect(t.$value).toBe('rgba(255, 128, 0, 0.2)');
  });

  test('with Figma extensions on, aliasOf keeps the outer reference and opacity', async () => {
    const t = find(await exportFiles({ includeFigmaExtensions: true }), 'core', ['color', 'brand-40-half']);
    expect(t.$extensions.figma.aliasOf).toEqual({ color: '{color.brand-40}', opacity: 50 });
  });
});
