## (2026-11-26) — The shadcn/ui and Tailwind themes export for any brand, on every surface (#2997)

**What was missing.** The audit posted on #2997 (2026-11-26) found the engine projected a brand's shadcn/ui theme and Tailwind v4 `@theme` block only as regen artifacts, for the five committed brands, and as a hosted registry item for three. No export surface offered them for a brand of the user's own: not Studio's or the plugin's Export, not the MCP's `export_theme`, not the CLI. The projectors were pure functions over a handoff, but they lived in `emit-shadcn.ts` and `emit-tailwind.ts` beside `node:fs`, so no bundle could import them, and nothing built a handoff from a brand in memory.

**The change.**
- **One projector, pure:** `packages/engine/web-themes.ts` holds the projectors, moved verbatim. It adds:
  - `handoffOf`, the handoff from the consumer set's files as objects;
  - `webThemeHandoff`, a brand's handoff from its tree, with the `buildOverlaySet` the token export writes;
  - `shadcnFiles` and `tailwindFiles`, each file's path, download name and bytes.

  `emit-shadcn.ts` and `emit-tailwind.ts` are now disk shells over it, and `regen --check` is in sync, so the move is output-preserving.
- **Studio and the plugin:** Export gains "shadcn/ui theme" (`<id>.shadcn.css`, `<id>.shadcn.registry-item.json`) and "Tailwind theme" (`<id>.tailwind.theme.css`), for the brand on screen, off the last-good theme. They're off after a failed restore, as the tokens are. The plugin's iframe is Studio's UI, so both hosts gain them together.
- **The MCP and the CLI:** `export_theme` gains the `shadcn` and `tailwind` sections, and `cli.ts` the `--shadcn` and `--tailwind` flags. Both write the committed relative paths, `shadcn/<id>.css`, `shadcn/<id>.registry-item.json` and `tailwind/<id>.theme.css`. The CLI's writes go through `fileInDir`.
- **The focus-ring rule and the `docs` pointer:** they ride in the registry item exactly as the hosted one carries them. The plain CSS carries neither, as built; that's an owner question on the PR.
- **Follow-ups:**
  - **#4588:** `check:shadcn` compiles all six shadow utilities;
  - **#4592:** `lint-us-english` and `lint-voice` read `apps/studio/README.md`, which had one `artefacts`, now fixed;
  - **#4587** stays open: whether the gate should hold floors that tightly is the maintainer call the issue names.

**Held by.** Each surface writes the committed files byte for byte:
- `test:export-parity`, both built hosts in Chromium, both themes, every gated brand;
- `test.ts`: in memory for all six committed brands, `export_theme`, and `cli.ts` on an engine-native and a standard-dialect brief;
- `regen --check`, for regen.

The expected side is always the committed `out/shadcn/**` and `out/tailwind/**`. A change to the projector without a regen fails every surface by name.
