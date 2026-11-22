## (2026-11-21) — Figma geometry: line boxes modeled, findings grouped, fields reached (#3408 S6)

**What changed.** On `poc/arm-1`, three owner decisions from #4432 are built, then the owner's decision B1 on this PR:
- **1 A:** `compare-figma-geometry.ts` groups lines by root cause. The button's root border (1px transparent in CSS,
  no stroke in Figma) is one finding, holding its border lines and every width or x line whose residual equals the
  border's difference on that side exactly. The same difference repeated across cases is one finding too. The summary
  reads `N of M comparisons differ, in K findings`.
- **2 C:** Figma's whole-pixel line box is modeled. `check-geometry.ts` records each text part's computed font size and
  line height. The comparison holds the code's height to Figma's less round(L) − ⌊64L⌋/64, and a centered text's y to
  Figma's plus half of it, at Chromium's 1/64px unit. No tolerance: 0.01px stays.
- **3 A:** each field has five more stories per form, `rest`, `hover`, `focus-visible`, `disabled` and `error` with the
  message off. `stateOf` in `a11y-harness.ts` strips the suffix wherever a check keys on the state.

**What it reads now**, against the record at `40d7fc01`: **100 of 509 comparisons differ, in 13 findings**. Before
this change it was 98 of 241. Class 1 and 2 (58 lines) are one finding. Class 3 (30 lines) is 0. Class 4 (10 unreached
members) is 2, the two error members. The other 40 lines (10 findings) are field geometry that is compared for the
first time: the control's content inset is 17 in code and 16 in Figma, the Show/Hide toggle's box, and the label
cell's right inset.

**Diagnosis worth keeping.** The first cut of the line-box model rounded L to 1/64px and missed the large and small
labels by up to 0.0156px. Chromium's LayoutUnit truncates, so 20.7px is laid out as 20.6875. It truncates the centered
offset too: the small label sits at 11.09375, not 11.1016. Both are modeled. Neither is a tolerance.

### B1: the field's message pinned shown at every validation status

At a validation status the code writes the message whatever `showMessage` says (Q-POC2 A), so Figma's error member
(`message=false`, the set's default) couldn't match. The owner chose B1 for all three statuses: at error, warning and
success, the message node is built **visible and not wired** to the `message` switch, so the switch does nothing there.
The set default stays hidden (#2926), and `ErrorNoMessage` stays.
- **Engine.** A `booleans` entry takes `pinnedShownAt` (variant axis → values). `figmaAnatomyPlan` builds the part
  visible there with no `visibleProp` and records `pinnedVisibleProp`. `planSetProperties` refuses a pinned node that
  is wired or built hidden, and the "declared two different ways" guard still trips for two bound members that
  disagree. The validator refuses a pin on a non-variant axis, an undeclared value, or every member. TextField and
  Password set it through `makeTextField`'s `messagePinnedAt`. Search and card-number fields don't, since arm 1 has
  no code for them.
- **Both executors needed it** (`EXECUTOR_REVISION` 67, reach `password-field`, `text-field`). Each wires the deduped
  refs on every member that builds the part, so each would have bound the pinned message. The plugin reads the
  member's plan. The paste payload reads a rule, `REF_PINS_ALL` (`part` plus axis values), off the member's name,
  because a per-member list (63 entries) broke the chunk budget. The skip code is emitted only for a set with a pin,
  so every other payload is byte-identical to before. An Update over a file built before the pin finds the message
  wired on those members, so the plugin takes that reference off, unless the node is kept as a hand edit. The
  read-back fails a pinned node that is still wired or hidden.
- **Footprint.** The pinned members are taller than the default member, whose message is hidden, so the fields now
  exempt `status` through `footprintVaries`, as checkbox-group does for its message. The validator accepts a pinned
  axis as the third reason a box moves.
- **Recorder.** `figma-geometry.js` reads each boolean per member: the visibility of the node wired to it, or, where
  the member wires none, of the node at the path other members wire, listed under `unwired`. The committed record
  predates this, so the two error lines stay until the Mac re-record, and the compare says so.
- **Review fixes.** `pinRules` guards its indexes, so `typecheck-components.ts` passes on the #1182 clean list
  again. The chunked paste path now has an executed arm: the text field is pasted in at least two chunks onto one
  page, and the message must be wired at `status=default` only.
- **Update over a pre-B1 file (executor revision 68).** The owner's Update file at `3fda7bad` read "2 to check": 21
  status=default members per field set showed their message against a plan that hides it. The update claimed
  `visible = true` on each pinned node while it was still wired, and on the host a wired node's `visible` is the set's
  one `message` default, so the last write turned it on for every member still wired. The executor now takes the
  reference off a pinned node before writing it, and the wire loop's own unwire stays as the backstop. The shim models
  the shared cell as an opt-in (`boolWriteThrough`), inferred from that run rather than measured, and a new
  `test-update-apply.ts` section updates a pre-B1 set to B1 and then updates from the state `3fda7bad` left. Both end
  clean.

**Trap.** `pinRules` derives the paste rule from the plans and then checks it against them. A pin pattern that no
axis rule states is refused, rather than shipped as a wire that binds the wrong members. The field findings that repeat across cases are grouped by their exact values. The three content-inset
lines are very probably one cause (the control's CSS border against Figma's inside stroke), but the records carry no
part strokes, so the comparison can't prove it and doesn't merge them.
