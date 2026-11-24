/**
 * Dot Notation Exporter.
 * Exports Figma variables in a plain text format with dot-path keys.
 * Creates one file per collection/mode.
 */

import { DTCGFile } from '../../types/dtcg';
import { PlatformExport, FormatOptions, FormatExporter } from '../../types/export-formats';
import { TokenNameCase } from '../../types/plugin';
import {
  sanitizeTokenName,
  sanitizeFileName as sanitizeFileNameShared,
} from '../../utils/token-name-utils';
import { ComposedColor, hasAlpha, isComposedColor } from '../../types/figma-guards';

/**
 * Input data for dot notation export
 */
export interface DotNotationExportInput {
  variables: Variable[];
  collections: VariableCollection[];
  variableMap: Map<string, Variable>;
  /** Casing for emitted token paths; defaults to 'preserve'. */
  tokenNameCase?: TokenNameCase;
}

/**
 * Exporter for Figma variables in dot notation plain text format.
 * Output format: path.to.token: "value"
 * For aliases: path.to.token: "{alias.path}" -> "resolved value"
 */
export class DotNotationExporter implements FormatExporter {
  /**
   * Export using DTCG tokens (required by FormatExporter interface).
   * This method is not used - dot notation export uses exportRaw() instead.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async export(_tokens: DTCGFile, _options: FormatOptions): Promise<PlatformExport[]> {
    // This method is required by FormatExporter interface but won't be used
    // Dot notation export uses exportRaw() instead
    return [];
  }

  /**
   * Export Figma variables to dot notation format.
   * Main export method for dot notation data.
   */
  exportRaw(input: DotNotationExportInput): PlatformExport[] {
    const { variables, collections, variableMap, tokenNameCase } = input;
    const exports: PlatformExport[] = [];

    for (const collection of collections) {
      for (const mode of collection.modes) {
        // Filter variables for this collection and mode
        const modeVariables = variables.filter(
          v => v.variableCollectionId === collection.id && v.valuesByMode[mode.modeId] !== undefined
        );

        if (modeVariables.length === 0) {
          continue;
        }

        // Build the content
        const lines: string[] = [];

        // Add header comments
        lines.push(`# Collection: ${collection.name}`);
        lines.push(`# Mode: ${mode.name}`);
        lines.push('');

        // Sort variables by name for consistent output. Use Array.concat() instead
        // of array spread — strict ES2018 target (see project-es2018-constraint).
        const sortedVariables = ([] as typeof modeVariables)
          .concat(modeVariables)
          .sort((a, b) => a.name.localeCompare(b.name));

        // Format each variable
        for (const variable of sortedVariables) {
          const line = this.formatVariable(variable, mode.modeId, variableMap, tokenNameCase);
          lines.push(line);
        }

        // Generate filename
        const fileName = this.generateFileName(collection.name, mode.name, collection.modes.length);

        exports.push({
          fileName,
          content: lines.join('\n'),
          extension: 'txt',
          mimeType: 'text/plain',
        });
      }
    }

    return exports;
  }

  /**
   * Format a single variable for dot notation output
   */
  private formatVariable(
    variable: Variable,
    modeId: string,
    variableMap: Map<string, Variable>,
    nameCase?: TokenNameCase
  ): string {
    const dotPath = this.convertToDotNotation(variable.name, nameCase);
    const rawValue = variable.valuesByMode[modeId];

    // Check if this is an alias
    if (this.isVariableAlias(rawValue)) {
      const aliasValue = rawValue;
      const targetVariable = variableMap.get(aliasValue.id);
      const aliasPath = targetVariable
        ? this.convertToDotNotation(targetVariable.name, nameCase)
        : 'unknown';

      // Resolve the actual value
      const resolvedValue = this.resolveComposedColor(
        this.resolveAliasValue(aliasValue, variableMap, modeId),
        variableMap,
        modeId
      );
      const formattedValue = this.formatValue(resolvedValue, variable.resolvedType);

      return `${dotPath}: "{${aliasPath}}" -> ${formattedValue}`;
    }

    // A color at an opacity (prism3 #4475): written as its reference and its opacity, then the color it resolves to at
    // that alpha, as an alias line is. Read as a plain color, it wrote `rgb(NaN, NaN, NaN)`.
    if (isComposedColor(rawValue)) {
      const formattedValue = this.formatValue(
        this.resolveComposedColor(rawValue, variableMap, modeId),
        variable.resolvedType
      );
      return `${dotPath}: "${this.describeComposedColor(rawValue, variableMap, nameCase)}" -> ${formattedValue}`;
    }

    // Regular value
    const formattedValue = this.formatValue(rawValue, variable.resolvedType);
    return `${dotPath}: ${formattedValue}`;
  }

  /**
   * A composed color (`{ color, opacity }`, the opacity a percent) resolved to the RGBA a designer sees: the color's
   * alpha multiplied by the opacity. Any other value is returned as it is; a half that does not resolve gives null.
   *
   * The color half may alias ANOTHER composed color (prism3 #4478): Figma lets its alias target any COLOR variable,
   * whose value may itself be composed. That inner wash resolves its own halves in the mode it was read in, and the
   * outer opacity multiplies its alpha. Depth-limited, as the alias walk is.
   */
  private resolveComposedColor(
    value: unknown,
    variableMap: Map<string, Variable>,
    modeId: string,
    depth: number = 0
  ): unknown {
    if (!isComposedColor(value)) {
      return value;
    }
    if (depth >= 10) {
      return null;
    }
    let color: unknown = value.color;
    if (this.isVariableAlias(value.color)) {
      const at = this.resolveAliasValueAt(value.color, variableMap, modeId);
      color = isComposedColor(at.value)
        ? this.resolveComposedColor(at.value, variableMap, at.modeId, depth + 1)
        : at.value;
    }
    const percent = this.isVariableAlias(value.opacity)
      ? this.resolveAliasValue(value.opacity, variableMap, modeId)
      : value.opacity;
    if (
      typeof color !== 'object' ||
      color === null ||
      !('r' in color) ||
      typeof percent !== 'number'
    ) {
      return null;
    }
    const rgb = color as RGB | RGBA;
    return { r: rgb.r, g: rgb.g, b: rgb.b, a: (hasAlpha(rgb) ? rgb.a : 1) * (percent / 100) };
  }

  /** A composed color's two halves as written: `{color.path} @ 30%`, either half an alias or a literal. */
  private describeComposedColor(
    value: ComposedColor,
    variableMap: Map<string, Variable>,
    nameCase?: TokenNameCase
  ): string {
    const ref = (alias: VariableAlias): string => {
      const target = variableMap.get(alias.id);
      return `{${target ? this.convertToDotNotation(target.name, nameCase) : 'unknown'}}`;
    };
    const color = this.isVariableAlias(value.color)
      ? ref(value.color)
      : this.formatValue(value.color, 'COLOR').slice(1, -1);
    const opacity = this.isVariableAlias(value.opacity) ? ref(value.opacity) : `${value.opacity}%`;
    return `${color} @ ${opacity}`;
  }

  /**
   * Convert Figma variable path to dot notation, honouring the token-name
   * casing mode. Delegates to the shared token-name utility so this stays in
   * step with the DTCG export.
   * e.g., "color/primary/500" -> "color.primary.500"
   */
  private convertToDotNotation(name: string, nameCase?: TokenNameCase): string {
    return sanitizeTokenName(name, nameCase).replace(/\//g, '.');
  }

  /**
   * Format a value for dot notation output
   */
  private formatValue(value: unknown, resolvedType: string): string {
    if (value === null || value === undefined) {
      return '"null"';
    }

    // Handle colors
    if (resolvedType === 'COLOR' && typeof value === 'object' && value !== null) {
      const color = value as { r: number; g: number; b: number; a: number };
      const r = Math.round(color.r * 255);
      const g = Math.round(color.g * 255);
      const b = Math.round(color.b * 255);

      if (color.a !== undefined && color.a < 1) {
        return `"rgba(${r}, ${g}, ${b}, ${color.a.toFixed(2)})"`;
      }
      return `"rgb(${r}, ${g}, ${b})"`;
    }

    // Handle floats/numbers
    if (typeof value === 'number') {
      // Check if it's a whole number
      if (Number.isInteger(value)) {
        return `"${value}"`;
      }
      return `"${value.toFixed(2)}"`;
    }

    // Handle booleans
    if (typeof value === 'boolean') {
      return `"${value}"`;
    }

    // Handle strings
    if (typeof value === 'string') {
      return `"${value}"`;
    }

    // Handle objects (stringify)
    if (typeof value === 'object') {
      return `"${JSON.stringify(value)}"`;
    }

    // Handle symbols
    if (typeof value === 'symbol') {
      return `"${value.toString()}"`;
    }

    // Handle bigint
    if (typeof value === 'bigint') {
      return `"${value.toString()}"`;
    }

    // Handle function (unlikely but for completeness)
    if (typeof value === 'function') {
      return '"[function]"';
    }

    // Fallback - should not reach here
    return '"unknown"';
  }

  /**
   * Check if a value is a variable alias
   */
  private isVariableAlias(value: unknown): value is VariableAlias {
    return (
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      (value as any).type === 'VARIABLE_ALIAS'
    );
  }

  /**
   * Recursively resolve alias values
   */
  private resolveAliasValue(
    alias: VariableAlias,
    variableMap: Map<string, Variable>,
    preferredModeId: string
  ): unknown {
    return this.resolveAliasValueAt(alias, variableMap, preferredModeId).value;
  }

  /**
   * `resolveAliasValue`, also reporting the mode the value was read in: the preferred mode, or the last variable's
   * first mode when the preferred one is not its own (prism3 #4478), so a composed value resolves its halves there.
   */
  private resolveAliasValueAt(
    alias: VariableAlias,
    variableMap: Map<string, Variable>,
    preferredModeId: string,
    depth: number = 0
  ): { value: unknown; modeId: string } {
    // Prevent infinite loops
    if (depth > 10) {
      return { value: null, modeId: preferredModeId };
    }

    const targetVariable = variableMap.get(alias.id);
    if (!targetVariable) {
      return { value: null, modeId: preferredModeId };
    }

    // Try to get value for the preferred mode, or fall back to first mode
    let readModeId = preferredModeId;
    let value = targetVariable.valuesByMode[preferredModeId];
    if (value === undefined) {
      readModeId = Object.keys(targetVariable.valuesByMode)[0];
      value = targetVariable.valuesByMode[readModeId];
    }

    if (this.isVariableAlias(value)) {
      return this.resolveAliasValueAt(value, variableMap, preferredModeId, depth + 1);
    }

    return { value: value, modeId: readModeId };
  }

  /**
   * Generate filename for export
   */
  private generateFileName(collectionName: string, modeName: string, totalModes: number): string {
    const sanitizedCollection = this.sanitizeFileName(collectionName);

    // If only one mode, don't include mode name in filename
    if (totalModes === 1) {
      return `${sanitizedCollection}.txt`;
    }

    const sanitizedMode = this.sanitizeFileName(modeName);
    return `${sanitizedCollection}-${sanitizedMode}.txt`;
  }

  /**
   * Sanitize a string for use in filenames
   */
  private sanitizeFileName(name: string): string {
    return sanitizeFileNameShared(name);
  }

  getSupportedExtensions(): string[] {
    return ['txt'];
  }

  getDisplayName(): string {
    return 'Dot Notation';
  }

  validateTokens(): { isValid: boolean; errors: string[] } {
    // Dot notation export doesn't use DTCG tokens, always valid
    return { isValid: true, errors: [] };
  }
}
