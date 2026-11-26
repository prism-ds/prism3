/**
 * Prism3 — THE TAILWIND v4 `@theme` PROJECTOR (#2997 PR 3). Writes `tailwind/<brand>.theme.css` for every brand.
 *
 *   npx tsx packages/engine/emit-tailwind.ts                 # write out/tailwind/<brand>.theme.css
 *   npx tsx packages/engine/emit-tailwind.ts --out <dir>     # write <dir>/tailwind/** instead (what a gate renders)
 *
 * One self-contained file a Tailwind v4 project imports after `tailwindcss`: the shadcn variables in `:root` and
 * `.dark` (the same values `emit-shadcn.ts` writes, from the same handoff), the per-mode shadow variables, and an
 * `@theme inline` block that points Tailwind's names at them. `inline` makes each utility read the variable itself
 * (`bg-primary` → `var(--primary)`), so `.dark` flips it, as shadcn's own `@theme inline` does.
 *
 * Read from the emitted handoff only, like `emit-shadcn.ts`; `projections/tailwind.ts` holds no values. Gate 5
 * (`packages/tokens` `check:shadcn`) compiles a fixture against this file with the stock Tailwind CLI.
 *
 * A REGEN STEP (Q2997.5 B, #2997 PR 4): `out/tailwind/**` is committed and drift-checked like every artifact.
 *
 * THE DISK SHELL: the projector is `web-themes.ts` (`tailwindThemeCss`), pure, which every other surface runs too.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { handoffBrands, OUT_DIR, readHandoff } from './emit-shadcn.ts';
import { tailwindFiles } from './web-themes.ts';
import { isEntry } from './entry-point';

export { shadowCss, tailwindThemeCss } from './web-themes.ts';

/** Writes `<out>/tailwind/<brand>.theme.css` for every brand in `handoffDir`. */
export const emitTailwind = (out = OUT_DIR, handoffDir = OUT_DIR): string[] => {
  mkdirSync(join(out, 'tailwind'), { recursive: true });
  return handoffBrands(handoffDir).flatMap((brand) => tailwindFiles(readHandoff(brand, handoffDir)).map((f) => {
    const p = join(out, f.path);
    writeFileSync(p, f.text);
    return p;
  }));
};

if (isEntry(import.meta.url)) {
  const i = process.argv.indexOf('--out');
  const out = i > 0 ? resolve(process.argv[i + 1] ?? '') : OUT_DIR;
  const written = emitTailwind(out);
  console.log(`✓ tailwind: ${written.length} files written to ${join(out, 'tailwind')}`);
}
