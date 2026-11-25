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
 *
 * The marker's key is the sub-property's path in `$value` (review of #4595): a shadow's Figma `radius` is DTCG's `blur`,
 * so a radius binding is keyed `blur`, and in a shadow of several layers each layer's key carries its index (`1.color`),
 * so two layers never share one. A percent line height bound to a library variable is its resolved ratio (150% is 1.5,
 * typed here), never an alias to the local line-height variable that also holds 1.5.
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

const libBlur = makeVariable({
  id: 'VariableID:lib4/7:4',
  name: 'shadow/blur/md',
  key: 'lib4',
  remote: true,
  scopes: ['EFFECT_FLOAT'],
  variableCollectionId: LIB,
  valuesByMode: { 'lib-default': 8 },
});
const libLeading = makeVariable({
  id: 'VariableID:lib5/7:5',
  name: 'font/line-height/relaxed',
  key: 'lib5',
  remote: true,
  scopes: ['LINE_HEIGHT'],
  variableCollectionId: LIB,
  valuesByMode: { 'lib-default': 150 },
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

// A local ratio of 1.5: the line-height cache keys it as "1.5" and "150", so a 150% line height would match it by value.
const localRelaxed = makeVariable({
  id: 'VariableID:2:3',
  name: 'font/line-height/loose',
  scopes: ['LINE_HEIGHT'],
  valuesByMode: { [MODE]: 1.5 },
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

const relaxedStyle = {
  id: 'S:text/2',
  name: 'body/relaxed',
  description: '',
  fontName: { family: 'Inter', style: 'Regular' },
  fontSize: 16,
  letterSpacing: { value: 0, unit: 'PIXELS' },
  lineHeight: { value: 150, unit: 'PERCENT' },
  textDecoration: 'NONE',
  boundVariables: { lineHeight: alias(libLeading.id) },
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

const shadowLayer = (bound: Record<string, unknown>) => ({
  type: 'DROP_SHADOW',
  visible: true,
  color: { r: 1, g: 128 / 255, b: 0, a: 1 },
  offset: { x: 0, y: 2 },
  radius: 8,
  spread: 0,
  blendMode: 'NORMAL',
  boundVariables: bound,
});
// One layer whose blur (Figma's `radius`) is bound to the library, and two layers whose colors both are.
const blurStyle = { id: 'S:effect/2', name: 'elevation/soft', description: '', effects: [shadowLayer({ radius: alias(libBlur.id) })] };
const layeredStyle = {
  id: 'S:effect/3',
  name: 'elevation/layered',
  description: '',
  effects: [shadowLayer({ color: alias(libColor.id) }), shadowLayer({ color: alias(libColor.id) })],
};

function installFigma(): void {
  const library = [libWeight, libSize, libColor, libBlur, libLeading];
  (globalThis as Record<string, unknown>).figma = {
    variables: {
      getVariableByIdAsync: (id: string) => Promise.resolve(library.find(v => v.id === id) || null),
      getVariableCollectionByIdAsync: (id: string) =>
        Promise.resolve(id === LIB ? { id, name: 'Brand library', remote: true, defaultModeId: 'lib-default' } : null),
      getLocalVariableCollectionsAsync: () =>
        Promise.resolve([{ id: LOCAL, name: 'core', defaultModeId: MODE, modes: [{ modeId: MODE, name: 'Default' }] }]),
      getLocalVariablesAsync: () => Promise.resolve([localWeight, localLineHeight, localRelaxed]),
    },
    getLocalTextStylesAsync: () => Promise.resolve([textStyle, relaxedStyle]),
    getLocalEffectStylesAsync: () => Promise.resolve([effectStyle, blurStyle, layeredStyle]),
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

/** Whether a marker's key (`blur`, `1.color`) is a path that exists in the token's `$value`. */
const inValue = (value: any, key: string): boolean => {
  let node = value;
  for (const k of key.split('.')) {
    if (!node || typeof node !== 'object' || !(k in node)) return false;
    node = node[k];
  }
  return true;
};

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

  test('shadow: a library-bound blur is marked under blur, a key that exists in its value', async () => {
    const t = tokenAt(await exportFiles(), 'elevation/soft');
    expect(t.$extensions.figma.externalAlias).toEqual({ blur: marker(libBlur) });
    expect(inValue(t.$value, 'blur')).toBe(true);
  });

  test('shadow: two library-bound layers are marked under two keys, each a path in the value', async () => {
    const t = tokenAt(await exportFiles(), 'elevation/layered');
    expect(t.$extensions.figma.externalAlias).toEqual({ '0.color': marker(libColor), '1.color': marker(libColor) });
    expect(inValue(t.$value, '0.color') && inValue(t.$value, '1.color')).toBe(true);
  });

  test('typography: a library-bound percent line height is its ratio, not an alias to a local look-alike', async () => {
    const t = tokenAt(await exportFiles(), 'body/relaxed');
    expect(t.$value.lineHeight).toBe(1.5);
    expect(t.$extensions.figma.externalAlias).toEqual({ lineHeight: marker(libLeading) });
  });
});
