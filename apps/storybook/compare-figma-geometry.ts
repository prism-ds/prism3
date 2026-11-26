/**
 * FIGMA AGAINST CODE, BY ARITHMETIC (#3408 S6, KPI 2 geometry with Q32 A).
 *
 *   npx tsx apps/storybook/compare-figma-geometry.ts              (after check-geometry.ts has written the code record)
 *   npx tsx apps/storybook/compare-figma-geometry.ts --self-test  (the arithmetic, on planted records; no Figma needed)
 *
 * THE TWO SIDES (`docs/34`): Figma's record (`figma-geometry.json`) is what Figma lays out, read from world
 * coordinates by `figma-geometry.js` on the Mac; the code's (`storybook-static/geometry.code.json`) is what Chromium
 * lays out for the Storybook's HTML form, read by `check-geometry.ts`, which also holds the element form equal to it.
 * Neither is derived from the other or from the def.
 *
 * MATCHING. Each code case is matched to the component set member whose variant it shows: its props, and its state.
 * Figma's axis names map to the API's: `leading icon` → leading, `trailing icon` → trailing, `status` → validation.
 * A code case with no member (a code-only state, such as `inactive`) is named, not compared. Every member at a KPI 2
 * state (rest, hover, focus-visible, disabled, pending, and the fields' error) that no code case reaches is named too.
 * Each of the two names its nearest counterpart and every variant axis or boolean property on which they differ, so an
 * unmatched pair reads as WHICH axis kept it apart, not only that it was kept apart (#4432's first record: every field
 * case showed `message=true`, and Figma's members record the property at its default, `false`).
 *
 * THE ARITHMETIC, to 0.01px:
 *   - the root's padding, border and corner radii, and its height: equal;
 *   - each part's y and height: equal (vertical is token-bound: padding, line height, icon size);
 *   - a part Figma sizes to FILL, or any part of a root of FIXED width: its left inset and its right inset, each against
 *     its own side's root (a field's width is its build width in Figma and its container's in code). A FILL part's
 *     right inset is offset by the text width difference (code − Figma) of each hugging part after it in its row
 *     whose one text Figma records, that text read in code as the hugging part's content box (its box less its padding
 *     and border): the Show/Hide button after the password field's label cell (#3408 KPI 2 findings, 2026-11-25);
 *   - TEXT, and a part that hugs one: its x only; its width is the font's, not the layout's;
 *   - a Figma TEXT part whose code part records its font (`check-geometry.ts`): Figma sets a line box at whole pixels,
 *     H = round(L) for a line height L = font size × line height, where Chromium truncates it to its 1/64px layout
 *     unit, L₆₄ = ⌊64L⌋/64. So the code's height is held to Figma's less that rounding (H − L₆₄), and, for a text Figma
 *     centers in its parent, the code's y to Figma's plus half of it, truncated to the layout unit as Chromium places it.
 *     Arithmetic, not a tolerance (#4432 decision 2 C, Q32 A): a text 1px off still fails. Not modeled, as no matched
 *     TEXT part needs it: what sits below a top-aligned text;
 *   - every other part: its x and its width. In a row that hugs a TEXT, a part after the text is offset by the text's
 *     width difference (code − Figma), and so is a hugging root's width (floored at its minimum width). So a 1px
 *     drift in a padding or a gap still fails, however the two renderers set the text.
 *   - one case is named, not compared: a button at its minimum width in either record whose label text differs between
 *     the two. Its content is centered, so its x positions depend on the text.
 *
 * ROOT CAUSES (#4432 decision 1 A). A line is one comparison; a finding is one root cause. A root border that differs
 * (CSS's transparent hairline against a member with no stroke) is one finding per component, however many cases show
 * it, and so is every line whose residual equals that border's difference on its side exactly: a hugging root's width
 * (left + right), and a part's x or inset (that side's border). Otherwise, the same difference (the same part, the
 * same quantity, the same two values) in several cases of one component is one finding: one rule, drawn in every
 * state. Every other line is its own finding.
 * A PART's border is the same kind of cause (#3408 KPI 2 findings, 2026-11-25): a CSS border takes layout space, where
 * Figma's stroke takes it only in a frame that includes strokes in layout. Where both records carry a part's layout
 * border and they differ, that part is one cause per component, and a line joins it when its residual equals, exactly,
 * the sum of what the borders explain on its side: the root's, each bordered ancestor's, and, for a FILL part's right
 * inset, the whole border of each hugging part after it. A Figma record from before the part borders carries none, so
 * its lines stay their own findings. The summary names both counts; the lines print under their finding.
 *
 * Fails by name: `<component> <case> (<figma node id>): <what> is <code> in code, <figma> in Figma`.
 * A missing Figma record FAILS, naming the Mac job: a comparison that did not run is not a pass.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load, ARM_1, boxedParts } from './arm-contract';
import { isEntry } from '@prism3/engine/harness';

const HERE = import.meta.dirname ?? '';
const FIGMA = resolve(HERE, 'figma-geometry.json');
const SCRIPT = resolve(HERE, 'figma-geometry.js');

/**
 * The Mac script must RETURN its record: the Desktop Bridge's `figma_execute` wraps the code in an async function body
 * and hands back only an explicit `return`, so a bare `(async () => { ... })();`, or an IIFE that drops its own
 * `return`, comes back `undefined`. So the self-test runs the script's source the way the bridge does, in an async
 * function body with `figma` in scope, against a stub file of one set, one member and one text layer, and holds what
 * comes back. Read from the script's source, not from any copy of it. Returns the failure, or null.
 */
export const scriptReturns = async (src: string): Promise<string | null> => {
  const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
  const label = { id: '2:3', name: 'label', type: 'TEXT', visible: true, characters: 'Go', layoutSizingHorizontal: 'HUG', absoluteBoundingBox: box(112, 108, 30, 20) };
  const member = { id: '2:1', type: 'COMPONENT', variantProperties: { state: 'rest' }, absoluteBoundingBox: box(100, 100, 54, 36), children: [label], strokes: [] };
  const set = { id: '1:1', name: 'button', type: 'COMPONENT_SET', componentPropertyDefinitions: {}, children: [member] };
  // #4461: a field whose message is wired to `message` (hidden) at status=default and pinned shown, wired to nothing,
  // at status=error. The record must read each member's EFFECTIVE value, not the set's one default.
  const msg = (id: string, visible: boolean, wired: boolean) => ({ id, name: 'message', type: 'INSTANCE', visible, absoluteBoundingBox: box(0, 70, 320, 20), children: [], ...(wired ? { componentPropertyReferences: { visible: 'message#7:0' } } : {}) });
  // and a control stroked 1px INSIDE, its stroke out of layout at status=default and in it at error: its layout
  // border must read 0 where the stroke is out of layout, and the weights where it is in
  const ctl = (id: string, inLayout: boolean) => ({ id, name: 'control', type: 'FRAME', visible: true, absoluteBoundingBox: box(0, 20, 320, 44), children: [], strokes: [{ type: 'SOLID' }], strokeWeight: 1, strokeTopWeight: 1, strokeRightWeight: 1, strokeBottomWeight: 1, strokeLeftWeight: 1, strokeAlign: 'INSIDE', strokesIncludedInLayout: inLayout });
  const field = (id: string, status: string, m: ReturnType<typeof msg>, c: ReturnType<typeof ctl>) => ({ id, type: 'COMPONENT', variantProperties: { status }, absoluteBoundingBox: box(0, 0, 320, 90), children: [c, m], strokes: [] });
  const fset = { id: '3:1', name: 'text-field', type: 'COMPONENT_SET', componentPropertyDefinitions: { 'message#7:0': { type: 'BOOLEAN', defaultValue: false } }, children: [field('3:2', 'default', msg('3:3', false, true), ctl('3:6', false)), field('3:4', 'error', msg('3:5', true, false), ctl('3:7', true))] };
  const stub = { loadAllPagesAsync: async () => {}, root: { findAllWithCriteria: () => [set, fset] } };
  const AsyncFunction = (async () => {}).constructor as new (...args: string[]) => (figma: unknown) => Promise<unknown>;
  let got: unknown;
  try { got = await new AsyncFunction('figma', src)(stub); } catch (e) { return `figma-geometry.js throws when run as figma_execute runs it: ${(e as Error).message}`; }
  if (typeof got !== 'string') return `figma-geometry.js, run as figma_execute runs it, returns ${got === undefined ? 'undefined' : typeof got}, not the record as a JSON string: figma_execute hands back only an explicit return`;
  let part: Record<string, unknown> | undefined;
  try { part = JSON.parse(got).components?.button?.members?.[0]?.parts?.['container/label']; } catch { return 'figma-geometry.js returns a string that is not JSON'; }
  const want = { id: '2:3', type: 'TEXT', x: 12, y: 8, w: 30, h: 20, text: 'Go' };
  const off = Object.entries(want).filter(([k, v]) => part?.[k] !== v).map(([k]) => k);
  if (!part || off.length) return `figma-geometry.js returns a record without the stub's label as container/label {x: 12, y: 8, w: 30, h: 20} (${part ? `differs in ${off.join(', ')}` : 'missing'})`;
  const rec = JSON.parse(got);
  const fm = (rec.components?.['text-field']?.members ?? []) as { variant: Record<string, string>; properties?: Record<string, string>; unwired?: string[] }[];
  const eff = (status: string) => fm.find((x) => x.variant.status === status);
  const [d, e] = [eff('default'), eff('error')];
  if (rec.propertyRead !== 'effective' || d?.properties?.message !== 'false' || d?.unwired || e?.properties?.message !== 'true' || JSON.stringify(e?.unwired) !== '["message"]')
    return `figma-geometry.js does not record each member's effective message (#4461): the stub field's message is wired and hidden at status=default and pinned shown, wired to nothing, at error, so it must read message=false there and message=true, unwired, at error; it read ${JSON.stringify({ propertyRead: rec.propertyRead, default: [d?.properties?.message, d?.unwired], error: [e?.properties?.message, e?.unwired] })}`;
  type SP = { border?: number[]; stroke?: { weights: number[]; inLayout: boolean } };
  const [dc, ec] = [d as unknown as { parts?: Record<string, SP> }, e as unknown as { parts?: Record<string, SP> }].map((x) => x?.parts?.['container/control']);
  if (JSON.stringify(dc?.border) !== '[0,0,0,0]' || JSON.stringify(dc?.stroke?.weights) !== '[1,1,1,1]' || JSON.stringify(ec?.border) !== '[1,1,1,1]' || JSON.stringify(part?.border) !== '[0,0,0,0]')
    return `figma-geometry.js does not record each part's layout border (#3408 KPI 2 findings): the stub control's 1px INSIDE stroke is out of layout at status=default and in it at error, and the label has none, so the borders must read 0/0/0/0, 1/1/1/1 (its stroke 1/1/1/1) and 0/0/0/0; they read ${JSON.stringify({ default: [dc?.border, dc?.stroke?.weights], error: ec?.border, label: part?.border })}`;
  return null;
};
const CODE = resolve(HERE, 'storybook-static/geometry.code.json');
const EPS = 0.01 + 1e-9;
const KPI_STATES = ['rest', 'hover', 'focus-visible', 'disabled', 'pending'];
const ALIAS: Record<string, string> = { 'leading icon': 'leading', 'trailing icon': 'trailing', status: 'validation' };
const key_ = (figmaName: string) => ALIAS[figmaName] ?? figmaName;

type Box = { x: number; y: number; w: number; h: number };
type FPart = Box & { id: string; type: string; sizing: string | null; text?: string; border?: number[] };
type FMember = { id: string; variant: Record<string, string>; properties?: Record<string, string>; unwired?: string[]; root: { w: number; h: number; sizing: string | null; minWidth: number | null; padding: number[]; border: number[]; radius: number[] }; parts: Record<string, FPart> };
type CCase = { story: string; where: Record<string, string>; root: { w: number; h: number; padding: number[]; border: number[]; radius: number[] }; parts: Record<string, Box & { border?: number[]; padding?: number[]; font?: { size: number; lineHeight: number | null } }>; text?: string };
export type FigmaRecord = { components: Record<string, { members: FMember[] }> };
export type CodeRecord = { cases: Record<string, CCase> };

const near = (a: number, b: number) => Math.abs(a - b) <= EPS;

/** Every variant axis and boolean property on which a member and a case's variant differ, in the API's names. An axis
 *  the case does not name is not a difference (the matcher does not hold it either), except a variant axis, which the
 *  matcher requires the case to name. */
export const axisDiffs = (mm: FMember, where: Record<string, string>): string[] => [
  ...Object.entries(mm.variant).map(([axis, v]) => where[key_(axis)] === undefined ? `variant ${key_(axis)} is not named in code, ${v} in Figma` : where[key_(axis)] !== v ? `variant ${key_(axis)} is ${where[key_(axis)]} in code, ${v} in Figma` : ''),
  ...Object.entries(mm.properties ?? {}).map(([axis, v]) => where[key_(axis)] !== undefined && where[key_(axis)] !== v ? `property ${key_(axis)} is ${where[key_(axis)]} in code, ${v} in Figma` : ''),
].filter(Boolean);
/** The candidates with the fewest differences, as "<label> differs in <…>; <…>" (and how many more tie). */
const closest = <T>(items: T[], label: (t: T) => string, diffs: (t: T) => string[]): string => {
  const scored = items.map((t) => ({ t, d: diffs(t) })).sort((a, b) => a.d.length - b.d.length);
  if (!scored.length) return 'nothing to compare against';
  const ties = scored.filter((x) => x.d.length === scored[0].d.length).length - 1;
  return `${label(scored[0].t)} differs in ${scored[0].d.join('; ') || 'nothing on its axes'}${ties ? ` (and ${ties} more at the same distance)` : ''}`;
};
const n2 = (v: number) => Math.round(v * 100) / 100;

/** Chromium's layout unit: a length truncated to 1/64px (its LayoutUnit from a float). */
const unit64 = (v: number) => Math.floor(v * 64 + 1e-9) / 64;
/** Figma's whole-pixel line box against Chromium's 1/64px one, for a line height L in px: [H, H − L₆₄]. */
export const lineBox = (L: number): [number, number] => [Math.round(L), Math.round(L) - unit64(L)];

export type Finding = { cause: string | null; lines: string[] };
/** The lines grouped by root cause, in first-seen order; a line with no cause is a finding of its own. A cause is a
 *  border's (see ROOT CAUSES) or, failing that, the line less its case and node id. */
export const findingsOf = (failures: string[], causeOf: Map<string, string>): Finding[] => {
  const out: Finding[] = [];
  const byCause = new Map<string, Finding>();
  for (const line of failures) {
    const cause = causeOf.get(line) ?? null;
    if (cause === null) { out.push({ cause, lines: [line] }); continue; }
    if (!byCause.has(cause)) { const f = { cause, lines: [] as string[] }; byCause.set(cause, f); out.push(f); }
    byCause.get(cause)!.lines.push(line);
  }
  return out;
};

/** `codeParts`: the part paths, per component, a Figma layer must be matched by in code (`partList`). */
export const compare = (fig: FigmaRecord, code: CodeRecord, codeParts: Record<string, string[]>): { failures: string[]; notes: string[]; compared: number; findings: Finding[] } => {
  const failures: string[] = [];
  const notes: string[] = [];
  const causeOf = new Map<string, string>();
  let compared = 0;
  const reached = new Set<string>();
  for (const [key, c] of Object.entries(code.cases)) {
    const component = key.split('--')[0];
    const set = fig.components[component];
    if (!set) { failures.push(`${component}: no "${component}" component set in the Figma record`); continue; }
    // every Figma axis as the case shows it, and every code-only axis (e.g. fullWidth) at its API default
    // and every boolean property the member shows (its default) as the case shows it
    const first = set.members[0];
    const axes = new Set([...Object.keys(first?.variant ?? {}), ...Object.keys(first?.properties ?? {})].map(key_));
    const offAxis = Object.entries(c.where).filter(([k, v]) => !axes.has(k) && DEFAULTS[component]?.[k] !== undefined && DEFAULTS[component][k] !== v);
    const shows = (mm: FMember) => [...Object.entries(mm.variant), ...Object.entries(mm.properties ?? {})].every(([axis, v]) => c.where[key_(axis)] === undefined || c.where[key_(axis)] === v);
    const m = offAxis.length ? undefined : set.members.find((mm) => Object.keys(mm.variant).every((axis) => c.where[key_(axis)] !== undefined) && shows(mm));
    if (!m) {
      const noAxis = offAxis.map(([k, v]) => `${k}=${v} has no Figma axis or property; `).join('');
      notes.push(`${key}: no Figma member shows ${Object.entries(c.where).map(([k, v]) => `${k}=${v}`).join(', ')} (code only, not compared): ${noAxis}nearest ${closest(set.members, (mm) => `member ${mm.id}`, (mm) => axisDiffs(mm, c.where))}`);
      continue;
    }
    reached.add(m.id);
    const at = `${component} ${key.split('--')[1]} (${m.id})`;
    // the root's border, where it differs: one cause for the component, and the residual each side's difference explains
    const [cb, fb] = [c.root.border, m.root.border];
    const borderCause = cb.some((v, i) => !near(v, fb[i])) ? `${component}: the root's border is ${cb.join('/')} in code, ${fb.join('/')} in Figma (top/right/bottom/left)` : null;
    const side = { top: cb[0] - fb[0], right: cb[1] - fb[1], bottom: cb[2] - fb[2], left: cb[3] - fb[3], width: cb[1] + cb[3] - fb[1] - fb[3] };
    // a PART's border, where it differs in layout: a CSS border takes layout space, and Figma's stroke only where the
    // frame includes it in layout. Known only where both records carry the part's border (Figma's since the KPI 2
    // findings of 2026-11-25). One cause per bordered part, like the root's.
    const SIDE = { top: 0, right: 1, bottom: 2, left: 3 } as const;
    const partBorder = new Map<string, { cause: string; d: number[] }>();
    for (const [p, b] of Object.entries(c.parts)) {
      const fbp = m.parts[p]?.border;
      if (p === 'container' || !b.border || !fbp || b.border.every((v, i) => near(v, fbp[i]))) continue;
      partBorder.set(p, { cause: `${component}: ${p}'s border is ${b.border.join('/')} in code, ${fbp.join('/')} in Figma's layout (top/right/bottom/left)`, d: b.border.map((v, i) => v - fbp[i]) });
    }
    /** The hugging parts to a part's right in its row, or in an ancestor's: siblings of the part or of an ancestor. */
    const huggingAfter = (part: string): string[] => Object.keys(m.parts).filter((p) => {
      const parent = p.slice(0, p.lastIndexOf('/'));
      const f = m.parts[p];
      const mine = part.split('/').map((_, i, a) => a.slice(0, i + 1).join('/')).filter((q) => q.startsWith(`${parent}/`) && q.slice(parent.length + 1).indexOf('/') === -1);
      return f.sizing === 'HUG' && p !== part && !part.startsWith(`${p}/`) && mine.some((q) => q !== p && m.parts[q] && f.x >= m.parts[q].x + m.parts[q].w - EPS);
    });
    /** What a line's residual is explained by: the root's border on its side, each bordered ancestor's on its side, and,
     *  for a FILL part's right inset, the whole border of each hugging part after it. All of them, or the line's own. */
    type Why = { side: keyof typeof side; part?: string; after?: boolean };
    const fail = (what: string, got: number, want: number, why?: Why) => {
      const line = `${at}: ${what} is ${n2(got)} in code, ${n2(want)} in Figma`;
      failures.push(line);
      const terms: [string, number][] = [];
      if (why && borderCause) terms.push([borderCause, side[why.side]]);
      if (why?.part && why.side !== 'width') {
        for (const [p, pb] of partBorder) if (why.part.startsWith(`${p}/`)) terms.push([pb.cause, pb.d[SIDE[why.side]]]);
        if (why.after) for (const p of huggingAfter(why.part)) { const pb = partBorder.get(p); if (pb) terms.push([pb.cause, pb.d[1] + pb.d[3]]); }
      }
      const live = terms.filter(([, v]) => !near(v, 0));
      const sum = live.reduce((a, [, v]) => a + v, 0);
      causeOf.set(line, live.length && near(got - want, sum) ? [...new Set(live.map(([k]) => k))].join(' and ') : `${component}: ${what} is ${n2(got)} in code, ${n2(want)} in Figma`);
    };
    /** A hugging part's content width in code: its box less its padding and border. */
    const content = (b: CCase['parts'][string]) => b.padding && b.border ? b.w - b.padding[1] - b.padding[3] - b.border[1] - b.border[3] : null;
    /** For a FILL part's right inset: the text width difference (code − Figma) of each hugging part after it whose one
     *  text Figma records, read in code from that part's content box. */
    const textAfter = (part: string): [number, string[]] => {
      let d = 0;
      const names: string[] = [];
      for (const p of huggingAfter(part)) {
        const texts = Object.entries(m.parts).filter(([q, fq]) => q.startsWith(`${p}/`) && fq.type === 'TEXT');
        const cw = c.parts[p] ? content(c.parts[p]) : null;
        if (texts.length !== 1 || cw === null) continue;
        d += cw - texts[0][1].w;
        names.push(p.slice(p.lastIndexOf('/') + 1));
      }
      return [d, names];
    };
    const SIDES = ['top', 'right', 'bottom', 'left'];
    const CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
    for (const [k, names] of [['padding', SIDES], ['border', SIDES], ['radius', CORNERS]] as const) {
      c.root[k].forEach((v, i) => {
        compared++;
        if (near(v, m.root[k][i])) return;
        fail(`container ${k} ${names[i]}`, v, m.root[k][i]);
        if (k === 'border') causeOf.set(failures[failures.length - 1], borderCause!);
      });
    }
    compared++;
    if (!near(c.root.h, m.root.h)) fail('container height', c.root.h, m.root.h);

    // the text in this row, if the root hugs one: its width difference offsets what follows it
    const textPart = Object.entries(m.parts).find(([p, fp]) => fp.type === 'TEXT' && c.parts[p]);
    const delta = textPart ? c.parts[textPart[0]].w - textPart[1].w : 0;
    const textEnd = textPart ? textPart[1].x + textPart[1].w : Infinity;
    const hug = m.root.sizing === 'HUG';
    const atMin = (w: number) => m.root.minWidth !== null && near(w, m.root.minWidth);
    const centered = hug && textPart && (atMin(m.root.w) || atMin(c.root.w)) && textPart[1].text !== c.text;
    if (centered) notes.push(`${at}: at its minimum width with a different label ("${c.text}" in code, "${textPart![1].text}" in Figma): x positions and the width not compared`);
    if (hug && !centered) {
      compared++;
      const want = Math.max(m.root.minWidth ?? 0, m.root.w + delta);
      if (!near(c.root.w, want)) fail(`container width (Figma's ${n2(m.root.w)} + the text's ${n2(delta)})`, c.root.w, want, { side: 'width' });
    }
    for (const [part, b] of Object.entries(c.parts)) {
      if (part === 'container') continue;
      const f = m.parts[part];
      if (!f) { failures.push(`${at}: ${part} is drawn in code, not in Figma`); causeOf.set(failures[failures.length - 1], `${component}: ${part} is drawn in code, not in Figma`); continue; }
      // a TEXT part: Figma's line box is the code's line height rounded to whole pixels, and a centered text moves by
      // half the rounding (decision 2 C). Centered is read from Figma, whose numbers are exact: the text's middle at
      // its parent's middle.
      const L = f.type === 'TEXT' ? b.font?.lineHeight ?? null : null;
      if (L !== null) {
        const [H, round] = lineBox(L);
        const parentPath = part.slice(0, part.lastIndexOf('/'));
        const pf = parentPath === 'container' ? { y: 0, h: m.root.h } : m.parts[parentPath];
        const centeredText = pf !== undefined && near(f.y + f.h / 2, pf.y + pf.h / 2);
        const why = `Figma's whole-pixel line box: ${n2(L)}px set at ${H}`;
        compared++;
        if (!near(b.h, f.h - round)) fail(`${part} height (${why}, Figma's ${n2(f.h)} less ${n2(round)})`, b.h, f.h - round);
        compared++;
        const wantY = centeredText ? unit64(f.y + round / 2) : f.y;
        if (!near(b.y, wantY)) fail(`${part} y${centeredText ? ` (${why}, centered: Figma's ${n2(f.y)} + ${n2(round / 2)})` : ''}`, b.y, wantY, { side: 'top', part });
      } else for (const k of ['y', 'h'] as const) { compared++; if (!near(b[k], f[k])) fail(`${part} ${k === 'y' ? 'y' : 'height'}`, b[k], f[k], k === 'y' ? { side: 'top', part } : undefined); }
      if (centered) continue;
      const hugsText = f.type === 'TEXT' || (f.sizing === 'HUG' && Object.entries(m.parts).some(([p, q]) => p.startsWith(`${part}/`) && q.type === 'TEXT'));
      const [cl, cr, fl, fr] = [b.x, c.root.w - b.x - b.w, f.x, m.root.w - f.x - f.w];
      if (f.sizing === 'FILL') {
        compared++;
        if (!near(cl, fl)) fail(`${part} left inset`, cl, fl, { side: 'left', part });
        if (!hugsText) {
          // a hugging part after it sets its own text: its width difference moves this right edge, as a hugging root's
          // width moves with its text (the Show/Hide button after the password field's label cell)
          const [td, by] = textAfter(part);
          const wr = fr + td;
          compared++;
          if (!near(cr, wr)) fail(`${part} right inset${by.length ? ` (Figma's ${n2(fr)} + the ${by.join(' and ')}'s text ${n2(td)})` : ''}`, cr, wr, { side: 'right', part, after: true });
        }
        continue;
      }
      if (m.root.sizing === 'FIXED') {
        // a root of another width: a part keeps the inset on the side Figma anchors it to, and its own width
        compared++;
        if (fl <= fr) { if (!near(cl, fl)) fail(`${part} left inset`, cl, fl, { side: 'left', part }); } else if (!near(cr, fr)) fail(`${part} right inset`, cr, fr, { side: 'right', part });
        if (!hugsText) { compared++; if (!near(b.w, f.w)) fail(`${part} width`, b.w, f.w); }
        continue;
      }
      const want = f.x >= textEnd - EPS ? f.x + delta : f.x;
      compared++;
      if (!near(b.x, want)) fail(`${part} x${want !== f.x ? ` (Figma's ${n2(f.x)} + the text's ${n2(delta)})` : ''}`, b.x, want, { side: 'left', part });
      if (!hugsText) { compared++; if (!near(b.w, f.w)) fail(`${part} width`, b.w, f.w); }
    }
    for (const [part, f] of Object.entries(m.parts)) {
      if (Object.keys(c.parts).some((p) => p === part) || !codeParts[component]?.includes(part)) continue;
      failures.push(`${at}: ${part} (${f.id}) is drawn in Figma, not in code`);
      causeOf.set(failures[failures.length - 1], `${component}: ${part} is drawn in Figma, not in code`);
    }
  }
  for (const [component, set] of Object.entries(fig.components)) for (const m of set.members) {
    const state = m.variant.state;
    const status = m.variant.status;
    if (reached.has(m.id) || !KPI_STATES.includes(state)) continue;
    // the KPI's members: the default variant at each state, and the fields' error at rest (Q32 A, the brief's states)
    const isDefault = Object.entries(m.variant).every(([axis, v]) => axis === 'state' || DEFAULTS[component]?.[ALIAS[axis] ?? axis] === v || (axis === 'status' && v === 'error' && state === 'rest'));
    if (isDefault && (status === undefined || status === 'default' || (status === 'error' && state === 'rest'))) failures.push(`${component} (${m.id}) ${Object.entries(m.variant).map(([k, v]) => `${k}=${v}`).join(', ')}: a KPI 2 member no code case reaches: nearest ${closest(Object.entries(code.cases).filter(([k]) => k.split('--')[0] === component), ([k]) => `case ${k}`, ([, cc]) => axisDiffs(m, cc.where))}`);
  }
  return { failures, notes, compared, findings: findingsOf(failures, causeOf) };
};

/** The part paths the arm says its code draws with a box: its input contract's boxed parts (`arm-contract.ts`), so a
 *  Figma part outside them is not a miss, and one inside them that no code case drew is. Read from the contract, never
 *  from the code record: a part the code never draws must not drop out of the comparison with it (`docs/34`). */
const contractArg = process.argv.indexOf('--contract');
const CODE_PARTS: Record<string, string[]> = Object.fromEntries(Object.entries(boxedParts(load(contractArg > 0 ? resolve(process.argv[contractArg + 1]) : ARM_1))).map(([id, p]) => [id, Object.keys(p)]));
/** The part list a run compares a code record with. The real run and the self-test both take it from here, so the
 *  self-test holds the derivation the real run uses: it ignores the record on purpose. */
export const partList = (_code: CodeRecord): Record<string, string[]> => CODE_PARTS;
/** The derivation this file used before the contract: the parts some code case drew. Kept only so the self-test can
 *  show it misses a part the code never draws. */
const drawnParts = (code: CodeRecord): Record<string, string[]> => {
  const out: Record<string, Set<string>> = {};
  for (const [key, c] of Object.entries(code.cases)) for (const p of Object.keys(c.parts)) (out[key.split('--')[0]] ??= new Set()).add(p);
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v]]));
};
/** Each component's API defaults, from the emission (`components.ai.json`); a button's visuals default to absent. */
const AI = JSON.parse(readFileSync(resolve(HERE, '../../packages/engine/out/components/components.ai.json'), 'utf8')).components;
const DEFAULTS: Record<string, Record<string, string>> = Object.fromEntries(['button', 'text-field', 'password-field'].map((id) => [id, {
  ...Object.fromEntries(AI[id].props.filter((p: { default?: unknown }) => p.default !== undefined).map((p: { name: string; default: unknown }) => [p.name, String(p.default)])),
  ...(id === 'button' ? { leading: 'false', trailing: 'false' } : {}),
  ...(id === 'password-field' ? { shown: 'false' } : {}),
}]));

// ------------------------------------------------------------------------------------------------ self-test
/** A Figma record planted from the code's own: the text set 7.3px narrower, as another renderer would, and a label that
 *  records its font set as Figma sets it: a whole-pixel line box, centered in the root (Figma's numbers, not the code's
 *  minus the model, so the model is what makes the two agree). */
const plantFigma = (code: CodeRecord): FigmaRecord => {
  // (every part keeps the code's border, so the borders agree; the Show/Hide button's text is set narrower, below)
  const out: FigmaRecord = { components: {} };
  for (const [key, c] of Object.entries(code.cases)) {
    const component = key.split('--')[0];
    const field = component !== 'button';
    const label = c.parts['container/label'];
    const shrink = !field && label ? 7.3 : 0;
    const narrow = field ? c.root.w - 320 : 0; // a field built at 320px in Figma, laid out wider in code
    const FIXED_PARTS = /(leadingVisual|trailingVisual)$/;
    // the Show/Hide button hugs its "Show", set 4.66px narrower, as on the Mac: the button is that much narrower and
    // further right, and the label cell, which fills the row up to it, that much wider
    const TOGGLE = 'container/labelRow/toggle';
    const toggle = c.parts[TOGGLE];
    const tShrink = toggle ? 4.66 : 0;
    const parts: Record<string, FPart> = {};
    for (const [p, b] of Object.entries(c.parts)) {
      if (p === 'container') continue;
      const after = !field && label && b.x >= label.x + label.w - EPS;
      const sizing = !field ? 'FIXED' : p === TOGGLE ? 'HUG' : FIXED_PARTS.test(p) ? 'FIXED' : 'FILL';
      const cell = p.startsWith('container/labelRow/labelCell');
      const rightAnchored = field && sizing !== 'FILL' && b.x > c.root.w / 2;
      const L = !field && p === 'container/label' ? b.font?.lineHeight ?? null : null;
      const H = L === null ? b.h : Math.round(L);
      parts[p] = {
        id: `1:${Object.keys(parts).length}`, type: !field && p === 'container/label' ? 'TEXT' : 'FRAME', sizing,
        x: after ? b.x - shrink : rightAnchored ? b.x - narrow + (p === TOGGLE ? tShrink : 0) : b.x, y: L === null ? b.y : (c.root.h - H) / 2,
        w: p === 'container/label' && !field ? b.w - shrink : sizing === 'FILL' ? b.w - narrow + (cell ? tShrink : 0) : p === TOGGLE ? b.w - tShrink : b.w, h: H,
        ...(b.border ? { border: [...b.border] } : {}),
        ...(p === 'container/label' && !field ? { text: c.text } : {}),
      };
    }
    if (toggle?.padding && toggle.border) {
      const t = parts[TOGGLE];
      parts[`${TOGGLE}/label`] = { id: `1:${Object.keys(parts).length}`, type: 'TEXT', sizing: 'HUG', text: 'Show', border: [0, 0, 0, 0],
        x: t.x + toggle.border[3] + toggle.padding[3], y: t.y, w: t.w - toggle.padding[1] - toggle.padding[3] - toggle.border[1] - toggle.border[3], h: t.h };
    }
    const variant: Record<string, string> = {};
    for (const [k, v] of Object.entries(c.where)) variant[Object.entries(ALIAS).find(([, a]) => a === k)?.[0] ?? k] = v;
    delete variant.fullWidth;
    if (c.where.fullWidth === 'true' || c.where.shown === 'true') continue; // code only: Figma has no member for it
    delete variant.shown;
    const properties: Record<string, string> = {};
    if (field) for (const k of ['leading', 'trailing', 'message']) if (variant[k] !== undefined || variant[`${k} icon`] !== undefined) { properties[k === 'message' ? 'message' : `${k} icon`] = variant[`${k} icon`] ?? variant[k]; delete variant[`${k} icon`]; delete variant[k]; }
    const set = (out.components[component] ??= { members: [] });
    if (set.members.some((mm) => JSON.stringify([mm.variant, mm.properties]) === JSON.stringify([variant, properties]))) continue; // one member per variant, as in Figma
    set.members.push({ id: `9:${key}`, variant, properties, root: { ...c.root, w: field ? 320 : c.root.w - shrink, sizing: field ? 'FIXED' : 'HUG', minWidth: field ? null : 0 }, parts });
  }
  return out;
};
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const SELF: { name: string; plant: (f: FigmaRecord) => void; plantCode?: (c: CodeRecord) => void; mustName: RegExp; missedByDrawn?: true }[] = [
  { name: 'Figma\'s button padding 1px wider on the left (every part 1px further right)',
    plant: (f) => { const m = f.components.button.members.find((x) => x.id === '9:button--rest')!; m.root.padding[3] += 1; m.root.w += 1; for (const p of Object.values(m.parts)) p.x += 1; },
    mustName: /^button rest \(9:button--rest\): container padding left is .* in code, .* in Figma/ },
  { name: 'Figma\'s label 1px lower in the text field',
    plant: (f) => { f.components['text-field'].members.find((x) => x.id === '9:text-field--rest')!.parts['container/label'].y += 1; },
    mustName: /^text-field rest \(9:text-field--rest\): container\/label y is/ },
  { name: 'Figma\'s gap before the trailing visual 1px wider',
    plant: (f) => { const m = f.components.button.members.find((x) => x.id === '9:button--with-visuals')!; m.parts['container/trailingVisual'].x += 1; m.root.w += 1; },
    mustName: /^button with-visuals .*: container\/trailingVisual x \(Figma's .* \+ the text's .*\) is/ },
  { name: 'Figma\'s control 1px narrower on the right, in a field of another width',
    plant: (f) => { f.components['password-field'].members.find((x) => x.id === '9:password-field--rest')!.parts['container/control'].w -= 1; },
    mustName: /^password-field rest .*: container\/control right inset is/ },
  { name: 'Figma\'s pending button with no label layer, where the code draws one',
    plant: (f) => { delete f.components.button.members.find((x) => x.id === '9:button--pending')!.parts['container/label']; },
    mustName: /^button pending .*: container\/label is drawn in code, not in Figma/ },
  { name: 'code that never draws the password field\'s message, in any case, where Figma does',
    plant: () => {}, plantCode: (c) => { for (const [k, x] of Object.entries(c.cases)) if (k.startsWith('password-field--')) delete x.parts['container/message']; },
    mustName: /^password-field error .*: container\/message \(.*\) is drawn in Figma, not in code/, missedByDrawn: true },
];

if (isEntry(import.meta.url)) {
  if (!existsSync(CODE)) { console.error('FAIL setup: storybook-static/geometry.code.json is missing. Run: npx tsx apps/storybook/check-geometry.ts'); process.exit(1); }
  const code: CodeRecord = JSON.parse(readFileSync(CODE, 'utf8'));
  if (process.argv.includes('--self-test')) {
    let bad = 0;
    const script = await scriptReturns(readFileSync(SCRIPT, 'utf8'));
    if (script) { bad++; console.error(`FAIL self-test: ${script}`); }
    else console.log('OK self-test: figma-geometry.js, run in an async function body as figma_execute runs it, returns the record (a stub set\'s label read back as container/label, each stub field member\'s effective message: false where wired and hidden, true and unwired where pinned shown, #4461, and each part\'s layout border: 0 for a stroke out of layout, its weights in it)');
    const base = plantFigma(code);
    const clean = compare(base, code, partList(code));
    for (const n of clean.notes) console.log(`  named: ${n}`);
    if (clean.failures.length) { bad++; console.error(`FAIL self-test: the planted record with only the text narrower and Figma's whole-pixel line boxes should agree, but: ${clean.failures.slice(0, 5).join(' / ')}`); }
    else console.log(`OK self-test: a record whose only differences are the text's width and Figma's whole-pixel line boxes agrees (${clean.compared} comparisons; ${clean.notes.length} named, not compared)`);
    // the line-box arm is only an arm if the planted labels differ from the code's (#4432 decision 2 C)
    const rounded = Object.entries(code.cases).filter(([k, c]) => k.startsWith('button--') && c.parts['container/label']?.font && base.components.button.members.some((m) => m.id === `9:${k}` && !near(m.parts['container/label'].h, c.parts['container/label'].h)));
    if (rounded.length < 3) { bad++; console.error(`FAIL self-test: the planted record sets ${rounded.length} button labels at a whole-pixel line box other than the code's; the line-box arm needs the code record to carry each label's font (check-geometry.ts) and three sizes to round`); }
    else console.log(`OK self-test: ${rounded.length} planted labels sit at Figma's whole-pixel line box, not the code's (${rounded.map(([k]) => k.slice(8)).join(', ')})`);
    // the text-width model reaches a FILL part through the hugging part after it: the planted button's "Show" is set
    // narrower, so without the model the label cell's right inset would differ
    const cellLines = Object.values(base.components['password-field'].members).filter((m) => m.parts['container/labelRow/toggle/label']).length;
    if (cellLines < 4) { bad++; console.error(`FAIL self-test: the planted record sets ${cellLines} Show/Hide labels narrower than the code's; the sibling text arm needs the code record to carry the button's padding and border (check-geometry.ts)`); }
    else console.log(`OK self-test: ${cellLines} planted Show/Hide labels are set narrower than the code's, and the label cell's right inset agrees through the hugging button's text`);
    // PART BORDERS (#3408 KPI 2 findings, 2026-11-25): Figma's field controls and Show/Hide buttons with no stroke in
    // layout, the code's content inside them and the label cell before them moved by it, and nothing else, is one
    // finding per bordered part: three, each holding every line its border explains
    const pb = clone(base);
    for (const field of ['text-field', 'password-field']) for (const m of pb.components[field].members) {
      const ctl = m.parts['container/control'];
      const cb0 = ctl.border ?? [0, 0, 0, 0];
      ctl.border = [0, 0, 0, 0];
      for (const [p, fp] of Object.entries(m.parts)) {
        if (!p.startsWith('container/control/')) continue;
        if (fp.sizing === 'FILL') { fp.x -= cb0[3]; fp.w += cb0[3] + cb0[1]; } else if (fp.x > ctl.x + ctl.w / 2) fp.x += cb0[1]; else fp.x -= cb0[3];
      }
      const tg = m.parts['container/labelRow/toggle'];
      if (!tg?.border) continue;
      const [l, r] = [tg.border[3], tg.border[1]];
      tg.border = [0, 0, 0, 0];
      tg.x += l + r; tg.w -= l + r;
      m.parts['container/labelRow/toggle/label'].x += r;
      for (const p of ['container/labelRow/labelCell', 'container/labelRow/labelCell/label']) m.parts[p].w += l + r;
    }
    const pr = compare(pb, code, partList(code));
    const byPart = (field: string, part: string) => pr.findings.find((f) => (f.cause ?? '').startsWith(`${field}: ${part}'s border is `));
    const partWant = [
      ['the text field\'s control border is one finding, holding its content\'s and entry\'s insets', byPart('text-field', 'container/control')?.lines.some((l) => /container\/control\/content left inset is/.test(l)) && byPart('text-field', 'container/control')?.lines.some((l) => /container\/control\/content\/entry left inset is/.test(l))],
      ['the password field\'s control border is one finding', !!byPart('password-field', 'container/control')],
      ['the Show/Hide button\'s border is one finding, holding the label cell\'s right inset', byPart('password-field', 'container/labelRow/toggle')?.lines.some((l) => /container\/labelRow\/labelCell right inset \(Figma's .* \+ the toggle's text .*\) is/.test(l))],
      ['three findings in all', pr.findings.length === 3],
    ] as const;
    for (const [what, ok] of partWant) {
      if (ok) console.log(`OK self-test: part borders: ${what}`);
      else { bad++; console.error(`FAIL self-test: part borders: ${what}, but: ${pr.findings.length} findings: ${pr.findings.map((f) => `${f.cause ?? f.lines[0]} (${f.lines.length})`).join(' / ')}`); }
    }
    // ROOT CAUSES (#4432 decision 1 A): Figma's buttons with no border, everything else equal, is one finding; another
    // difference is another, and one difference in two cases is one
    const nb = clone(base);
    for (const m of nb.components.button.members) {
      m.root.border = [0, 0, 0, 0];
      m.root.w -= 2;
      for (const fp of Object.values(m.parts)) fp.x -= 1;
    }
    for (const id of ['9:text-field--rest', '9:text-field--hover']) nb.components['text-field'].members.find((x) => x.id === id)!.parts['container/label'].y += 1;
    const g = compare(nb, code, partList(code));
    const border = g.findings.find((f) => /^button: the root's border is 1\/1\/1\/1 in code, 0\/0\/0\/0 in Figma/.test(f.cause ?? ''));
    const labelY = g.findings.filter((f) => f.lines.some((l) => /^text-field (rest|hover) .*: container\/label y is/.test(l)));
    const want = [
      ['Figma\'s borderless buttons are one finding', !!border && g.findings.filter((f) => f.lines.some((l) => l.startsWith('button '))).length === 1],
      ['it holds every border line, and the width and x lines the border explains', !!border && border.lines.some((l) => / container border left is 1 in code, 0 in Figma$/.test(l)) && border.lines.some((l) => /: container width \(/.test(l)) && border.lines.some((l) => /: container\/label x is/.test(l))],
      // the two members are each matched by several cases (rest, filled, required and medium share one)
      ['the label 1px lower in two text-field members is one other finding, over every case that shows them', labelY.length === 1 && labelY[0].lines.length >= 2 && labelY[0].lines.every((l) => /^text-field [a-z-]+ \(9:text-field--(rest|hover)\): container\/label y is/.test(l))],
      ['two findings in all', g.findings.length === 2],
    ] as const;
    for (const [what, ok] of want) {
      if (ok) console.log(`OK self-test: root causes: ${what}`);
      else { bad++; console.error(`FAIL self-test: root causes: ${what}, but: ${g.findings.length} findings: ${g.findings.map((f) => `${f.cause ?? f.lines[0]} (${f.lines.length})`).join(' / ')}`); }
    }
    // FIELD REACH (#4432 decision 3 A): Figma's field members record \`message\` at its default, false. Each KPI 2 state at
    // the default status must be reached by a code case with the message off. (At error, Q-POC2 A writes the message
    // whatever showMessage says, so Figma's error member at message=false is a finding, not a gap in the stories.)
    const reach = clone(base);
    for (const field of ['text-field', 'password-field']) {
      const set = reach.components[field];
      set.members = set.members.filter((m) => m.properties?.message === 'true').map((m) => ({ ...m, properties: { ...m.properties, message: 'false' } }));
    }
    const rr = compare(reach, code, partList(code));
    for (const field of ['text-field', 'password-field']) for (const state of ['rest', 'hover', 'focus-visible', 'disabled']) {
      const m = reach.components[field].members.find((x) => x.variant.state === state && x.variant.status === 'default' && x.variant.size === 'medium' && Object.entries(x.properties ?? {}).every(([k, v]) => k === 'message' || v === 'false'));
      const missed = !m || rr.failures.some((x) => x.startsWith(`${field} (${m.id}) `) && x.includes('a KPI 2 member no code case reaches'));
      if (!missed) console.log(`OK self-test: field reach: ${field} at ${state}, the message off as in Figma, is reached by a code case`);
      else { bad++; console.error(`FAIL self-test: field reach: ${field} at ${state} with the message off (Figma's default) is reached by no code case${m ? `: ${rr.failures.find((x) => x.startsWith(`${field} (${m.id}) `))}` : ', and no such member was planted'}`); }
    }
    // an unmatched pair names the axis that kept it apart: Figma's field members record `message` at its default
    // (on the code record less its no-message cases, so every text-field case shows the message, as on #4432)
    const withMsg = clone(code);
    for (const k of Object.keys(withMsg.cases)) if (k.endsWith('-no-message')) delete withMsg.cases[k];
    const why = plantFigma(withMsg);
    for (const m of why.components['text-field'].members) m.properties = { ...m.properties, message: 'false' };
    // and a matched member with a part the contract boxes but this case does not draw, so the call reaches the
    // drawn-in-Figma branch, the one that reads the part list: a call without it throws there
    const lead = why.components.button.members.find((x) => x.id === '9:button--rest')!;
    lead.parts['container/leadingVisual'] = { ...lead.parts['container/label'], id: '9:lead', type: 'FRAME' };
    const r = compare(why, withMsg, partList(withMsg));
    if (r.failures.some((x) => /^button rest \(9:button--rest\): container\/leadingVisual \(9:lead\) is drawn in Figma, not in code$/.test(x))) console.log('OK self-test: a matched member\'s part the contract boxes and the case does not draw is named, through the part list');
    else { bad++; console.error(`FAIL self-test: a matched member's part the contract boxes and the case does not draw is not named: ${r.failures.find((x) => x.startsWith('button rest')) ?? 'no line'}`); }
    for (const [what, re, lines] of [
      ['the unmatched case', /^text-field--rest: .*nearest member 9:text-field--rest differs in property message is true in code, false in Figma$/, r.notes],
      ['the unreached member', /^text-field \(9:text-field--rest\) .*a KPI 2 member no code case reaches: nearest case text-field--rest differs in property message is true in code, false in Figma/, r.failures],
    ] as const) {
      if (lines.some((x) => re.test(x))) console.log(`OK self-test: ${what} names the property that kept it apart (message)`);
      else { bad++; console.error(`FAIL self-test: ${what} does not name the property that kept it apart (message): ${lines.find((x) => x.startsWith('text-field')) ?? 'no line'}`); }
    }
    // the two other reasons a case is kept apart: a code-only axis (the planted base leaves fullWidth=true code-only),
    // and a variant axis Figma has that no case names (every password-field member gains `density`)
    const extra = clone(base);
    for (const m of extra.components['password-field'].members) m.variant = { ...m.variant, density: 'compact' };
    const xr = compare(extra, code, partList(code));
    for (const [what, re, lines, prefix] of [
      ['the code-only case', /^button--full-width: .*\(code only, not compared\): fullWidth=true has no Figma axis or property; nearest member /, clean.notes, 'button--full-width'],
      ['the case a Figma variant axis keeps apart', /^password-field--rest: .*nearest member 9:password-field--rest differs in variant density is not named in code, compact in Figma$/, xr.notes, 'password-field--rest'],
    ] as const) {
      if (lines.some((l) => re.test(l))) console.log(`OK self-test: ${what} names the axis that kept it apart`);
      else { bad++; console.error(`FAIL self-test: ${what} does not name the axis that kept it apart: ${lines.find((l) => l.startsWith(prefix)) ?? 'no line'}`); }
    }
    for (const t of SELF) {
      const f = clone(base);
      t.plant(f);
      const c = clone(code);
      t.plantCode?.(c);
      // the planted code record goes through the same part-list derivation the real run uses
      const r = compare(f, c, partList(c));
      if (r.failures.some((x) => t.mustName.test(x))) console.log(`OK self-test: "${t.name}" fails by name`);
      else { bad++; console.error(`FAIL self-test: "${t.name}" was not caught by name (${r.failures[0] ?? 'no failures'})`); }
      if (t.missedByDrawn) {
        // the case is the fix's: the record-derived list must miss it, or the case does not test the fix
        const old = compare(f, c, drawnParts(c));
        if (old.failures.some((x) => t.mustName.test(x))) { bad++; console.error(`FAIL self-test: "${t.name}" is caught even with the parts derived from the code record, so it does not test the contract's part list`); }
        else console.log(`OK self-test: with the parts derived from the code record, "${t.name}" is missed (${old.failures.length} failures), as before the contract`);
      }
    }
    process.exit(bad ? 1 : 0);
  }
  if (!existsSync(FIGMA)) {
    console.error('FAIL figma geometry: apps/storybook/figma-geometry.json is missing. It comes from the Mac job in apps/storybook/figma-geometry.md; a comparison that did not run is not a pass.');
    process.exit(1);
  }
  const figRecord = JSON.parse(readFileSync(FIGMA, 'utf8'));
  const r = compare(figRecord, code, partList(code));
  // #4461 (B1): a record from before the effective read holds each boolean at the set's one default, so a field member
  // whose message is pinned shown at a validation status reads message=false in it. Its lines wait on the re-record.
  if (figRecord.propertyRead !== 'effective')
    console.log('NOTE the Figma record reads each boolean property at its set default (it predates #4461\'s per-member read), so the field error members read message=false here; since #4461 the message is pinned shown and unbound at every validation status, and those lines await the Mac re-record (apps/storybook/figma-geometry.md)');
  for (const m of Object.values(figRecord.components ?? {}).flatMap((c) => (c as { members: FMember[] }).members)) if (m.unwired?.length) console.log(`NOTE member ${m.id} (${Object.entries(m.variant).map(([k, v]) => `${k}=${v}`).join(', ')}): ${m.unwired.join(', ')} shown, wired to no property (#4461)`);
  for (const n of r.notes) console.log(`NOTE ${n}`);
  if (r.failures.length) {
    console.error(`FAIL figma geometry: ${r.failures.length} of ${r.compared} comparisons differ, in ${r.findings.length} findings (lines that share a root cause count once)`);
    for (const f of r.findings) {
      if (f.lines.length === 1) { console.error(`  - ${f.lines[0]}`); continue; }
      console.error(`  - one finding, ${f.lines.length} lines: ${f.cause}`);
      for (const l of f.lines) console.error(`      - ${l}`);
    }
    process.exit(1);
  }
  console.log(`OK figma geometry: ${r.compared} comparisons, code equal to Figma to 0.01px`);
}
