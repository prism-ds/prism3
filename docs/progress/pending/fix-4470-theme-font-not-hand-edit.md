## (2026-11-23) — A theme's type family is not a hand edit on a usage panel (#4470)

**What broke.** On the template (2026-11-22) the owner changed the title and display family through the theme, then ran
Update file. About 35 usage panels were flagged as edited by hand and kept aside as "(edited)" copies. Nobody had
touched them. The same run flagged CardNumberField (`control/cardMark`, 84 members) and List (`items/item1-3`, 12).

**Diagnosis.** A panel's print is the style guide's `fingerprintOf`, and that read every text's resolved `fontName`,
`fontSize` and `fontWeight` beside its `textStyleId`. The `_Doc-block` template draws its texts in text styles, and the
file's styles bind their family to a font variable. So a theme that changes a family re-resolves every styled text, and
the print moved on every panel with one. Code spans make it worse: a text with a span drawn in the code style (#3552)
reads mixed, and the print then read each run's resolved font.

**The fix.** `fingerprintOf` takes `{ bindings: true }`, which reads a text in a style as that style's id, and a font
field bound to a variable as that variable's id, run by run where the text is mixed. A text in no style still reads its
font. The usage panel's print moves to a fifth form (`5:`) that reads this way (`panelPrint`). The fourth form is kept as
`printV4` and still compares panels recorded in it. Tables, the About frame and the cover keep the default reading, so no
print recorded before this change stops matching.

**Hand edits still read.** A font, size or tracking set by hand on a styled text detaches the style in Figma, so the print
moves (style id to values). A different style is a different id. A font typed over a variable reads its value. The test
holds each one.

**The members are a different cause.** A member's record (`member-baseline.ts`) already hashed a styled text by its style's
name, never its font. Built on the host's instance model with the sets they nest, both sets read every member current after
every family moved (`#4470 members/…`, `test-update-apply.ts`). List can't be reached at all: a List member holds no text
of its own, and the record doesn't walk inside a List.Item instance. Their flags fit the stated limit of #4070 (records
written before it compare a nested instance through `own`, `#4070 nested/written before`), which #4097 tracks. This PR
doesn't touch them.

**What this cannot fix.** A panel recorded in the fourth form, on a file whose theme fonts already changed, can't match
again: the print it holds was taken over the old font, and nothing records what that was. Such a panel is kept aside once
(the safe direction) and then carries the fifth form. The issue's workaround still applies to those: choose overwrite for
usage panels in the dry run.

**Escape review.** The panel tests (`test-doc-panel.ts`) drew every block text in a fixed font with no text style, and no
case changed a font. So no test could move a styled text's resolved font while its style stayed, and the existing `theme/…`
case in the update suite moved bound numbers and paint colors only. Added: `styleText`, a model of a text in a style
(it reads the style's font until a font, size or tracking is set on it, which detaches it; a code span splits it into runs),
and the `theme font/…` section, run on a host that lists each instance's overrides and on one that lists none. Filed: #4482,
for the style guide's tables, which print with the default reading and draw their type samples in a style.

**Gates.** Mutations, each failing by name: `panelPrint` without `bindings` → `theme font/untouched` (both hosts); a styled
text's key reading its font → the same; a run's key reading its font → the same; an unstyled text's font dropped →
`theme font/unstyled hand font`; a bound family read as its value → `theme font/font variable`; the member signature
reading a styled text's font → `#4470 members/card-number-field`.

**Not measured.** Which fields the real host lists in `overrides` for a range text style on an instance's text. The model
lists `styledTextSegments`, `textStyleId` and `fontName`. The no-overrides host covers the whole-read path either way.
