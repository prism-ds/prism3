/**
 * Depth, the levers panel (UI redesign S9.2; concept v6's Depth & motion page, V4). #4571 (owner decision Q-ME3 A) split
 * Depth & motion in two: tempo and easing moved to Motion (`domains/motion.ts`), and this page keeps the shadow.
 *
 * WHAT IT DRAWS: the intro; **Elevation**: the shadow softness slider, on the manifest's range and named stops, and,
 * behind its own Show advanced, **Shadow tint**'s hue and amount sliders (owner decision D8 A: tint is part of the
 * shadow, so it sits inside Elevation). Last, the way on to Motion. Each manifest key homed here draws its `lever-*`
 * block exactly once.
 *
 * WHICH MODE A CONTROL EDITS (owner decision Q22): the mode the preview shows (softness and tint are per mode).
 * Previewing Light writes the brand value; previewing Dark or a custom mode writes `modeLevers[mode].*`, and the control
 * says "Auto: follows Light (‹value›)" until it is set, with Return to Auto once it is. Auto names LIGHT's value in every
 * mode, a custom mode included: the engine resolves these levers from the brand value, never from a custom mode's base
 * (the S9 scoping report, finding 7). A derived mode (HC light, HC dark, wireframe) is read-only, held by the frame: the
 * whole levers panel is inert and disabled under one line (N-3 A, #1984), and the preview is still drawn (Q59).
 *
 * BEHAVIOR-NEUTRAL (the S2 rule). Every write goes through `state/depth-motion-input.ts`, which writes what the legacy
 * Elevation page wrote, byte for byte, its traps included: Light's tint is written one key at a time, and a mode's
 * shadow slider landing exactly on the brand value clears the override.
 *
 * HOW IT REPAINTS: by store subscription only (plan §5): `brand`, `mode` and `search`. A control writes, notes the edit
 * for the preview's reveal (`noteSectionEdit`, QA-B9) and calls `rebuild()`. The panel redraws itself whole only when
 * its shape changes (the mode, Show advanced, a search); a shadow slider's edit updates the sliders, their readouts and
 * their Auto lines in place, so a drag survives every repaint. It never names a legacy repaint tier and never imports
 * `main.ts` (`test-shell-imports.ts`).
 */
import { brandState, currentMode, getPath, lastError, searchQuery, setPage, setSearchHits, subscribe, theme } from '../state/store';
import { isDerived } from '../state/verdict';
import { authoredTint, brandShadowValue, setShadow, shadowOverride, type ShadowKey } from '../state/depth-motion-input';
import { DOMAINS, pageOfTab, type PageData } from '../shell/pages';
import { modeLabel } from '../shell/preview';
import { armEnter, enterMark, glyph, h, hook } from '../shell/dom';
import { advancedLabel, leverBlock, leverOf, setText, slider, sliderReadout, stateLine, subLine, type LeverBlock, keepFocus, pageEdit, filterLevers } from '../ui/lever-kit';

const PAGE = DOMAINS.find((d) => d.id === 'depth') as PageData;
const section = (title: string) => PAGE.sections.find((s) => s.title === title)!;

/** The page's own copy. APPROVED (owner, 2026-10-04) unless marked DRAFT; the DRAFT strings are in the S9.2
 *  fragment's "Copy for owner approval" block. */
export const DEPTH_COPY = {
  /** A per-mode control's Auto, previewing another mode (Q22, APPROVED; Type's wording). */
  autoLight: (v: string): string => `Auto · follows Light (${v})`,
  toAuto: 'Return to Auto',
  editing: (m: string): string => `Editing ${m}, the mode the preview shows.`,
  /** DRAFT (#4571): the way on to Motion, the tab Depth & motion split into (Q-ME3 A). */
  next: 'Continue to Motion',
  /** DRAFT: the tint info text, in D16's plain words. */
  tintTip: 'How far shadows move off pure black, and toward which hue. 0 is pure black.',
  /** The two tint sliders' names (the legacy page's). */
  hue: 'Tint hue',
  amount: 'Tint amount',
  /** The hue slider's readout, and the line under it, when the shadow has no hue to follow: the neutral ramp is gray
   *  and no tint hue is set (#2184). The pinned form is approved (owner Q58 B, Q72 A); so is the general form, for a
   *  Custom tint or Follow primary at chroma 0 (Q73 A, Q82). */
  noHue: 'None',
  noHuePinned: 'The pinned gray has no hue, so shadows are untinted.',
  noHueGray: 'The neutral is gray, so shadows are untinted.',
} as const;

/** Something drawn that search can hide and a refusal can mark. */
type Item = { el: HTMLElement; said: string; key: string; block: LeverBlock };
/** A shadow slider drawn this render, synced in place on every brand change. */
type ShadowCtl = { key: ShadowKey; set: (v: number) => void; readout: (t: string) => void; auto: HTMLElement; reset: HTMLButtonElement; fmt: (v: number) => string;
  /** The hue slider only: disabled, its readout and hint saying so, while the shadow has no hue (#2184 Q58 B). */
  noHue?: (none: boolean) => void };

/** Mount the Depth & motion levers into `host`. Subscriptions are released through `cleanups`. */
export const mountDepthLevers = (host: HTMLElement, cleanups: (() => void)[]): void => {
  const root = hook(h('div', 'p3-levers-body'), 'depth-levers');
  host.replaceChildren(root);
  /** Elevation's own Show advanced (Shadow tint, D8 A). */
  let tintOpen = false;
  /** The key the last edit wrote, so an engine refusal marks the lever that caused it. */
  let lastEdited: string | null = null;
  let items: Item[] = [];
  let shadows: ShadowCtl[] = [];
  /** The brand value each shadow slider lands against, as it was drawn (the legacy closure's `global`). */
  const drawnBrand: Partial<Record<ShadowKey, number | null>> = {};
  let shapeKey = '';

  const edit = pageEdit((k) => { lastEdited = k; });   // the shared edit (#2487 B5)
  const light = (): boolean => currentMode === 'light';
  const derived = (): boolean => isDerived(currentMode);

  /** Auto and Return to Auto, both drawn and one shown, so the line flips in place while a slider is dragged. */
  const autoPair = (role: string, onReset: () => void): { el: HTMLElement; auto: HTMLElement; reset: HTMLButtonElement } => {
    const el = h('div', 'p3-autorow');
    const auto = hook(h('p', 'p3-sub', ''), `${role}-auto`);
    const reset = hook(h('button', 'p3-btn p3-btn-page'), `${role}-reset`);
    reset.type = 'button';
    reset.append(h('span', 'p3-btn-label', DEPTH_COPY.toAuto));
    reset.onclick = onReset;
    el.append(auto, reset);
    return { el, auto, reset };
  };

  // ── Elevation ─────────────────────────────────────────────────────────────────────────────────
  /** One shadow slider for the previewed mode. Light: the brand value (the tint one key at a time). Another mode: its
   *  override, or the brand value under Auto; landing on the brand value clears it (`setShadow`). */
  const shadowSlider = (key: ShadowKey, role: string, label: string | null, b: LeverBlock,
    part?: { id: string; min: number; max: number; step: number; unit?: string }): HTMLElement => {
    const L = leverOf('shadow.softness')!;
    const fmt = (v: number): string => (part ? `${Number(v).toFixed(String(part.step).includes('.') ? String(part.step).split('.')[1].length : 0)}${part.unit ?? ''}` : sliderReadout(L, v));
    const wrap = h('div', 'p3-field');
    const lever = part ? 'shadow.tint' : 'shadow.softness';
    const name = label ?? L.label;
    const s = slider(lever, role, `${name}, ${modeLabel(currentMode)}`, (v) => {
      edit(lever, () => { setShadow(currentMode, key, v, drawnBrand[key]); });
    }, part);
    // Softness is its lever block's one control, so the block's own name labels it and its readout sits in the head;
    // the tint's two sliders each carry a name and a readout of their own.
    let readout: (t: string) => void = b.setReadout;
    if (label) {
      const head = h('div', 'p3-slider-head');
      const lab = h('label', 'p3-field-label', label);
      lab.htmlFor = s.el.id;
      const read = h('span', 'p3-readout');
      head.append(lab, read);
      wrap.append(head);
      readout = (t) => setText(read, t);
    }
    wrap.append(s.el);
    // No hue to follow (a pure-gray pin, no tint hue set): the hue slider is disabled, reads None, and says why
    // (#2184, owner Q58 B). The engine reports it as `tint.hue: null`; it never shows the converter's noise hue.
    let noHue: ShadowCtl['noHue'];
    if (key === 'tint.hue') {
      const why = stateLine(DEPTH_COPY.noHuePinned);
      why.hidden = true;
      wrap.append(why);
      noHue = (none) => {
        if (s.el.disabled !== none) s.el.disabled = none;
        if (none) {
          s.el.setAttribute('aria-valuetext', DEPTH_COPY.noHue);
          // The reason names the source: a pinned gray, or a hue-and-chroma neutral at chroma 0 (Q73 A).
          setText(why.querySelector('span')!, brandState.neutral?.anchor ? DEPTH_COPY.noHuePinned : DEPTH_COPY.noHueGray);
        }
        if (why.hidden === none) why.hidden = !none;
      };
    }
    const pair = autoPair(role, () => edit(lever, () => { setShadow(currentMode, key, undefined, drawnBrand[key]); }));
    if (!light() && !derived()) wrap.append(pair.el);
    shadows.push({ key, set: s.set, readout, auto: pair.auto, reset: pair.reset, fmt, noHue });
    return wrap;
  };
  const softness = (): Item => {
    const b = leverBlock('shadow.softness', { forId: 'p3-shadow-softness' });
    b.ctl.append(shadowSlider('softness', 'shadow-softness', null, b));
    return { el: b.el, said: b.said, key: 'shadow.softness', block: b };
  };
  const tint = (): Item => {
    const s = section('Shadow tint');
    const b = leverBlock('shadow.tint', { label: s.title, desc: DEPTH_COPY.tintTip, group: true });
    b.ctl.append(subLine(s.desc ?? ''));
    b.ctl.append(
      shadowSlider('tint.hue', 'shadow-tint-hue', DEPTH_COPY.hue, b, { id: 'hue', min: 0, max: 360, step: 1, unit: '°' }),
      shadowSlider('tint.amount', 'shadow-tint-amount', DEPTH_COPY.amount, b, { id: 'amount', min: 0, max: 1, step: 0.05 }),
    );
    return { el: b.el, said: `${b.said} ${DEPTH_COPY.hue} ${DEPTH_COPY.amount}`.toLowerCase(), key: 'shadow.tint', block: b };
  };
  /** The value a shadow slider shows: the brand's in Light (the authored tint key, else the resolved), the mode's
   *  override or the brand's elsewhere. */
  const shadowShown = (key: ShadowKey): number | null => {
    if (light()) {
      if (key === 'softness') return (getPath(brandState, 'shadow.softness') as number | undefined) ?? theme.shadow.softness;
      const k = key === 'tint.hue' ? 'hue' : 'amount';
      return authoredTint()?.[k] ?? theme.shadow.tint[k];
    }
    return shadowOverride(currentMode, key) ?? brandShadowValue(key);
  };
  const syncShadows = (): void => {
    for (const c of shadows) {
      drawnBrand[c.key] = brandShadowValue(c.key);
      const v = shadowShown(c.key);
      const show = (x: number | null): string => (x === null ? DEPTH_COPY.noHue : c.fmt(x));
      if (v !== null) c.set(v);
      c.noHue?.(v === null);
      c.readout(show(v));
      const set = !light() && shadowOverride(currentMode, c.key) !== undefined;
      setText(c.auto, DEPTH_COPY.autoLight(show(brandShadowValue(c.key))));
      if (c.auto.hidden !== set) c.auto.hidden = set;
      if (c.reset.hidden !== !set) c.reset.hidden = !set;
    }
  };

  // ── the sections ──────────────────────────────────────────────────────────────────────────────
  const sectionShell = (title: string, desc: string | undefined, i: number): HTMLElement => {
    const el = hook(h('section', 'p3-lsec'), 'lever-section');
    el.id = `p3-lsec-depth-${i}`;
    const head = h('div', 'p3-lsec-head');
    const t = h('h2', 'p3-lsec-title', title);
    t.id = `${el.id}-t`;
    // No name, so not a landmark: only Inspect and Activity carry landmark names (Q197, #2487).
    head.append(t);
    if (desc) head.append(h('p', 'p3-lsec-desc', desc));
    el.append(head);
    // Q22: every control on this page edits the mode the preview shows, so a section says which, once.
    if (!light() && !derived()) el.append(hook(subLine(DEPTH_COPY.editing(modeLabel(currentMode))), 'depth-editing'));
    return el;
  };
  /** Elevation's own Show advanced (S6.2's form): a disclosure button and the Shadow tint block it opens. */
  const tintFold = (open: boolean): { el: HTMLElement; item: Item | null } => {
    const row = h('div', 'p3-advrow');
    const btn = hook(h('button', 'p3-btn p3-btn-page'), 'depth-tint-advanced');
    btn.type = 'button';
    btn.id = 'p3-adv-depth-tint';
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-controls', 'p3-advb-depth-tint');
    const n = section('Shadow tint').rows.length;
    btn.append(glyph(open ? 'chev' : 'chevr'), h('span', 'p3-btn-label', advancedLabel(open, n)));
    btn.onclick = () => { tintOpen = !tintOpen; if (tintOpen) armEnter('p3-advb-depth-tint'); render(); };
    const body = enterMark(h('div', 'p3-advbody'), 'p3-advb-depth-tint');
    body.id = 'p3-advb-depth-tint';
    body.hidden = !open;
    let item: Item | null = null;
    if (open) { item = tint(); body.append(item.el); }
    row.append(btn, body);
    return { el: row, item };
  };

  const shape = (): string => JSON.stringify([currentMode, tintOpen || !!searchQuery.trim(), lastError && lastEdited]);

  const render = (): void => {
    // What had focus, found again after the redraw (`keepFocus`, #2487 B5).
    const { key: focusKey, again } = keepFocus(root);
    const scrollTop = host.scrollTop;
    shapeKey = shape();
    items = [];
    shadows = [];
    const parts: HTMLElement[] = [h('p', 'p3-intro', PAGE.intro)];
    // Elevation, with Shadow tint behind its own Show advanced (D8 A); a search opens it.
    const elev = section('Elevation');
    const e = sectionShell(elev.title, elev.desc, 0);
    const soft = softness();
    const fold = tintFold(tintOpen || !!searchQuery.trim());
    e.append(soft.el, fold.el);
    items.push(soft, ...(fold.item ? [fold.item] : []));
    parts.push(e);
    const next = hook(h('button', 'p3-btn p3-btn-page p3-next'), 'depth-continue');
    next.type = 'button';
    next.append(h('span', 'p3-btn-label', DEPTH_COPY.next), glyph('chevr'));
    next.onclick = () => setPage(pageOfTab('motion'));   // by tab (S7's pageOfTab)
    const nr = h('div', 'p3-nextrow');
    nr.append(next);
    parts.push(nr);
    root.replaceChildren(...parts);
    syncShadows();
    for (const it of items) it.block.setRefused(!!lastError && !!lastEdited && it.key === lastEdited);
    filter();
    if (focusKey) again()?.focus({ preventScroll: true });
    if (host.scrollTop !== scrollTop) host.scrollTop = scrollTop;
  };

  /** Search (Q3): hide what does not match, report the count. */
  const filter = (): void => filterLevers(root, items);   // the shared search (#2487 B5)

  cleanups.push(subscribe('brand', () => {
    if (shape() !== shapeKey) { render(); return; }
    syncShadows();
    for (const it of items) it.block.setRefused(!!lastError && !!lastEdited && it.key === lastEdited);
  }));
  cleanups.push(subscribe('mode', () => render()));
  cleanups.push(subscribe('search', () => { if (shape() !== shapeKey) render(); else filter(); }));
  cleanups.push(() => { if (searchQuery.trim()) setSearchHits(null); });
  render();
};
