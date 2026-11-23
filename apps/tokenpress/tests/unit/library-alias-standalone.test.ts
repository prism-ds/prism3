/**
 * prism3 #4490 — exporting a collection whose variables alias variables from another file (a published library).
 *
 * After #4166 such an alias exported as a reference by the target's name, `{brand.primary}`, marked
 * `$extensions.figma.externalAlias`. The library's tokens are not in the export, so the reference pointed at nothing:
 * Style Dictionary fails the build on it ("tries to reference brand.primary, which is not defined"), and the CSS format
 * wrote `var(--brand-primary)`, a custom property nothing declares. The export is meant to build on its own.
 *
 * Option A (the lane's recommendation; the owner decides on the PR): `$value` is the value the library variable
 * resolves to, read through the library collection's DEFAULT mode, as Figma resolves an alias into another collection.
 * The reference is kept in `externalAlias.reference`, so a tool that exports the library alongside can rebuild it.
 * A library chain that does not reach a value keeps the reference, as before.
 *
 * THE EXPECTED VALUES ARE NOT DERIVED FROM THE CODE UNDER TEST (docs/34). The colors are 8-bit colors written out by
 * hand (`#ff8000` = 1, 128/255, 0, which the exporter rounds to 4 places: 0.502; `#00ff00` = 0, 1, 0), and 16 is 16px.
 * The "every reference resolves" check walks the exported files themselves, not the exporter's variable map.
 */

import JSZip from 'jszip';
import { describe, test, expect } from '../../test-harness';
import { TokenExporter } from '../../src/plugin/exporter';
import { MultiFormatTokenExporter } from '../../src/plugin/multi-format-exporter';

const MODE = '1:0';
const LIB = 'VariableCollectionId:lib/1:0';
const alias = (id: string) => ({ type: 'VARIABLE_ALIAS', id });

function makeVariable(overrides: Record<string, unknown>): Variable {
  return Object.assign(
    {
      key: 'key-0',
      remote: false,
      resolvedType: 'COLOR',
      scopes: [],
      description: '',
      variableCollectionId: 'VariableCollectionId:local',
    },
    overrides
  ) as unknown as Variable;
}

// The library color has two modes, and its collection's default mode is NOT its first key, so a walk that read the
// first key would export green instead of orange.
const libColor = makeVariable({
  id: 'VariableID:abc123/7:1',
  name: 'brand/primary',
  key: 'abc123',
  remote: true,
  variableCollectionId: LIB,
  valuesByMode: { 'lib-first': { r: 0, g: 1, b: 0, a: 1 }, 'lib-default': { r: 1, g: 128 / 255, b: 0, a: 1 } },
});
// A library spacing step: scoped GAP in the library. The local alias has no scopes, so it is typed by the library's.
const libSpace = makeVariable({
  id: 'VariableID:abc124/7:2',
  name: 'space/4',
  key: 'abc124',
  remote: true,
  resolvedType: 'FLOAT',
  scopes: ['GAP'],
  variableCollectionId: LIB,
  valuesByMode: { 'lib-first': 16, 'lib-default': 16 },
});
// A library opacity: Figma stores an OPACITY-scoped FLOAT as a percent, and DTCG wants a fraction (#709), so 40 is 0.4.
// The conversion reads the scope of the variable that HOLDS the value, the library one, not the unscoped local alias.
const libOpacity = makeVariable({
  id: 'VariableID:abc125/7:3',
  name: 'opacity/40',
  key: 'abc125',
  remote: true,
  resolvedType: 'FLOAT',
  scopes: ['OPACITY'],
  variableCollectionId: LIB,
  valuesByMode: { 'lib-default': 40 },
});
// A library alias to another library variable: a two-hop chain inside the library.
const libAccent = makeVariable({
  id: 'VariableID:abc126/7:4',
  name: 'brand/accent',
  key: 'abc126',
  remote: true,
  variableCollectionId: LIB,
  valuesByMode: { 'lib-first': alias(libColor.id), 'lib-default': alias(libColor.id) },
});
// A library variable that aliases an id nothing resolves: its chain does not reach a value.
const libDangling = makeVariable({
  id: 'VariableID:abc127/7:5',
  name: 'brand/gone',
  key: 'abc127',
  remote: true,
  variableCollectionId: LIB,
  valuesByMode: { 'lib-default': alias('VariableID:nowhere/9:9') },
});

const fill = makeVariable({ id: 'VariableID:2:1', name: 'button/fill', valuesByMode: { [MODE]: alias(libColor.id) } });
const gap = makeVariable({
  id: 'VariableID:2:2',
  name: 'button/gap',
  resolvedType: 'FLOAT',
  valuesByMode: { [MODE]: alias(libSpace.id) },
});
const accent = makeVariable({ id: 'VariableID:2:3', name: 'button/accent', valuesByMode: { [MODE]: alias(libAccent.id) } });
const disabled = makeVariable({
  id: 'VariableID:2:6',
  name: 'button/disabled-opacity',
  resolvedType: 'FLOAT',
  valuesByMode: { [MODE]: alias(libOpacity.id) },
});
// A local alias to a local alias of a library variable: only the inner one points outside the export.
const hover = makeVariable({ id: 'VariableID:2:4', name: 'button/hover', valuesByMode: { [MODE]: alias(fill.id) } });
const stroke = makeVariable({ id: 'VariableID:2:5', name: 'button/stroke', valuesByMode: { [MODE]: alias(libDangling.id) } });

function installFigma(locals: Variable[]): void {
  const library = [libColor, libSpace, libOpacity, libAccent, libDangling];
  (globalThis as Record<string, unknown>).figma = {
    variables: {
      getVariableByIdAsync: (id: string) => Promise.resolve(library.find(v => v.id === id) || null),
      getVariableCollectionByIdAsync: (id: string) =>
        Promise.resolve(id === LIB ? { id, name: 'Brand library', remote: true, defaultModeId: 'lib-default' } : null),
      getLocalVariableCollectionsAsync: () =>
        Promise.resolve([
          { id: 'VariableCollectionId:local', name: 'core', defaultModeId: MODE, modes: [{ modeId: MODE, name: 'Default' }] },
        ]),
      getLocalVariablesAsync: () => Promise.resolve(locals),
    },
    getLocalTextStylesAsync: () => Promise.resolve([]),
    getLocalEffectStylesAsync: () => Promise.resolve([]),
    getLocalPaintStylesAsync: () => Promise.resolve([]),
  };
}

/** Every file `zip` holds, by name, JSON parsed. */
async function unzip(buffer: ArrayBuffer): Promise<Record<string, any>> {
  const zip = await JSZip.loadAsync(buffer);
  const files: Record<string, any> = {};
  for (const name of Object.keys(zip.files)) {
    if (zip.files[name].dir) continue;
    const text = await zip.files[name].async('string');
    files[name] = name.endsWith('.json') ? JSON.parse(text) : text;
  }
  return files;
}

async function exportDTCG(locals: Variable[]): Promise<Record<string, any>> {
  installFigma(locals);
  return unzip(await new TokenExporter({ tokenNameCase: 'preserve' } as never).exportToZip());
}

/** Every token path the exported JSON files define, dot-joined. */
function definedPaths(files: Record<string, any>): Set<string> {
  const paths = new Set<string>();
  const walk = (node: any, path: string[]): void => {
    if (!node || typeof node !== 'object') return;
    if (node.$value !== undefined) {
      paths.add(path.join('.'));
      return;
    }
    for (const key of Object.keys(node)) if (!key.startsWith('$')) walk(node[key], path.concat(key));
  };
  for (const name of Object.keys(files)) if (typeof files[name] === 'object') walk(files[name], []);
  return paths;
}

/** Every `{…}` reference in a `$value` of the exported JSON files (not in `$extensions`), with its token path. */
function valueReferences(files: Record<string, any>): Array<{ at: string; ref: string }> {
  const refs: Array<{ at: string; ref: string }> = [];
  const collect = (value: unknown, at: string): void => {
    if (typeof value === 'string') {
      const m = value.match(/^\{(.+)\}$/);
      if (m) refs.push({ at, ref: m[1] });
    } else if (value && typeof value === 'object') {
      for (const v of Object.values(value)) collect(v, at);
    }
  };
  const walk = (node: any, path: string[]): void => {
    if (!node || typeof node !== 'object') return;
    if (node.$value !== undefined) {
      collect(node.$value, path.join('.'));
      return;
    }
    for (const key of Object.keys(node)) if (!key.startsWith('$')) walk(node[key], path.concat(key));
  };
  for (const name of Object.keys(files)) if (typeof files[name] === 'object') walk(files[name], []);
  return refs;
}

function token(files: Record<string, any>, path: string[]): any {
  for (const name of Object.keys(files)) {
    let node = files[name];
    for (const key of path) node = node && typeof node === 'object' ? node[key] : undefined;
    if (node && node.$value !== undefined) return node;
  }
  return undefined;
}

describe('library alias exports standalone (#4490)', () => {
  test('every reference in the export resolves to a token the export defines', async () => {
    const files = await exportDTCG([fill, gap, disabled, accent, hover]);
    const defined = definedPaths(files);
    const dangling = valueReferences(files).filter(r => !defined.has(r.ref));
    expect(dangling).toEqual([]);
  });

  test('a library color exports as its value in the library default mode, the reference kept', async () => {
    const files = await exportDTCG([fill]);
    const t = token(files, ['button', 'fill']);
    expect(t.$type).toBe('color');
    expect(t.$value).toEqual({ colorSpace: 'srgb', components: [1, 0.502, 0], alpha: 1 });
    expect(t.$extensions.figma.externalAlias).toEqual({
      reference: '{brand.primary}',
      variableId: libColor.id,
      variableKey: 'abc123',
      collection: 'Brand library',
    });
  });

  test('an unscoped alias to a library spacing step is a 16px dimension, typed by the library scope', async () => {
    const files = await exportDTCG([gap]);
    const t = token(files, ['button', 'gap']);
    expect(t.$type).toBe('dimension');
    expect(t.$value).toEqual({ value: 16, unit: 'px' });
    expect(t.$extensions.figma.externalAlias.reference).toBe('{space.4}');
  });

  test('an unscoped alias to a library opacity is the fraction 0.4, converted by the library scope', async () => {
    const files = await exportDTCG([disabled]);
    const t = token(files, ['button', 'disabled-opacity']);
    expect(t.$type).toBe('number');
    expect(t.$value).toBe(0.4);
  });

  test('a chain inside the library resolves to its end, and keeps the first hop as the reference', async () => {
    const files = await exportDTCG([accent]);
    const t = token(files, ['button', 'accent']);
    expect(t.$value).toEqual({ colorSpace: 'srgb', components: [1, 0.502, 0], alpha: 1 });
    expect(t.$extensions.figma.externalAlias.reference).toBe('{brand.accent}');
  });

  test('a local alias to a local alias stays a reference: its target is in the export', async () => {
    const files = await exportDTCG([fill, hover]);
    expect(token(files, ['button', 'hover']).$value).toBe('{button.fill}');
  });

  test('a library chain that reaches no value keeps the reference, as before', async () => {
    const files = await exportDTCG([stroke]);
    const t = token(files, ['button', 'stroke']);
    expect(t.$value).toBe('{brand.gone}');
    expect(t.$extensions.figma.externalAlias.reference).toBe('{brand.gone}');
  });

  test('the CSS format declares the library value, not a var() nothing defines', async () => {
    installFigma([fill, gap]);
    const exporter = new MultiFormatTokenExporter({
      tokenNameCase: 'preserve',
      includeDTCG: true,
      additionalFormats: [{ format: 'css', config: { css: { prefix: '', useCustomProperties: true } } }],
    } as never);
    const files = await unzip(await exporter.exportToZipWithFormats());
    const css = files['css/tokens.css'] as string;
    expect(/--button-fill: rgb\(255, 128, 0\);/.test(css)).toBe(true);
    expect(/var\(--brand-primary\)|var\(--space-4\)/.test(css)).toBe(false);
  });
});
