/**
 * THE PARITY CHECK, first slice (#3408 S2 → S6): does `button.css`, rendered, bind the tokens the design spec names?
 *
 *   npx tsx packages/css/check-parity.ts
 *
 * THE TWO SIDES, and why neither is derived from the other (`docs/34`):
 *   - EXPECTED is read from the emission only: `specs.json` (the token per part, size and state, the focus ring's
 *     stroke per surface) and `components.ai.json` (every prop and value the API promises). Never `generate.ts`.
 *   - ACTUAL is what Chromium computes for markup this file writes from its OWN copy of the markup contract
 *     (`MARKUP` below, which the README documents), with `button.css` loaded as shipped. The cascade is the browser's,
 *     so a selector that never matches, a rule that loses on specificity, or a state wired to the wrong attribute shows
 *     up as a wrong token, not as a pass.
 *
 * HOW A COMPUTED VALUE NAMES A TOKEN. The page loads no real token CSS. Instead every color, dimension and typography
 * leaf of the tree is defined as a unique SENTINEL (a color `rgb(1, hi, lo)`, a length `10000+i px`, a font of size
 * `10000+i px`, a number `i/1000`), so each computed value decodes back to exactly one token name. A number is read
 * through the one property that scales one, `letter-spacing` (Q143 A): computed tracking ÷ computed font size × 1000. Two tokens with equal real values
 * (the outline border and the outline label both resolve to primary-600) still decode apart — a swap between them,
 * invisible to a screenshot, fails here by name.
 *
 * States are forced through the DevTools protocol (`CSS.forcePseudoState`: hover, active, focus-visible) or set as
 * the contract's attributes (pending, disabled, inactive). `inactive` is the def's code-only state: it has no spec row,
 * and its def says its intended paint is `disabled`'s, so it is held to the disabled row.
 *
 * MOTION (Q146 A, #4375). A duration leaf's sentinel is `<i>ms` and a cubicBezier's is `cubic-bezier(0.5, <i>, 0.5, 1)`,
 * so each of `specs.json`'s motion bindings decodes from the transition Chromium computes for the property this file
 * maps it to (`MOTION`, written here, not read from the generator). `motion.state-reduced` is read with the page's
 * `prefers-reduced-motion` set to reduce. A binding the map doesn't name fails as a gap, by name. The sentinel
 * durations are long, so a forced state is finished (`Animation.finish()`), never read mid-transition.
 *
 * SELF-TEST. After the real run, seven mutants must each FAIL BY NAME, or this check fails: a swapped token, a dropped
 * state, a dropped prop value in the CSS, a dropped prop value in the markup contract, dropped tracking, the press
 * rebound to the reduced duration, and the reduced-motion transition dropped.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readUncommitted } from './emission';
import { ARM_1, load, tokenProperty } from '../../apps/storybook/arm-contract';
import { isEntry } from './entry.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../engine/out');
const specs = readUncommitted('specs.json').components;
const ai = JSON.parse(readFileSync(resolve(OUT, 'components/components.ai.json'), 'utf8')).components;
const tree = JSON.parse(readFileSync(resolve(OUT, 'prism3.tokens.json'), 'utf8'));
const README = readFileSync(resolve(HERE, 'README.md'), 'utf8');
const CSS = readFileSync(resolve(HERE, 'button.css'), 'utf8');

const ID = 'button';
const SPEC = specs[ID];
const API = ai[ID];

// ------------------------------------------------------------------------------------------------ the markup contract
// This package's README states it; this is the check's own copy, written apart from the generator. An attribute value
// of `null` means "set nothing" (the default needs no attribute, but the check writes it anyway to prove it matches).
type Attrs = Record<string, string | null>;
type Markup = Record<string, { how: string; values?: Record<string, Attrs> }>;
export const MARKUP: Markup = {
  label: { how: 'text in <span class="p3-button__label">' },
  onClick: { how: 'a click listener on the element (suppressed while aria-disabled, S4)' },
  appearance: { how: 'data-prop-appearance', values: { filled: { 'data-prop-appearance': 'filled' }, outline: { 'data-prop-appearance': 'outline' }, text: { 'data-prop-appearance': 'text' } } },
  size: { how: 'data-prop-size', values: { small: { 'data-prop-size': 'small' }, medium: { 'data-prop-size': 'medium' }, large: { 'data-prop-size': 'large' } } },
  surface: { how: 'data-prop-surface', values: { default: { 'data-prop-surface': 'default' }, inverse: { 'data-prop-surface': 'inverse' } } },
  inset: { how: 'data-prop-inset', values: { default: { 'data-prop-inset': 'default' }, flush: { 'data-prop-inset': 'flush' } } },
  fullWidth: { how: 'data-prop-fullwidth="true"', values: { true: { 'data-prop-fullwidth': 'true' }, false: {} } },
  type: { how: 'the native type attribute', values: { button: { type: 'button' }, submit: { type: 'submit' }, reset: { type: 'reset' } } },
  isPending: { how: 'aria-busy="true" and aria-disabled="true"', values: { true: { 'aria-busy': 'true', 'aria-disabled': 'true' }, false: {} } },
  isInactive: { how: 'aria-disabled="true"', values: { true: { 'aria-disabled': 'true' }, false: {} } },
  disabled: { how: 'the native disabled attribute', values: { true: { disabled: '' }, false: {} } },
  leadingVisual: { how: 'a <span class="p3-button__leading-visual" aria-hidden="true"> before the label' },
  trailingVisual: { how: 'a <span class="p3-button__trailing-visual" aria-hidden="true"> after the label' },
  href: { how: 'renders <a class="p3-button" href> instead of <button>' },
  'aria-label': { how: 'the native aria-label attribute' },
};
const PART: Record<string, string> = {
  container: '',
  'container/label': '.p3-button__label',
  'container/leadingVisual': '.p3-button__leading-visual',
  'container/trailingVisual': '.p3-button__trailing-visual',
  'container/spinner': '.p3-button__spinner',
};
/** A design-state's markup: attributes, or a pseudo-class the protocol forces. */
const STATE: Record<string, { attrs?: Attrs; force?: string; prop?: [string, string] }> = {
  rest: {},
  hover: { force: 'hover' },
  pressed: { force: 'active' },
  'focus-visible': { force: 'focus-visible' },
  pending: { prop: ['isPending', 'true'] },
  disabled: { prop: ['disabled', 'true'] },
  inactive: { prop: ['isInactive', 'true'] },
};

// ------------------------------------------------------------------------------------------------ sentinels
const ROOT = Object.keys(tree).filter((k) => !k.startsWith('$'))[0];
// The CSS custom property each token is read through: the arm's input contract's `tokens` (#4436), arm 1's stock
// Style Dictionary names. A token the contract names no property for gets no sentinel, so a value bound through it
// decodes to no token and fails by name.
const cssName = tokenProperty(load(ARM_1).tokens, ROOT);
const sentinel = new Map<string, string>(); // css var → sentinel value
const decode = new Map<string, string>(); // computed value → token path
{
  let i = 1;
  const walk = (n: any, p: string[], type?: string) => {
    if (!n || typeof n !== 'object') return;
    const t = n.$type ?? type;
    if (n.$value !== undefined) {
      const path = p.join('.');
      const k = i++;
      if (t === 'color') { sentinel.set(cssName(path)!, `rgb(1, ${k >> 8}, ${k & 255})`); decode.set(`rgb(1, ${k >> 8}, ${k & 255})`, path); }
      if (t === 'dimension') { sentinel.set(cssName(path)!, `${10000 + k}px`); decode.set(`${10000 + k}px`, path); }
      // Chromium clamps font-size at 10000px, so a font sentinel lives below it, in its own decode namespace.
      if (t === 'typography') { sentinel.set(cssName(path)!, `400 ${1000 + k}px/1 serif`); decode.set(`font:${1000 + k}px`, path); }
      if (t === 'number') { sentinel.set(cssName(path)!, `${k / 1000}`); decode.set(`ls:${k}`, path); }
      return;
    }
    for (const [key, v] of Object.entries(n)) if (!key.startsWith('$')) walk(v, [...p, key], t);
  };
  walk(tree[ROOT], [], undefined);
}
// Motion leaves (#4375): a duration's sentinel is `<i>ms`, a curve's `cubic-bezier(0.5, <i>, 0.5, 1)`, each in its own
// decode namespace, so a transition Chromium computes names exactly one token.
{
  let i = 1;
  const walk = (n: any, p: string[], type?: string) => {
    if (!n || typeof n !== 'object') return;
    const t = n.$type ?? type;
    if (n.$value !== undefined) {
      const path = p.join('.');
      const k = i++;
      if (t === 'duration') { sentinel.set(cssName(path), `${k}ms`); decode.set(`dur:${k}`, path); }
      if (t === 'cubicBezier') { sentinel.set(cssName(path), `cubic-bezier(0.5, ${k}, 0.5, 1)`); decode.set(`ease:${k}`, path); }
      return;
    }
    for (const [key, v] of Object.entries(n)) if (!key.startsWith('$')) walk(v, [...p, key], t);
  };
  walk(tree[ROOT], [], undefined);
}
const name = (computed: string) => decode.get(computed) ?? (computed === 'rgba(0, 0, 0, 0)' ? '(transparent)' : `(no token: ${computed})`);

// ------------------------------------------------------------------------------------------------ the probes
/** A check's `prop` may be `transition-duration:<property>` or `transition-timing-function:<property>`: that property's
 *  entry in the part's transition lists. `reduce` reads it with `prefers-reduced-motion: reduce`. */
export type Probe = { coord: Record<string, string>; state: string; leading: boolean; trailing: boolean; checks: { part: string; prop: string; want: string; what: string; reduce?: boolean }[] };
const where = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k}=${v}`).join(' ');
const COLOR_PROP: Record<string, string> = { fill: 'background-color', stroke: 'border-top-color', ink: 'color', icon: 'color' };
/**
 * Each motion binding the button carries, as the transitions it sets (Q146 A; the def's `motion.reduceMotion`): the
 * state change on the fill, the border and the label's ink; the press on the container's transform. Written here.
 */
const STATE_PROPS: [string, string][] = [['container', 'background-color'], ['container', 'border-color'], ['container/label', 'color']];
const MOTION: Record<string, { read: 'transition-duration' | 'transition-timing-function'; reduce: boolean[]; on: [string, string][] }> = {
  'motion.state': { read: 'transition-duration', reduce: [false], on: STATE_PROPS },
  'motion.state-easing': { read: 'transition-timing-function', reduce: [false, true], on: STATE_PROPS },
  'motion.state-reduced': { read: 'transition-duration', reduce: [true], on: STATE_PROPS },
  'motion.press': { read: 'transition-duration', reduce: [false], on: [['container', 'transform']] },
  'motion.press-easing': { read: 'transition-timing-function', reduce: [false], on: [['container', 'transform']] },
};
const SIZE_PROP: Record<string, string> = {
  paddingTop: 'padding-top', paddingBottom: 'padding-bottom', paddingLeft: 'padding-left', paddingRight: 'padding-right',
  gap: 'column-gap', width: 'width', minWidth: 'min-width',
  // #3839: the corner and the stroke are redlines too. One corner and one side stand for all four: the generator writes
  // the shorthand from one token, and a per-corner key would be a new name, unmapped here, so it fails as a gap.
  radius: 'border-top-left-radius', strokeWidth: 'border-top-width',
};

export const buildProbes = (markup: Markup): { probes: Probe[]; gaps: string[] } => {
  const probes: Probe[] = [];
  const gaps: string[] = [];
  // 1. Every prop and value the API promises has a markup mapping, and the README documents each prop.
  for (const p of API.props) {
    const m = markup[p.name];
    if (!m) { gaps.push(`prop ${p.name} has no markup mapping`); continue; }
    for (const val of p.values ?? (p.type === 'boolean' ? ['true', 'false'] : [])) if (!m.values?.[String(val)]) gaps.push(`prop value ${p.name}=${val} has no markup mapping`);
    if (!new RegExp(`^\\|\\s*\`${p.name}\`\\s*\\|`, 'm').test(README)) gaps.push(`prop ${p.name} is not in the README's markup contract table`);
  }
  for (const s of SPEC.axes.find((a: any) => a.name === 'state').values.concat(SPEC.codeOnlyStates)) if (!STATE[s]) gaps.push(`state ${s} has no markup mapping`);

  // 2. Colors: every spec row, with both visuals present (the spinner takes the leading cell when pending).
  const rowsWithInactive = [...SPEC.colors, ...SPEC.colors.filter((r: any) => r.where.state === 'disabled').map((r: any) => ({ ...r, where: { ...r.where, state: 'inactive' } }))];
  for (const row of rowsWithInactive) {
    const { state, ...coord } = row.where;
    const checks: Probe['checks'] = [];
    const painted = new Set<string>();
    for (const p of row.parts) for (const [k, token] of Object.entries<any>(p)) {
      if (k === 'part') continue;
      checks.push({ part: p.part, prop: COLOR_PROP[k], want: token, what: `${p.part} ${COLOR_PROP[k]}` });
      painted.add(`${p.part}:${COLOR_PROP[k]}`);
    }
    // what the spec does not paint on the container stays unpainted
    for (const prop of ['background-color', 'border-top-color']) if (!painted.has(`container:${prop}`)) checks.push({ part: 'container', prop, want: '(transparent)', what: `container ${prop}` });
    probes.push({ coord, state, leading: true, trailing: true, checks });
  }
  // 3. Focus ring: the nested focus-ring's stroke, at the surface it follows.
  const ring = SPEC.nesting.find((n: any) => n.part === 'container/focusRing');
  for (const surface of SPEC.axes.find((a: any) => a.name === 'surface').values) {
    const stroke = specs[ring.component].colors.find((c: any) => c.where.surface === (ring.follows.includes('surface') ? surface : 'default')).parts[0].stroke;
    probes.push({ coord: { appearance: 'filled', surface, inset: 'default' }, state: 'focus-visible', leading: false, trailing: false, checks: [{ part: 'container', prop: 'outline-color', want: stroke, what: 'focusRing outline-color' }] });
  }
  // 4. Sizes: every redline row, at rest. The container's height is a floor (min-height), so a wrapped label grows it.
  for (const row of SPEC.redlines) {
    const { leading, trailing, ...coord } = row.where;
    const checks: Probe['checks'] = [];
    for (const p of row.parts) for (const [k, val] of Object.entries<any>(p.values)) {
      const prop = k === 'height' ? (p.part === 'container' ? 'min-height' : 'height') : SIZE_PROP[k];
      if (!prop) { gaps.push(`redline ${p.part}.${k} has no CSS property in this check`); continue; }
      const want = val.token ?? `(px ${val.px})`;
      checks.push({ part: p.part, prop, want, what: `${p.part} ${k}` });
    }
    if (!row.parts.some((p: any) => p.part === 'container' && p.values.minWidth)) checks.push({ part: 'container', prop: 'min-width', want: '(none)', what: 'container minWidth (none)' });
    probes.push({ coord: { appearance: coord.inset === 'flush' ? 'text' : 'filled', ...coord }, state: 'rest', leading: leading === 'true', trailing: trailing === 'true', checks });
  }
  // 5. Label styles: the type token, and its decoration and tracking (the font shorthand carries neither).
  for (const row of SPEC.type) for (const p of row.parts) {
    const style = p.textStyle.split('.').reduce((n: any, k: string) => n?.[k], tree[ROOT])?.$value;
    const deco = style?.textDecoration ?? 'none';
    const ls = typeof style?.letterSpacing === 'string' ? style.letterSpacing.replace(/^\{|\}$/g, '').replace(new RegExp(`^${ROOT}\\.`), '') : `(literal ${style?.letterSpacing})`;
    probes.push({ coord: { ...row.where }, state: 'rest', leading: false, trailing: false, checks: [
      { part: p.part, prop: 'font-size', want: p.textStyle, what: `${p.part} textStyle` },
      { part: p.part, prop: 'text-decoration-line', want: `(kw ${deco})`, what: `${p.part} textDecoration` },
      { part: p.part, prop: 'letter-spacing', want: ls, what: `${p.part} letterSpacing` },
    ] });
  }
  // 6. Motion: every binding, on each appearance at rest.
  const motionChecks: Probe['checks'] = [];
  for (const [key, token] of Object.entries<string>(SPEC.motion ?? {})) {
    const m = MOTION[key];
    if (!m) { gaps.push(`motion binding ${key} has no CSS property in this check`); continue; }
    for (const reduce of m.reduce) for (const [part, prop] of m.on) {
      motionChecks.push({ part, prop: `${m.read}:${prop}`, want: token, what: `${key} (${part} ${prop} ${m.read.replace('transition-', '')}${reduce ? ', reduced motion' : ''})`, reduce });
    }
  }
  if (motionChecks.length) for (const appearance of SPEC.axes.find((a: any) => a.name === 'appearance').values) {
    probes.push({ coord: { appearance, surface: 'default', inset: 'default', size: 'medium' }, state: 'rest', leading: false, trailing: false, checks: motionChecks });
  }
  return { probes, gaps };
};

const attrsOf = (pr: Probe, markup: Markup): { attrs: Attrs; missing: string[] } => {
  const attrs: Attrs = { class: 'p3-button', 'data-component': ID };
  const missing: string[] = [];
  const apply = (prop: string, val: string) => {
    const a = markup[prop]?.values?.[val];
    if (!a) { missing.push(`${prop}=${val}`); return; }
    Object.assign(attrs, a);
  };
  for (const [k, v] of Object.entries(pr.coord)) apply(k, v);
  apply('type', 'button');
  const st = STATE[pr.state];
  if (st.prop) apply(...st.prop);
  return { attrs, missing };
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const html = (pr: Probe, i: number, attrs: Attrs) => {
  const a = Object.entries(attrs).filter(([, v]) => v !== null).map(([k, v]) => (v === '' ? k : `${k}="${esc(v!)}"`)).join(' ');
  return `<button ${a} data-probe="${i}">`
    + (pr.leading ? '<span class="p3-button__leading-visual" aria-hidden="true"><svg viewBox="0 0 24 24"></svg></span>' : '')
    + '<span class="p3-button__spinner" aria-hidden="true"><svg viewBox="0 0 24 24"></svg></span>'
    + '<span class="p3-button__label">Save</span>'
    + (pr.trailing ? '<span class="p3-button__trailing-visual" aria-hidden="true"><svg viewBox="0 0 24 24"></svg></span>' : '')
    + '</button>';
};

// ------------------------------------------------------------------------------------------------ the run
/**
 * A DELIVERY FORM (#3408 S6): how a probe reaches the page. The default writes the contract's markup by hand. The
 * element form (`packages/web-components/check-token-parity.ts`) writes a `<p3-button>` from the probe's props, loads
 * the element's script, and marks the element's rendered root as the probe, so the same EXPECTED and the same
 * sentinel decoding hold the element's output. `props` is the probe as API props: its coordinates plus its state's prop.
 */
export type Form = { name: string; scripts: string[]; write: (pr: Probe, i: number, attrs: Attrs, props: Record<string, string>) => string };
const HTML_FORM: Form = { name: 'html', scripts: [], write: (pr, i, attrs) => html(pr, i, attrs) };
/** After a form's scripts run: each `[data-probe-host]` element's rendered root (its `data-probe-root` child) becomes the probe. */
export const MARK_ROOTS = `(async () => { const hosts = [...document.querySelectorAll('[data-probe-host]')]; await Promise.all(hosts.map((h) => h.updateComplete)); for (const h of hosts) { const inner = h.querySelector(':scope > ' + h.getAttribute('data-probe-root')); if (inner) inner.setAttribute('data-probe', h.getAttribute('data-probe-host')); } })()`;
export const runParity = async (browser: any, css: string, markup: Markup, form: Form = HTML_FORM): Promise<{ failures: string[]; checked: number }> => {
  const { probes, gaps } = buildProbes(markup);
  const failures = [...gaps];
  const page = await browser.newPage();
  const built = probes.map((pr, i) => {
    const { attrs, missing } = attrsOf(pr, markup);
    for (const m of missing) failures.push(`${where(pr.coord)} state=${pr.state}: ${m} has no markup mapping`);
    const st = STATE[pr.state];
    return form.write(pr, i, attrs, { ...pr.coord, ...(st.prop ? { [st.prop[0]]: st.prop[1] } : {}) });
  });
  const root = `:root{${[...sentinel].filter(([k]) => k).map(([k, v]) => `${k}:${v};`).join('')}}`;
  await page.setContent(`<!doctype html><html><head><style>${root}</style><style>${css}</style></head><body>${built.join('\n')}</body></html>`);
  if (form.scripts.length) {
    for (const s of form.scripts) await page.addScriptTag({ content: s });
    await page.evaluate(MARK_ROOTS);
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const doc = await cdp.send('DOM.getDocument', { depth: -1 });
  for (let i = 0; i < probes.length; i++) {
    const force = STATE[probes[i].state].force;
    if (!force) continue;
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: `[data-probe="${i}"]` });
    if (!nodeId) continue; // no probe root: every check of this probe reads "(no probe root)" below
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [force] });
  }
  // A forced state starts its transition; the sentinel durations are long, so each finite one is finished, not waited on.
  const finish = () => page.evaluate(() => { for (const a of document.getAnimations()) if (a.effect?.getTiming().iterations !== Infinity) a.finish(); });
  const read = (reduce: boolean) => page.evaluate(([list, parts, rd]: [any[], Record<string, string>, boolean]) => list.map((pr: any, i: number) => {
    const el = document.querySelector(`[data-probe="${i}"]`);
    if (!el) return pr.checks.map(() => '(no probe root)');
    return pr.checks.map((c: any) => {
      if (!!c.reduce !== rd) return null;
      const node = parts[c.part] ? el.querySelector(`:scope > ${parts[c.part]}`) : el;
      if (!node) return '(no element)';
      const cs = getComputedStyle(node);
      if (c.prop === 'letter-spacing') return `ls:${Math.round((parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize)) * 1000)}`;
      if (c.prop.startsWith('transition-')) {
        // no named helper in here: tsx's keepNames wraps it in `__name`, which the page does not define
        const [list_, prop] = c.prop.split(':');
        const props = cs.transitionProperty.split(', ');
        const at = props.findIndex((x: string) => x === prop || x === 'all');
        if (at < 0) return `(no transition on ${prop})`;
        const xs = cs.getPropertyValue(list_).split(/,\s*(?![^()]*\))/);
        const x = xs[at % xs.length];
        if (list_ === 'transition-duration') return `dur:${Math.round(parseFloat(x) * (x.endsWith('ms') ? 1 : 1000))}`;
        const m = /^cubic-bezier\(0\.5, ([\d.]+), 0\.5, 1\)$/.exec(x);
        return m ? `ease:${Number(m[1])}` : `(curve ${x})`;
      }
      return c.prop === 'font-size' ? `font:${cs.fontSize}` : cs.getPropertyValue(c.prop);
    });
  }), [probes, PART, reduce]);
  await finish();
  const normal = await read(false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await finish();
  const reduced = await read(true);
  const reads = normal.map((row: (string | null)[], i: number) => row.map((x, j) => x ?? reduced[i][j]));
  let checked = 0;
  probes.forEach((pr, i) => pr.checks.forEach((c, j) => {
    checked++;
    const got = reads[i][j];
    let gotName: string;
    // no floor: `auto` computes as 0px outside a flex or grid container
    if (c.want === '(none)') gotName = got === 'auto' || got === '0px' ? '(none)' : `(px ${got})`;
    else if (c.want.startsWith('(px ')) gotName = `(px ${got.replace(/px$/, '')})`;
    else if (c.want.startsWith('(kw ')) gotName = `(kw ${got})`;
    else if (/^\(no transition|^\(curve /.test(got)) gotName = got;
    else gotName = name(got);
    if (gotName !== c.want) failures.push(`${where(pr.coord)} state=${pr.state} leading=${pr.leading} trailing=${pr.trailing}: ${c.what} binds ${gotName}, the spec names ${c.want}`);
  }));
  await page.close();
  return { failures, checked };
};

// ------------------------------------------------------------------------------------------------ mutants
/** Drops each rule (selector + block, inside the layer) whose selector matches. */
const dropRules = (css: string, test: (sel: string) => boolean) =>
  css.replace(/^( +)([^\n{}@][^\n{}]*) \{\n[\s\S]*?^\1\}\n/gm, (all, _i, sel) => (test(sel) ? '' : all));
const withoutValue = (markup: Markup, prop: string, val: string): Markup => {
  const copy: Markup = JSON.parse(JSON.stringify(markup));
  delete copy[prop].values![val];
  return copy;
};
const MUTANTS: { name: string; css: string; markup: Markup; mustName: RegExp }[] = [
  { name: 'swap one bound token (filled hover fill → pressed fill)',
    css: CSS.replace(/(:hover[^{]*\{\n\s*background-color: var\(--pds3-color-interactive-primary-fill-)hover/, '$1pressed'),
    markup: MARKUP, mustName: /appearance=filled surface=default inset=default state=hover .*container background-color binds color\.interactive\.primary\.fill\.pressed/ },
  { name: 'drop a state (every :active rule)',
    css: dropRules(CSS, (s) => s.includes(':active')), markup: MARKUP, mustName: /state=pressed .* binds/ },
  { name: 'drop a prop value in the CSS (size=large)',
    css: dropRules(CSS, (s) => s.includes('[data-prop-size="large"]')), markup: MARKUP, mustName: /size=large .* binds/ },
  { name: 'drop a prop value in the markup contract (appearance=text)',
    css: CSS, markup: withoutValue(MARKUP, 'appearance', 'text'), mustName: /prop value appearance=text has no markup mapping/ },
  { name: 'the press rebound to the reduced duration',
    css: CSS.replace(/(transform var\(--pds3-motion-preset-press-)duration\)/, '$1duration-reduced)'),
    markup: MARKUP, mustName: /motion\.press \(container transform duration\) binds motion\.preset\.press\.duration-reduced, the spec names motion\.preset\.press\.duration/ },
  { name: 'the reduced-motion transition dropped (the container keeps motion.state)',
    css: CSS.replace(/\n +\.p3-button \{\n +transition: [^;]*preset-state-duration-reduced[^;]*;\n +\}/, ''),
    markup: MARKUP, mustName: /motion\.state-reduced \(container background-color duration, reduced motion\) binds motion\.preset\.state\.duration, the spec names motion\.preset\.state\.duration-reduced/ },
  { name: 'drop the tracking (every letter-spacing declaration)',
    css: CSS.replace(/\n\s*letter-spacing: [^;]+;/g, ''), markup: MARKUP, mustName: /container\/label letterSpacing binds \(no token: ls:NaN\), the spec names core\.font\.letter-spacing-role\.normal/ },
];

if (isEntry(import.meta.url)) {
  const { chromium } = createRequire(import.meta.url)('playwright');
  const browser = await chromium.launch();
  let bad = 0;
  try {
    const real = await runParity(browser, CSS, MARKUP);
    if (real.failures.length) {
      bad++;
      console.error(`FAIL parity: ${real.failures.length} of ${real.checked} bindings disagree with specs.json / components.ai.json`);
      for (const f of real.failures.slice(0, 40)) console.error(`  - ${f}`);
    } else console.log(`OK parity: ${real.checked} bindings across ${SPEC.colors.length} color rows, ${SPEC.redlines.length} redline rows and ${SPEC.type.length} type rows match specs.json; every prop and value in components.ai.json has a markup mapping`);
    for (const m of MUTANTS) {
      if (m.css === CSS && m.markup === MARKUP) { bad++; console.error(`FAIL self-test: mutant "${m.name}" did not change its subject`); continue; }
      const r = await runParity(browser, m.css, m.markup);
      if (r.failures.some((f) => m.mustName.test(f))) console.log(`OK self-test: mutant "${m.name}" fails by name (${r.failures.length} failures)`);
      else { bad++; console.error(`FAIL self-test: mutant "${m.name}" was not caught by name${r.failures[0] ? `; first failure: ${r.failures[0]}` : ' (no failures)'}`); }
    }
  } finally {
    await browser.close();
  }
  process.exit(bad ? 1 : 0);
}
