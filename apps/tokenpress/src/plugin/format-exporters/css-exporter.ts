/**
 * CSS format exporter.
 * Converts DTCG tokens to CSS custom properties.
 */

import { DTCGToken, DTCGFile, DTCGShadowLayer } from '../../types/dtcg';
import { FormatOptions, PlatformExport, TokenTransformer } from '../../types/export-formats';
import { BaseFormatExporter } from './base-exporter';

/**
 * Converts a DTCG token path into a CSS custom-property name.
 *
 * This is the SINGLE source of truth for CSS identifiers, used by both the
 * declaration side (`--x:`) and the reference side (`var(--x)`). The two must
 * agree exactly or every aliased token emits a dangling `var()`.
 *
 * They previously diverged: declarations went through `sanitizeName`, which
 * lowercases, while references only swapped "." for "-" with no case handling.
 * That was invisible while token names were lowercased upstream, and broke the
 * moment names began preserving their original case. Splitting camelCase humps
 * (rather than flattening them) also matches what Style Dictionary's stock
 * `name/cti/kebab` transform produces, so the two pipelines agree.
 *
 * Accepts either a "." -delimited DTCG path or an alias's inner text.
 */
export function toCSSVariableName(tokenPath: string, prefix: string = ''): string {
  const kebab = tokenPath
    .replace(/[.]/g, '-')
    // camelCase / PascalCase humps -> word boundaries
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    // acronym followed by a capitalised word: "HTMLValue" -> "HTML-Value"
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    // collapse anything unsafe in a custom-property ident
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${prefix}${kebab}`;
}

/**
 * Writes a DTCG color object as a CSS color, in the notation of its own color space (prism3 #4477): `srgb` as
 * `rgb(r, g, b)` / `rgba(r, g, b, a)`, `hsl` as `hsl(h, s%, l%)` / `hsla(h, s%, l%, a)`, the alpha form only below
 * full alpha. The exporter writes HSL components as degrees and percents (0–100). Returns null for any other space,
 * so the caller decides what to write rather than a `String(object)`.
 */
export function formatDTCGColor(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const color = value as { colorSpace?: string; components?: number[]; alpha?: number };
  if (!Array.isArray(color.components) || color.components.length < 3) {
    return null;
  }
  const translucent = color.alpha !== undefined && color.alpha < 1;
  const [c1, c2, c3] = color.components;
  if (color.colorSpace === 'srgb') {
    const rgb = [Math.round(c1 * 255), Math.round(c2 * 255), Math.round(c3 * 255)].join(', ');
    return translucent ? `rgba(${rgb}, ${color.alpha})` : `rgb(${rgb})`;
  }
  if (color.colorSpace === 'hsl') {
    const hsl = `${c1}, ${c2}%, ${c3}%`;
    return translucent ? `hsla(${hsl}, ${color.alpha})` : `hsl(${hsl})`;
  }
  return null;
}

/**
 * CSS Token Transformer
 * Handles conversion of DTCG tokens to CSS values
 */
export class CSSTokenTransformer implements TokenTransformer {
  /**
   * Prefix applied to emitted custom-property names. Must match the prefix the
   * exporter uses for declarations, or `var()` references won't resolve.
   */
  private prefix: string = '';

  setPrefix(prefix: string): void {
    this.prefix = prefix || '';
  }

  /**
   * Turns a DTCG alias's inner text into a matching `var()` reference.
   */
  private aliasToVar(aliasInner: string): string {
    return `var(--${toCSSVariableName(aliasInner, this.prefix)})`;
  }

  transformColor(token: DTCGToken, path: string): string {
    const value = token.$value as any;

    if (typeof value === 'string' && value.startsWith('{')) {
      // This is a reference, return as CSS custom property
      return this.aliasToVar(value.slice(1, -1));
    }

    const css = formatDTCGColor(value);
    return css !== null ? css : String(value);
  }

  transformDimension(token: DTCGToken, path: string): string {
    const value = token.$value as any;

    // Three shapes are supported:
    //   1. DTCG alias: '{path.to.token}' → resolve to var()
    //   2. SD-preset string: '4px' / '0.5rem' → pass through
    //   3. DTCG dimension object: { value, unit } → stringify
    if (typeof value === 'string') {
      if (value.startsWith('{') && value.endsWith('}')) {
        return this.aliasToVar(value.slice(1, -1));
      }
      return value;
    }

    if (typeof value === 'object' && value !== null && value.value !== undefined) {
      return `${value.value}${value.unit || 'px'}`;
    }

    return String(value);
  }

  transformTypography(token: DTCGToken, path: string): string {
    // Typography composites don't have a direct CSS equivalent
    // This method is not used for the expanded approach
    // Individual properties are handled in the exporter
    return `/* Typography composite - see individual properties */`;
  }

  /**
   * Transform individual typography properties to CSS values
   */
  transformTypographyProperty(value: any, propertyName: string): string {
    // Handle references
    if (typeof value === 'string' && value.startsWith('{')) {
      return this.aliasToVar(value.slice(1, -1));
    }

    // Handle dimension objects (fontSize, letterSpacing)
    if (typeof value === 'object' && value !== null && value.value !== undefined) {
      return `${value.value}${value.unit || 'px'}`;
    }

    // Handle plain values
    return String(value);
  }

  transformShadow(token: DTCGToken, path: string): string {
    const value = token.$value as any;

    if (Array.isArray(value)) {
      // Multiple shadow layers
      return value.map(layer => this.formatShadowLayer(layer)).join(', ');
    } else {
      // Single shadow layer
      return this.formatShadowLayer(value);
    }
  }

  /**
   * prism3 #3886: a DTCG `cubicBezier` (`[x1, y1, x2, y2]`) is CSS's `cubic-bezier()`. An alias stays a `var()`.
   */
  transformCubicBezier(token: DTCGToken): string | null {
    const value = token.$value as unknown;
    if (typeof value === 'string' && value.charAt(0) === '{') {
      return this.aliasToVar(value.slice(1, -1));
    }
    if (Array.isArray(value) && value.length === 4 && value.every(n => typeof n === 'number')) {
      return `cubic-bezier(${value.join(', ')})`;
    }
    return null;
  }

  /**
   * prism3 #3886: a DTCG `duration` is written in `ms`. The object form (`{ value, unit }`) is converted, seconds
   * included; a string such as `"50ms"` is already CSS. An alias stays a `var()`.
   */
  transformDuration(token: DTCGToken): string | null {
    const value = token.$value as unknown;
    if (typeof value === 'string') {
      return value.charAt(0) === '{' ? this.aliasToVar(value.slice(1, -1)) : value;
    }
    if (value && typeof value === 'object' && typeof (value as { value?: unknown }).value === 'number') {
      const d = value as { value: number; unit?: string };
      const ms = d.unit === 's' ? d.value * 1000 : d.value;
      return `${Math.round(ms * 1000) / 1000}ms`;
    }
    if (typeof value === 'number') {
      return `${value}ms`;
    }
    return null;
  }

  transformGeneric(token: DTCGToken, path: string, type: string): string {
    const value = token.$value;

    if (typeof value === 'string' && value.startsWith('{')) {
      return this.aliasToVar(value.slice(1, -1));
    }

    // Handle objects (dimension, etc.) by stringifying
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }

    return String(value);
  }

  private formatShadowLayer(layer: DTCGShadowLayer): string {
    const parts = [];

    if (layer.inset) {
      parts.push('inset');
    }

    // Shadow dimensions can be DTCGDimension objects (the spec default) or
    // CSS strings (Style Dictionary preset). Format helper handles both.
    parts.push(this.formatShadowDimension(layer.offsetX));
    parts.push(this.formatShadowDimension(layer.offsetY));
    parts.push(this.formatShadowDimension(layer.blur));

    if (layer.spread) {
      parts.push(this.formatShadowDimension(layer.spread));
    }

    if (layer.color) {
      // Convert DTCG color object to CSS color string
      const color = layer.color;
      if (typeof color === 'string') {
        parts.push(color);
      } else {
        const css = formatDTCGColor(color);
        if (css !== null) {
          parts.push(css);
        }
      }
    }

    return parts.join(' ');
  }

  /**
   * Format a single shadow dimension for the CSS shorthand. Handles three
   * cases: DTCGDimension object, CSS-string ('4px'), or DTCG alias
   * ('{shadow.offset}'). Aliases get var() resolution; strings pass through;
   * objects are stringified as `${value}${unit}`.
   */
  private formatShadowDimension(dim: DTCGShadowLayer['offsetX'] | undefined): string {
    if (!dim) {
      return '0px';
    }
    if (typeof dim === 'string') {
      // Alias references look like '{path.to.token}' — resolve to var().
      // Plain CSS strings ('4px') pass through unchanged.
      if (dim.startsWith('{') && dim.endsWith('}')) {
        return this.aliasToVar(dim.slice(1, -1));
      }
      return dim;
    }
    return `${dim.value || 0}${dim.unit || 'px'}`;
  }
}

/**
 * CSS Format Exporter
 * Exports DTCG tokens as CSS custom properties
 */
export class CSSFormatExporter extends BaseFormatExporter {
  constructor() {
    super(new CSSTokenTransformer());
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async export(tokens: DTCGFile, options: FormatOptions): Promise<PlatformExport[]> {
    const cssOptions = options.config?.css || {};
    const prefix = cssOptions.prefix || '';
    const useCustomProperties = cssOptions.useCustomProperties !== false; // Default true

    // The transformer emits the reference side (`var(--x)`); it needs the same
    // prefix the declaration side uses or references won't resolve.
    (this.transformer as CSSTokenTransformer).setPrefix(prefix);

    const lines: string[] = [];
    const omitted: string[] = [];

    // Add header comment with mode name if available
    const modeName = tokens.$extensions?.figma?.mode;
    lines.push('/**');
    lines.push(` * Design Tokens - CSS Custom Properties${modeName ? ` (${modeName})` : ''}`);
    lines.push(' * Generated by Token Press');
    lines.push(' */');
    lines.push('');

    if (useCustomProperties) {
      lines.push(':root {');

      this.walkTokens(tokens, (token, path) => {
        // Handle typography composites by expanding into individual properties
        if (token.$type === 'typography' && typeof token.$value === 'object') {
          this.expandTypographyToken(token, path, prefix, lines);
        } else {
          const cssPath = toCSSVariableName(path, prefix);
          const value = this.transformToken(token, path);
          // prism3 #3886: a value with no CSS form is left out and named, never written as JSON.
          if (value === null) {
            omitted.push(path);
            return;
          }
          lines.push(`  --${cssPath}: ${value};`);
        }
      });

      lines.push('}');
    } else {
      // Generate CSS classes/utilities if requested
      if (cssOptions.generateUtilities) {
        lines.push('/* Utility Classes */');
        this.walkTokens(tokens, (token, path) => {
          if (token.$type === 'color') {
            const className = toCSSVariableName(path, prefix);
            const value = this.transformToken(token, path);
            lines.push(`.${className} { color: ${value}; }`);
            lines.push(`.bg-${className} { background-color: ${value}; }`);
          }
        });
      }
    }

    const content = lines.join('\n');

    const out = this.createExport('tokens.css', content, 'css', 'text/css');
    if (omitted.length > 0) {
      out.omitted = omitted;
    }
    return [out];
  }

  getSupportedExtensions(): string[] {
    return ['css'];
  }

  getDisplayName(): string {
    return 'CSS Custom Properties';
  }

  /**
   * The CSS value of a token, or null when CSS has no form for it (prism3 #3886, owner decision A): easing and
   * durations have one; any other value that is an object or an array (a gradient, a spring, a font stack) does not,
   * and is left out rather than written as JSON.
   */
  private transformToken(token: DTCGToken, path: string): string | null {
    const transformer = this.transformer as CSSTokenTransformer;
    switch (token.$type) {
      case 'color':
        return this.transformer.transformColor(token, path);
      case 'dimension':
        return this.transformer.transformDimension(token, path);
      case 'typography':
        return this.transformer.transformTypography(token, path);
      case 'shadow':
        return this.transformer.transformShadow(token, path);
      case 'cubicBezier':
        return transformer.transformCubicBezier(token);
      case 'duration':
        return transformer.transformDuration(token);
      default: {
        const value = token.$value as unknown;
        if (value !== null && typeof value === 'object') {
          return null;
        }
        return this.transformer.transformGeneric(token, path, token.$type);
      }
    }
  }

  /**
   * Expand a typography composite token into individual CSS properties
   */
  private expandTypographyToken(
    token: DTCGToken,
    path: string,
    prefix: string,
    lines: string[]
  ): void {
    const typographyValue = token.$value as any;
    const transformer = this.transformer as CSSTokenTransformer;

    // Define the typography properties we want to export. Mirrors the keys
    // the TypographyConverter actually emits on $value — keep in sync if the
    // composite shape grows.
    const propertyMap: Record<string, string> = {
      fontFamily: 'font-family',
      fontSize: 'font-size',
      fontWeight: 'font-weight',
      letterSpacing: 'letter-spacing',
      lineHeight: 'line-height',
      fontStyle: 'font-style',
      textDecoration: 'text-decoration',
      textDecorationThickness: 'text-decoration-thickness',
      textDecorationOffset: 'text-underline-offset',
    };

    // Create a CSS variable for each property
    for (const [dtcgProp, cssProp] of Object.entries(propertyMap)) {
      if (typographyValue[dtcgProp] !== undefined) {
        const cssPath = toCSSVariableName(`${path}-${cssProp}`, prefix);
        const value = transformer.transformTypographyProperty(typographyValue[dtcgProp], dtcgProp);
        lines.push(`  --${cssPath}: ${value};`);
      }
    }
  }
}
