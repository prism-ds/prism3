/**
 * Prism3 — THE SHADCN/UI THEME PROJECTOR (#2997). Projects each brand's emitted tokens onto shadcn/ui's theme
 * variables, as a plain CSS file and as a shadcn registry item (`registry:theme`).
 *
 *   npx tsx packages/engine/emit-shadcn.ts                 # write out/shadcn/<brand>.css and .registry-item.json
 *   npx tsx packages/engine/emit-shadcn.ts --out <dir>     # write <dir>/shadcn/** instead (what a gate renders)
 *
 * A PROJECTION, NOT A SECOND SOURCE. It reads the emitted handoff — `<brand>.base.tokens.json` plus
 * `<brand>.dark.overlay.tokens.json` in `out/` — never the engine's in-memory theme, and every value comes from the
 * role `projections/shadcn.ts` names for it. That file holds no values, so nothing here can drift from the tokens a
 * brand ships.
 *
 * THE DISK SHELL. The projector itself is `web-themes.ts`, pure, which every other surface runs too (the MCP, the CLI,
 * Studio's and the plugin's Export). This file reads the handoff from `out/` and writes what `shadcnFiles` returns.
 *
 * Literal values, not `var(--pds3-…)` aliases: shadcn switches modes with `.dark`, `@prism3/tokens` with
 * `[data-theme="dark"]`, so an alias would not flip.
 *
 * COLOR FORMAT (Q2997.14 A). `oklch()`, converted from the emitted color (a DTCG 2025.10 object, #4123) with `color.ts`, as shadcn's stock themes are.
 * The precision is the smallest that keeps every corpus value on its own 8-bit hex; gate 2 (`lint-shadcn-roundtrip`,
 * #2997 PR 2) proves that through Chromium's own parser, which shares no code with this file. A value with alpha
 * keeps it in the `oklch(L C H / NN%)` form shadcn uses for its dark `border`.
 *
 * A REGEN STEP (Q2997.5 B, #2997 PR 4): `out/shadcn/**` is committed and drift-checked like every artifact. The gates
 * still render a fresh copy with `--out`, so they never read a stale one.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handoffOf, SHADCN_MODES, shadcnFiles, type Handoff } from './web-themes.ts';
import { isEntry } from './entry-point';

// The projector's names, where the gates and `emit-tailwind.ts` have always imported them from.
export {
  SHADCN_MODES, resolveRole, parseEmittedColor, dimensionCss, toOklchCss, dimensionValue, fontValue, shadcnModeVars,
  shadcnThemeVars, shadcnCss, SHADCN_RING_FORMS, SHADCN_RING_SELECTOR, SHADCN_BASE_CSS, SHADCN_DOCS, shadcnRegistryItem,
  type ShadcnMode, type Handoff,
} from './web-themes.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const OUT_DIR = resolve(here, 'out');

type Tree = Record<string, unknown>;

/**
 * The brands the handoff carries: every `<brand>.base.tokens.json` in `dir`, sorted by code point. A brand's web base,
 * `<brand>.web.base.tokens.json` (#4155), shares the suffix but is not a brand: it has no overlays of its own.
 */
export const handoffBrands = (dir = OUT_DIR): string[] =>
  readdirSync(dir).filter((f) => f.endsWith('.base.tokens.json') && !f.endsWith('.web.base.tokens.json'))
    .map((f) => f.slice(0, -'.base.tokens.json'.length))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

/** A committed brand's handoff, read from `dir`: its base file and the overlay of each mode shadcn needs. */
export const readHandoff = (brand: string, dir = OUT_DIR): Handoff => {
  const read = (f: string): Tree => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Tree;
  const overlays: Array<{ mode: string; tree: unknown }> = [];
  for (const m of Object.values(SHADCN_MODES)) {
    if (!m) continue;
    const f = `${brand}.${m}.overlay.tokens.json`;
    if (!existsSync(join(dir, f))) throw new Error(`${brand}: no ${f} in the handoff`);
    overlays.push({ mode: m, tree: read(f) });
  }
  return handoffOf(brand, read(`${brand}.base.tokens.json`), overlays);
};

/** Writes `<out>/shadcn/<brand>.css` and `<brand>.registry-item.json` for every brand in `handoffDir`. */
export const emitShadcn = (out = OUT_DIR, handoffDir = OUT_DIR): string[] => {
  mkdirSync(join(out, 'shadcn'), { recursive: true });
  const written: string[] = [];
  for (const brand of handoffBrands(handoffDir)) for (const f of shadcnFiles(readHandoff(brand, handoffDir))) {
    const p = join(out, f.path);
    writeFileSync(p, f.text);
    written.push(p);
  }
  return written;
};

if (isEntry(import.meta.url)) {
  const i = process.argv.indexOf('--out');
  const out = i > 0 ? resolve(process.argv[i + 1] ?? '') : OUT_DIR;
  const written = emitShadcn(out);
  console.log(`✓ shadcn: ${written.length} files written to ${join(out, 'shadcn')}`);
}
