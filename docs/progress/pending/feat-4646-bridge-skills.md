## (2026-11-28) — The Figma bridge serves prism3-rebind, prism3-build-ui and prism3-bridge as MCP skills (#4646 step 2)

The bridge's two skills were resources an agent had to know to read: `instructions` named them, and nothing loaded them
when they were needed. Step 2 of #4646 serves them through the MCP Skills extension (`io.modelcontextprotocol/skills`,
SEP-2640), from the same checkout files.

- **What a client sees.** `capabilities.extensions["io.modelcontextprotocol/skills"]` in `initialize` and
  `server/discover`; `skills/list` names `skill://prism3-rebind/SKILL.md` and `skill://prism3-build-ui/SKILL.md`;
  `skills/get` returns a skill's frontmatter and its files with digests; each file reads at `skill://<name>/<path>`,
  `consistency-audit.js` included. The skill text is byte-identical to the `prism3://skills/…` resource (`skills/read`).
- **What stays.** The five `prism3://` resources, `RENAMED_RESOURCES` and its -32002, and the arm gating: arms 0 and 1
  declare no extension and answer `skills/list` -32601 (`arm/<n>-skills`). `resources/list` is still exactly the five
  approved resources (Q3300.3 A): the skill files are found through `skills/list`, not listed there.
- **How.** The SDK's `SkillsExtension` attaches to its high-level `McpServer`, and refuses a server that already serves
  resources, so the bridge now builds an `McpServer`, attaches the skills first, and registers the five resources on
  the same registry; the tools and task methods are still set on its underlying `Server` by hand. The skills come from a
  small `SkillSource` over the checkout files rather than the SDK's `SkillCatalog`, because the catalog lists every
  `SKILL.md` in `resources/list`. The SDK's own `skillEntry` builds and validates each entry (digests, frontmatter). A
  skill that does not validate is left out and named on stderr; the bridge still starts. `createMcpServer` throws at
  start if what the SDK declares for the extension is not what `initialize` answers.
- **Owner decisions (2026-11-28).** Q3 A: `skills/prism3-bridge/SKILL.md` is the approved note (`BRIDGE_INSTRUCTIONS`,
  Q3300.1 A) verbatim plus `figma_run`'s long-run line, served as a third MCP skill; `instructions` and `readFirst` are
  unchanged (`skills/bridge-note` holds the body to both). Q2 A: skills at every revision, as built. Q1 A: the skills
  stay in F2, so F2 runs from this merge on aren't comparable with earlier ones (`tools/agent-adherence/figma.md`).
  `prism3-build-screens` joins when #4632 merges.
- **Tests.** `apps/plugin/test-agent-bridge.ts`: 321 assertions, all pass (310 before). Mutations, each failing by
  name, are in the PR.
