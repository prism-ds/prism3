/**
 * THE GEOMETRY CHECK (#3408 S6, KPI 2 geometry with Q32 A, and KPI 3's "the same checks" across the two forms).
 *
 *   npx tsx apps/storybook/check-geometry.ts          (after `npm run -w @prism3/storybook build`)
 *   npx tsx apps/storybook/check-geometry.ts --contract <file> [--storybook <dir>] [--record <file>]   (another arm's)
 *
 * WHAT IT READS FROM THE ARM'S CONTRACT (#4436, `ARM-CONTRACT.md`): every story it visits (the contract's `forms`),
 * each component's root and part selectors, how each case's variant is read (`variant`), how the focus ring is drawn
 * (`focusRing`), and the button's label (its `container/label` part). Nothing here names an arm 1 class or attribute.
 * Arm 1's own contract is the default, and its run is also held to `expected-stories.ts`; another arm's run is held
 * to its contract's KPI 2 stories.
 *
 * WHAT IT MEASURES. Every story, both delivery forms, left to right and right to left, on the light theme. For the
 * component's root: its extent, padding, border widths and corner radii. For each part of the def's anatomy that has a
 * box in code: its box (x, y, width, height) relative to the root's top left, read from the browser's layout
 * (`getBoundingClientRect`), not from declared values. Parts are keyed by the anatomy's own part path
 * (`container/control/content`), the key Figma's layers carry, so the record can be set beside Figma's.
 *
 * WHAT IT COMPARES, here: each form against the contract's first form, the reference (arm 1: the element form against
 * the HTML form), for the same case, by arithmetic, to 0.01px. One edge
 * a pixel off, on one part, fails by name. A part drawn in one form and not the other fails by name.
 *
 * WHAT IT WRITES: `storybook-static/geometry.code.json`, the left-to-right reference form's record (the forms are equal
 * when this passes). Another arm's run writes its record only where `--record` says. `compare-figma-geometry.ts` sets it beside Figma's own record (`figma-geometry.json`, from the Mac job
 * in `figma-geometry.md`).
 *
 * TEXT: a part that sets text itself (a text node of its own) also records its computed font size and line height in px,
 * unrounded (`font`), which the Figma comparison needs to model Figma's whole-pixel line box (#4432 decision 2 C).
 *
 * THE FOCUS RING, in the focus-visible case only, by the contract's `focusRing`: an `outline` has no box of its own, so
 * its box is derived from the root's box, the outline's offset and its width; a `part` is its selector's box; `none`
 * records nothing. Either is recorded as `container/focusRing`.
 *
 * SELF-TEST: mutants planted in one form only, each must FAIL BY NAME, plus the represented-story mutants every
 * Storybook check carries.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load, ARM_1, boxedParts, contractStories, kpiStories, readIndex } from './arm-contract';
import { open, context, result, main, at, dirsFor, DROPPED, STATIC, stateOf, type Plant, type Result, type Story, type Dir } from './a11y-harness';

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const CONTRACT_FILE = arg('--contract') ? resolve(arg('--contract')!) : ARM_1;
const IS_ARM_1 = CONTRACT_FILE === ARM_1;
const SB = arg('--storybook') ? resolve(arg('--storybook')!) : STATIC;
/** The arm's input contract (`ARM-CONTRACT.md`, checked by `check-arm-contract.ts`): arm 1's unless `--contract`. */
const CONTRACT = load(CONTRACT_FILE);
/** The anatomy's part paths that have a box in code, per component, and where each is in the arm's markup. */
export const PARTS: Record<string, Record<string, string>> = boxedParts(CONTRACT);
const ROOTS: Record<string, string> = Object.fromEntries(Object.entries(CONTRACT.components).map(([id, c]) => [id, c.root]));
/** The reference form: the contract's first. The record is written from it, and every other form is held equal to it. */
const REF = Object.keys(CONTRACT.forms)[0];

/** Every story the contract names in the built Storybook, less a mutant's `drop`. */
const stories = (plant: Plant = {}): Story[] => {
  const index = readIndex(SB);
  if (!index) { console.error(`FAIL setup: ${SB}/index.json is missing. Build the arm's Storybook first (arm 1: npm run -w @prism3/storybook build)`); process.exit(1); }
  return contractStories(CONTRACT, index).filter((s) => !plant.drop?.includes(s.id));
};

export type Box = { x: number; y: number; w: number; h: number; font?: { size: number; lineHeight: number | null } };
export type RootGeometry = { w: number; h: number; padding: number[]; border: number[]; radius: number[] };
export type Measure = { where: Record<string, string>; root: RootGeometry; parts: Record<string, Box>; text?: string };
const DP = 100; // 0.01px
const round = (n: number) => Math.round(n * DP) / DP;

/** The variant a story shows (by the contract's `variant`), plus the state the case names. */
const STATES = new Set(['rest', 'hover', 'pressed', 'focus-visible', 'disabled', 'inactive', 'pending', 'filled', 'read-only']);

// The page side is a string: tsx's keepNames wraps a named helper in `__name`, which the page does not define (S2).
const MEASURE = `(([component, rootSel, parts, state, dp, prefix, ring, labelSel]) => {
  const r2 = (n) => Math.round(n * dp) / dp;
  const root = document.querySelector('#storybook-root ' + rootSel);
  if (!root) return 'no ' + rootSel + ' in the story';
  // Geometry is layout. The root's own transform is motion (the press's scale, #4375), which the motion checks hold, and
  // Figma draws no press: so it is set aside, with its transition, before measuring. Nothing reads the page after this,
  // and the next story opens a fresh one.
  root.style.transition = 'none';
  root.style.transform = 'none';
  const rb = root.getBoundingClientRect();
  const cs = getComputedStyle(root);
  const px = (v) => r2(parseFloat(v) || 0);
  const where = { state };
  if (prefix) for (const a of [...root.attributes]) if (a.name.startsWith(prefix)) where[a.name.slice(prefix.length)] = a.value;
  const out = {};
  for (const [part, sel] of Object.entries(parts)) {
    const el = sel ? root.querySelector(sel) : root;
    if (!el || getComputedStyle(el).display === 'none') continue;
    const b = el.getBoundingClientRect();
    if (!b.width && !b.height) continue;
    out[part] = { x: r2(b.left - rb.left), y: r2(b.top - rb.top), w: r2(b.width), h: r2(b.height) };
    // a part that sets text itself (a non-empty text node of its own): its computed font size and line height, in px,
    // unrounded, so the comparison can model how Figma rounds a line box (#4432 decision 2 C)
    if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
      const ts = getComputedStyle(el);
      const size = parseFloat(ts.fontSize);
      const lh = ts.lineHeight === 'normal' ? null : /px$/.test(ts.lineHeight) ? parseFloat(ts.lineHeight) : parseFloat(ts.lineHeight) * size;
      out[part].font = { size, lineHeight: lh };
    }
  }
  const text = component === 'button' && labelSel ? root.querySelector(labelSel)?.textContent?.trim() : undefined;
  if (state === 'focus-visible' && ring.drawn === 'outline' && cs.outlineStyle !== 'none') {
    const o = parseFloat(cs.outlineOffset) + parseFloat(cs.outlineWidth);
    out['container/focusRing'] = { x: r2(-o), y: r2(-o), w: r2(rb.width + 2 * o), h: r2(rb.height + 2 * o) };
  }
  if (state === 'focus-visible' && ring.drawn === 'part') {
    const el = root.querySelector(ring.selector);
    const b = el && getComputedStyle(el).display !== 'none' ? el.getBoundingClientRect() : null;
    if (b && (b.width || b.height)) out['container/focusRing'] = { x: r2(b.left - rb.left), y: r2(b.top - rb.top), w: r2(b.width), h: r2(b.height) };
  }
  return {
    where,
    root: {
      w: r2(rb.width), h: r2(rb.height),
      padding: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(px),
      border: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].map(px),
      radius: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(px),
    },
    parts: out,
    ...(text !== undefined ? { text } : {}),
  };
})`;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const measure = async (page: any, s: Story, parts = PARTS): Promise<Measure | string> => {
  const c = CONTRACT.components[s.component];
  const prefix = 'attributes' in c.variant ? c.variant.attributes : null;
  const m: Measure | string = await page.evaluate(`${MEASURE}(${JSON.stringify([s.component, ROOTS[s.component], parts[s.component], STATES.has(stateOf(s)) ? stateOf(s) : 'rest', DP, prefix, c.focusRing, parts[s.component]['container/label'] ?? null])})`);
  // a variant written per case in the contract, keyed as the attribute form keys it (lower case)
  if (typeof m !== 'string' && 'cases' in c.variant) for (const [k, x] of Object.entries(c.variant.cases[s.case] ?? {})) m.where[k.toLowerCase()] = x;
  return m;
};

/** Every difference between two records of one case, by name, to 0.01px. `a` and `b` name the two sides. */
export const diff = (where: string, x: Measure, y: Measure, a: string, b: string): string[] => {
  const out: string[] = [];
  const near = (p: number, q: number) => Math.abs(p - q) <= 1 / DP + 1e-9;
  for (const k of ['w', 'h'] as const) if (!near(x.root[k], y.root[k])) out.push(`${where}: container ${k === 'w' ? 'width' : 'height'} is ${x.root[k]} in the ${a}, ${y.root[k]} in the ${b}`);
  const SIDES = ['top', 'right', 'bottom', 'left'];
  const CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
  for (const [k, names] of [['padding', SIDES], ['border', SIDES], ['radius', CORNERS]] as const) {
    x.root[k].forEach((v, i) => { if (!near(v, y.root[k][i])) out.push(`${where}: container ${k} ${names[i]} is ${v} in the ${a}, ${y.root[k][i]} in the ${b}`); });
  }
  for (const part of new Set([...Object.keys(x.parts), ...Object.keys(y.parts)])) {
    const [p, q] = [x.parts[part], y.parts[part]];
    if (!p || !q) { out.push(`${where}: ${part} is drawn in the ${p ? a : b} only`); continue; }
    for (const k of ['x', 'y', 'w', 'h'] as const) if (!near(p[k], q[k])) out.push(`${where}: ${part} ${({ x: 'x', y: 'y', w: 'width', h: 'height' })[k]} is ${p[k]} in the ${a}, ${q[k]} in the ${b}`);
    if (JSON.stringify(p.font) !== JSON.stringify(q.font)) out.push(`${where}: ${part} font (size, line height) is ${JSON.stringify(p.font ?? null)} in the ${a}, ${JSON.stringify(q.font ?? null)} in the ${b}`);
  }
  return out;
};

const record: Record<string, Measure & { story: string }> = {};
/** The props a story leaves at their default write no attribute; the record names them, from the emission's API. */
const AI = JSON.parse(readFileSync(resolve(import.meta.dirname ?? '', '../../packages/engine/out/components/components.ai.json'), 'utf8')).components;
const VARIANT_PROPS: Record<string, string[]> = { button: ['appearance', 'size', 'surface', 'inset', 'fullWidth'], 'text-field': ['size', 'validation'], 'password-field': ['size', 'validation'] };
const fullWhere = (s: Story, m: Measure): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const name of VARIANT_PROPS[s.component]) {
    const p = AI[s.component].props.find((x: { name: string }) => x.name === name);
    out[name] = m.where[name.toLowerCase()] ?? String(p?.default);
  }
  // what Figma sets with a boolean property, not a variant: which slots are drawn, and the Show/Hide button's state
  const slot = (part: string) => String(Object.keys(m.parts).some((p) => p.endsWith(part)));
  out.leading = slot('/leadingVisual');
  if (s.component !== 'password-field') out.trailing = slot('/trailingVisual');
  if (s.component !== 'button') out.message = slot('container/message');
  if (s.component === 'password-field') out.shown = String(s.case.startsWith('shown'));
  out.state = m.where.state;
  return out;
};

/** A plant may also replace the contract's part selectors (a mutant's typo), so the represented-part rule is tested. */
type GeoPlant = Plant & { parts?: Record<string, Record<string, string>> };
export const run = async (browser: unknown, origin: string, plant: GeoPlant = {}, only: (s: Story) => boolean = () => true): Promise<Result> => {
  const r = result();
  const parts = plant.parts ?? PARTS;
  const drawn = new Map<string, Set<string>>();
  const ctx = await context(browser, plant);
  const page = await ctx.newPage();
  const seen = new Map<string, Measure>();
  try {
    for (const s of stories(plant).filter(only)) for (const dir of dirsFor(s, plant)) {
      const where = at(s, dir);
      try { await open(page, origin, s, 'light', plant, dir, ROOTS[s.component]); }
      catch (e) { r.failures.push(`${where}: did not settle: ${(e as Error).message.split('\n')[0]}`); continue; }
      const m = await measure(page, s, parts);
      if (typeof m === 'string') { r.failures.push(`${where}: ${m}`); continue; }
      for (const p of Object.keys(m.parts)) (drawn.get(s.component) ?? drawn.set(s.component, new Set()).get(s.component)!).add(p);
      r.checked.add(where);
      r.passed++;
      seen.set(`${s.component}--${s.case}|${dir}|${s.form}`, m);
      if (s.form === REF && dir === 'ltr' && !plant.init && !plant.css && !plant.after && !plant.parts) record[`${s.component}--${s.case}`] = { story: s.id, ...m, where: fullWhere(s, m) };
    }
    for (const [key, other] of seen) {
      const [c, dir, form] = key.split('|');
      if (form === REF) continue;
      const ref = seen.get(`${c}|${dir}|${REF}`);
      if (!ref) continue; // represented() names a case checked in one form only
      const d = diff(`${c}${(dir as Dir) === 'ltr' ? '' : ' (rtl)'}`, other, ref, `${form} form`, `${REF} form`);
      if (d.length) r.failures.push(...d); else r.passed++;
    }
    // every part the contract maps to a selector is drawn by some story, in either form (`docs/34`: a promised surface is
    // represented). Otherwise a selector that matches nothing drops its part from both forms alike, and from the record.
    // Held for each component whose every story this run visited.
    const visited = stories(plant);
    for (const [component, sel] of Object.entries(parts)) {
      const mine = visited.filter((s) => s.component === component);
      if (!mine.length || !mine.every(only)) continue;
      for (const [part, selector] of Object.entries(sel)) if (!drawn.get(component)?.has(part)) r.failures.push(`${component}: ${part} is mapped to ${JSON.stringify(selector)} and no story drew it`);
    }
  } finally {
    await ctx.close();
  }
  return r;
};

const only = (c: string, cs: string) => (s: Story) => s.component === c && s.case === cs;
/** CSS that reaches the element form only: the element's host is the root's parent. */
const elementOnly = (tag: string, rules: string) => `${tag} > ${rules}`;
const ARM_1_MUTANTS = [
  { name: 'the element form\'s button padding 1px wider on the left', plant: { css: elementOnly('p3-button', '.p3-button { padding-left: calc(var(--pds3-space-200) + 1px) !important; }') },
    only: only('button', 'rest'), mustName: /^button--rest: container padding left is \d+(\.\d+)? in the element form, \d+(\.\d+)? in the html form/ },
  { name: 'the element form\'s text field label 1px lower', plant: { css: elementOnly('p3-text-field', '.p3-text-field > .p3-field-label { position: relative; top: 1px; }') },
    only: only('text-field', 'rest'), mustName: /^text-field--rest: container\/label y is .* in the element form/ },
  { name: 'the element form\'s Show/Hide button not drawn', plant: { css: elementOnly('p3-password-field', '.p3-password-field .p3-password-field__toggle { display: none !important; }') },
    only: only('password-field', 'rest'), mustName: /^password-field--rest: container\/labelRow\/toggle is drawn in the html form only/ },
  { name: 'the element form\'s focus ring offset 1px further out', plant: { css: '#storybook-root p3-button > .p3-button { outline-offset: calc(var(--pds3-focus-ring-offset) + 1px) !important; }' },
    only: only('button', 'focus-visible'), mustName: /^button--focus-visible: container\/focusRing (x|width) is .* in the element form/ },
  { name: 'a contract selector with a typo, so the text field\'s message is never drawn', plant: { parts: { ...PARTS, 'text-field': { ...PARTS['text-field'], 'container/message': ':scope > .p3-field-mesage' } } },
    only: (s: Story) => s.component === 'text-field', mustName: /^text-field: container\/message is mapped to ":scope > \.p3-field-mesage" and no story drew it/ },
];

/**
 * The mutants any contract's run carries (#4436): a part selector with a typo must be named as never drawn, a story
 * dropped from the visit must be named as not checked, and a button whose focus ring is never drawn must be named.
 * Each is built from the contract, not from arm 1's classes.
 */
const contractMutants = () => {
  const out: { name: string; plant: GeoPlant; only: (s: Story) => boolean; mustName: RegExp }[] = [];
  const [part, sel] = Object.entries(PARTS['text-field']).find(([p]) => p !== 'container')!;
  out.push({ name: `a contract selector with a typo, so the text field's ${part} is never drawn`, plant: { parts: { ...PARTS, 'text-field': { ...PARTS['text-field'], [part]: `${sel}-typo` } } },
    only: (s: Story) => s.component === 'text-field', mustName: new RegExp(`^text-field: ${part.replace(/\//g, '\\/')} is mapped to .* and no story drew it`) });
  const drop = kpiStories(CONTRACT).find((s) => s.component === 'text-field' && s.case === 'error' && s.form === REF)!;
  out.push({ name: 'a story dropped from the suite', plant: { drop: [drop.id] }, only: (s: Story) => s.component === 'text-field' && s.case === 'error',
    mustName: new RegExp(`^${drop.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: not checked by geometry`) });
  return out;
};

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.dirname ?? '', 'check-geometry.ts')) {
  const recordTo = arg('--record') ? resolve(arg('--record')!) : IS_ARM_1 ? resolve(STATIC, 'geometry.code.json') : undefined;
  process.on('exit', (code) => {
    if (code !== 0 || !Object.keys(record).length || !recordTo) return;
    writeFileSync(recordTo, `${JSON.stringify({ format: '1.0', source: 'code', form: REF, dir: 'ltr', theme: 'light', note: 'Boxes relative to the root\'s top left, in CSS px, to 0.01. Parts keyed by the def\'s anatomy part path.', cases: record }, null, 1)}\n`);
    console.log(`wrote ${recordTo.startsWith(STATIC) ? `storybook-static${recordTo.slice(STATIC.length)}` : recordTo} (${Object.keys(record).length} cases)`);
  });
  if (!existsSync(CONTRACT_FILE)) { console.error(`FAIL setup: no contract at ${CONTRACT_FILE}`); process.exit(1); }
  // #4436 review: the contract measured is the one asked for. The file `--contract` names is read here by its own path,
  // never through `CONTRACT_FILE`, so a run that fell back to arm 1's contract (base's defect, which measured arm 1 and
  // passed) fails by name instead of passing on arm 1's stories.
  if (arg('--contract')) {
    const asked = (JSON.parse(readFileSync(resolve(arg('--contract')!), 'utf8')) as { arm?: string }).arm;
    if (CONTRACT.arm !== asked) {
      console.error(`FAIL setup: --contract names the contract "${asked}", but the geometry loaded "${CONTRACT.arm}" (#4436): a run on the wrong contract measures arm 1's stories and passes`);
      process.exit(1);
    }
  }
  const forms = Object.keys(CONTRACT.forms);
  const summary = `${CONTRACT.arm}: every story its contract names, ${forms.join(' and ')} forms, left to right and right to left: the root's extent, padding, border and radii, and each anatomy part's box, equal to the ${REF} form's to 0.01px.`;
  await main('geometry', summary, run as never, IS_ARM_1 ? [...ARM_1_MUTANTS, ...DROPPED('geometry')] : contractMutants() as never, IS_ARM_1
    ? {}
    // another arm's element tags aren't arm 1's, and its contract doesn't name them, so no registry is read (#3969 is arm 1's)
    : { storybook: SB, expected: () => kpiStories(CONTRACT), tags: [] });
}
