---
engine: patch
---
Update file no longer keeps a usage panel aside as "(edited)" when the theme changes a type family (#4470). A panel's
record now reads each text by the text style it uses, or by the font variable its family is bound to, instead of the
font that style or variable resolves to. A font set by hand, a different style or a rewritten line still reads as an
edit, and the panel is kept. Panels drawn before this change are still compared the way they were recorded: after a
theme font change they can report one false edit until Update redraws them. Plugin only; no committed artifact moves.
