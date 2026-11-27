/**
 * Prism3 — THE SHADCN THEME HOLDS ITS CONTRAST, MEASURED ON THE EMITTED CSS (#2997 gate 1).
 *
 *   npx tsx packages/engine/lint-shadcn-contrast.ts
 *
 * Every ink-on-ground pair stock shadcn/ui draws from the theme must clear its floor in every brand and both modes,
 * measured on the CSS the projector emits, not assumed from the role map (#2997 Q3, CLAUDE.md principle 4).
 *
 * HOW IT MEASURES. The projector (`emit-shadcn.ts`) renders a fresh copy into a temp dir. Each brand's CSS is loaded
 * into headless Chromium; the ground is drawn opaque on a canvas and the ink composited over it, so `oklch()`, alpha and
 * the `.dark` switch are all the browser's work (`shadcn-browser.ts`). The ratio is WCAG 2's, written in that file.
 *
 * WHERE THE EXPECTATION COMES FROM (docs/34). `PAIRS` is typed here from shadcn's own usage (#2997 §5), never derived
 * from the map. The floor of each pair is the higher of its authored WCAG floor (4.5 text, 3 non-text) and the engine's
 * own `min` for the ink's mapped role in that mode, read from `<brand>.tokens.json`'s `$extensions.prism3`. So a remap to
 * a role with a stronger promise raises the bar, and a remap to a weaker role is still held to WCAG.
 *
 * KNOWN FAILURES. Owner decision Q2997.8 A: shadcn uses `destructive` and `primary` both as a fill and as text, and in
 * dark mode no one fill clears 4.5 against both white ink and the page. Those pairs are listed in `KNOWN`, per brand,
 * with the decision and the ratio accepted, and reported, not failed, while they hold that ratio; the engine question
 * is #4279. `KNOWN_PENDING` holds the regression fixture's pair the owner accepted on #4289 (owner decision 2026-11-19
 * A: a legacy fixture, not engine-derived). It is held the same way: to the ratio accepted, printed on every run, STALE
 * once it passes. Each floor is held from both sides (#4587; owner decision 2026-11-27): a pair below it fails as BELOW
 * ACCEPTED, and the floor itself is compared with the same entry's floor in the base's copy of this file, read from git
 * at the merge base (`baseFloors`, the ladder `shadcn-vars.ts` uses). A floor edited down fails as FLOOR LOWERED; a new
 * entry more than 0.01 below its measured ratio fails as SLACK; a pair that improved under an unchanged floor passes
 * with a WARNING line to record the new ratio as its floor. No base, or a base copy it cannot read, CANNOT RUN.
 *
 * MUTATION: map `muted-foreground` → `color.text.tertiary` and this fails `prism3 light: muted-foreground on muted 3.17 <
 * 4.5` by name. Emit prism3's dark `primary` as `oklch(0.25 0.1 266.7)` and it fails `prism3 dark: primary on background
 * 1.19 < 4.5 — BELOW ACCEPTED 4.24` by name: a known pair is held to the ratio the owner accepted, not muted at any ratio.
 * Darken nb's light `muted` and it fails `nb light: muted-foreground on muted … — BELOW ACCEPTED 3.77` by name.
 * Delete the ring rule from `SHADCN_BASE_CSS` (`emit-shadcn.ts`) and it fails `<brand> <mode>: ring/50 <form> on
 * background … < 3` by name, for every form in every brand; drop one form from `SHADCN_RING_FORMS` and it fails that
 * form's rows alone (`prism3 light: ring/50 slider on background 2.81 < 3`). Drop the rule's invalid exclusion and it
 * fails `<brand> <mode>: an invalid field lost its destructive/20 ring with the rule …` by name. Raise a `FADED` entry's floor in `KNOWN` above its measured ratio (or lower the ratio
 * under it) and it fails `… destructive/90 on card … — BELOW ACCEPTED …` by name. Lower a floor in a commit
 * (`prism3 light: destructive/90 on card` 3.97 → 3.00) and it fails `prism3 light: destructive/90 on card 3.97 < 4.5 —
 * FLOOR LOWERED KNOWN: floor 3, the base's floor 3.97 …` by name (#4587). Run it with no base ref (`GITHUB_BASE_REF`
 * naming a branch that does not exist) and it fails `no base ref — the floor-against-base arm CANNOT RUN …`.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitShadcn, handoffBrands } from './emit-shadcn.ts';
import { SHADCN_COLOR_VARS } from './projections/shadcn.ts';
import { floor2, openShadcnPage, wcagRatio, type RingProbe } from './shadcn-browser.ts';
import { isEntry } from './entry-point';
import { comparisonBase, mergeGroupBase } from './comparison-base.ts';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, 'out');

type Kind = 'text' | 'non-text';
/** [ink, ground, kind], typed from shadcn's usage (#2997 §5), never derived from the map. */
export const PAIRS: ReadonlyArray<readonly [string, string, Kind]> = [
  ['foreground', 'background', 'text'],
  ['card-foreground', 'card', 'text'],
  ['popover-foreground', 'popover', 'text'],
  ['primary-foreground', 'primary', 'text'],
  ['secondary-foreground', 'secondary', 'text'],
  ['muted-foreground', 'muted', 'text'],
  ['muted-foreground', 'background', 'text'],
  ['muted-foreground', 'card', 'text'],
  ['accent-foreground', 'accent', 'text'],
  ['destructive-foreground', 'destructive', 'text'],
  ['destructive', 'background', 'text'], // field error text, `text-destructive`
  ['destructive', 'card', 'text'],
  ['primary', 'background', 'text'], // the link button, `text-primary`
  ['sidebar-foreground', 'sidebar', 'text'],
  ['sidebar-primary-foreground', 'sidebar-primary', 'text'],
  ['sidebar-accent-foreground', 'sidebar-accent', 'text'],
  ['ring', 'background', 'non-text'],
  ['ring', 'card', 'non-text'],
  ['ring', 'muted', 'non-text'],
  ['ring', 'sidebar', 'non-text'],
  ['input', 'background', 'non-text'],
  ['input', 'card', 'non-text'],
  ...[1, 2, 3, 4, 5].flatMap((n): Array<readonly [string, string, Kind]> => [[`chart-${n}`, 'background', 'non-text'], [`chart-${n}`, 'card', 'non-text']]),
];
const WCAG: Record<Kind, number> = { 'text': 4.5, 'non-text': 3 };

/**
 * FADED PAIRS (#4386, #4387, #4388; owner decision 2026-11-24 on #4386, A for the ring, C for the rest). Three stock
 * classes draw a theme color at an alpha, so `PAIRS` alone measures them at a strength no component renders. Each is
 * measured here at its class's alpha:
 *   · `ring/50 <form>` — the box-shadow focus ring, in each `ring-ring/50` form stock shadcn/ui uses (`RING_PROBES`):
 *     `focus-visible:` (Button, Input, Select and most controls), the Slider thumb, the Calendar's `has-focus:` and its
 *     focused day, the Input OTP's active slot, `focus-within:` (Combobox, Attachment), the Input Group and Bubble.
 *     Its ink is not typed here: it is the `--tw-ring-color` Chromium computes on the probe in its focused or active
 *     state, under `STOCK_UTILITIES` plus the emitted registry item's own `css`. So each row measures whatever the
 *     registry item's rule (`emit-shadcn.ts`, decision A, extended to every form on #4575) actually does to that form,
 *     and dropping a form from the rule fails that form's rows here. Two more probes hold the rule off an invalid
 *     field, flagged on the element or on a field inside it: its ring stays the stock `destructive` at 20%.
 *   · `destructive/90` on `card` — the destructive Alert's description, `text-destructive/90` (decision C, `KNOWN`).
 *   · `muted-foreground` on `input/30` over `background` — the dark field's placeholder over `dark:bg-input/30`, so dark
 *     only (decision C, `KNOWN`).
 * The ink's floor is read for the role of the variable named in `role`, as for `PAIRS`.
 */
type Mode = 'light' | 'dark';
export type Faded = { ink: string; ground: string; kind: Kind; role: string; modes: readonly Mode[];
  inkCss: string; groundCss: string; under?: string };
/** One probe per stock `ring-ring/50` form: markup carrying the component's own focus classes (from shadcn/ui's
 *  `new-york-v4` sources), what to focus, and where the ring is read. */
export const RING_PROBES: Readonly<Record<string, RingProbe>> = {
  'focus-visible': { html: '<button id="p" class="focus-visible:ring-ring/50 focus-visible:ring-[3px]">x</button>', focus: '#p', read: '#p' },
  'slider': { html: '<span id="p" tabindex="0" class="ring-ring/50 hover:ring-4 focus-visible:ring-4"></span>', focus: '#p', read: '#p' },
  'calendar': { html: '<div id="p" class="has-focus:ring-[3px] has-focus:ring-ring/50"><input id="f"></div>', focus: '#f', read: '#p' },
  'calendar-day': { html: '<div class="group/day" data-focused="true"><button id="p" class="group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50">5</button></div>', read: '#p' },
  'otp-slot': { html: '<div id="p" data-active="true" class="data-[active=true]:ring-[3px] data-[active=true]:ring-ring/50">1</div>', read: '#p' },
  'focus-within': { html: '<div id="p" class="focus-within:ring-[3px] focus-within:ring-ring/50"><input id="f"></div>', focus: '#f', read: '#p' },
  'input-group': { html: '<div id="p" class="has-[[data-slot=input-group-control]:focus-visible]:ring-[3px] has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50"><input id="f" data-slot="input-group-control"></div>', focus: '#f', read: '#p' },
  'bubble': { html: '<a id="p" href="#x" class="[button,a]:focus-visible:ring-3 [button,a]:focus-visible:ring-ring/50">x</a>', focus: '#p', read: '#p' },
};
/** Invalid fields, whose stock ring is `destructive` at 20% and must stay so under the rule: flagged on the field itself
 *  (Input, `aria-invalid:`) and on a field inside a wrapper (Combobox, `has-aria-invalid:`). */
export const INVALID_PROBES: Readonly<Record<string, RingProbe>> = {
  'invalid field': { html: '<input id="p" aria-invalid="true" class="focus-visible:ring-ring/50 aria-invalid:ring-destructive/20">', focus: '#p', read: '#p' },
  'invalid field inside a wrapper': { html: '<div id="p" class="focus-within:ring-ring/50 has-aria-invalid:ring-destructive/20"><input id="f" aria-invalid="true"></div>', focus: '#f', read: '#p' },
};
export const FADED: readonly Faded[] = [
  ...Object.keys(RING_PROBES).flatMap((form) => ['background', 'card', 'muted', 'sidebar'].map((g): Faded => ({ ink: `ring/50 ${form}`,
    ground: g, kind: 'non-text', role: 'ring', modes: ['light', 'dark'], inkCss: `ring:${form}`, groundCss: `var(--${g})` }))),
  { ink: 'destructive/90', ground: 'card', kind: 'text', role: 'destructive', modes: ['light', 'dark'],
    inkCss: 'color-mix(in oklab, var(--destructive) 90%, transparent)', groundCss: 'var(--card)' },
  { ink: 'muted-foreground', ground: 'input/30 over background', kind: 'text', role: 'muted-foreground', modes: ['dark'],
    inkCss: 'var(--muted-foreground)', groundCss: 'color-mix(in oklab, var(--input) 30%, transparent)', under: 'var(--background)' },
];

/** The stock rules behind the probes, as stock Tailwind 4.3.3 (the version `@prism3/tokens` pins) compiles the classes
 *  in `RING_PROBES` and `INVALID_PROBES`, in its output order (which decides the invalid fields), under its layer
 *  order. Typed from that output, never from the projector. */
export const STOCK_UTILITIES = `@layer theme, base, components, utilities;
@layer utilities {
  .ring-ring\\/50 { --tw-ring-color: color-mix(in oklab, var(--ring) 50%, transparent); }
  .group-data-\\[focused\\=true\\]\\/day\\:ring-ring\\/50:is(:where(.group\\/day)[data-focused="true"] *) { --tw-ring-color: color-mix(in oklab, var(--ring) 50%, transparent); }
  .focus-within\\:ring-ring\\/50:focus-within { --tw-ring-color: color-mix(in oklab, var(--ring) 50%, transparent); }
  .focus-visible\\:ring-ring\\/50:focus-visible { --tw-ring-color: color-mix(in oklab, var(--ring) 50%, transparent); }
  .has-focus\\:ring-ring\\/50:has(:focus) { --tw-ring-color: color-mix(in oklab, var(--ring) 50%, transparent); }
  .has-aria-invalid\\:ring-destructive\\/20:has([aria-invalid="true"]) { --tw-ring-color: color-mix(in oklab, var(--destructive) 20%, transparent); }
  .has-\\[\\[data-slot\\=input-group-control\\]\\:focus-visible\\]\\:ring-ring\\/50:has(:is([data-slot=input-group-control]:focus-visible)) { --tw-ring-color: color-mix(in oklab, var(--ring) 50%, transparent); }
  .aria-invalid\\:ring-destructive\\/20[aria-invalid="true"] { --tw-ring-color: color-mix(in oklab, var(--destructive) 20%, transparent); }
  .data-\\[active\\=true\\]\\:ring-ring\\/50[data-active="true"] { --tw-ring-color: color-mix(in oklab, var(--ring) 50%, transparent); }
  .\\[button\\,a\\]\\:focus-visible\\:ring-ring\\/50:is(button, a):focus-visible { --tw-ring-color: color-mix(in oklab, var(--ring) 50%, transparent); }
}`;

/** A registry item's `css` object as CSS text, the way shadcn writes it into a project's stylesheet. `@apply` is
 *  Tailwind's, not CSS, and is dropped: Chromium would ignore it anyway. */
export const registryCssText = (o: Readonly<Record<string, unknown>>): string => Object.entries(o).map(([k, v]) => {
  if (typeof v === 'string') return `${k}: ${v};`;
  if (k.startsWith('@apply')) return '';
  return `${k} { ${registryCssText(v as Record<string, unknown>)} }`;
}).filter(Boolean).join('\n');

/**
 * Q2997.8 A: the dual-use pairs, failing in dark on every corpus brand. Owner decision 2026-11-24 C (on #4386): the
 * faded pairs of #4387 and #4388 (`FADED`), recorded the same way rather than overridden in the theme. Keyed `<brand> <mode>: <ink> on <ground>`, as
 * `KNOWN_PENDING` is, each with the ratio the owner accepted: the value measured when the decision was built, floored to
 * two places. A known pair that falls BELOW its accepted floor fails by name, so the entry mutes the pair the owner saw,
 * not any ratio on any brand forever (docs/34, a gate with no memory). An entry whose pair now passes, or whose brand is
 * gone, fails as STALE. The floors are written here by hand from that measurement, never read back from a run.
 */
export type Accepted = { floor: number; why: string };
export const KNOWN: Readonly<Record<string, Accepted>> = {
  'aurora dark: destructive on background': { floor: 4.25, why: 'Q2997.8 A — destructive is a fill under white ink; the engine question is #4279' },
  'aurora dark: destructive on card': { floor: 4.25, why: 'Q2997.8 A — card is background.primary (Q2997.1 B); #4279' },
  'aurora dark: primary on background': { floor: 4.25, why: 'Q2997.8 A — primary is a fill under white ink; #4279' },
  'harbor dark: destructive on background': { floor: 4.25, why: 'Q2997.8 A — destructive is a fill under white ink; the engine question is #4279' },
  'harbor dark: destructive on card': { floor: 4.25, why: 'Q2997.8 A — card is background.primary (Q2997.1 B); #4279' },
  'harbor dark: primary on background': { floor: 4.23, why: 'Q2997.8 A — primary is a fill under white ink; #4279' },
  'nb dark: destructive on background': { floor: 4.24, why: 'Q2997.8 A — destructive is a fill under white ink; the engine question is #4279' },
  'nb dark: destructive on card': { floor: 4.24, why: 'Q2997.8 A — card is background.primary (Q2997.1 B); #4279' },
  'nb dark: primary on background': { floor: 4.24, why: 'Q2997.8 A — primary is a fill under white ink; #4279' },
  'prism3 dark: destructive on background': { floor: 4.25, why: 'Q2997.8 A — destructive is a fill under white ink; the engine question is #4279' },
  'prism3 dark: destructive on card': { floor: 4.25, why: 'Q2997.8 A — card is background.primary (Q2997.1 B); #4279' },
  'prism3 dark: primary on background': { floor: 4.24, why: 'Q2997.8 A — primary is a fill under white ink; #4279' },
  'wendys dark: destructive on background': { floor: 4.22, why: 'Q2997.8 A — destructive is a fill under white ink; the engine question is #4279' },
  'wendys dark: destructive on card': { floor: 4.22, why: 'Q2997.8 A — card is background.primary (Q2997.1 B); #4279' },
  'wendys dark: primary on background': { floor: 4.04, why: 'Q2997.8 A — primary is a fill under white ink; #4279' },
  'aurora light: destructive/90 on card': { floor: 3.91, why: "Owner decision 2026-11-24 C (#4387) — the stock Alert's `text-destructive/90`; recorded, not overridden" },
  'aurora dark: destructive/90 on card': { floor: 3.63, why: "Owner decision 2026-11-24 C (#4387) — the stock Alert's `text-destructive/90`; recorded, not overridden" },
  'aurora dark: muted-foreground on input/30 over background': { floor: 3.83, why: "Owner decision 2026-11-24 C (#4388) — the stock field's placeholder on `dark:bg-input/30`; recorded, not overridden" },
  'harbor light: destructive/90 on card': { floor: 3.97, why: "Owner decision 2026-11-24 C (#4387) — the stock Alert's `text-destructive/90`; recorded, not overridden" },
  'harbor dark: destructive/90 on card': { floor: 3.63, why: "Owner decision 2026-11-24 C (#4387) — the stock Alert's `text-destructive/90`; recorded, not overridden" },
  'harbor dark: muted-foreground on input/30 over background': { floor: 3.79, why: "Owner decision 2026-11-24 C (#4388) — the stock field's placeholder on `dark:bg-input/30`; recorded, not overridden" },
  'nb dark: destructive/90 on card': { floor: 3.61, why: "Owner decision 2026-11-24 C (#4387) — the stock Alert's `text-destructive/90`; recorded, not overridden" },
  'nb dark: muted-foreground on input/30 over background': { floor: 3.8, why: "Owner decision 2026-11-24 C (#4388) — the stock field's placeholder on `dark:bg-input/30`; recorded, not overridden" },
  'prism3 light: destructive/90 on card': { floor: 3.97, why: "Owner decision 2026-11-24 C (#4387) — the stock Alert's `text-destructive/90`; recorded, not overridden" },
  'prism3 dark: destructive/90 on card': { floor: 3.62, why: "Owner decision 2026-11-24 C (#4387) — the stock Alert's `text-destructive/90`; recorded, not overridden" },
  'prism3 dark: muted-foreground on input/30 over background': { floor: 3.78, why: "Owner decision 2026-11-24 C (#4388) — the stock field's placeholder on `dark:bg-input/30`; recorded, not overridden" },
  'wendys light: destructive/90 on card': { floor: 3.95, why: "Owner decision 2026-11-24 C (#4387) — the stock Alert's `text-destructive/90`; recorded, not overridden" },
  'wendys dark: destructive/90 on card': { floor: 3.61, why: "Owner decision 2026-11-24 C (#4387) — the stock Alert's `text-destructive/90`; recorded, not overridden" },
  'wendys dark: muted-foreground on input/30 over background': { floor: 3.77, why: "Owner decision 2026-11-24 C (#4388) — the stock field's placeholder on `dark:bg-input/30`; recorded, not overridden" },
};
/**
 * The regression fixture's pair, raised on #4289 and accepted there (owner decision 2026-11-19 A), kept here as the owner
 * said. Same key and shape as `KNOWN`; the floor is the 3.77 the owner saw, written by hand. Printed on every run.
 */
export const KNOWN_PENDING: Readonly<Record<string, Accepted>> = {
  'nb light: muted-foreground on muted': { floor: 3.77, why: 'Owner decision 2026-11-19 A — legacy fixture, not engine-derived' },
};

/**
 * How a pair under its floor is reported. `known` (a `KNOWN` entry) and `accepted` (a `KNOWN_PENDING` entry) print and
 * pass while the ratio holds its entry's floor; below that floor, or with no entry, the pair is `failing`. `listed` says
 * the key has an entry, which is what the STALE arms read.
 *
 * THE FLOOR AGAINST THE BASE (#4587; owner decision 2026-11-27). An entry's floor is the ratio the owner accepted, so an
 * edit that lowers it widens what was accepted: 3.97 to 3.00 passed on every run, and the pair could then fall to 3.00
 * with nothing failing. The measured ratio alone cannot tell that edit from a pair that improved under an unchanged
 * floor, so the floor is compared with the SAME entry's floor in the base's copy of this file (`base`, read from git by
 * `baseFloors`, a record this gate never writes):
 *   · lower than the base's floor → `failing`, `FLOOR LOWERED KNOWN|PENDING`, whatever the measured ratio.
 *   · no entry at the base (a new entry), and more than `SLACK_MAX` below the measured ratio floored to two places →
 *     `failing`, `SLACK KNOWN|PENDING`: a new floor is written from the measurement, not under it.
 *   · at or above the base's floor, and more than `SLACK_MAX` below the measured ratio → it passes with a `warning`: the
 *     pair improved, and the reader should record the new ratio as the floor. Not a failure.
 * The 0.01 allows the last digit of a floored ratio to move with the renderer. Compared in whole hundredths, so floating
 * point cannot make 3.97 - 3.96 more than one step. `base` defaults to empty, where every entry is new: the strictest
 * reading, never a pass for want of a base.
 */
export const SLACK_MAX = 0.01;
const cents = (n: number): number => Math.round(n * 100);
export const judgeBelowFloor = (key: string, r: number, known: Readonly<Record<string, Accepted>> = KNOWN,
  pending: Readonly<Record<string, Accepted>> = KNOWN_PENDING, base: Readonly<Record<string, number>> = {}):
  { verdict: 'known' | 'accepted' | 'failing'; note: string; listed: boolean; warning?: string } => {
  const k = known[key], entry = k ?? pending[key];
  if (!entry) return { verdict: 'failing', note: '', listed: false };
  if (r < entry.floor) return { verdict: 'failing', note: ` — BELOW ACCEPTED ${entry.floor} (${entry.why})`, listed: true };
  const table = k ? 'KNOWN' : 'PENDING', was = base[key], held = floor2(r);
  if (was !== undefined && cents(entry.floor) < cents(was)) {
    return { verdict: 'failing', note: ` — FLOOR LOWERED ${table}: floor ${entry.floor}, the base's floor ${was}, so the pair could fall to ${entry.floor} unseen. Put ${was} back`, listed: true };
  }
  const slack = cents(held) - cents(entry.floor) > cents(SLACK_MAX);
  if (slack && was === undefined) {
    return { verdict: 'failing', note: ` — SLACK ${table}: a new entry, measured ${held}, floor ${entry.floor}, so the pair could fall to ${entry.floor} unseen. Write ${held} as its floor`, listed: true };
  }
  const warning = slack ? `WARNING ${key}: measured ${held}, floor ${entry.floor} — the pair improved; record ${held} as its floor in ${k ? 'KNOWN' : 'KNOWN_PENDING'}` : undefined;
  return { verdict: k ? 'known' : 'accepted', note: k ? '' : ` — ${entry.why}`, listed: true, ...(warning ? { warning } : {}) };
};

/**
 * The floors a copy of this file declares, by key, from both tables: the record `judgeBelowFloor` compares against.
 * Read from source text, because the base's copy is a blob in git, not a module. Null when either table's literal is
 * not found, which the gate reports as CANNOT RUN rather than as a base with no entries. The gate also parses its own
 * source and requires the result to equal `KNOWN` and `KNOWN_PENDING` as evaluated, so a parser that drifted from the
 * file's shape fails here by name instead of reading every entry as new or as unchanged.
 */
export const parseFloors = (src: string): Record<string, number> | null => {
  const out: Record<string, number> = {};
  for (const name of ['KNOWN', 'KNOWN_PENDING']) {
    const m = new RegExp(`export const ${name}: Readonly<Record<string, Accepted>> = \\{\\n([\\s\\S]*?)\\n\\};`).exec(src);
    if (!m) return null;
    for (const line of m[1]!.split('\n')) {
      const e = /^\s*'([^']+)':\s*\{\s*floor:\s*([0-9.]+)\s*,/.exec(line);
      if (e) out[e[1]!] = Number(e[2]);
    }
  }
  return out;
};

const REPO = resolve(here, '..', '..');
const SELF = 'packages/engine/lint-shadcn-contrast.ts';
const git = (...args: string[]): { ok: boolean; out: string; err: string } => {
  const r = spawnSync('git', ['-C', REPO, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: r.stdout ?? '', err: (r.stderr ?? '').trim() };
};
const cannotRun = (lines: string[]): never => {
  console.error(`✗ shadcn contrast: ${lines[0]}`);
  for (const l of lines.slice(1)) console.error(l);
  process.exit(1);
};
/**
 * The base's floors, by the ladder `shadcn-vars.ts` and `lint-contract-version.ts` use: in a merge-group run the
 * group's parent (`MERGE_GROUP_BASE_SHA`, `mergeGroupBase`, #4106), authoritative, with no fallback when it is lost; on
 * a pull request `origin/<GITHUB_BASE_REF>`, fetched again in CI because the checkout's copy is as old as the run's
 * start; otherwise `origin/main`, then `main`. Then the merge base with it, or HEAD's first parent on the base branch
 * itself (`comparisonBase`, #2556). The studio job checks out with `fetch-depth: 0`; under a shallow clone the merge
 * base does not resolve and this CANNOT RUN. A base whose copy of this file is absent reads as no entries (every entry
 * new, the strictest reading); a copy whose tables cannot be parsed CANNOT RUN. It never passes over no base.
 */
export const baseFloors = (): { floors: Record<string, number>; label: string } => {
  const tried: string[] = [];
  let ref: string | null = null;
  const mg = mergeGroupBase(git);
  const prRef = process.env.GITHUB_BASE_REF;
  if (mg) {
    tried.push(mg.tried);
    ref = mg.ref;
  } else if (prRef) {
    const pr = `origin/${prRef}`;
    if (process.env.GITHUB_ACTIONS === 'true') {
      const f = git('fetch', '--no-tags', '--quiet', 'origin', `+refs/heads/${prRef}:refs/remotes/${pr}`);
      if (!f.ok) return cannotRun([`could not refresh ${pr} from origin — the floor-against-base arm CANNOT RUN against the current base (#4587).`, `    ${f.err || '(git printed nothing)'}`]);
    }
    const r = git('rev-parse', '--verify', '--quiet', `${pr}^{commit}`);
    tried.push(`${pr} (GITHUB_BASE_REF, authoritative) — ${r.ok ? 'resolves' : 'does not resolve'}`);
    if (r.ok) ref = pr;
  } else {
    for (const c of ['origin/main', 'main']) {
      const r = git('rev-parse', '--verify', '--quiet', `${c}^{commit}`);
      tried.push(`${c} — ${r.ok ? 'resolves' : 'does not resolve'}`);
      if (r.ok) { ref = c; break; }
    }
  }
  if (!ref) return cannotRun(['no base ref — the floor-against-base arm CANNOT RUN, which is not the same as no floor lowered (#4587).', `    tried: ${tried.join(' · ')}`, '  Locally, `git fetch origin main`.']);
  const mb = git('merge-base', 'HEAD', ref);
  if (!mb.ok || !mb.out.trim()) return cannotRun([`no merge base between HEAD and ${ref} — the floor-against-base arm CANNOT RUN (#4587).`, '  A shallow clone is the usual cause: `git fetch --unshallow`.']);
  const { base, label } = comparisonBase(git, mb.out.trim(), cannotRun);
  const where = `${base.slice(0, 8)} (${mg ? 'merge group' : ref}, ${label})`;
  if (!git('cat-file', '-e', `${base}:${SELF}`).ok) return { floors: {}, label: `${where}: no copy of this gate there, so every entry is new` };
  const shown = git('show', `${base}:${SELF}`);
  if (!shown.ok) return cannotRun([`could not read ${SELF} at ${where} — the floor-against-base arm CANNOT RUN (#4587).`, `    ${shown.err || '(git printed nothing)'}`]);
  const floors = parseFloors(shown.out);
  if (!floors) return cannotRun([`the base's ${SELF} at ${where} declares no KNOWN or KNOWN_PENDING table this gate can read — the floor-against-base arm CANNOT RUN (#4587).`]);
  return { floors, label: where };
};

/** The engine's own floor for `role` in `mode`, from the brand's full tree. */
const engineMin = (tree: Record<string, unknown>, role: string, mode: 'light' | 'dark'): number => {
  let node: unknown = tree;
  for (const k of role.split('.')) node = node && typeof node === 'object' ? (node as Record<string, unknown>)[k] : undefined;
  const ext = ((node as { $extensions?: { prism3?: Ext } } | undefined)?.$extensions?.prism3) ?? {};
  const m = mode === 'light' ? ext.min : ext.modes?.dark?.min;
  return typeof m === 'number' ? m : 0;
};

if (isEntry(import.meta.url)) {
  // The parser against this file as evaluated: a parser that drifted from the tables' shape would read every base entry
  // as missing (all new) or misread a floor, so it must reproduce KNOWN and KNOWN_PENDING exactly before it reads the base.
  const own = parseFloors(readFileSync(fileURLToPath(import.meta.url), 'utf8'));
  const want = Object.fromEntries([...Object.entries(KNOWN), ...Object.entries(KNOWN_PENDING)].map(([key, a]) => [key, a.floor]));
  if (!own || JSON.stringify(Object.entries(own).sort()) !== JSON.stringify(Object.entries(want).sort()))
    cannotRun(['SELF-CHECK: parseFloors does not read this file\'s own KNOWN and KNOWN_PENDING back exactly — the floor-against-base arm CANNOT RUN (#4587).',
      `    parsed ${own ? Object.keys(own).length : 'nothing'}, evaluated ${Object.keys(want).length}`]);
  const base = baseFloors();
  const tmp = mkdtempSync(join(realpathSync(tmpdir()), 'prism3-shadcn-'));
  process.on('exit', () => rmSync(tmp, { recursive: true, force: true }));
  emitShadcn(tmp);
  const failures: string[] = [], known: string[] = [], accepted: string[] = [], warnings: string[] = [];
  const seenPending = new Set<string>(), seenKnown = new Set<string>();
  let measured = 0;
  const brands = handoffBrands();
  for (const brand of brands) {
    const full = JSON.parse(readFileSync(join(OUT, `${brand}.tokens.json`), 'utf8')) as Record<string, Record<string, unknown>>;
    const tree = Object.values(full)[0]!;
    const page = await openShadcnPage(readFileSync(join(tmp, 'shadcn', `${brand}.css`), 'utf8'));
    const item = JSON.parse(readFileSync(join(tmp, 'shadcn', `${brand}.registry-item.json`), 'utf8')) as { css?: Record<string, unknown> };
    const withRule = `${STOCK_UTILITIES}\n${registryCssText(item.css ?? {})}`;
    try {
      for (const mode of ['light', 'dark'] as const) {
        // Each ring form as its stock component renders it: first the stock classes alone (a premise: they must fade the
        // ring, or the form's rows measure nothing), then with the registry item's rule, which is what the rows measure.
        const ring: Record<string, string> = {};
        for (const [form, probe] of Object.entries(RING_PROBES)) {
          const stock = await page.ringColor(mode, STOCK_UTILITIES, probe);
          const [a] = await page.read(mode, [stock.value || 'transparent']);
          if (!a || Math.abs(a[3] - 128) > 2) failures.push(`${brand} ${mode}: premise — the stock ring/50 ${form} probe painted alpha ${a?.[3]}, not 50%`);
          ring[form] = (await page.ringColor(mode, withRule, probe)).value || 'transparent';
        }
        // An invalid field keeps the stock destructive ring at 20%, with and without the rule.
        for (const [what, probe] of Object.entries(INVALID_PROBES)) {
          for (const [css, label] of [[STOCK_UTILITIES, 'stock'], [withRule, 'with the rule']] as const) {
            const v = (await page.ringColor(mode, css, probe)).value || 'transparent';
            const [got, want] = await page.read(mode, [v, 'color-mix(in oklab, var(--destructive) 20%, transparent)']);
            if (!got || !want || got.some((c, i) => Math.abs(c - want[i]!) > 2)) failures.push(`${brand} ${mode}: an ${what} lost its destructive/20 ring ${label} (painted ${got?.join(',')}, not ${want?.join(',')})`);
          }
        }
        const rows: Array<{ ink: string; ground: string; kind: Kind; role: string; css: readonly [string, string, string?] }> = [
          ...PAIRS.map(([ink, ground, kind]) => ({ ink, ground, kind, role: ink, css: [`var(--${ink})`, `var(--${ground})`] as const })),
          ...FADED.filter((f) => f.modes.includes(mode)).map((f) => ({ ink: f.ink, ground: f.ground, kind: f.kind, role: f.role,
            css: [f.inkCss.startsWith('ring:') ? ring[f.inkCss.slice('ring:'.length)]! : f.inkCss, f.groundCss, ...(f.under ? [f.under] : [])] as [string, string, string?] })),
        ];
        const got = await page.over(mode, rows.map((r) => r.css));
        rows.forEach(({ ink, ground, kind, role: inkVar }, i) => {
          const role = SHADCN_COLOR_VARS[inkVar];
          if (!role) { failures.push(`${brand} ${mode}: ${inkVar} is not a mapped color`); return; }
          const floor = Math.max(WCAG[kind], engineMin(tree, role, mode));
          const { ink: a, ground: b } = got[i]!;
          if (b[3] !== 255) { failures.push(`${brand} ${mode}: ${ground} did not paint opaque`); return; }
          const r = wcagRatio(a, b);
          measured++;
          if (r >= floor) return;
          const line = `${brand} ${mode}: ${ink} on ${ground} ${floor2(r)} < ${floor}`;
          const key = `${brand} ${mode}: ${ink} on ${ground}`;
          const { verdict, note, listed, warning } = judgeBelowFloor(key, r, KNOWN, KNOWN_PENDING, base.floors);
          if (listed) (KNOWN[key] ? seenKnown : seenPending).add(key);
          if (warning) warnings.push(warning);
          (verdict === 'known' ? known : verdict === 'accepted' ? accepted : failures).push(line + note);
        });
      }
    } finally { await page.close(); }
  }
  for (const k of Object.keys(KNOWN)) if (!seenKnown.has(k)) failures.push(`STALE KNOWN ${k} — it passes now, or its brand is gone; take it out of KNOWN`);
  for (const k of Object.keys(KNOWN_PENDING)) if (!seenPending.has(k)) failures.push(`STALE PENDING ${k} — it passes now, or its brand is gone; take it out of KNOWN_PENDING`);
  for (const k of known) console.log(`  known  ${k}`);
  for (const p of accepted) console.log(`  accepted ${p}`);
  for (const w of warnings) console.log(`  ${w}`);
  console.log(`  floors held against the base at ${base.label}`);
  if (failures.length) {
    console.error(`✗ shadcn contrast: ${failures.length} failure(s)`);
    for (const f of failures) console.error(`    ${f}`);
    console.error('\n  Fix: remap the ink in projections/shadcn.ts to a role that clears the floor. A pair the owner accepts as a');
    console.error('  known failure goes in KNOWN with its decision and the ratio accepted; one below that ratio is a new failure.');
    process.exit(1);
  }
  console.log(`✓ shadcn contrast — ${measured} pairs measured in Chromium over ${brands.length} brands × 2 modes (${PAIRS.length} pairs each, plus ${FADED.length} faded by a stock class: ` +
    `ring/50 in ${Object.keys(RING_PROBES).length} stock forms with the registry item's rule, ${Object.keys(INVALID_PROBES).length} invalid fields left destructive); ${known.length} known (Q2997.8 A; owner decision 2026-11-24 C), ${accepted.length} accepted as a legacy fixture (owner decision 2026-11-19 A), 0 failing.`);
}
