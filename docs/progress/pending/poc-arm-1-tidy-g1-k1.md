## (2026-11-25) — PoC arm 1: G1 A and K1 A written in as decided (#3408)

**What changed.** On `poc/arm-1`, docs and the KPI 1 tool only, following the owner decisions of 2026-11-25 on #3408
and the review of #4598.

- **G1 A.** The field control's 1px inset (CSS's border takes layout space, Figma's INSIDE stroke doesn't) is a real
  difference, counted once per bordered part, as decision 1 A counts the button's border. `figma-geometry.md` and the
  KPI 2 progress entry now say so and cite #4599, the systemic fix on main: Figma's builder includes the stroke in
  layout on bordered parts.
- **The re-record note.** #4598's Ready comment said a part whose stroke reports `inLayout: true` would keep its lines
  separate. It's the other way: Figma's insets then match the code's, so that part's border lines and its finding
  vanish. `figma-geometry.md` now says what a re-record shows, so a smaller count reads as #4599 reaching the file.
- **K1 A.** KPI 1's from-scratch time includes `npm ci`. `K1` in `tools/poc-kpi1/kpi1.ts` is answered, so the cell
  reads `install …s (K1 A: timed)` with no "pending" mark. The README, the arm input contract, `tools/CLAUDE.md` and
  the KPI 1 progress entry say it's decided.

**Checked.** A new self-test case holds the answer as committed: 20,000ms with a 6,050ms install must read 20. The
summary case now types its expected line as decided, rather than building the mark from `K1.state`.
- A headline that drops the install fails by name.
- `K1` set back to pending fails by name.
