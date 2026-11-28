## (2026-11-28) — The Figma bridge asks the person before update-components overwrites hand edits (#4646 step 3)

Write gates on the bridge were prose: nothing asked the person before a write that discards their work. Step 3 of
#4646 adds MCP elicitation for the first such write the issue names, an `update-components` confirm with
`handEdits: "overwrite"` (for the run, or for one set under `choices.sets`).

- **What the person sees.** One form `elicitation/create` with no fields (accept, decline or cancel), naming each set
  whose hand edits the overwrite replaces and how many members, read from the newest check this bridge ran whose
  `previewHash` the confirm echoes. Each set's choice is resolved as the plugin's `choiceFor` resolves it. A check the
  bridge can't read (another bridge, or before a restart) is said, not guessed. Accept sends the confirm; anything
  else, a failed question included, sends nothing and `--record` logs `refused-by-bridge`. A confirm whose check found
  no hand edits under `overwrite` isn't asked about. As a task, the question comes before the task, so a decline makes
  no task.
- **Who is asked.** Elicitation is a CLIENT capability: the spec gives the server nothing to declare, so
  `capabilitiesFor` and every `initialize` answer are unchanged. The bridge asks a session that negotiated
  `2025-06-18` or later (`ELICITATION_SINCE`) whose client declared form elicitation; the SDK's own normalization of
  `elicitation: {}` to form is matched in `elicitsFor`. Every other session gets today's confirm, unasked
  (`handshake/<version>-elicitation`, `elicit/no-capability`, `elicit/url-only`). Every arm asks, by the pattern of the
  owner's Q1 A on #4654: it gates a write rather than showing the agent anything (`arm/0-elicit`).
- **Why the file can't be switched under it.** The question adds a gate; it doesn't replace one. The confirm still
  echoes the check's `previewHash`, which the plugin recomputes from the open file, so a different file refuses it.
- **The #4661 review's step-3 note** (an outgoing request reusing a pending `skill://` read's id would clear its
  -32002 record): already closed by #4663, whose `bridgeTransport` clears records only on a message carrying `result`
  or `error`, and a request carries neither. `skills/request-id` now holds it in process, and fails by name when the
  check is widened to any message with an id.
- **Held for the owner:** the question and refusal text, the `commands.json` sentence, `prune` and node-removing
  writes as later uses, and the file's name in the question (the plugin's link state doesn't carry it). All in the PR.
- **Filed:** #4675, the adherence scorer counting a declined (`refused-by-bridge`) hashed confirm as a write.
- **Tests.** `apps/plugin/test-agent-bridge.ts`, all pass; the test harness now tells a request from the bridge (it
  has a `method`) from a reply. Mutations, each failing by name, are in the PR.
