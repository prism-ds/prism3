/**
 * Prism3 Figma plugin — LOAD THE FONTS A VARIABLE WRITE WILL FORCE FIGMA TO RE-RESOLVE (#680).
 *
 * Applying the aurora brand to a file that had been themed failed outright, from the writer that
 * touches no text at all:
 *
 *   write failed: in setValueForMode: unloaded font "Clash Display Semi Bold".
 *
 * A text style in the file binds its `fontFamily` to a `font/family/<category>` variable. Writing that
 * variable makes Figma re-resolve the style, and re-resolution needs the resulting face LOADED — per
 * plugin run, so nothing a previous session loaded counts. `write-text-styles.ts` and
 * `write-components.ts` both load fonts before touching text; the variable writer loaded none, which is
 * the whole defect.
 *
 * WHY THE FACE TO LOAD IS A CROSS PRODUCT, NOT A SET EITHER BRAND DECLARES. #680 offered two ways to
 * choose the font set — derive it from the theme, or read what is already in the file — and the reported
 * face is evidence that NEITHER alone is enough. Measured on the two brands from the live run:
 *
 *     aurora's plan names   Clash Display|Bold, Clash Display|Medium, Inter|{Regular,Bold,Medium}, JetBrains Mono|Regular
 *     harbor's plan names   Inter|{Regular,Bold,Semi Bold}, JetBrains Mono|Regular
 *     the live failure was  Clash Display | Semi Bold
 *
 * `Clash Display` is the family aurora is writing. `Semi Bold` is a style only HARBOR names — the file
 * had been themed harbor, and that style is still sitting there. The pair appears in no plan: Figma
 * re-resolves the existing style against the INCOMING family value while keeping its OWN style name. So
 * a theme-derived set misses it (aurora never says `Semi Bold`), and a file-derived set misses it too
 * (the file never said `Clash Display`). It is only visible as the product of the two.
 *
 * That also settles the direction the issue left open: the file read is not optional. A theme-only load
 * additionally misses `Inter|Semi Bold` — a face the file needs and the incoming brand does not mention.
 *
 * DEGRADES, NEVER THROWS. Every load is attempted independently and a failure is recorded, mirroring
 * `write-text-styles`' skip-with-warning posture. Candidates carry their ORIGIN, because the two kinds
 * of failure mean opposite things: a face the theme or the file actually names failing to load is worth
 * a designer's attention, while a crossed pair failing is the expected case (most family × style
 * combinations do not exist) and reporting those would bury the real ones in noise.
 *
 * Compiled under `tsconfig.main.json` — has `figma.*`, NO `document`. Declared as a port so the Node
 * harness drives it with a shim; the real `figma` structurally satisfies it.
 */
import type { TextStylePlan, VarCollectionPlan } from '@prism3/engine/figma';
import { normStyle, resolveFontStyle } from './write-text-styles';
import type { FontName } from './write-text-styles';

/** The minimal `figma` font + text-style surface the preload needs. */
export interface FontPreloadApi {
  /** The file's EXISTING text styles — their current faces, and the styles that will be re-resolved. */
  getLocalTextStylesAsync(): Promise<{ name: string; fontName: FontName }[]>;
  loadFontAsync(fontName: FontName): Promise<void>;
  /** What this Figma can actually load (#499's list). OPTIONAL: without it every candidate is attempted
   *  and the unavailable ones are recorded, which is correct but chattier. */
  listAvailableFontsAsync?(): Promise<ReadonlyArray<{ fontName: FontName }>>;
}

/** Where a candidate face came from — decides whether a failed load is reportable. */
export type FaceOrigin = 'theme' | 'file' | 'crossed';

export type FontPreloadResult = {
  /** faces successfully loaded, so the write that follows cannot fail on them. */
  loaded: number;
  /** the BRAND's own faces that loaded: distinct loaded faces some `theme` candidate resolved to (#1090). The
   *  number the Apply Theme summary reports. `loaded` also counts faces preloaded for the styles the file
   *  already held (file and crossed), so it grew between two applies of one brand as the file filled up —
   *  4 on an empty file, 6 once the first run's styles were there — under a sentence that reads as the
   *  brand's fonts. This depends only on the brand and the host's font list. */
  brandLoaded: number;
  /** distinct resolved faces passed to `loadFontAsync` (loaded + failed loads). Not `loaded + unavailable
   *  + crossedMisses`: a resolver miss is reported without a load, and a repeat of a failed face is
   *  reported again under its own origin without a second load. */
  attempted: number;
  /** NAMED faces that would not load: the theme asks for a typeface this Figma does not have, or the
   *  file already uses one. Reportable — a brand is about to lose type it asked for. */
  unavailable: { face: string; origin: FaceOrigin; reason: string }[];
  /** crossed pairs that did not exist. Expected, counted rather than listed (see the header). */
  crossedMisses: number;
  /** the candidate set by origin, so a caller can assert the cross product was actually built. */
  byOrigin: Record<FaceOrigin, number>;
};

const key = (f: FontName): string => `${f.family}|${f.style}`;

/**
 * Every face the imminent variable write could force Figma to re-resolve, with its origin.
 *
 * Exported separately from the loading so the set is assertable without a font registry: the interesting
 * claim is WHICH faces this computes, and a test that has to load them all to find out is testing the
 * host's font list as much as this. Ordered named-before-crossed so the reportable loads happen first.
 */
export const facesToPreload = (
  plan: TextStylePlan,
  existing: readonly { fontName: FontName }[],
): { face: FontName; origin: FaceOrigin }[] => {
  const out: { face: FontName; origin: FaceOrigin }[] = [];
  const seen = new Set<string>();
  const add = (face: FontName, origin: FaceOrigin): void => {
    if (!face.family || !face.style || seen.has(key(face))) return;
    seen.add(key(face));
    out.push({ face, origin });
  };
  // The two named sets first — a real face that will not load must be reported before the speculative
  // pairs get a chance to fill the attempt budget.
  for (const row of plan) add({ family: row.fontFamilyPrimary, style: row.fontStyle }, 'theme');
  for (const s of existing) add(s.fontName, 'file');
  // ...then the product that produced the reported failure: an existing style keeps its own style name
  // and picks up the incoming family (and the mirror case, for a file whose family survives while the
  // brand changes a weight). `seen` means anything already named is not re-added as crossed.
  //
  // BLANKET, NOT PER-STYLE — and why that is still a superset of the pairs that can actually resolve.
  // The precise set is "for each existing style, cross its baked style with the NEW value of the
  // font/family/<category> variable it binds" — but that needs knowing which category each style binds,
  // which this function does not have. Crossing every theme family with every file style (and back) is
  // coarser: it also produces pairs no existing style will ever resolve to (e.g. a family this file's
  // styles never used, paired with a style that family's own category never had) — expected noise,
  // counted in `crossedMisses` rather than reported. It is a superset of the precise set, and specifically
  // ONLY because the incoming write sets every font/family/* category the file's existing styles bind —
  // so every (category, new-family) pair a re-resolving style needs is somewhere in `themeFamilies`, and
  // every baked style still in the file is somewhere in `fileStyles`. That is a property of today's plan
  // shape (every brand's TextStylePlan covers the full category set), not a guarantee this function
  // enforces — a theme plan that wrote only SOME categories could leave a real pair uncrossed while this
  // function reports the (wrong) blanket set as complete. If plans ever become partial, this needs
  // either a per-category cross (using each style's actual bound category) or an assertion here that
  // `themeFamilies`' categories are a superset of whatever categories `existing` binds.
  const themeFamilies = [...new Set(plan.map((r) => r.fontFamilyPrimary))].filter(Boolean);
  const themeStyles = [...new Set(plan.map((r) => r.fontStyle))].filter(Boolean);
  const fileFamilies = [...new Set(existing.map((s) => s.fontName.family))].filter(Boolean);
  const fileStyles = [...new Set(existing.map((s) => s.fontName.style))].filter(Boolean);
  for (const family of themeFamilies) for (const style of fileStyles) add({ family, style }, 'crossed');
  for (const family of fileFamilies) for (const style of themeStyles) add({ family, style }, 'crossed');
  return out;
};

/**
 * Load them. Call this BEFORE the first variable write of an apply — the point is that no
 * `setValueForMode` afterwards can throw `unloaded font`.
 *
 * A face the host's font list does not contain is not attempted (the list, when offered, is the cheaper
 * and quieter answer); a host that offers no list has every candidate attempted instead, so a missing
 * capability degrades to more work rather than to less coverage.
 *
 * "DOES NOT CONTAIN" MEANS UNDER ANY SPELLING (#1789). Each candidate's style is resolved against its
 * family's real style list with `resolveFontStyle` — the #499 resolver the text-style pass uses — and the
 * RESOLVED face is what gets loaded. An exact `family|style` test here reported `Playfair Display|Semi
 * Bold Italic` unavailable on a Figma whose Playfair ships `SemiBold Italic`, while the text-style pass,
 * resolving the same row, wrote the style correctly: the warning contradicted the apply it sat in. Only a
 * resolver `undefined` (the family lacks the weight under every spelling, or the family is absent) is a
 * miss. Every origin resolves the same way — the origin decides whether a miss is REPORTED, never how a
 * face is looked up. Two candidates that resolve to one face load it once; if that load fails, each
 * named candidate among them is still reported, whichever candidate made the attempt.
 *
 * The verdict's "N font style names matched to the installed font" (#4185) stays the text-style pass's
 * count alone. It counts STYLES whose baked name was corrected; this resolves candidate FACES (file and
 * crossed pairs included, and a theme face the text-style pass will resolve again), so adding the two would
 * count one correction twice in a unit the sentence does not name.
 */
export const preloadFonts = async (
  plan: TextStylePlan,
  api: FontPreloadApi,
): Promise<FontPreloadResult> => {
  let existing: readonly { fontName: FontName }[] = [];
  try {
    existing = await api.getLocalTextStylesAsync();
  } catch {
    /* the file's styles are unreadable — the theme's own faces still load, which is strictly better
     * than loading nothing. Deliberately not fatal: this runs before a write that must still happen. */
  }
  return loadPreloadCandidates(facesToPreload(plan, existing), api);
};

/**
 * The host's real style names per family, from `listAvailableFontsAsync`. Keyed by family because the resolver needs
 * a family's whole style list, not a membership test on one spelling (#1789). `undefined` when the host offers no
 * list or the read throws: callers then fall back to the names as planned.
 */
export const availableStylesByFamily = async (
  api: Pick<FontPreloadApi, 'listAvailableFontsAsync'>,
): Promise<Map<string, string[]> | undefined> => {
  try {
    const list = await api.listAvailableFontsAsync?.();
    if (!list) return undefined;
    const byFamily = new Map<string, string[]>();
    for (const { fontName } of list) {
      const styles = byFamily.get(fontName.family);
      if (styles) styles.push(fontName.style);
      else byFamily.set(fontName.family, [fontName.style]);
    }
    return byFamily;
  } catch {
    return undefined;
  }
};

/** The text plan's cut → family pairing (`fontStyleVar` → `fontFamilyVar`), each pair once: all `resolveCutPlan` reads
 *  of the text plan. The agent paste's font step carries this instead of the whole text plan (#3861). */
export const cutPairsOf = (text: TextStylePlan): [string, string][] => {
  const out = new Map<string, string>();
  for (const r of text) if (r.fontStyleVar && r.fontFamilyVar) out.set(r.fontStyleVar, r.fontFamilyVar);
  return [...out];
};
const isPairs = (t: TextStylePlan | readonly (readonly [string, string])[]): t is readonly (readonly [string, string])[] => Array.isArray(t[0]);

/**
 * THE CUT VARIABLES, IN EACH FAMILY'S OWN SPELLING, BEFORE THE VARIABLE STAGE WRITES THEM (#1728).
 *
 * The engine names a cut one way per weight (`Semi Bold Italic`), and a family may spell it its own way (Playfair's
 * `SemiBold Italic`). The text-style stage corrects the cut variable (#1296), but the variable stage runs first, so it
 * wrote the engine's spelling on every apply: a run stopped between the two left the variable naming a style its
 * family does not have, and every re-apply put the wrong spelling back before correcting it again. This resolves each
 * cut row's literal per mode against the family the text plan pairs it with (`fontStyleVar` → `fontFamilyVar`, never a
 * name parse), with the same `resolveFontStyle` the text-style stage uses, so the two cannot disagree.
 *
 * Leaves a value as planned when there is no host list, when either row aliases in that mode, when the family is not
 * on this host, or when the family lacks the weight under every spelling. In Apply Theme that last case no longer
 * reaches here: `fillMissingWeights` (#4474) has already written the nearest weight in its place. On the agent paste
 * path, which does not fill, it is still a miss the preload and the text-style stage report. The text-style stage's
 * reconcile stays as the second reader, for a value this pass could not see. Pure; returns new plans and the count of
 * values it changed.
 */
export const resolveCutPlan = (
  plans: readonly VarCollectionPlan[],
  text: TextStylePlan | readonly (readonly [string, string])[],
  stylesByFamily: ReadonlyMap<string, readonly string[]> | undefined,
): { plans: VarCollectionPlan[]; resolved: number } => {
  if (!stylesByFamily) return { plans: [...plans], resolved: 0 };
  const familyVarOf = new Map<string, string>(isPairs(text) ? text : cutPairsOf(text));
  const rowOf = new Map(plans.flatMap((p) => p.rows.map((r) => [r.name, { plan: p, row: r }] as const)));
  let resolved = 0;
  const out = plans.map((p) => ({
    ...p,
    rows: p.rows.map((row) => {
      const famName = familyVarOf.get(row.name);
      const fam = famName ? rowOf.get(famName) : undefined;
      if (!fam || row.resolvedType !== 'STRING') return row;
      const valuesByMode = row.valuesByMode.map((cut, i) => {
        if (typeof cut !== 'string' || row.aliasByMode[i]) return cut;
        const j = fam.plan.modes.indexOf(p.modes[i]);
        const family = j < 0 ? undefined : fam.row.valuesByMode[j];
        if (typeof family !== 'string' || fam.row.aliasByMode[j]) return cut;
        const avail = stylesByFamily.get(family);
        const real = avail && resolveFontStyle(avail, cut);
        if (!real || real === cut) return cut;
        resolved++;
        return real;
      });
      return { ...row, valuesByMode };
    }),
  }));
  return { plans: out, resolved };
};

/**
 * The loading half of `preloadFonts`, over an explicit candidate list. Exported so a test can feed an
 * order `facesToPreload` never produces: nothing below may rely on named candidates coming first.
 */
export const loadPreloadCandidates = async (
  candidates: readonly { face: FontName; origin: FaceOrigin }[],
  api: Pick<FontPreloadApi, 'loadFontAsync' | 'listAvailableFontsAsync'>,
): Promise<FontPreloadResult> => {
  // The host's real styles per family, when it offers the list (#1789). No list: every candidate is attempted.
  const stylesByFamily = await availableStylesByFamily(api);

  let loaded = 0;
  let attempted = 0;
  let crossedMisses = 0;
  const unavailable: FontPreloadResult['unavailable'] = [];
  const byOrigin: Record<FaceOrigin, number> = { theme: 0, file: 0, crossed: 0 };

  /** resolved face → the outcome of its one load. Two spellings of one face load it once, and a repeat
   *  inherits the outcome: a failure is still REPORTED under the repeat's own origin. Holding the outcome,
   *  not just "seen", is what keeps this independent of candidate order — a named face whose load failed
   *  first under a crossed candidate must not vanish from the report. */
  const tried = new Map<string, { ok: true } | { ok: false; reason: string }>();
  /** resolved faces a theme candidate loaded (#1090). A set, filled from whichever candidate's outcome is read,
   *  so it does not depend on a theme candidate being the one that made the attempt. */
  const brandFaces = new Set<string>();

  for (const { face, origin } of candidates) {
    byOrigin[origin]++;
    // Resolve against the family's real styles (#1789). No list in hand: the candidate stands as named
    // and the load itself is the test, exactly as before.
    let toLoad = face;
    if (stylesByFamily) {
      const styles = stylesByFamily.get(face.family);
      const style = styles && resolveFontStyle(styles, face.style);
      if (!style) {
        // Known absent from this Figma under every spelling. A crossed pair missing is the ordinary
        // case; a named one missing is the same fact `write-text-styles` reports as skip-with-warning,
        // recorded here too so the warning does not depend on the text-style pass reaching that row.
        // The face is reported as ASKED FOR, not as some near-miss the resolver considered.
        if (origin === 'crossed') crossedMisses++;
        else unavailable.push({ face: key(face), origin, reason: 'not available in this Figma' });
        continue;
      }
      toLoad = { family: face.family, style };
    }
    let outcome = tried.get(key(toLoad));
    if (!outcome) {
      attempted++;
      try {
        await api.loadFontAsync(toLoad);
        loaded++;
        outcome = { ok: true };
      } catch (e) {
        outcome = { ok: false, reason: (e as Error)?.message ?? 'load failed' };
      }
      tried.set(key(toLoad), outcome);
    }
    if (outcome.ok) {
      if (origin === 'theme') brandFaces.add(key(toLoad));
      continue;
    }
    if (origin === 'crossed') crossedMisses++;
    else unavailable.push({ face: key(face), origin, reason: outcome.reason });
  }

  return { loaded, brandLoaded: brandFaces.size, attempted, unavailable, crossedMisses, byOrigin };
};

/* ---- #4474: A WEIGHT THE FAMILY LACKS, WARNED BEFORE THE WRITE AND FILLED BY THE NEAREST ONE ----------------------
 *
 * `resolveFontStyle` answers "is this weight here under some spelling?". When it is not (a family with no Semi Bold,
 * asked for 600), every text style on that weight was skipped mid-apply, one by one, and the reason reached the report
 * only as a count of skipped styles. Owner decision A on #4474 (2026-11-24) replaces that skip, the posture #237 chose:
 * before any write, name the missing face and point at the weight setting, then write the nearest weight the family has,
 * so no style is skipped. Only a weight the family lacks under EVERY spelling falls back: a spelling difference is still
 * `resolveFontStyle`'s, and a cut that is not a plain weight (a width cut such as `Light Condensed`) has no nearest and
 * keeps the old skip. */

/** Normalized weight words → the numeric weight (CSS's names, plus the synonyms `resolveFontStyle` treats as one). */
const WEIGHT_OF: Record<string, number> = {
  thin: 100, hairline: 100, extralight: 200, ultralight: 200, light: 300, regular: 400, normal: 400,
  medium: 500, semibold: 600, demibold: 600, demi: 600, bold: 700, extrabold: 800, ultrabold: 800, black: 900, heavy: 900,
};

/** A style name as a plain weight: `Semi Bold Italic` → 600, italic. `Italic` alone is Regular Italic. `undefined` for
 *  anything else (a width cut, a named display cut): those have no place on the weight axis to be near. */
export const styleWeightOf = (style: string): { weight: number; italic: boolean } | undefined => {
  let n = normStyle(style);
  const italic = n.endsWith('italic');
  if (italic) n = n.slice(0, -'italic'.length);
  if (!n) return italic ? { weight: 400, italic } : undefined;
  const weight = WEIGHT_OF[n];
  return weight === undefined ? undefined : { weight, italic };
};

/**
 * The family's style nearest in weight to `desired`, of the same italic-ness, or `undefined` when `desired` is not a
 * plain weight or the family has no plain weight of that italic-ness. Distance is the numeric weight; a tie goes the
 * way CSS font matching goes — lighter below 400, heavier from 400 up — so a missing 600 between 500 and 700 takes 700.
 */
export const nearestWeightStyle = (available: readonly string[], desired: string): string | undefined => {
  const want = styleWeightOf(desired);
  if (!want) return undefined;
  let best: { style: string; weight: number } | undefined;
  for (const style of available) {
    const w = styleWeightOf(style);
    if (!w || w.italic !== want.italic) continue;
    if (!best) { best = { style, weight: w.weight }; continue; }
    const d = Math.abs(w.weight - want.weight), bd = Math.abs(best.weight - want.weight);
    const towards = want.weight < 400 ? w.weight < best.weight : w.weight > best.weight;
    if (d < bd || (d === bd && towards)) best = { style, weight: w.weight };
  }
  return best?.style;
};

/** One missing face and what stands in for it: `asked` as the plan named it, `used` as the family spells it, and how
 *  many text styles take it. */
export type WeightFallback = { family: string; asked: string; used: string; styles: number };

/**
 * THE PLANS WITH EVERY MISSING WEIGHT FILLED BY THE NEAREST ONE (#4474), worked out before the first write so the
 * warning can come first and no stage meets a face it cannot load. Rewrites the text plan's `fontStyle` and each cut
 * variable's literal per mode, where the family (the row's own, or the mode's, read through the text plan's cut →
 * family pairing as `resolveCutPlan` reads it) lacks the weight under every spelling. Everything else is returned as
 * given. No host list, no change: without it there is nothing to be near. Pure.
 */
export const fillMissingWeights = (
  text: TextStylePlan,
  plans: readonly VarCollectionPlan[],
  stylesByFamily: ReadonlyMap<string, readonly string[]> | undefined,
): { text: TextStylePlan; plans: VarCollectionPlan[]; fallbacks: WeightFallback[] } => {
  if (!stylesByFamily) return { text, plans: [...plans], fallbacks: [] };
  const found = new Map<string, WeightFallback>();
  const stand = (family: string, asked: string): string | undefined => {
    const avail = stylesByFamily.get(family);
    if (!avail || resolveFontStyle(avail, asked)) return undefined;
    const used = nearestWeightStyle(avail, asked);
    if (!used) return undefined;
    const k = `${family}|${asked}`;
    if (!found.has(k)) found.set(k, { family, asked, used, styles: 0 });
    return used;
  };
  const outText = text.map((row) => {
    const used = stand(row.fontFamilyPrimary, row.fontStyle);
    if (!used) return row;
    found.get(`${row.fontFamilyPrimary}|${row.fontStyle}`)!.styles++;
    return { ...row, fontStyle: used };
  });
  const familyVarOf = new Map<string, string>(cutPairsOf(text));
  const rowOf = new Map(plans.flatMap((p) => p.rows.map((r) => [r.name, { plan: p, row: r }] as const)));
  const outPlans = plans.map((p) => ({
    ...p,
    rows: p.rows.map((row) => {
      const famName = familyVarOf.get(row.name);
      const fam = famName ? rowOf.get(famName) : undefined;
      if (!fam || row.resolvedType !== 'STRING') return row;
      let moved = false;
      const valuesByMode = row.valuesByMode.map((cut, i) => {
        if (typeof cut !== 'string' || row.aliasByMode[i]) return cut;
        const j = fam.plan.modes.indexOf(p.modes[i]);
        const family = j < 0 ? undefined : fam.row.valuesByMode[j];
        if (typeof family !== 'string' || fam.row.aliasByMode[j]) return cut;
        const used = stand(family, cut);
        if (!used) return cut;
        moved = true;
        return used;
      });
      return moved ? { ...row, valuesByMode } : row;
    }),
  }));
  return { text: outText, plans: outPlans, fallbacks: [...found.values()] };
};
