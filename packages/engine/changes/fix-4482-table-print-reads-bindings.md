---
engine: patch
---
Style guides: a theme that changes a type family no longer makes a superseded table read as edited by hand (#4482). A
table's record now reads each text by the text style it uses and the bold or italic applied over that style, or by the
font variable its family is bound to, instead of the font these resolve to. A font picked by hand, another style, a bold
over a styled line or a retyped cell still reads as an edit, and the table is kept. Tables drawn before this change are
still compared the way they were recorded. After a theme font change, such a table can be kept once until it is drawn
again. Plugin only; no committed artifact moves.
