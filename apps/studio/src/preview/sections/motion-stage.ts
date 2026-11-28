/** The motion stage (#4571, the motion editor's PR 3; `docs/superpowers/motion-editor-proposal.md` §3.1, §3.2 and
 *  wireframes A and B): each preset playing on what it moves, and each component pattern in context, with its timeline.
 *
 *  WHAT IT DRAWS. A Preset choice, Play or Replay and the Slow motion choice; "Used by", one chip per pattern that names
 *  the chosen preset or its exit half (`patternsReachedBy`, from the patterns the engine resolved), a click playing that
 *  one; the stage, the pattern drawn over a small page in the brand's paints; and under it the timeline, one bar per
 *  track (element · property), its length the track's duration and its offset the track's delay, labeled with the
 *  preset's name (§3.2). A preset no pattern names yet plays on a plain specimen (§3.1 item 2): a square that fades and
 *  rises for reveal and settle, a line drawn on for draw, a row of cards that advances for step. What each specimen
 *  does is the owner's (it is in the PR's owner questions), so the drawing lives in `SPECIMENS` alone.
 *
 *  THE RULE (§3, held by `test-plays-the-data.ts` in Chromium): every moving element's transition is the timing its
 *  track's preset resolves to, in the mode in view, and nothing else. `trackTiming` is the one place a timing is read,
 *  from `theme.motion` (the resolved presets, the mode's duration ramp, its easing roles, the springs and the delays).
 *  No timing is typed here. The gate reads the same values from the emitted token tree instead, so a timing written
 *  here, or read from the wrong mode, fails it by pattern and track.
 *
 *  WHEN IT PLAYS is the caller's (`preview/motion.ts`), as for the traces (D9 A): once after a Motion edit, and on Play
 *  or Replay; never by itself under reduced motion. At rest an entrance and a change show their end, and an exit its
 *  start; an exit snaps back to its start a moment after it plays (`EXIT_HOLD_MS`), so the stage is never left empty.
 *  The Slow motion divisor stretches durations and delays alike, for legibility only; the timeline's labels stay the
 *  real values.
 *
 *  Each moving element carries `data-motion-pattern` (the pattern's name, or `specimen:<preset>`) and
 *  `data-motion-element`, and each timeline bar `data-motion-track` and `data-preset`: what the gate finds them by.
 *
 *  WHAT IT IS HANDED. The style-guide context, the resolved motion axis, the mode in view, a distance resolver, the
 *  view state and the block's copy. Nothing here reads the session. */
import { springLinearEasing, trackKey, type MotionPattern, type MotionTrack, type Theme } from '@prism3/engine';
import { el, hook, subHead, viewOnly, type SgCtx } from './kit';
import { curveOfRole } from './motion-curves';
import { MOTION_SLOWMO_OPTIONS } from './motion-transitions';

type Motion = Theme['motion'];

/** One track's timing in `mode`: its duration and delay in ms, and its easing as CSS. */
export type TrackTiming = { ms: number; delayMs: number; easing: string };

/** The timing a preset path (`surface`, `surface.exit`) resolves to in `mode`. The one read of a timing in the stage. */
export const trackTiming = (mo: Motion, mode: string, presetPath: string): TrackTiming => {
  const exit = presetPath.endsWith('.exit');
  const name = exit ? presetPath.slice(0, -'.exit'.length) : presetPath;
  const p = mo.presets.find((x) => x.preset === name);
  const half = exit ? p?.exit : p;
  if (!half) throw new Error(`motion stage: no preset '${presetPath}'`);
  const steps = mo.motionByMode?.[mode]?.duration ?? mo.duration;
  const ms = 'step' in half.duration ? steps[half.duration.step] : mo.springSettle[half.duration.spring];
  if (ms === undefined) throw new Error(`motion stage: preset '${presetPath}' has no duration in ${mode}`);
  let easing: string;
  if ('spring' in half.easing) {
    const s = mo.spring[half.easing.spring];
    if (!s) throw new Error(`motion stage: no spring '${half.easing.spring}'`);
    easing = springLinearEasing(s);
  } else {
    const curve = 'role' in half.easing ? curveOfRole(mo, mode, half.easing.role) : half.easing.curve;
    const b = mo.easing[curve];
    if (!b) throw new Error(`motion stage: no curve '${curve}'`);
    easing = `cubic-bezier(${b.join(', ')})`;
  }
  const delayMs = half.delay === null ? 0 : mo.delay[half.delay];
  if (delayMs === undefined) throw new Error(`motion stage: no delay '${half.delay}'`);
  return { ms, delayMs, easing };
};

/** The CSS properties a track's property group moves (Q-MS7 A). */
export const CSS_OF: Record<MotionTrack['property'], readonly string[]> = {
  opacity: ['opacity'], transform: ['transform'], size: ['height'], color: ['background-color', 'color'],
};

/** The components that arrive over a page, so the stage draws one behind them. */
const OVERLAYS: readonly string[] = ['dialog', 'toast', 'tooltip', 'popover', 'fade'];

/** How long an exit holds its end before the stage snaps back to its start, in ms. View behavior, not a timing. */
const EXIT_HOLD_MS = 600;

/** A specimen pattern for a preset no pattern names (§3.1 item 2). DRAFT, the owner's: each is the proposal's words. */
const SPECIMENS: Record<string, (preset: string) => MotionPattern> = {
  reveal: (p) => ({ name: `specimen:${p}`, half: 'enter', tracks: [
    { element: 'square', property: 'opacity', preset: p }, { element: 'square', property: 'transform', transform: 'slide', from: 'below', distance: { token: 'distance.nudge' }, preset: p }] }),
  settle: (p) => SPECIMENS.reveal!(p),
  draw: (p) => ({ name: `specimen:${p}`, half: 'change', tracks: [{ element: 'line', property: 'transform', transform: 'travel', preset: p }] }),
  step: (p) => ({ name: `specimen:${p}`, half: 'change', tracks: [{ element: 'cards', property: 'transform', transform: 'travel', preset: p }] }),
};
/** The specimen for any other preset a brand's track override leaves unnamed: a square that fades in. */
const plainSpecimen = (p: string): MotionPattern => ({ name: `specimen:${p}`, half: 'enter', tracks: [{ element: 'square', property: 'opacity', preset: p }] });
export const specimenOf = (preset: string): MotionPattern => (SPECIMENS[preset] ?? plainSpecimen)(preset);

export type StageCopy = {
  readonly title: string; readonly desc: string; readonly preset: string; readonly usedBy: string; readonly specimen: string;
  readonly timeline: string; readonly play: string; readonly replay: string; readonly slow: string; readonly off: string; readonly reduced: string;
  readonly ms: (ms: number) => string; readonly delay: (ms: number) => string; readonly pattern: (name: string) => string;
};

export type StageState = {
  preset: string; pattern: string | null; slowmo: number; played: boolean; reduced: boolean;
  onPick: (preset: string, pattern: string | null) => void; onSlowmo: (v: number) => void; onPlay: () => void;
};

/** The two looks each moving element alternates between, and its transition. */
type Mover = { el: HTMLElement; from: Record<string, string>; to: Record<string, string>; props: string[]; timings: TrackTiming[] };

export const motionStageSection = (
  c: SgCtx, mo: Motion, mode: string, distancePx: (token: string) => number, s: StageState, copy: StageCopy,
): { node: HTMLElement; play: () => void } => {
  const patterns = mo.patterns ?? [];
  const wrap = hook(el('div', 'dm-block'), 'motion-stage-block');
  wrap.dataset.sgSection = 'motion-stage';
  wrap.append(subHead(copy.title), el('p', 'dm-desc', copy.desc));

  // ── the toolbar: the preset, Play, Slow motion ────────────────────────────────────────────────
  const bar = el('div', 'mo-toolbar');
  const presetLabel = el('label', 'mo-slowmo');
  presetLabel.append(document.createTextNode(`${copy.preset} `));
  const presetSel = hook(viewOnly(el('select', 'p3-select p3-mo-preset')), 'motion-stage-preset') as HTMLSelectElement;
  for (const p of mo.presets) {
    const o = el('option', undefined, p.preset) as HTMLOptionElement;
    o.value = p.preset;
    if (p.preset === s.preset) o.selected = true;
    presetSel.append(o);
  }
  presetSel.onchange = () => s.onPick(presetSel.value, null);
  presetLabel.append(presetSel);
  const btn = hook(el('button', 'p3-btn p3-btn-page p3-mo-play', s.played ? copy.replay : copy.play), 'motion-stage-play') as HTMLButtonElement;
  btn.type = 'button';
  const slowLabel = el('label', 'mo-slowmo');
  slowLabel.append(document.createTextNode(`${copy.slow} `));
  const slowSel = hook(viewOnly(el('select', 'p3-select p3-mo-slowmo')), 'motion-stage-slowmo') as HTMLSelectElement;
  for (const v of MOTION_SLOWMO_OPTIONS) {
    const o = el('option', undefined, v === 1 ? copy.off : `1/${v}`) as HTMLOptionElement;
    o.value = String(v);
    if (v === s.slowmo) o.selected = true;
    slowSel.append(o);
  }
  slowSel.onchange = () => s.onSlowmo(Number(slowSel.value) || 1);
  slowLabel.append(slowSel);
  bar.append(presetLabel, btn, slowLabel);
  wrap.append(bar);
  if (s.reduced) wrap.append(hook(el('p', 'dm-desc', copy.reduced), 'motion-stage-reduced'));

  // ── Used by ──────────────────────────────────────────────────────────────────────────────────
  const users = patterns.filter((p) => p.tracks.some((t) => t.preset === s.preset || t.preset === `${s.preset}.exit`));
  const chosen = users.find((p) => p.name === s.pattern) ?? users[0] ?? specimenOf(s.preset);
  const used = hook(el('div', 'mo-usedby'), 'motion-used-by');
  used.setAttribute('role', 'group');
  used.setAttribute('aria-label', `${copy.usedBy}: ${s.preset}`);
  used.append(el('span', 'mo-usedby-lab', copy.usedBy));
  if (!users.length) used.append(hook(el('span', 'mo-usedby-none', copy.specimen), 'motion-used-by-none'));
  for (const p of users) {
    const chip = hook(el('button', 'p3-btn p3-btn-page mo-usedby-chip', copy.pattern(p.name)), 'motion-used-by-chip') as HTMLButtonElement;
    chip.type = 'button';
    chip.dataset.pattern = p.name;
    chip.setAttribute('aria-pressed', String(p === chosen));
    chip.onclick = () => s.onPick(s.preset, p.name);
    used.append(chip);
  }
  wrap.append(used);

  // ── the stage ────────────────────────────────────────────────────────────────────────────────
  const stage = hook(el('div', 'mo-scene'), 'motion-scene');
  stage.dataset.pattern = chosen.name;
  stage.style.background = c.paint(c.cur, 'background.primary');
  // The page behind: a few faint lines, so a scrim and an end panel read at their scale.
  // Only behind what arrives over a page (a dialog, a toast, a tooltip, a popover, the generic fade); an in-place
  // pattern plays on the page alone.
  if (OVERLAYS.includes(chosen.name.split('/')[0]!)) {
    const page = el('div', 'mo-scene-page');
    for (let i = 0; i < 4; i++) { const l = el('div', 'mo-scene-line'); l.style.background = c.paint(c.cur, 'border.secondary'); page.append(l); }
    stage.append(page);
  }
  const movers = drawPattern(c, mo, mode, chosen, stage, distancePx, s.slowmo);
  // A specimen's caption is its preset's name (owner, #4665); a pattern's is its engine name and its placement.
  const cap = chosen.name.startsWith('specimen:') ? s.preset : `${chosen.name}${chosen.label ? ` · ${chosen.label}` : ''}`;
  wrap.append(stage, el('p', 'mo-scene-cap', cap));

  // ── the timeline ─────────────────────────────────────────────────────────────────────────────
  const rows = chosen.tracks.map((t) => ({ t, tm: trackTiming(mo, mode, t.preset) }));
  const total = Math.max(1, ...rows.map((r) => r.tm.delayMs + r.tm.ms));
  const tl = hook(el('div', 'mo-timeline'), 'motion-timeline');
  tl.setAttribute('role', 'list');
  tl.setAttribute('aria-label', `${copy.timeline}: ${chosen.name}`);
  for (const { t, tm } of rows) {
    const row = hook(el('div', 'mo-tl-row'), 'motion-timeline-row');
    row.setAttribute('role', 'listitem');
    row.append(el('span', 'mo-tl-name mono', `${t.element} · ${t.property}`));
    const lane = el('div', 'mo-tl-lane');
    const b = hook(el('div', 'mo-tl-bar'), 'motion-timeline-bar');
    b.dataset.motionTrack = trackKey(t);
    b.dataset.preset = t.preset;
    b.style.left = `${(tm.delayMs / total) * 100}%`;
    b.style.width = `${(tm.ms / total) * 100}%`;
    lane.append(b);
    // The preset's name sits beside the lane, not on the bar: on the page's own ink, at any bar's length.
    row.append(lane, el('span', 'mo-tl-ms mono', `${t.preset} · ${copy.ms(tm.ms)}${tm.delayMs ? ` · ${copy.delay(tm.delayMs)}` : ''}`));
    tl.append(row);
  }
  wrap.append(tl);

  let snapBack: ReturnType<typeof setTimeout> | undefined;
  const longest = Math.max(0, ...movers.flatMap((m) => m.timings.map((t) => t.delayMs + t.ms))) * s.slowmo;
  /** Play the pattern once: jump to its start with no transition, force a reflow, then move to its end. */
  const play = (): void => {
    clearTimeout(snapBack);
    for (const m of movers) { m.el.style.transition = 'none'; Object.assign(m.el.style, m.from); }
    void stage.offsetWidth;
    for (const m of movers) { setTransition(m, s.slowmo); Object.assign(m.el.style, m.to); }
    if (chosen.half === 'exit') snapBack = setTimeout(() => {
      for (const m of movers) { m.el.style.transition = 'none'; Object.assign(m.el.style, m.from); }
      void stage.offsetWidth;
      for (const m of movers) setTransition(m, s.slowmo);
    }, longest + EXIT_HOLD_MS);
  };
  btn.onclick = () => { s.onPlay(); play(); btn.textContent = copy.replay; };
  return { node: wrap, play };
};

/** Write a mover's transition: one entry per CSS property its tracks move, each on its own track's timing. */
const setTransition = (m: Mover, slowmo: number): void => {
  m.el.style.transition = '';
  m.el.style.transitionProperty = m.props.join(', ');
  m.el.style.transitionDuration = m.timings.map((t) => `${t.ms * slowmo}ms`).join(', ');
  m.el.style.transitionTimingFunction = m.timings.map((t) => t.easing).join(', ');
  m.el.style.transitionDelay = m.timings.map((t) => `${t.delayMs * slowmo}ms`).join(', ');
};

/** Draw a pattern's elements into `stage` and work out each one's two looks. At rest: an exit at its start, anything
 *  else at its end. */
const drawPattern = (c: SgCtx, mo: Motion, mode: string, p: MotionPattern, stage: HTMLElement, distancePx: (t: string) => number, slowmo: number): Mover[] => {
  const paint = (k: string): string => c.paint(c.cur, k);
  const make = (cls: string, name: string, bg?: string): HTMLElement => {
    const e = el('div', `mo-el ${cls}`);
    e.dataset.motionPattern = p.name;
    e.dataset.motionElement = name;
    if (bg) e.style.background = paint(bg);
    return e;
  };
  const comp = p.name.startsWith('specimen:') ? p.name : p.name.split('/')[0]!;
  const placement = p.name.split('/')[1];
  const els = new Map<string, HTMLElement>();
  const add = (name: string, e: HTMLElement, into: HTMLElement = stage): HTMLElement => { els.set(name, e); into.append(e); return e; };

  // The elements each component draws, named as its tracks name them.
  if (comp === 'dialog') {
    add('scrim', make('mo-scrim', 'scrim', 'scrim.default'));
    const panel = add('panel', make(placement === 'bottom' ? 'mo-panel mo-panel-bottom' : placement === 'end' ? 'mo-panel mo-panel-end' : 'mo-panel', 'panel', 'foreground.raised'));
    const content = make('mo-content', 'content');
    for (const w of ['70%', '90%', '55%']) { const l = el('div', 'mo-bar'); l.style.width = w; l.style.background = paint('border.primary'); content.append(l); }
    if (p.tracks.some((t) => t.element === 'content')) add('content', content, panel);
    else { delete content.dataset.motionPattern; delete content.dataset.motionElement; panel.append(content); }
  } else if (comp === 'toast') add('toast', make('mo-toast', 'toast', 'foreground.raised'));
  else if (comp === 'tooltip') add('tooltip', make('mo-tooltip', 'tooltip', 'foreground.raised'));
  else if (comp === 'popover') add('popover', make('mo-popover', 'popover', 'foreground.raised'));
  else if (comp === 'fade') add('element', make('mo-square', 'element', 'interactive.primary.fill.rest'));
  else if (comp === 'accordion') {
    const acc = el('div', 'mo-acc');
    acc.style.borderColor = paint('border.primary');
    const head = el('div', 'mo-acc-head');
    const bar = el('div', 'mo-bar'); bar.style.width = '50%'; bar.style.background = paint('border.primary');
    head.append(bar, add('indicator', make('mo-acc-ind', 'indicator'), head));
    els.get('indicator')!.style.borderColor = paint('icon.primary');
    acc.append(head);
    const panel = add('panel', make('mo-acc-panel', 'panel'), acc);
    for (const w of ['80%', '60%']) { const l = el('div', 'mo-bar'); l.style.width = w; l.style.background = paint('border.secondary'); panel.append(l); }
    stage.append(acc);
  } else if (comp === 'hover' || comp === 'pressed') add('control', make('mo-control', 'control'));
  else if (comp === 'tabs') {
    const tabs = el('div', 'mo-tabs');
    tabs.style.borderColor = paint('border.secondary');
    for (let i = 0; i < 3; i++) { const l = el('div', 'mo-bar mo-tab'); l.style.background = paint('border.primary'); tabs.append(l); }
    add('underline', make('mo-underline', 'underline', 'interactive.primary.indicator.rest'), tabs);
    stage.append(tabs);
    add('panel', make('mo-tabpanel', 'panel', 'background.secondary'));
  } else if (comp === 'switch') {
    const track = add('track', make('mo-switch', 'track'));
    add('thumb', make('mo-thumb', 'thumb', 'interactive.primary.on-fill'), track);
  } else if (comp === 'segmented') {
    const seg = el('div', 'mo-seg');
    seg.style.borderColor = paint('border.primary');
    add('pill', make('mo-pill', 'pill', 'interactive.primary.fill.rest'), seg);
    add('label', make('mo-seglabel', 'label'), seg);
    stage.append(seg);
  } else if (p.tracks.some((t) => t.element === 'line')) add('line', make('mo-line', 'line', 'interactive.primary.fill.rest'));
  else if (p.tracks.some((t) => t.element === 'cards')) {
    const win = el('div', 'mo-cardwin');
    const row = add('cards', make('mo-cards', 'cards'), win);
    for (let i = 0; i < 4; i++) { const k = el('div', 'mo-card'); k.style.background = paint('foreground.raised'); k.style.borderColor = paint('border.secondary'); row.append(k); }
    stage.append(win);
  } else add('square', make('mo-square', 'square', 'interactive.primary.fill.rest'));

  // Each track's two looks, by its property group and what its transform does.
  const looks = (t: MotionTrack): [Record<string, string>, Record<string, string>] => {
    const inOut = <T extends Record<string, string>>(hidden: T, shown: T): [T, T] => (p.half === 'exit' ? [shown, hidden] : [hidden, shown]);
    if (t.property === 'opacity') {
      if (comp === 'tabs') return [{ opacity: '0.3' }, { opacity: '1' }];
      return inOut({ opacity: '0' }, { opacity: '1' });
    }
    if (t.property === 'size') return comp === 'accordion' && p.half === 'exit' ? [{ height: '44px' }, { height: '0px' }] : [{ height: '0px' }, { height: '44px' }];
    if (t.property === 'color') {
      if (comp === 'hover') return [{ backgroundColor: paint('interactive.primary.fill.rest') }, { backgroundColor: paint('interactive.primary.fill.hover') }];
      if (comp === 'pressed' && placement === 'release') return [{ backgroundColor: paint('interactive.primary.fill.pressed') }, { backgroundColor: paint('interactive.primary.fill.hover') }];
      if (comp === 'pressed') return [{ backgroundColor: paint('interactive.primary.fill.hover') }, { backgroundColor: paint('interactive.primary.fill.pressed') }];
      if (comp === 'switch') return [{ backgroundColor: paint('interactive.neutral.fill.rest') }, { backgroundColor: paint('interactive.primary.fill.rest') }];
      return [{ backgroundColor: paint('text.tertiary') }, { backgroundColor: paint('interactive.primary.on-fill') }];
    }
    // transform
    if (t.transform === 'scale') {
      const sc = `scale(${t.scale ?? 1})`;
      if (comp === 'pressed') return placement === 'release' ? [{ transform: sc }, { transform: 'none' }] : [{ transform: 'none' }, { transform: sc }];
      return inOut({ transform: sc }, { transform: 'none' });
    }
    if (t.transform === 'slide') {
      const d = !t.distance || 'self' in t.distance ? '100%' : 'px' in t.distance ? `${t.distance.px}px` : `${distancePx(t.distance.token)}px`;
      const off = t.from === 'end' ? `translateX(${d})` : `translateY(${d})`;
      return inOut({ transform: off }, { transform: 'none' });
    }
    if (t.transform === 'turn') return p.half === 'exit' ? [{ transform: 'rotate(180deg)' }, { transform: 'none' }] : [{ transform: 'none' }, { transform: 'rotate(180deg)' }];
    // travel: the underline, thumb and pill move one stop; the draw specimen's line grows from its start; step's cards advance one.
    if (comp.startsWith('specimen:') && t.element === 'line') return [{ transform: 'scaleX(0)' }, { transform: 'none' }];
    if (t.element === 'cards') return [{ transform: 'none' }, { transform: 'translateX(-25%)' }];
    return [{ transform: 'none' }, { transform: 'translateX(100%)' }];
  };

  const movers: Mover[] = [];
  for (const [name, e] of els) {
    const tracks = p.tracks.filter((t) => t.element === name);
    if (!tracks.length) continue;
    const m: Mover = { el: e, from: {}, to: {}, props: [], timings: [] };
    for (const t of tracks) {
      const tm = trackTiming(mo, mode, t.preset);
      const [a, b] = looks(t);
      Object.assign(m.from, a);
      Object.assign(m.to, b);
      for (const css of CSS_OF[t.property]) { m.props.push(css); m.timings.push(tm); }
    }
    Object.assign(e.style, p.half === 'exit' ? m.from : m.to);
    setTransition(m, slowmo);
    movers.push(m);
  }
  return movers;
};
