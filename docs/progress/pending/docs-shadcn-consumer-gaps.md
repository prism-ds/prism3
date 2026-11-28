## (2026-11-28) — shadcn/ui theme: dark selectors, stock sizes and font loading documented (#4636 items 1, 3, 4)

Docs lane for three of #4636's four consumer gaps from the #4632 build-screens test. Item 2 (ready-made token CSS for
every brand) stays open.

- **Dark selectors (item 1).** Both READMEs now name the other selector. Checked against the emitted CSS, not the
  source comments: `out/shadcn/<brand>.css` and `out/tailwind/<brand>.theme.css` switch on `.dark`, and the built
  `packages/tokens/dist/prism3.css` on `[data-theme="dark"]` plus `@media (prefers-color-scheme: dark)` on
  `:root:not([data-theme])`. That last block is the trap the docs name: a page that sets neither gets dark tokens and
  light shadcn components on a dark system. The advice is to set `class="dark"` and `data-theme="dark"` together.
- **Stock sizes (item 3, owner decision C, 2026-11-28).** The export keeps stock sizes; `apps/studio/README.md` now
  tables the difference. Prism3's side was read from the emitted `out/<brand>.tokens.json` (`size.md.height` 44px,
  `control.size.md.width`/`track`/`thumb` 64/32/24px, the same in all three hosted brands). shadcn's side was read
  from its `new-york-v4` registry source for `button` and `switch`: `h-9` (36px), and `w-8` × `h-[1.15rem]` with a
  `size-4` thumb (32 × 18.4px, 16px). The issue's "32×18" rounds the 18.4px; the table states it unrounded. Stock
  default height equals Prism3's small (36px, `size.sm.height`).
- **Font loading (item 4).** The registry item and the Tailwind theme name `--font-sans`/`--font-mono` but carry no
  `@font-face`; the token CSS carries none either. Both READMEs say to load each face under the family name the value
  starts with. The registry item's `docs` line gains one sentence saying the fonts aren't loaded, so a consumer sees
  it at `npx shadcn add`; that moves the five `out/shadcn/*.registry-item.json` and takes a minor change note.
  Every brand's font value ends in a generic family (`sans-serif`, `monospace`), checked across all five, which is
  what the fallback sentence relies on.

All new sentences are shipped copy and wait on the owner in the PR body's "Strings for owner approval".
