/**
 * The motion stage (#4571, the motion editor's PR 3; the proposal's §3.1 and §3.2): one preset playing on a pattern
 * that names it, over a small page, with a timeline of its tracks under it.
 *
 * WHAT IT PLAYS: the engine's own data, never a timing of its own. Each track's milliseconds, easing and delay come
 * from `patternPlayback` (the preset the track names, resolved in the mode in view: the mode's tempo, a role followed to
 * the mode's curve, a spring's `linear()`), and are written as a CSS transition on the element the track moves. The
 * plays-the-data gate (`test:chrome` section `4571-play`) reads each element's computed transition back and holds it to
 * the emitted token tree, so a timing typed here fails by the pattern and track it plays.
 *
 * A PRESET NO PATTERN NAMES (`reveal`, `draw`, `step`, `settle`) plays on a plain specimen (the proposal's §3.1): one
 * element, its tracks on that preset alone. What each specimen does is visual design, so it is DRAFT (#4571).
 *
 * WHAT IT DRAWS each element as: a block painted in the brand's own roles for the mode (the page, a raised surface, the
 * scrim, the primary fill), so a dialog reads as one at the brand's colors. The shapes are DRAFT (#4571): stand-ins for
 * the components, not the components themselves.
 *
 * View state only: the chosen preset and pattern live in the caller, never in the brand.
 */
import { patternPlayback, type TrackPlayback } from '@prism3/engine';
import type { Theme } from '@prism3/engine';
import { el, hook, subHead, viewOnly } from './kit';

type Pattern = NonNullable<Theme['motion']['patterns']>[number];
type Track = Pattern['tracks'][number];

export type StageCopy = {
  readonly title: string; readonly desc: string;
  readonly preset: string; readonly play: string; readonly usedBy: string; readonly specimen: string;
  readonly timeline: string; readonly track: (element: string, property: string) => string;
};

/** The plain specimen a preset no pattern names plays on (DRAFT, #4571): a square that fades and rises for reveal and
 *  settle, a line drawn on for draw, a card that advances for step. */
export const specimenPattern = (preset: string): Pattern => {
  const t = (property: Track['property'], more: Partial<Track> = {}): Track => ({ element: 'specimen', property, preset, ...more });
  const tracks = preset === 'draw' ? [t('transform', { transform: 'scale', scale: 0.01 })]
    : preset === 'step' ? [t('transform', { transform: 'travel' })]
    : [t('opacity'), t('transform', { transform: 'slide', from: 'below', distance: { token: 'distance.nudge' } })];
  return { name: `specimen/${preset}`, half: preset === 'draw' || preset === 'step' ? 'change' : 'enter', tracks };
};

/** The CSS property a track's property group moves. */
const cssProp = (t: Track): string => (t.property === 'opacity' ? 'opacity' : t.property === 'transform' ? 'transform' : t.property === 'color' ? 'background-color' : 'height');

/** A track's two ends, `[from, to]`, for the half it plays in. A release plays its press backward. */
const endsOf = (t: Track, p: Pattern, pb: TrackPlayback, ink: { rest: string; on: string }): [string, string] => {
  let ends: [string, string];
  if (t.property === 'opacity') ends = p.half === 'change' ? ['0.35', '1'] : ['0', '1'];
  else if (t.property === 'color') ends = [ink.rest, ink.on];
  else if (t.property === 'size') ends = ['0px', '48px'];
  else if (t.transform === 'scale') ends = [`scale(${t.scale ?? 1})`, 'none'];
  else if (t.transform === 'slide') ends = [t.from === 'bottom' ? 'translateY(100%)' : t.from === 'end' ? 'translateX(100%)' : `translateY(${pb.distancePx ?? 8}px)`, 'none'];
  else if (t.transform === 'turn') ends = ['rotate(0deg)', 'rotate(180deg)'];
  else ends = ['translateX(0px)', 'translateX(48px)'];
  // An exit, and a press (its scale goes down), play from the end back to the start.
  const backward = p.half === 'exit' || (p.half === 'change' && t.transform === 'scale' && !p.name.endsWith('/release'));
  return backward ? [ends[1], ends[0]] : ends;
};

/** Draw `pattern` on a small page and return how to play it. `paint` reads a color role in the mode in view. */
export const motionStageSection = (
  mo: Theme['motion'], mode: string,
  view: { preset: string; pattern: string | null; slowmo: number; onPreset: (p: string) => void; onPattern: (p: string) => void },
  paint: (role: string) => string, copy: StageCopy,
): { node: HTMLElement; play: () => void } => {
  const wrap = hook(el('div', 'dm-block'), 'motion-stage');
  wrap.dataset.sgSection = 'motion-stage';
  wrap.append(subHead(copy.title), el('p', 'dm-desc', copy.desc));

  const patterns = mo.patterns ?? [];
  const using = patterns.filter((p) => p.tracks.some((t) => t.preset === view.preset || t.preset === `${view.preset}.exit`));
  const pattern = using.find((p) => p.name === view.pattern) ?? using[0] ?? specimenPattern(view.preset);
  wrap.dataset.pattern = pattern.name;

  // The toolbar: which preset, and Play. The chrome's own select and page button (#4188): they steer the preview.
  const bar = el('div', 'mo-toolbar');
  const lab = el('label', 'mo-slowmo');
  lab.append(document.createTextNode(`${copy.preset} `));
  const sel = hook(viewOnly(el('select', 'p3-select')), 'motion-stage-preset') as HTMLSelectElement;
  for (const p of mo.presets) {
    const o = el('option', undefined, p.preset) as HTMLOptionElement;
    o.value = p.preset;
    if (p.preset === view.preset) o.selected = true;
    sel.append(o);
  }
  sel.onchange = () => view.onPreset(sel.value);
  lab.append(sel);
  const btn = hook(el('button', 'p3-btn p3-btn-page', copy.play), 'motion-stage-play') as HTMLButtonElement;
  btn.type = 'button';
  bar.append(lab, btn);
  wrap.append(bar);

  // Used by: a chip per pattern that names the preset; none, and the stage says it plays on a specimen.
  const chips = hook(el('div', 'mo-usedby'), 'motion-used-by');
  chips.append(el('span', 'dm-desc', using.length ? copy.usedBy : copy.specimen));
  for (const p of using) {
    const c = hook(el('button', 'p3-btn p3-btn-page mo-chip', p.name), 'motion-used-by-pattern') as HTMLButtonElement;
    c.type = 'button';
    c.dataset.pattern = p.name;
    c.setAttribute('aria-pressed', String(p.name === pattern.name));
    c.onclick = () => view.onPattern(p.name);
    chips.append(c);
  }
  wrap.append(chips);

  // The stage: the page, and one element per element the pattern moves, each painted in the brand's roles.
  const plays = patternPlayback(mo, pattern, mode);
  const page = el('div', 'mo-pstage');
  page.style.background = paint('background.secondary');
  const ink = { rest: paint('background.tertiary'), on: paint('interactive.primary.fill') };
  const FILL: Record<string, string> = {
    scrim: paint('scrim.default'), panel: paint('foreground.raised'), content: paint('background.tertiary'), toast: paint('foreground.raised'),
    tooltip: paint('inverse.background.primary'), popover: paint('foreground.raised'), indicator: paint('interactive.primary.fill'),
    underline: paint('interactive.primary.fill'), thumb: paint('foreground.raised'), track: ink.rest, pill: paint('foreground.raised'),
    label: ink.rest, control: paint('interactive.primary.fill'), element: paint('foreground.raised'), specimen: paint('interactive.primary.fill'),
  };
  const els = new Map<string, HTMLElement>();
  for (const pb of plays) {
    const name = pb.track.element;
    if (els.has(name)) continue;
    const n = hook(el('div', `mo-el mo-el-${name}`), 'motion-stage-element');
    n.dataset.element = name;
    n.style.background = FILL[name] ?? paint('foreground.raised');
    els.set(name, n);
    // The panel's content sits inside it, as a dialog's does.
    (name === 'content' && els.get('panel') ? els.get('panel')! : page).append(n);
  }
  wrap.append(page);

  // The timeline (§3.2): one bar per track, its length the preset's duration, offset by its delay.
  const total = Math.max(1, ...plays.map((p) => p.delayMs + p.ms));
  const tl = hook(el('div', 'mo-timeline'), 'motion-timeline');
  tl.append(el('p', 'dm-desc', `${copy.timeline} · ${total}ms`));
  for (const pb of plays) {
    const row = hook(el('div', 'mo-tl-row'), 'motion-timeline-row');
    row.dataset.track = `${pb.track.element}.${pb.track.property}`;
    row.append(el('span', 'mo-tl-name', copy.track(pb.track.element, pb.track.property)));
    const lane = el('span', 'mo-tl-lane');
    const barEl = el('span', 'mo-tl-bar', pb.preset);
    barEl.style.marginInlineStart = `${(pb.delayMs / total) * 100}%`;
    barEl.style.width = `${(pb.ms / total) * 100}%`;
    barEl.dataset.ms = String(pb.ms);
    barEl.dataset.delay = String(pb.delayMs);
    lane.append(barEl);
    row.append(lane, el('span', 'mo-tl-ms', `${pb.ms}ms`));
    tl.append(row);
  }
  wrap.append(tl);

  /** Set every element to its start, then, a frame later, to its end under the transitions the data gives. */
  const play = (): void => {
    const by = new Map<HTMLElement, TrackPlayback[]>();
    for (const pb of plays) { const n = els.get(pb.track.element)!; by.set(n, [...(by.get(n) ?? []), pb]); }
    for (const [n, list] of by) {
      n.style.transition = 'none';
      for (const pb of list) n.style.setProperty(cssProp(pb.track), endsOf(pb.track, pattern, pb, ink)[0]);
    }
    void page.offsetWidth;
    requestAnimationFrame(() => {
      for (const [n, list] of by) {
        n.dataset.tracks = list.map((pb) => `${pb.track.element}.${pb.track.property}`).join(' ');
        n.style.transition = list.map((pb) => `${cssProp(pb.track)} ${pb.ms * view.slowmo}ms ${pb.easing} ${pb.delayMs * view.slowmo}ms`).join(', ');
        for (const pb of list) n.style.setProperty(cssProp(pb.track), endsOf(pb.track, pattern, pb, ink)[1]);
      }
    });
  };
  btn.onclick = play;
  return { node: wrap, play };
};
