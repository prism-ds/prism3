---
engine: minor
---
Checkbox.Row and Radio.Row hug their content (#4473, owner decision A). A placed row is as wide as its control, gap and label, so a HUG width override now works; a parent can still stretch the row, as Checkbox.Group and Radio.Group do. The rows used to be built at 320 wide with a 120 floor so their label could fill and wrap, which held a placed row at 320. Switch.Row already hugged, so the three rows now share one sizing rule. In Figma a row label no longer wraps; in code it still wraps at its container's width.
