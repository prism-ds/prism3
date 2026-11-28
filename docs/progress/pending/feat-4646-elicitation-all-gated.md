## (2026-11-28) — The Figma bridge asks the person before a write that discards work (#4646 step 3)

Three bridge writes discard something a person may want back: `prune`, `update-components` with `handEdits:
"overwrite"`, and `panels-clean`. Until now the agent's own `confirm: true` was the only confirmation, so a person who
never saw the preview could lose work. Step 3 of #4646 asks the person through MCP elicitation first, when the client
takes a form.

- **The flow.** Before a gated `confirm: true` the bridge reads the open file's name (`status`) and runs the same command
  as a dry run. A `previewHash` that no longer matches the dry run's is refused without asking ("Run the preview
  again"). A dry run that would discard nothing goes out unasked. Otherwise the person gets one form, a single `allow`
  checkbox, with a message naming the file, the count and the plugin's summary, and saying whether Prism3 saves a named
  version first. Allow sends the write as the agent sent it; anything else is `declined: true`, and nothing is written.
- **Tied to the file.** `prune` and an overwrite through `previewHash`, which the plugin checks again when it writes.
  `panels-clean` has no hash, so the bridge reads the file name again after the answer and refuses a change. That is
  weaker (two files with one name look alike); a plugin-side hash is a follow-up for the owner to choose.
- **The version line is what the plugin already does.** `prune` and an update apply call `saveVersion` before they write;
  `panels-clean` does not, and its message says so and tells the person to save one in Figma.
- **Clients.** A client without form elicitation sees no change. A bare `elicitation: {}`, which every client before
  `2025-11-25` sends, counts as a form (the SDK stores it as `{ form: {} }`). The bridge sends `elicitation/create` as a
  plain request rather than through `elicitInput`, which always adds `mode`: that field goes only to a `2025-11-25`
  session. A gated task asks before the task exists, so its reply
  waits for the answer. Every arm asks; arm 0's `--record` logs a refusal as `refused-by-bridge`.
- **The recode record (the owner's note, from the #4661 delta review).** `bridgeTransport` clears a pending `skill://`
  read's -32602→-32002 record only on a reply, never on a message with a `method`, so an elicitation that reuses the
  read's id leaves it. The old `result`/`error` test already excluded a request; the explicit check says so, and
  `elicit/id-reuse` drives `bridgeTransport` directly to hold it.
- **Held for the owner.** The message wording; whether `draw-specs`, `set-override` and `run-code` stay unasked; the `panels-clean`
  file tie.
- **Tests.** `apps/plugin/test-agent-bridge.ts`: `elicit/*` (decline, allow, moved hash, nothing to discard, keep-only
  and dry runs unasked, overwrite counts, `panels-clean` file change, task, without elicitation) `elicit/id-reuse` and `arm/<n>-elicit`.
  374 assertions, all pass. Mutations, each failing by name, are in the PR.
