/*
 * FIGMA'S SIDE OF THE GEOMETRY RECORD (#3408 S6, KPI 2 with Q32 A). Run on the Mac, through the Desktop Bridge
 * (`figma_execute`), in the file the job names; see `figma-geometry.md`. It READS ONLY: no node, page, style,
 * variable or version is written.
 *
 * For every member of the `button`, `text-field` and `password-field` component sets on any page of the open file,
 * it records what Figma actually lays out, from world coordinates (`absoluteBoundingBox`), not declared values:
 *   - the member's extent, padding (each side), stroke weight (each side) and corner radii;
 *   - each visible descendant's box, relative to the member's top left, keyed by its layer path (`container/label`;
 *     the member itself is `container`), with its node id, its type and its horizontal sizing (FIXED, HUG or FILL);
 *     its `border`, the stroke weight (each side) that takes layout space, which is 0 unless the frame includes its
 *     strokes in layout (`strokesIncludedInLayout`); and, where it is stroked, its `stroke`: the weights, the
 *     alignment and whether they are in layout.
 * The variant is the member's own `variantProperties`.
 * Each BOOLEAN component property (`leading icon`, `message`) is recorded PER MEMBER, at its effective value (#4461):
 * the visibility of the member's node wired to it; where the member wires no node to it, the visibility of the node
 * at the layer path other members wire, listed under the member's `unwired` (the field's message, pinned shown and
 * unbound at a validation status, reads "true" there); and only where neither exists, the set's default.
 *
 * It returns the record as a JSON string. Save it UNEDITED as `apps/storybook/figma-geometry.json`. The IIFE is
 * RETURNED: `figma_execute` wraps the code in an async function body and hands back only an explicit `return`, so a
 * bare `(async () => { ... })();` comes back `undefined` (the first live run). `compare-figma-geometry.ts --self-test`
 * runs this source the same way, against a stub file, and fails unless the record comes back.
 * `compare-figma-geometry.ts` holds it against the code's record.
 */
return (async () => {
  const SETS = ['button', 'text-field', 'password-field'];
  const r2 = (n) => Math.round(n * 100) / 100;
  await figma.loadAllPagesAsync();
  const sets = figma.root.findAllWithCriteria({ types: ['COMPONENT_SET'] }).filter((s) => SETS.includes(s.name));
  const out = { format: '1.0', source: 'figma', file: '(not recorded: the file name stays out of the repo)', note: 'Boxes relative to the member\'s top left, from absoluteBoundingBox, in px, to 0.01. Parts keyed by layer path.', propertyRead: 'effective', components: {} };
  for (const set of sets) {
    const members = [];
    // the set's BOOLEAN component properties (e.g. "leading icon", "message"), read per member below (#4461)
    const bools = Object.entries(set.componentPropertyDefinitions || {}).filter(([, d]) => d.type === 'BOOLEAN');
    // every own layer of a member with its path; a nested instance's internals are another component's, so not entered
    const layers = (m) => { const out = []; const go = (n, path) => { for (const c of n.children || []) { const p = `${path}/${c.name}`; out.push([p, c]); if (c.type !== 'INSTANCE') go(c, p); } }; go(m, 'container'); return out; };
    const wiredTo = (n) => (n.componentPropertyReferences || {}).visible;
    // the layer paths any member wires to each property
    const wiredPaths = {};
    for (const m of set.children) if (m.type === 'COMPONENT') for (const [p, n] of layers(m)) if (wiredTo(n)) (wiredPaths[wiredTo(n)] = wiredPaths[wiredTo(n)] || new Set()).add(p);
    for (const m of set.children) {
      if (m.type !== 'COMPONENT') continue;
      const own = layers(m);
      const properties = {};
      const unwired = [];
      for (const [key, def] of bools) {
        const name = key.split('#')[0];
        const wired = own.filter(([, n]) => wiredTo(n) === key);
        const peers = wired.length ? [] : own.filter(([p]) => (wiredPaths[key] || new Set()).has(p));
        if (wired.length) properties[name] = String(wired.every(([, n]) => n.visible !== false));
        else if (peers.length) { properties[name] = String(peers.every(([, n]) => n.visible !== false)); unwired.push(name); }
        else properties[name] = String(def.defaultValue);
      }
      const o = m.absoluteBoundingBox;
      const parts = {};
      const walk = (n, path) => {
        for (const c of n.children || []) {
          if (c.visible === false) continue;
          const p = `${path}/${c.name}`;
          const b = c.absoluteBoundingBox;
          // its stroke (each side), and the part of it that takes layout space: none, unless the frame includes its
          // strokes in layout (an INSIDE stroke draws over the padding; a CSS border is added to it)
          const sw = typeof c.strokeWeight === 'number' ? c.strokeWeight : 0;
          const stroke = c.strokes && c.strokes.length ? [c.strokeTopWeight, c.strokeRightWeight, c.strokeBottomWeight, c.strokeLeftWeight].map((v) => r2(typeof v === 'number' ? v : sw)) : [0, 0, 0, 0];
          if (b) parts[p] = {
            id: c.id, type: c.type, sizing: c.layoutSizingHorizontal || null, x: r2(b.x - o.x), y: r2(b.y - o.y), w: r2(b.width), h: r2(b.height),
            border: c.strokesIncludedInLayout === true ? stroke : [0, 0, 0, 0],
            ...(stroke.some((v) => v) ? { stroke: { weights: stroke, align: c.strokeAlign || null, inLayout: c.strokesIncludedInLayout === true } } : {}),
            ...(c.type === 'TEXT' ? { text: c.characters } : {}),
          };
          if (c.type !== 'TEXT') walk(c, p);
        }
      };
      walk(m, 'container');
      const weight = typeof m.strokeWeight === 'number' ? m.strokeWeight : 0;
      members.push({
        id: m.id,
        variant: m.variantProperties || {},
        properties,
        ...(unwired.length ? { unwired } : {}),
        root: {
          w: r2(o.width), h: r2(o.height), sizing: m.layoutSizingHorizontal || null, minWidth: typeof m.minWidth === 'number' ? r2(m.minWidth) : null,
          padding: [m.paddingTop, m.paddingRight, m.paddingBottom, m.paddingLeft].map((v) => r2(v || 0)),
          border: m.strokes && m.strokes.length ? [m.strokeTopWeight, m.strokeRightWeight, m.strokeBottomWeight, m.strokeLeftWeight].map((v) => r2(typeof v === 'number' ? v : weight)) : [0, 0, 0, 0],
          radius: [m.topLeftRadius, m.topRightRadius, m.bottomRightRadius, m.bottomLeftRadius].map((v) => r2(typeof v === 'number' ? v : (typeof m.cornerRadius === 'number' ? m.cornerRadius : 0))),
        },
        parts,
      });
    }
    out.components[set.name] = { setId: set.id, members };
  }
  return JSON.stringify(out);
})();
