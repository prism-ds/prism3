/**
 * KPI 3, "ONE TOKEN EDIT REACHES BOTH FORMS" (#3408, plan item 4): the probes, the browser read and the judge.
 *
 *   npx tsx tools/poc-kpi1/one-edit.ts --read     (prints the probes' computed values from this tree's built Storybook)
 *
 * `kpi1.ts --run update` runs `--read` in its scratch copy twice, before and after the one edit, and judges the two
 * reads with `judge`. This file is never run against the repo's own tree by the scorecard.
 *
 * THE PROBES are written here by hand: a component, the story case, the part's selector, the CSS property, and the token
 * path the part binds there. They are not read from `specs.json` or the generated CSS, so a probe can disagree with them.
 * Each probe is read in both delivery forms (the HTML story and the element story) and both themes (light and dark).
 *
 * THE ORACLE is the emitted DTCG, the engine's own output for the edited input: the token path resolved through its
 * aliases, in the dark overlay first for dark, then in the base. The browser value comes the long way round, through
 * Style Dictionary's CSS, the component CSS and the cascade, so the two are independent of each other.
 *
 * WHAT FAILS, by probe, form and theme:
 *   - a form or theme with no reading (the probe was not represented);
 *   - a reading before the edit that is not the token's value before it (the probe reads the wrong thing);
 *   - a reading after the edit that is not the token's value after it (the edit did not reach that form);
 *   - a token the edit did not move (the probe would pass whether or not the edit reached anything).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { isEntry } from '@prism3/engine/harness';

const HERE = import.meta.dirname ?? '';

export type Form = 'html' | 'element';
export type Theme = 'light' | 'dark';
export const FORMS: readonly Form[] = ['html', 'element'];
export const THEMES: readonly Theme[] = ['light', 'dark'];
export type Probe = { name: string; component: 'button' | 'text-field' | 'password-field'; case: string; selector: string; prop: string; token: string };

/** Written by hand: what the update edits (the primary color and the radius) shows on, in each component. */
export const PROBES: Probe[] = [
  { name: 'button fill', component: 'button', case: 'filled', selector: '.p3-button', prop: 'background-color', token: 'pds3.color.interactive.primary.fill.rest' },
  { name: 'button corner', component: 'button', case: 'filled', selector: '.p3-button', prop: 'border-top-left-radius', token: 'pds3.radius.md' },
  { name: 'text field corner', component: 'text-field', case: 'rest', selector: '.p3-text-field__control', prop: 'border-top-left-radius', token: 'pds3.radius.sm' },
  { name: 'password field corner', component: 'password-field', case: 'rest', selector: '.p3-password-field__control', prop: 'border-top-left-radius', token: 'pds3.radius.sm' },
];

/** A reading's key: probe, form and theme. */
export const key = (p: Pick<Probe, 'name'>, form: Form, theme: Theme) => `${p.name} (${form}, ${theme})`;
export type Reading = Record<string, string>;

// ------------------------------------------------------------------------------------------------ the oracle
type Tree = Record<string, unknown>;
const at = (t: Tree, path: string): { $value?: unknown } | undefined =>
  path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Tree)[k] : undefined), t) as { $value?: unknown } | undefined;

/** The token's value in a theme: each alias hop looked up in the overlay first (dark), then the base. */
export const resolveToken = (base: Tree, overlay: Tree | null, path: string): string => {
  const seen = new Set<string>();
  let p = path;
  for (;;) {
    if (seen.has(p)) throw new Error(`alias cycle at ${p}`);
    seen.add(p);
    const node = (overlay && at(overlay, p)?.$value !== undefined ? at(overlay, p) : undefined) ?? at(base, p);
    const v = node?.$value;
    if (v === undefined) throw new Error(`no token ${p}${p === path ? '' : ` (an alias of ${path})`}`);
    if (typeof v === 'string' && /^\{[^}]+\}$/.test(v)) { p = v.slice(1, -1); continue; }
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object' && typeof (v as { hex?: unknown }).hex === 'string') return (v as { hex: string }).hex;
    if (v && typeof v === 'object' && 'value' in (v as object) && 'unit' in (v as object)) return `${(v as { value: number }).value}${(v as { unit: string }).unit}`;
    throw new Error(`${path} resolves to a value this probe can't compare: ${JSON.stringify(v)}`);
  }
};

/** The value a browser reports for a token value: a 6-digit hex as `rgb(r, g, b)`, a dimension as written. */
export const asComputed = (v: string): string => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(v);
  return m ? `rgb(${m.slice(1).map((x) => parseInt(x, 16)).join(', ')})` : v;
};

/** Every probe's expected computed value, per theme, from an `out/` folder's DTCG. */
export const expected = (outDir: string): Reading => {
  const read = (f: string) => JSON.parse(readFileSync(resolve(outDir, f), 'utf8')) as Tree;
  const base = read('prism3.base.tokens.json');
  const dark = read('prism3.dark.overlay.tokens.json');
  const out: Reading = {};
  for (const p of PROBES) for (const theme of THEMES) {
    const v = asComputed(resolveToken(base, theme === 'dark' ? dark : null, p.token));
    for (const form of FORMS) out[key(p, form, theme)] = v;
  }
  return out;
};

// ------------------------------------------------------------------------------------------------ the judge
/** The failures, each by probe, form and theme; an empty list is a pass. */
export const judge = (before: Reading, after: Reading, wantBefore: Reading, wantAfter: Reading): string[] => {
  const bad: string[] = [];
  for (const p of PROBES) for (const theme of THEMES) {
    const k0 = key(p, 'html', theme);
    if (wantBefore[k0] === wantAfter[k0]) bad.push(`${p.name} (${theme}): the edit did not move ${p.token} (${wantAfter[k0]}), so this probe measures nothing`);
    for (const form of FORMS) {
      const k = key(p, form, theme);
      if (before[k] === undefined || after[k] === undefined) { bad.push(`${k}: not read ${before[k] === undefined ? 'before' : 'after'} the edit`); continue; }
      if (before[k] !== wantBefore[k]) bad.push(`${k}: computes ${before[k]} before the edit, but ${p.token} was ${wantBefore[k]}`);
      if (after[k] !== wantAfter[k]) bad.push(`${k}: computes ${after[k]} after the edit, but ${p.token} is now ${wantAfter[k]}${after[k] === before[k] ? ' (unchanged: the edit did not reach it)' : ''}`);
    }
  }
  return bad;
};

// ------------------------------------------------------------------------------------------------ the browser read
/** Reads every probe from this tree's `apps/storybook/storybook-static`, in both forms and both themes. */
export const read = async (): Promise<Reading> => {
  const h = await import('../../apps/storybook/a11y-harness.ts');
  if (!existsSync(resolve(h.STATIC, 'index.json'))) throw new Error('no built Storybook: apps/storybook/storybook-static/index.json is missing');
  const { chromium } = h.require('playwright');
  const { server, origin } = await h.serve();
  const browser = await chromium.launch();
  const out: Reading = {};
  try {
    const ctx = await h.context(browser);
    const page = await ctx.newPage();
    for (const p of PROBES) for (const form of FORMS) for (const theme of THEMES) {
      const s = { id: `components-${p.component}-${form}--${p.case}`, component: p.component, form, case: p.case };
      await h.open(page, origin, s, theme);
      const v = await page.evaluate(([sel, prop]: string[]) => {
        const el = document.querySelector(`#storybook-root ${sel}`);
        return el ? getComputedStyle(el).getPropertyValue(prop) : null;
      }, [p.selector, p.prop]);
      if (v !== null) out[key(p, form, theme)] = v;
    }
  } finally {
    await browser.close();
    server.close();
  }
  return out;
};

if (isEntry(import.meta.url) && process.argv.includes('--read')) {
  read().then((r) => console.log(JSON.stringify(r)), (e) => { console.error(`FAIL one edit: the browser read failed: ${(e as Error).message}`); process.exit(1); });
}
