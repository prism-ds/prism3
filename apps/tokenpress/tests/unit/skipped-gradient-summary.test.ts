/**
 * prism3 #3885 — a paint style that layers a gradient with other visible paints is skipped (a DTCG `gradient` holds
 * one), and its name was only logged with `console.warn`: `code.ts` posted `skippedBlurStyles` to the panel and not
 * `skippedGradientStyles`, and the panel's export summary showed only the blur-only skips. A designer who never opens
 * the dev console never learned the style was left out.
 *
 * Two halves, both run for real:
 *   - THE SANDBOX. `src/code.ts` is imported over a stubbed `figma`, an export is requested through its own
 *     `figma.ui.onmessage`, and the posted `export-result` must carry the skipped names, on the standard path and on
 *     the multi-format path (CSS on).
 *   - THE PANEL. `src/ui.html`'s own script is run in `node:vm` over a permissive stand-in DOM, an `export-result` is
 *     delivered through its own `window.onmessage`, and the footer status must name the skipped style.
 *
 * THE EXPECTED VALUES ARE NOT DERIVED FROM THE CODE UNDER TEST (docs/34): the fixture has exactly one layered style,
 * `brand/layered`, and one plain gradient, `brand/sunrise`, which must not be reported.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, test, expect } from '../../test-harness';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const stop = (r: number, g: number, b: number, position: number) => ({ color: { r, g, b, a: 1 }, position });
const linear = {
  type: 'GRADIENT_LINEAR',
  visible: true,
  gradientStops: [stop(1, 0, 0, 0), stop(0, 0, 1, 1)],
  gradientTransform: [
    [1, 0, 0],
    [0, 1, 0],
  ],
};
const paintStyles = [
  { id: 'S:1', name: 'brand/sunrise', description: '', paints: [linear] },
  {
    id: 'S:2',
    name: 'brand/layered',
    description: '',
    paints: [{ type: 'SOLID', visible: true, color: { r: 0, g: 0, b: 0 } }, linear],
  },
];

const posted: Array<{ type: string; data: any }> = [];
let onmessage: ((message: unknown) => Promise<void>) | null = null;

function installFigma(): void {
  const ui: Record<string, unknown> = {
    postMessage: (m: { type: string; data: any }) => posted.push(m),
  };
  Object.defineProperty(ui, 'onmessage', {
    configurable: true,
    get: () => onmessage,
    set: (fn: (message: unknown) => Promise<void>) => {
      onmessage = fn;
    },
  });
  (globalThis as Record<string, unknown>).__html__ = '';
  (globalThis as Record<string, unknown>).figma = {
    showUI: () => {},
    ui,
    clientStorage: { getAsync: () => Promise.resolve(undefined), setAsync: () => Promise.resolve() },
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

async function exportResult(options: Record<string, unknown>): Promise<any> {
  installFigma();
  if (onmessage === null) {
    await import('../../src/code');
  }
  posted.length = 0;
  await (onmessage as (message: unknown) => Promise<void>)({
    type: 'export',
    data: Object.assign({ tokenNameCase: 'preserve', colorSpace: 'srgb', colorFormat: 'dtcg' }, options),
  });
  const result = posted.find(m => m.type === 'export-result');
  return result ? result.data : posted;
}

/** Runs the panel's script and delivers one export result; returns the footer status text it set. */
function footerAfter(result: Record<string, unknown>): string {
  const html = readFileSync(resolve(root, 'src/ui.html'), 'utf8');
  const code = (html.match(/<script>([\s\S]*?)<\/script>/g) || [])
    .map(s => s.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    .join('\n');
  const texts: Record<string, string> = {};
  const element = (id: string): any => {
    const store: Record<string | symbol, unknown> = {
      id,
      style: {},
      dataset: {},
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    };
    return new Proxy(store, {
      get(t, k) {
        if (k in t) return t[k];
        if (k === 'children' || k === 'childNodes') return [];
        if (k === 'value') return '';
        return () => element('anon');
      },
      set(t, k, v) {
        t[k] = v;
        if (k === 'textContent') texts[id] = v;
        return true;
      },
    });
  };
  const document = new Proxy(
    {},
    {
      get(_t, k) {
        if (k === 'getElementById') return (id: string) => element(id);
        if (k === 'querySelectorAll') return () => [];
        return () => element('document');
      },
    }
  );
  const quiet = { log() {}, warn() {}, error() {}, info() {} };
  const context: Record<string, any> = {
    document,
    console: quiet,
    setTimeout: () => 0,
    clearTimeout() {},
    parent: { postMessage() {} },
    localStorage: { getItem: () => null, setItem() {} },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(code, context);
  context.window.onmessage({
    data: { pluginMessage: { type: 'export-result', data: Object.assign({ success: true, fileCount: 2, zipData: [] }, result) } },
  });
  return texts['footer-status'];
}

describe('skipped layered-gradient styles reach the export summary (#3885)', () => {
  test('the sandbox posts the skipped names on the standard path', async () => {
    const result = await exportResult({});
    expect(result.skippedGradientStyles).toEqual(['brand/layered']);
  });

  test('the sandbox posts the skipped names on the multi-format path', async () => {
    const result = await exportResult({ formatCss: true });
    expect(result.skippedGradientStyles).toEqual(['brand/layered']);
  });

  test('the panel footer names a skipped layered-gradient style', () => {
    const text = footerAfter({ skippedBlurStyles: [], skippedGradientStyles: ['brand/layered'] });
    expect(text).toBe('Exported 2 file(s). Skipped 1 layered gradient style(s): brand/layered');
  });

  test('the panel footer names both kinds of skip together', () => {
    const text = footerAfter({ skippedBlurStyles: ['blur/glass'], skippedGradientStyles: ['brand/layered'] });
    expect(text).toBe(
      'Exported 2 file(s). Skipped 1 blur-only effect style(s): blur/glass. Skipped 1 layered gradient style(s): brand/layered'
    );
  });

  test('with nothing skipped the footer is unchanged', () => {
    expect(footerAfter({ skippedBlurStyles: [], skippedGradientStyles: [] })).toBe('Exported 2 file(s) successfully');
  });
});
