---
engine: minor
---
A brand's shadcn/ui theme and its Tailwind v4 theme now export for any brand, not only the committed ones. Studio's and the plugin's Export gain two artifacts, "shadcn/ui theme" (the brand's light and dark variables as CSS, and the registry item a shadcn/ui project installs) and "Tailwind theme" (one CSS file to import after Tailwind). The MCP's `export_theme` gains the `shadcn` and `tailwind` sections, and the CLI the `--shadcn` and `--tailwind` flags. Every surface runs one projector, `web-themes.ts`, the one regen writes `out/shadcn/**` and `out/tailwind/**` with, so a committed brand gets exactly its committed files. `check:shadcn` now compiles all six shadow utilities, and the prose gates read `apps/studio/README.md`, where the registry item's note points.
