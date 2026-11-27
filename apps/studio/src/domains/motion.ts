/**
 * Motion, the levers panel (#4571, the motion editor's PR 2; owner decision Q-ME3 A split it from Depth & motion).
 *
 * WHAT IT DRAWS: the intro; **Motion**: the tempo chips, then one value picker per motion role (default, enter, exit,
 * emphasized), each listing the brand's curves, drawn (D10 A, D15), moved here whole from Depth & motion; **Presets**:
 * one row per preset, in the engine's order, with three pickers (duration, easing, delay), each showing its token
 * name and the value it resolves to in the mode in view. An arriving preset has an Exit disclosure with the same three
 * pickers for its closing half. Last, the way on to Layout.
 *
 * WHAT A PRESET PICKER OFFERS (owner decision Q-ME1 A): everything the engine accepts, read from the engine's own lists
 * (`presetSlotTargets`, `durationTargetsFor`), grouped roles first, then curves, then springs. The spring rule is held
 * by the list: a spring easing offers only its own settle time. Where a motion rule would object (an exit as long as
 * its entrance, a delay), the row says so and still takes the edit (`presetAdvisories`). An easing that follows a role
 * says which role; one pointed at a curve or spring says it is fixed (the proposal's §2.1 behavior 1). An exit slot
 * the brand has not set follows the entrance (behavior 2).
 *
 * WHICH MODE A CONTROL EDITS (owner decision Q22): tempo and easing edit the mode the preview shows, as they did on Depth
 * & motion. Presets have no per-mode form (the proposal's §4.1), so previewing any mode but Light their rows show the
 * brand value with every picker disabled, under one line saying so. A derived mode is read-only, held by the frame.
 *
 * Every write goes through `state/depth-motion-input.ts` (tempo, easing) or `state/motion-input.ts` (presets).
 *
 * HOW IT REPAINTS: by store subscription only (`brand`, `mode`, `search`), as Depth does.
 */
import {
  durationTargetsFor, easingSourceOf, presetAdvisories, presetSlotTargets, slotPathsOf,
  type SlotTarget,
} from '@prism3/engine';
import { brandState, currentMode, getPath, lastError, searchQuery, setPage, setSearchHits, subscribe, theme } from '../state/store';
import { isDerived } from '../state/verdict';
import { easingOverride, setEasingRole, setTempo, tempoOverride } from '../state/depth-motion-input';
import { presetSlotSet, resetPreset, setPresetSlot, type PresetHalf, type PresetSlot } from '../state/motion-input';
import { DOMAINS, pageOfTab, type PageData } from '../shell/pages';
import { modeLabel } from '../shell/preview';
import { glyph, h, hook } from '../shell/dom';
import { valuePicker, type PickerValue } from '../ui/value-picker';
import { choice, leverBlock, leverOf, promoteLever, stateLine, subLine, tokenLabel, type LeverBlock, keepFocus, pageEdit, filterLevers } from '../ui/lever-kit';

const PAGE = DOMAINS.find((d) => d.id === 'motion') as PageData;
const section = (title: string) => PAGE.sections.find((s) => s.title === title)!;

/** The page's own copy. Tempo's and easing's are APPROVED (owner, 2026-10-04) unless marked DRAFT, as they were on
 *  Depth & motion. Everything under `presets` is DRAFT (#4571, listed in the PR's "Strings for owner approval"). */
export const MOTION_COPY = {
  autoLight: (v: string): string => `Auto · follows Light (${v})`,
  toAuto: 'Return to Auto',
  editing: (m: string): string => `Editing ${m}, the mode the preview shows.`,
  easingRow: (role: string): string => `Easing for ${role}`,
  easingHint: 'The six curves are fixed. Each role picks one.',
  next: 'Continue to Layout',
  /** DRAFT: the easing rows' group label (concept v6's), and the tempo info text, in D16's plain words. */
  easingLabel: 'Easing per motion role',
  easingTip: 'Which of the six curves each kind of motion follows, by its role.',
  tempoTip: 'How fast every duration runs: Snappy 0.8×, Standard 1×, Relaxed 1.3×.',
  presets: {
    /** The three slots' names, as a picker's title and its button's label. */
    slot: { duration: 'Duration', easing: 'Easing', delay: 'Delay' } as Record<PresetSlot, string>,
    exit: 'Exit',
    /** A picker's title: `surface, duration` or `surface exit, easing`. */
    title: (preset: string, half: PresetHalf, slot: PresetSlot): string => `${preset}${half === 'exit' ? ' exit' : ''}, ${slot}`,
    hint: {
      duration: 'A step of the duration scale. With a spring easing, the spring\'s settle time.',
      easing: 'An easing role, a curve or a spring. A role follows the brand\'s choice for it.',
      delay: 'How long the preset waits before it starts. The steps are tooltip thresholds.',
    } as Record<PresetSlot, string>,
    groups: { step: 'Steps', 'spring-duration': 'Spring settle time', role: 'Roles', curve: 'Curves', spring: 'Springs', delay: 'Delays' } as Record<SlotTarget['group'], string>,
    noDelay: 'None',
    noDelayNote: 'Starts at once',
    follows: (role: string): string => `follows ${role}`,
    fixed: 'fixed',
    followsEntrance: 'Follows the entrance until set: one step shorter, on the exit role.',
    reset: 'Reset',
    brandWide: 'Presets are brand-wide. Preview Light to edit them.',
    advisory: {
      // Rendered after the half's name ("Exit: plays as long as…"), so it does not name the exit again (owner, 2026-11-27).
      'exit-not-shorter': 'plays as long as its entrance or longer. Leaving usually runs one step shorter.',
      delay: 'Every motion on this preset waits before it starts.',
    } as Record<string, string>,
  },
} as const;

/** The tempo chips, from the manifest's options. */
const tempoOptions = (): { v: string; l: string }[] => (leverOf('motionPersonality.tempo')?.options ?? []).map((o) => ({ v: String(o.value), l: String(o.label) }));
const tempoName = (v: string): string => tempoOptions().find((o) => o.v === v)?.l ?? v;

/** A cubic-bezier, drawn: the curve a value picker row shows (D10). Inline SVG, stroked in the row's ink. */
const SVGNS = 'http://www.w3.org/2000/svg';
export const curveSvg = (b: readonly number[]): SVGElement => {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '-6 -6 112 112');
  svg.setAttribute('class', 'p3-curve');
  svg.setAttribute('aria-hidden', 'true');
  const axis = document.createElementNS(SVGNS, 'path');
  axis.setAttribute('d', 'M0,0 L0,100 L100,100');
  axis.setAttribute('fill', 'none');
  axis.setAttribute('stroke', 'currentColor');
  axis.setAttribute('stroke-opacity', '0.35');
  axis.setAttribute('stroke-width', '3');
  const line = document.createElementNS(SVGNS, 'path');
  line.setAttribute('d', `M0,100 C${b[0] * 100},${100 - b[1] * 100} ${b[2] * 100},${100 - b[3] * 100} 100,0`);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', 'currentColor');
  line.setAttribute('stroke-width', '7');
  line.setAttribute('stroke-linecap', 'round');
  svg.append(axis, line);
  return svg;
};

/** Something drawn that search can hide and a refusal can mark. */
type Item = { el: HTMLElement; said: string; key: string; block: LeverBlock };

/** Mount the Motion levers into `host`. Subscriptions are released through `cleanups`. */
export const mountMotionLevers = (host: HTMLElement, cleanups: (() => void)[]): void => {
  const root = hook(h('div', 'p3-levers-body'), 'motion-levers');
  host.replaceChildren(root);
  /** The value picker that is open, by its key (a role, or `<preset>/<half>/<slot>`), or null; one at a time. */
  let openPick: string | null = null;
  let focusPick = false;
  let pickFocus: (() => void) | null = null;
  /** The arriving presets whose Exit disclosure is open. */
  const exitsOpen = new Set<string>();
  let lastEdited: string | null = null;
  let items: Item[] = [];
  let shapeKey = '';

  const edit = pageEdit((k) => { lastEdited = k; });
  const light = (): boolean => currentMode === 'light';
  const derived = (): boolean => isDerived(currentMode);

  const autoPair = (role: string, onReset: () => void): { el: HTMLElement; auto: HTMLElement; reset: HTMLButtonElement } => {
    const el = h('div', 'p3-autorow');
    const auto = hook(h('p', 'p3-sub', ''), `${role}-auto`);
    const reset = hook(h('button', 'p3-btn p3-btn-page'), `${role}-reset`);
    reset.type = 'button';
    reset.append(h('span', 'p3-btn-label', MOTION_COPY.toAuto));
    reset.onclick = onReset;
    el.append(auto, reset);
    return { el, auto, reset };
  };

  // ── Motion: tempo and easing per role (moved from Depth & motion, unchanged) ─────────────────────
  const tempo = (): Item => {
    const b = leverBlock('motionPersonality.tempo', { desc: MOTION_COPY.tempoTip, group: true });
    const mode = currentMode;
    const brandV = theme.motion.tempo;
    const ov = light() ? undefined : tempoOverride(mode);
    const c = choice(`${leverOf('motionPersonality.tempo')?.label ?? 'Motion tempo'}, ${modeLabel(mode)}`, 'tempo', tempoOptions(),
      (v) => edit('motionPersonality.tempo', () => setTempo(mode, v)));
    c.set((light() ? (getPath(brandState, 'motionPersonality.tempo') as string | undefined) : ov) ?? brandV);
    b.ctl.append(c.el);
    if (!light() && !derived()) {
      const pair = autoPair('tempo', () => edit('motionPersonality.tempo', () => setTempo(mode, undefined)));
      pair.auto.textContent = MOTION_COPY.autoLight(tempoName(brandV));
      pair.auto.hidden = ov !== undefined;
      pair.reset.hidden = ov === undefined;
      b.ctl.append(pair.el);
    }
    return { el: b.el, said: b.said, key: 'motionPersonality.tempo', block: b };
  };

  /** A button that opens the picker keyed `key`. */
  const pickButton = (key: string, hookName: string, id: string, now: string, aria: string, set: boolean, disabled = false): HTMLButtonElement => {
    const btn = hook(h('button', 'p3-btn p3-btn-page p3-pick'), hookName);
    btn.type = 'button';
    btn.id = id;
    if (set) btn.dataset.set = 'true';
    btn.setAttribute('aria-expanded', String(openPick === key));
    btn.setAttribute('aria-label', aria);
    btn.append(h('span', 'p3-btn-label', now), glyph('chev'));
    btn.disabled = disabled;
    btn.onclick = () => {
      const opening = openPick !== key;
      openPick = opening ? key : null;
      focusPick = opening;
      render();
    };
    return btn;
  };

  const easing = (): Item => {
    const b = leverBlock('motionPersonality.easingRoles', { label: MOTION_COPY.easingLabel, desc: MOTION_COPY.easingTip, group: true });
    const mode = currentMode;
    const curves = Object.entries(theme.motion.easing);
    const names = curves.map(([n]) => n);
    const rows = hook(h('div', 'p3-fillrows'), 'easing-rows');
    for (const r of theme.motion.easingRoles) {
      const brandCurve = r.curve;
      const ov = light() ? undefined : easingOverride(mode, r.role);
      const cur = ov ?? brandCurve;
      const id = `p3-easing-${r.role}`;
      const row = hook(h('div', 'p3-tweight'), 'easing-row');
      row.dataset.role = r.role;
      const now = !light() && ov === undefined ? MOTION_COPY.autoLight(brandCurve) : cur;
      const btn = pickButton(r.role, 'easing-pick', id, now, `${MOTION_COPY.easingRow(r.role)}, ${modeLabel(mode)}: ${now}. Pick a value`, ov !== undefined);
      btn.dataset.role = r.role;
      row.append(tokenLabel(`motion.easing-role.${r.role}`, MOTION_COPY.easingRow(r.role), id, { wrap: true }), btn);
      rows.append(row);
      if (openPick === r.role && !derived()) {
        const pk = valuePicker({
          name: MOTION_COPY.easingRow(r.role), modeLabel: modeLabel(mode), hint: MOTION_COPY.easingHint,
          current: names.indexOf(cur),
          values: curves.map(([n, bez], i) => ({
            v: i, label: n,
            sample: (e: HTMLElement) => { e.dataset.curve = n; e.append(curveSvg(bez)); },
          })),
          ...(light() ? {} : { reset: { label: MOTION_COPY.toAuto, enabled: ov !== undefined } }),
          // In a mode, Light's own curve is Auto: the legacy table never offered the self-map.
          onPick: (i) => edit('motionPersonality.easingRoles', () => setEasingRole(mode, r.role, light() || names[i] !== brandCurve ? names[i] : undefined)),
          onReset: () => edit('motionPersonality.easingRoles', () => setEasingRole(mode, r.role, undefined)),
          onClose: () => { openPick = null; render(); root.querySelector<HTMLElement>(`#${id}`)?.focus(); },
        });
        pickFocus = pk.focusCurrent;
        rows.append(pk.el);
      }
    }
    b.ctl.append(rows);
    return { el: b.el, said: `${b.said} ${theme.motion.easingRoles.map((r) => `${MOTION_COPY.easingRow(r.role)} motion.easing-role.${r.role}`).join(' ')}`.toLowerCase(), key: 'motionPersonality.easingRoles', block: b };
  };

  // ── Presets (#4571) ──────────────────────────────────────────────────────────────────────────────
  const P = MOTION_COPY.presets;
  /** The duration steps in the mode in view (a mode's tempo re-derives them). */
  const durations = (): Record<string, number> => theme.motion.motionByMode?.[currentMode]?.duration ?? theme.motion.duration;
  /** The curve a role uses in the mode in view. */
  const roleCurve = (role: string): string =>
    theme.motion.easingRolesByMode?.[currentMode]?.[role] ?? theme.motion.easingRoles.find((r) => r.role === role)?.curve ?? 'standard';
  /** What a target resolves to, in grey beside its token name: `300ms`, a curve's name, a spring's settle time. */
  const resolved = (path: string): string => {
    const [kind, name] = [path.slice(0, path.indexOf('.')), path.slice(path.indexOf('.') + 1)];
    if (kind === 'duration') return `${durations()[name] ?? '?'}ms`;
    if (kind === 'spring-duration') return `${theme.motion.springSettle[name] ?? '?'}ms`;
    if (kind === 'easing-role') return roleCurve(name);
    if (kind === 'spring') return `${theme.motion.springSettle[name] ?? '?'}ms`;
    if (kind === 'delay') return `${theme.motion.delay[name] ?? '?'}ms`;
    return '';
  };
  /** A target's curve, for its sample: a role's curve in the mode, a curve's own; null for a spring. */
  const bezierOf = (path: string): readonly number[] | null => {
    if (path.startsWith('easing-role.')) return theme.motion.easing[roleCurve(path.slice('easing-role.'.length))] ?? null;
    if (path.startsWith('easing.')) return theme.motion.easing[path.slice('easing.'.length)] ?? null;
    return null;
  };

  /** One slot: its name, a button with the token and its value, and its picker when open. */
  const slotControl = (preset: string, half: PresetHalf, slot: PresetSlot, now: string | null, easingNow: string, readOnly: boolean, into: HTMLElement): void => {
    const key = `${preset}/${half}/${slot}`;
    const id = `p3-preset-${preset}-${half}-${slot}`;
    const set = presetSlotSet(preset, half, slot) !== undefined;
    const shown = now === null ? P.noDelay : `${now} · ${resolved(now)}`;
    const cell = hook(h('div', 'p3-tweight p3-preset-slot'), 'preset-slot');
    cell.dataset.slot = slot;
    // The easing rows' label (QA-B2): the slot's name first, its token under it.
    const name = tokenLabel(`motion.preset.${preset}${half === 'exit' ? '.exit' : ''}.${slot}`, P.slot[slot], id, { wrap: true });
    const btn = pickButton(key, 'preset-pick', id, shown, `${P.title(preset, half, P.slot[slot].toLowerCase() as PresetSlot)}: ${shown}. Pick a value`, set, readOnly);
    btn.dataset.preset = preset;
    btn.dataset.half = half;
    btn.dataset.slot = slot;
    btn.dataset.path = now ?? '';
    cell.append(name, btn);
    into.append(cell);
    if (openPick !== key || readOnly) return;
    const targets: SlotTarget[] = slot === 'duration' ? durationTargetsFor(theme.motion, easingNow)
      : slot === 'easing' ? presetSlotTargets(theme.motion).easing : presetSlotTargets(theme.motion).delay;
    const values: PickerValue[] = targets.map((t, i) => ({
      v: i + 1, label: t.path, group: P.groups[t.group],
      // The sample: what the target resolves to in the mode in view, and its curve where it has one.
      sample: (e: HTMLElement) => { e.dataset.path = t.path; e.append(h('span', 'p3-preset-resolved', resolved(t.path))); const b = bezierOf(t.path); if (b) e.append(curveSvg(b)); },
    }));
    // "No delay" is the slot unset: v 0 resets it.
    if (slot === 'delay') values.unshift({ v: 0, label: P.noDelay, group: P.groups.delay, sample: (e) => { e.dataset.path = ''; e.append(h('span', 'p3-preset-resolved', P.noDelayNote)); } });
    const cur = now === null ? 0 : targets.findIndex((t) => t.path === now) + 1;
    const pk = valuePicker({
      name: P.title(preset, half, P.slot[slot].toLowerCase() as PresetSlot), modeLabel: modeLabel(currentMode), hint: P.hint[slot],
      current: cur, values,
      reset: { label: P.reset, enabled: set },
      onPick: (v) => edit('motionPersonality.presets', () => setPresetSlot(preset, half, slot, v === 0 ? undefined : targets[v - 1]!.path)),
      onReset: () => edit('motionPersonality.presets', () => setPresetSlot(preset, half, slot, undefined)),
      onClose: () => { openPick = null; render(); root.querySelector<HTMLElement>(`#${id}`)?.focus(); },
    });
    pickFocus = pk.focusCurrent;
    into.append(pk.el);
  };

  const presets = (): Item => {
    const s = section('Presets');
    const b = leverBlock('motionPersonality.presets', { group: true });
    const readOnly = !light();
    if (readOnly && !derived()) b.ctl.append(hook(stateLine(P.brandWide), 'presets-brand-wide'));
    const advisories = presetAdvisories(theme.motion, currentMode);
    const list = hook(h('div', 'p3-presets'), 'preset-rows');
    const said: string[] = [];
    for (const p of theme.motion.presets) {
      const row = hook(h('div', 'p3-preset'), 'preset-row');
      row.dataset.preset = p.preset;
      // The preset's name is the group's heading (L2, as Surfaces & fills' subgroups are), its source and reset under it.
      row.append(h('h3', p.preset === theme.motion.presets[0]?.preset ? 'p3-rows-sub p3-rows-sub-first' : 'p3-rows-sub', p.preset));
      const head = h('div', 'p3-preset-head');
      const src = easingSourceOf(p);
      const tag = hook(h('span', 'p3-preset-tag', 'follows' in src ? P.follows(src.follows) : P.fixed), 'preset-source');
      tag.dataset.source = 'follows' in src ? 'follows' : 'fixed';
      head.append(tag);
      const anySet = getPath(brandState, `motionPersonality.presets.${p.preset}`) !== undefined;
      if (anySet && !readOnly) {
        const reset = hook(h('button', 'p3-btn p3-btn-page'), 'preset-reset');
        reset.type = 'button';
        reset.dataset.preset = p.preset;
        reset.setAttribute('aria-label', `${P.reset} ${p.preset}`);
        reset.append(h('span', 'p3-btn-label', P.reset));
        reset.onclick = () => edit('motionPersonality.presets', () => resetPreset(p.preset));
        head.append(reset);
      }
      row.append(head);
      const slots = h('div', 'p3-fillrows p3-preset-slots');
      const paths = slotPathsOf(p);
      for (const slot of ['duration', 'easing', 'delay'] as const) slotControl(p.preset, 'own', slot, paths[slot], paths.easing, readOnly, slots);
      row.append(slots);
      for (const a of advisories.filter((x) => x.preset === p.preset && x.half === 'own')) row.append(hook(stateLine(P.advisory[a.code] ?? a.code, 'warn'), 'preset-advisory'));
      if (p.exit) {
        const open = exitsOpen.has(p.preset);
        const toggle = hook(h('button', 'p3-btn p3-btn-page p3-preset-exit-toggle'), 'preset-exit-toggle');
        toggle.type = 'button';
        toggle.dataset.preset = p.preset;
        toggle.setAttribute('aria-expanded', String(open));
        toggle.append(glyph(open ? 'chev' : 'chevr'), h('span', 'p3-btn-label', P.exit));
        toggle.onclick = () => { if (open) exitsOpen.delete(p.preset); else exitsOpen.add(p.preset); render(); };
        row.append(toggle);
        const exitAdv = advisories.filter((x) => x.preset === p.preset && x.half === 'exit');
        if (open) {
          const body = hook(h('div', 'p3-preset-exit'), 'preset-exit');
          const xp = slotPathsOf(p.exit);
          const exitSet = getPath(brandState, `motionPersonality.presets.${p.preset}.exit`) !== undefined;
          if (!exitSet) body.append(subLine(P.followsEntrance));
          const xs = h('div', 'p3-fillrows p3-preset-slots');
          for (const slot of ['duration', 'easing', 'delay'] as const) slotControl(p.preset, 'exit', slot, xp[slot], xp.easing, readOnly, xs);
          body.append(xs);
          row.append(body);
        }
        // An exit's advisory shows with its disclosure closed too, so an objection is never hidden.
        for (const a of exitAdv) row.append(hook(stateLine(`${P.exit}: ${P.advisory[a.code] ?? a.code}`, 'warn'), 'preset-advisory'));
      }
      list.append(row);
      said.push(p.preset);
    }
    b.ctl.append(list);
    return { el: b.el, said: `${b.said} ${s.title} ${said.join(' ')}`.toLowerCase(), key: 'motionPersonality.presets', block: b };
  };

  // ── the sections ──────────────────────────────────────────────────────────────────────────────
  const sectionShell = (title: string, desc: string | undefined, i: number): HTMLElement => {
    const el = hook(h('section', 'p3-lsec'), 'lever-section');
    el.id = `p3-lsec-motion-${i}`;
    const head = h('div', 'p3-lsec-head');
    const t = h('h2', 'p3-lsec-title', title);
    t.id = `${el.id}-t`;
    head.append(t);
    if (desc) head.append(h('p', 'p3-lsec-desc', desc));
    el.append(head);
    if (!light() && !derived() && i === 0) el.append(hook(subLine(MOTION_COPY.editing(modeLabel(currentMode))), 'motion-editing'));
    return el;
  };

  const shape = (): string => JSON.stringify([currentMode, !!searchQuery.trim(), openPick, [...exitsOpen], lastError && lastEdited,
    getPath(brandState, 'motionPersonality'), light() ? null : [tempoOverride(currentMode), getPath(brandState, `modeLevers.${currentMode}.easings`)]]);

  const render = (): void => {
    const { key: focusKey, again } = keepFocus(root);
    const scrollTop = host.scrollTop;
    shapeKey = shape();
    items = [];
    pickFocus = null;
    const parts: HTMLElement[] = [h('p', 'p3-intro', PAGE.intro)];
    const mot = section('Motion');
    const m = sectionShell(mot.title, mot.desc, 0);
    const t = tempo();
    const ez = easing();
    m.append(t.el, ez.el);
    const pre = section('Presets');
    const ps = sectionShell(pre.title, pre.desc, 1);
    const pr = presets();
    ps.append(pr.el);
    // The Presets title says it once (owner, 2026-11-27): the lever's own label, "Motion presets", stays in the
    // manifest for wherever settings list on their own, and its info button moves up beside the title.
    promoteLever(ps, pr.block);
    items.push(t, ez, pr);
    parts.push(m, ps);
    const next = hook(h('button', 'p3-btn p3-btn-page p3-next'), 'motion-continue');
    next.type = 'button';
    next.append(h('span', 'p3-btn-label', MOTION_COPY.next), glyph('chevr'));
    next.onclick = () => setPage(pageOfTab('layout'));
    const nr = h('div', 'p3-nextrow');
    nr.append(next);
    parts.push(nr);
    root.replaceChildren(...parts);
    for (const it of items) it.block.setRefused(!!lastError && !!lastEdited && it.key === lastEdited);
    filter();
    if (focusPick && pickFocus) { focusPick = false; (pickFocus as () => void)(); }
    else if (focusKey) again()?.focus({ preventScroll: true });
    if (host.scrollTop !== scrollTop) host.scrollTop = scrollTop;
  };

  const filter = (): void => filterLevers(root, items);

  cleanups.push(subscribe('brand', () => {
    if (shape() !== shapeKey) { render(); return; }
    for (const it of items) it.block.setRefused(!!lastError && !!lastEdited && it.key === lastEdited);
  }));
  cleanups.push(subscribe('mode', () => { openPick = null; render(); }));
  cleanups.push(subscribe('search', () => { if (shape() !== shapeKey) render(); else filter(); }));
  cleanups.push(() => { if (searchQuery.trim()) setSearchHits(null); });
  render();
};

