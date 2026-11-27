/**
 * The plugin adapter for the file facts scan (#2075 part 1): builds the engine's `FactsSource` from the open file and
 * runs `scanFileFacts` over it. Main thread only (`figma.*`). Read-only: it loads each page it reads (required under
 * `documentAccess: dynamic-page` before a page's children can be read) and reads; it writes nothing.
 *
 * SCOPE (#2853 Q5 A). `whole-file` (the default) loads and reads every page. `selection` (owner decision Q1 A) reads
 * the current page's selection, or the current page when nothing is selected, and loads no other page. `ids` loads
 * every page, then narrows to the named pages or layers. The engine's `scopePages` holds the rule; this only reads
 * the selection's ids. It never changes the selection or the current page.
 *
 * Figma's own objects satisfy the engine's structural types, so nothing is copied: the local lists are the host's
 * arrays, the pages are the host's page nodes, and the four lookups call the host's async getters. Nothing calls this
 * yet. Where the report surfaces (an agent-link read command, an export, the start screen) is the owner's call
 * (#2075's part 3 and the agent-link protocol), so this lands as a function and a test, not a message.
 *
 * `FactsHost` is the slice of `PluginAPI` this reads, so the global `figma` passes with no cast and a test passes a
 * shim (`file-shim.ts`'s `FileShim` and `NodeShim`).
 */
import { scanFileFacts, scopePages, type FactsComponent, type FactsStyle, type FactsNode, type FactsPage, type FactsSource, type FileFactsReport, type TextRun } from '@prism3/engine/figma';

type Page = FactsPage & { loadAsync?: () => Promise<void> };
type MainLike = { id: string; name: string; key?: string; remote?: boolean; parent?: { type: string; name: string; key?: string } | null } | null;

export type FactsHost = {
  variables: {
    getLocalVariableCollectionsAsync(): Promise<FactsSource['collections']>;
    getLocalVariablesAsync(): Promise<FactsSource['variables']>;
    getVariableByIdAsync(id: string): Promise<FactsSource['variables'][number] | null>;
    getVariableCollectionByIdAsync(id: string): Promise<FactsSource['collections'][number] | null>;
  };
  getLocalPaintStylesAsync(): Promise<readonly FactsStyle[]>;
  getLocalTextStylesAsync(): Promise<readonly FactsStyle[]>;
  getLocalEffectStylesAsync(): Promise<readonly FactsStyle[]>;
  getLocalGridStylesAsync(): Promise<readonly FactsStyle[]>;
  getStyleByIdAsync(id: string): Promise<FactsStyle | null>;
  root: { children: readonly Page[] };
  currentPage: Page & { readonly selection: readonly { readonly id: string }[] };
};
/** How a scan's scope is given: the whole file, the canvas selection (Q1 A), or an explicit list of page or layer ids. */
export type ScopeChoice = { from: 'whole-file' } | { from: 'selection' } | { from: 'ids'; ids: readonly string[] };

/** The fields a mixed text layer's runs are read for; the same names the engine's `TextRun` carries. */
const RUN_FIELDS = ['fontName', 'fontWeight', 'fontSize', 'lineHeight', 'fills', 'fillStyleId', 'textStyleId', 'boundVariables'] as const;

export async function figmaFactsSource(host: FactsHost, choice: ScopeChoice = { from: 'whole-file' }): Promise<FactsSource> {
  const all = host.root.children;
  let scoped: ReturnType<typeof scopePages>;
  if (choice.from === 'selection') {
    const current = host.currentPage;
    if (typeof current.loadAsync === 'function') await current.loadAsync();
    scoped = scopePages(all, { from: 'selection', page: current.id, ids: current.selection.map((n) => n.id) });
  } else {
    for (const p of all) if (typeof p.loadAsync === 'function') await p.loadAsync();
    scoped = scopePages(all, choice);
  }
  const { pages, scope } = scoped;
  const [collections, variables, paint, text, effect, grid] = await Promise.all([
    host.variables.getLocalVariableCollectionsAsync(),
    host.variables.getLocalVariablesAsync(),
    host.getLocalPaintStylesAsync(),
    host.getLocalTextStylesAsync(),
    host.getLocalEffectStylesAsync(),
    host.getLocalGridStylesAsync(),
  ]);
  return {
    collections, variables, styles: { paint, text, effect, grid }, pages, scope,
    variableById: (id) => host.variables.getVariableByIdAsync(id),
    collectionById: (id) => host.variables.getVariableCollectionByIdAsync(id),
    styleById: (id) => host.getStyleByIdAsync(id),
    mainComponent: async (node: FactsNode): Promise<FactsComponent | null> => {
      const get = (node as { getMainComponentAsync?: () => Promise<MainLike> }).getMainComponentAsync;
      const main = typeof get === 'function' ? await get.call(node) : null;
      if (!main) return null;
      const set = main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent : null;
      return { id: main.id, name: main.name, key: main.key, remote: !!main.remote, ...(set ? { setName: set.name, setKey: set.key } : {}) };
    },
    textRuns: (node: FactsNode): readonly TextRun[] | null => {
      const get = (node as { getStyledTextSegments?: (f: readonly string[]) => readonly TextRun[] }).getStyledTextSegments;
      return typeof get === 'function' ? get.call(node, RUN_FIELDS) : null;
    },
  };
}

/** Scan the open file, in a scope (the whole file by default). `figma` passes as the host. */
export async function scanOpenFile(host: FactsHost, choice?: ScopeChoice): Promise<FileFactsReport> {
  return scanFileFacts(await figmaFactsSource(host, choice));
}

/** Compile-time proof that the global `figma` is a `FactsHost` with no cast; never called. */
export const scanFigma = (): Promise<FileFactsReport> => scanOpenFile(figma);
