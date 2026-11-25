## (2026-11-25) — KPI 2 geometry: the Show/Hide button stretches to its row, and part borders count once (#3408)

**What changed.** On `poc/arm-1`, with no engine or executor change. It closes the findings that were (a) or (d) in
the KPI 2 inventory posted on #3408 the same day.

- **The Show/Hide button (a).** `@prism3/css` set the password field's label row to `align-items: flex-end`, so the
  nested Button hugged its 13.8px line at the row's bottom: y 5.2, 15.8 tall, in a 21px row. The def's row is
  `align: center`, and the button is `crossAxisFill`, stretched to the row with its "Show" centered (#2804, Q380 A).
  Figma draws it that way: y 0, 21 tall. The row now centers, and the button stretches.
  - `check-browser-fields.ts` holds the button to the row's own box, and its label to the button's middle.
  - A mutant that puts the button back at the row's bottom fails by name.
- **A hugging sibling's text (d).** The label cell's right inset was 37.34 in code and 40 in Figma. It's the gap plus
  the button's width, and that width hugs "Show": 4.66px of renderer text width and the button's 2px transparent
  border. A FILL part's right inset is now offset by the text width of each hugging part after it, as a hugging root's
  width already was.
  - The plan in the inventory was a `toggle/label` part in the arm contract. The contract's parts must be the def's own
    anatomy, which `check-arm-contract.ts` enforces, and the nested Button's label isn't one of them. So the code
    side reads the text as the button's content box: its box less its padding and border.
- **Part borders (d).** The code record now carries each part's CSS border and padding. `figma-geometry.js` (still
  read-only) records each layer's layout border: the stroke weight where the frame includes strokes in layout, and 0
  otherwise. It also records the stroke itself.
  - The comparison groups every line a part's border explains under that part: one finding per bordered part, the
    rule decision 1 A applies to the button's root.
  - A record without part borders, which includes the committed one, keeps its lines as their own findings until the
    Mac re-record.
  - The owner settled the difference as G1 A on #3408: a real difference, counted once per bordered part. The
    systemic fix, Figma's builder including the stroke in layout, is #4599 on main.

**KPI 2 row.** It was `138 of 809 comparisons differ, in 11 findings` on the committed Figma record. Now it's
`122 of 809, in 9`. After the re-record the projection is 4 findings, if the plugin's strokes sit out of layout as its
executor sets them: the button's root border, each field's control border, and the Show/Hide button's border.

**Trap.** The planted self-test record copies the code's part borders into Figma's, so a clean plant agrees. The part
border arm plants Figma's control and button strokes out of layout and moves what's inside by their weight. If the
code record loses its part padding, the sibling-text plant can't build its "Show", and the self-test names that.
