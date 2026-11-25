/**
 * prism3 #4366 — a composite's sub-property bound to a team-library variable (a text style's font weight, a gradient
 * stop's color, a shadow's color) exported with no record of the library. #4490 resolved a whole-token alias to a
 * library variable and kept the reference in `$extensions.figma.externalAlias`; the composites resolved bindings
 * against local variables only, so a library binding never got that marker, and a font weight could even come out as
 * an alias to an unrelated local variable that happened to hold the same weight.
 *
 * Owner decision A (2026-11-24, on #4366 and #4511): the sub-property exports its resolved value, plus an
 * `externalAlias` marker naming where it came from, per sub-property, consistent with #4490: the same four fields
 * (`reference`, `variableId`, `variableKey`, `collection`), keyed by the sub-property's path inside `$value`
 * (`fontWeight`, `0.color`, `color`).
 *
 * THE EXPECTED VALUES ARE NOT DERIVED FROM THE CODE UNDER TEST (docs/34): 600 is the weight "Semi Bold" names, 18px is
 * the style's own size, `#ff8000` is written out by hand (1, 128/255, 0, rounded to 4 places: 0.502), and each marker
 * is typed from the library variable it names. A local binding beside them gets no marker.
 */

import JSZip from 'jszip';
import { describe, test, expect } from '../../test-harness';
import { TokenExporter } from '../../src/plugin/exporter';

const MODE = '1:0';
const LOCAL = 'VariableCollectionId:local';
const LIB = 'VariableCollectionId:lib/1:0';
const alias = (id: string) => ({ type: 'VARIABLE_ALIAS', id });

function makeVariable(overrides: Record<string, unknown>): Variable {
  return Object.assign(
    { key: 'key-0', remote: false, resolvedType: 'FLOAT', scopes: [], description: '', variableCollectionId: LOCAL },
    overrides
  ) as unknown as Variable;
}

// The library: only `getVariableByIdAsync` knows these, as for a file that imports a published library.
const libWeight = makeVariable({
  id: 'VariableID:lib1/7:1',
  name: 'font/weight/strong',
  key: 'lib1',
  remote: true,
  scopes: ['FONT_WEIGHT'],
  variableCollectionId: LIB,
  valuesByMode: { 'lib-default': 600 },
});
const libSize = makeVariable({
  id: 'VariableID:lib2/7:2',
  name: 'font/size/lg',
  key: 'lib2',
  remote: true,
  scopes: ['FONT_SIZE'],
  variableCollectionId: LIB,
  valuesByMode: { 'lib-default': 18 },
});
const libColor = makeVariable({
  id: 'VariableID:lib3/7:3',
  name: 'brand/primary',
  key: 'lib3',
  remote: true,
  resolvedType: 'COLOR',
  variableCollectionId: LIB,
  valuesByMode: { 'lib-default': { r: 1, g: 128 / 255, b: 0, a: 1 } },
});

// Local variables. The weight holds the same 600 as the library's, which the font-weight cache would match by value.
const localWeight = makeVariable({
  id: 'VariableID:2:1',
  name: 'font/weight/semibold',
  scopes: ['FONT_WEIGHT'],
  valuesByMode: { [MODE]: 600 },
});
const localLineHeight = makeVariable({
  id: 'VariableID:2:2',
  name: 'font/line-height/lg',
  scopes: ['LINE_HEIGHT'],
  valuesByMode: { [MODE]: 24 },
});

const textStyle = {
  id: 'S:text/1',
  name: 'heading/lg',
  description: '',
  fontName: { family: 'Inter', style: 'Semi Bold' },
  fontSize: 18,
  letterSpacing: { value: 0, unit: 'PIXELS' },
  lineHeight: { value: 24, unit: 'PIXELS' },
  textDecoration: 'NONE',
  boundVariables: { fontWeight: alias(libWeight.id), fontSize: alias(libSize.id), lineHeight: alias(localLineHeight.id) },
};

const paintStyle = {
  id: 'S:paint/1',
  name: 'brand/sunrise',
  description: '',
  paints: [
    {
      type: 'GRADIENT_LINEAR',
      visible: true,
      gradientStops: [
        { color: { r: 1, g: 128 / 255, b: 0, a: 1 }, position: 0, boundVariables: { color: alias(libColor.id) } },
        { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 },
      ],
      gradientTransform: [
        [1, 0, 0],
        [0, 1, 0],
      ],
    },
  ],
};

const effectStyle = {
  id: 'S:effect/1',
  name: 'elevation/raised',
  description: '',
  effects: [
    {
      type: 'DROP_SHADOW',
      visible: true,
      color: { r: 1, g: 128 / 255, b: 0, a: 1 },
      offset: { x: 0, y: 2 },
      radius: 4,
      spread: 0,
      blendMode: 'NORMAL',
      boundVariables: { color: alias(libColor.id) },
    },
  ],
};

function installFigma(): void {
  const library = [libWeight, libSize, libColor];
  (globalThis as Record<string, unknown>).figma = {
    variables: {
      getVariableByIdAsync: (id: string) => Promise.resolve(library.find(v => v.id === id) || null),
      getVariableCollectionByIdAsync: (id: string) =>
        Promise.resolve(id === LIB ? { id, name: 'Brand library', remote: true, defaultModeId: 'lib-default' } : null),
      getLocalVariableCollectionsAsync: () =>
        Promise.resolve([{ id: LOCAL, name: 'core', defaultModeId: MODE, modes: [{ modeId: MODE, name: 'Default' }] }]),
      getLocalVariablesAsync: () => Promise.resolve([localWeight, localLineHeight]),
    },
    getLocalTextStylesAsync: () => Promise.resolve([textStyle]),
    getLocalEffectStylesAsync: () => Promise.resolve([effectStyle]),
    getLocalPaintStylesAsync: () => Promise.resolve([paintStyle]),
  };
}

async function exportFiles(): Promise<Record<string, any>> {
  installFigma();
  const buffer = await new TokenExporter({ tokenNameCase: 'preserve' } as never).exportToZip();
  const zip = await JSZip.loadAsync(buffer);
  const files: Record<string, any> = {};
  for (const name of Object.keys(zip.files)) {
    if (!zip.files[name].dir && name.endsWith('.json')) files[name] = JSON.parse(await zip.files[name].async('string'));
  }
  return files;
}

/** The token at a slash path in whichever exported file holds it, under any namespace wrapper. */
function tokenAt(files: Record<string, any>, slashPath: string): any {
  const keys = slashPath.split('/');
  for (const name of Object.keys(files)) {
    const roots = [files[name]].concat(Object.keys(files[name]).map(k => files[name][k]));
    for (const root of roots) {
      let node = root;
      for (const k of keys) node = node && typeof node === 'object' ? node[k] : undefined;
      if (node && node.$value !== undefined) return node;
    }
  }
  return undefined;
}

const marker = (v: Variable) => ({
  reference: `{${v.name.split('/').join('.')}}`,
  variableId: v.id,
  variableKey: (v as unknown as { key: string }).key,
  collection: 'Brand library',
});

describe('a composite sub-property bound to a library variable keeps its value and names the library (#4366)', () => {
  test('typography: a library-bound weight is the resolved value, not an alias to a local look-alike', async () => {
    const t = tokenAt(await exportFiles(), 'heading/lg');
    expect(t.$value.fontWeight).toBe(600);
  });

  test('typography: each library-bound sub-property has its own marker, and a local binding has none', async () => {
    const t = tokenAt(await exportFiles(), 'heading/lg');
    expect(t.$extensions.figma.externalAlias).toEqual({ fontWeight: marker(libWeight), fontSize: marker(libSize) });
  });

  test('typography: the library-bound size is the style value, and the local binding stays a reference', async () => {
    const t = tokenAt(await exportFiles(), 'heading/lg');
    expect(t.$value.fontSize).toEqual({ value: 18, unit: 'px' });
    expect(typeof t.$value.lineHeight === 'string' && t.$value.lineHeight.charAt(0) === '{').toBe(true);
  });

  test('gradient: a library-bound stop is the resolved color, marked by its index', async () => {
    const t = tokenAt(await exportFiles(), 'brand/sunrise');
    expect(t.$value[0].color.components).toEqual([1, 0.502, 0]);
    expect(t.$extensions.figma.externalAlias).toEqual({ '0.color': marker(libColor) });
  });

  test('shadow: a library-bound color is the resolved color, marked', async () => {
    const t = tokenAt(await exportFiles(), 'elevation/raised');
    expect(t.$value.color.components).toEqual([1, 0.502, 0]);
    expect(t.$extensions.figma.externalAlias).toEqual({ color: marker(libColor) });
  });
});
