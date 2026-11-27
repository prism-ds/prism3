/**
 * THE HANDOFF'S VALUE FORMS, read by `render-qa.mjs`'s oracle (#4382). Kept in their own module so `handoff-values.test.mjs`
 * can pin them without launching a browser.
 *
 * The handoff writes DTCG 2025.10 value forms since #4360: a color is `{ colorSpace, components, alpha?, hex? }` and a
 * dimension is `{ value, unit }`. The older string forms (`#rrggbb[aa]`, `rgb()`/`rgba()`, `"4px"`) are still read, so the
 * harness runs against a handoff from either side of that change. Anything else throws, naming the value, so a new form
 * fails loudly rather than reading as black or 0.
 */
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const show = (v) => (typeof v === 'string' ? v : JSON.stringify(v));

/** A handoff color as 8-bit sRGB plus alpha. */
export const parseColor = (s) => {
  if (isObj(s)) {
    const a = s.alpha === undefined ? 1 : s.alpha;
    if (typeof a !== 'number' || a < 0 || a > 1) throw new Error(`unparsed handoff color ${show(s)}`);
    if (typeof s.hex === 'string' && /^#[0-9a-f]{6}$/i.test(s.hex)) return { ...parseColor(s.hex), a };
    if (s.colorSpace === 'srgb' && Array.isArray(s.components) && s.components.length === 3
      && s.components.every((c) => typeof c === 'number' && c >= 0 && c <= 1)) {
      const [r, g, b] = s.components.map((c) => c * 255);
      return { r, g, b, a };
    }
    throw new Error(`unparsed handoff color ${show(s)}`);
  }
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
  if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/.exec(s);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : m[5] ? +m[4] / 100 : +m[4] };
  throw new Error(`unparsed handoff color ${show(s)}`);
};

/** A handoff dimension in px. Only px: a rem or any other unit throws, because the page's root size is not the handoff's. */
export const px = (v) => {
  if (isObj(v)) {
    if (v.unit === 'px' && typeof v.value === 'number') return v.value;
    throw new Error(`not a px dimension: ${show(v)}`);
  }
  const m = /^(-?[\d.]+)px$/.exec(String(v));
  if (!m) throw new Error(`not a px dimension: ${show(v)}`);
  return +m[1];
};
