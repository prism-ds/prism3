/**
 * Depth, the preview (UI redesign S9.2; concept v6's V4). #4571 (owner decision Q-ME3 A) moved its Motion section to
 * the Motion tab's own preview (`preview/motion.ts`), so this one holds the shadow.
 *
 * WHAT IT SHOWS, in the legacy Style guide's markup (owner direction for the domain previews, as Type's): one section,
 * headed and described as the lever section it pairs with (Q23). **Elevation**: the seven shadows, xs to 2xl and
 * `inset` set apart, each a card in the brand's page color with its token and CSS; then the shadow color at full
 * strength and as painted (owner decision D7 A). All of it in the previewed mode only.
 *
 * LEGACY MARKUP IN A LIGHT-PINNED HOST, SPECIMENS ON THE BRAND'S PAGE (plan §9.1), as `preview/type.ts`: the section's
 * ground is a specimen root painted with the brand's own `background.primary` for the mode the preview shows, and the
 * section container takes the levers panel's gray (owner decision Q24, `p3-sgsec`).
 *
 * HOW IT REPAINTS: by store subscription (`brand`, `mode`), never through a legacy tier. Nothing else moves it but an
 * edit's reveal (QA-B9), which the frame runs: no scroll, no focus, no lever (V1).
 */
import { currentMode, rp, subscribe, theme } from '../state/store';
import { resolvedModes } from '../state/verdict';
import { h, hook } from '../shell/dom';
import { DOMAINS, type PageData } from '../shell/pages';
import { modeLabel } from '../shell/preview';
import { shadowRampSection, shadowTintSection } from './sections/index';
import { SG_SURFACES, ground, oppositeOf, palSection, sgContext, type SgRole } from './sections/kit';
import { must } from '../must';

const PAGE = DOMAINS.find((d) => d.id === 'depth') as PageData;
/** A lever section's heading and description, from the page data the levers draw them from (Q23). */
const copyOf = (title: string): { title: string; desc: string } => ({ title, desc: PAGE.sections.find((x) => x.title === title)?.desc ?? '' });

/** The preview's own copy. APPROVED (owner, 2026-10-04) unless marked DRAFT; the DRAFT strings are in the S9.2
 *  fragment's "Copy for owner approval" block. */
export const DEPTH_PREVIEW_COPY = {
  shadowsTitle: 'Shadows',                                            // DRAFT (concept v6's board title)
  color: {
    title: 'Shadow color',                                            // DRAFT
    full: 'Full strength',                                            // DRAFT
    painted: 'As painted, 12%',                                       // DRAFT
    note: 'Shadows paint this color at 10–14% opacity, so the hue reads far subtler than on the swatch.',
  },
} as const;

/** Mount the Depth & motion preview into `host`. Subscriptions are released through `cleanups`. */
export const mountDepthPreview = (host: HTMLElement, cleanups: (() => void)[]): void => {
  const stack = hook(h('div', 'p3-stack p3-preview-stack'), 'depth-preview');
  const card = hook(h('div', 'p3-legacy-card'), 'depth-style-guide');
  card.dataset.theme = 'light';
  stack.append(card);
  host.replaceChildren(stack);

  const paint = (): void => {
    const all = resolvedModes(theme);
    const rolesByMode = new Map<string, Record<string, SgRole | undefined>>(all.map((x) => [x.mode as string, x.roles as Record<string, SgRole | undefined>]));
    const cur: string = rolesByMode.has(currentMode) ? currentMode : must(rp.modes[0], 'the first mode');
    const c = sgContext({
      rolesByMode, cur, opp: oppositeOf(cur, rp.modes, (m) => rolesByMode.has(m)), namespace: theme.namespace, modeLabel, badges: false,
      paletteHex: (p, s) => theme.palettes.find((x) => x.palette === p)?.steps.find((x) => x.key === s)?.hex ?? null,
    });
    const page = SG_SURFACES[0];
    const C = DEPTH_PREVIEW_COPY;

    const elev = copyOf('Elevation');
    const e = palSection(elev.title, elev.desc);
    e.append(shadowRampSection(c, rp.shadows, cur, { title: C.shadowsTitle }), shadowTintSection(theme.shadow, cur, C.color));

    const secs = [e];
    // Q24: each section's container on the levers panel's gray, as the other previews' are.
    for (const s of secs) s.classList.add('p3-sgsec');
    card.replaceChildren(...secs.map((s) => ground(c, s, page)));

  };
  cleanups.push(subscribe('brand', () => paint()), subscribe('mode', () => paint()));
  paint();
};
