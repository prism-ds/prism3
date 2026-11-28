/**
 * The CLIENT DENY-LIST (#1824, #4645): the one place in this repo where client names and ids are written on purpose.
 *
 * Two gates read it, and both read THIS constant, never a copy:
 *
 *   - `lint-voice.ts` reads `names`, over the three built bundles and every rendered personality note (#1824).
 *     It does not read `ids`: the bundles inline the engine, and the engine still carries the fixture ids until
 *     #4645's later phases rename them.
 *   - `lint-client-ids.ts` reads all three lists, over every tracked file's path and contents, as a ratchet (#4645).
 *
 * Sharing the list between the two gates is not a docs/34 breach. The list is each gate's ORACLE, and each gate's
 * SUBJECT (the bundles, the tree) is independent of it.
 *
 * ADDING A NAME (owner decision Q6 A on #4645). The repo is public, so a name written here is a name published.
 * `names` and `ids` hold only what was already public when the gate landed. Every further client name goes in
 * `hashes` as the SHA-256 of its normalized form, so this file never spells it out. Print the line to paste with
 *
 *   npx tsx packages/engine/lint-client-ids.ts --hash "<the name>"
 *
 * which writes nothing. The normalization is `normalizeWords` in `lint-client-ids.ts`: lowercased, curly apostrophes
 * made straight, split into words of letters and digits (an apostrophe inside a word stays) and again at case
 * boundaries (`fooBar`, `FOOBar`), joined by one space. `words` is how many words the name has, so the gate knows
 * which phrase lengths to hash. A name of two or more words also carries `joined`, the SHA-256 of its words run
 * together with no space, so a run-together identifier (`foobar`, `FOOBAR`, `foobarTheme`) is found too. The gate
 * fails a multi-word entry whose `joined` is missing or equal to `sha256`, so paste the whole line `--hash` prints.
 * Type each name in its brand casing when running `--hash` (`FooBar`, not `foobar`): a capital inside the name
 * becomes a word boundary, so the entry matches the brand's spelling phrase by phrase, not only through a rejoin.
 */

export type DenyPattern = { name: string; re: RegExp };
export type DenyHash = { sha256: string; words: number; joined?: string };

export const CLIENT_DENY_LIST: { names: DenyPattern[]; ids: DenyPattern[]; hashes: DenyHash[] } = {
  // The full display names, as `lint-voice.ts` has held them since #1824. Each pattern is anchored at a word start so
  // a longer word cannot hide it. The two-word name matches only in its brand casing or as a slug, because the
  // lower-case phrase is ordinary English.
  names: [
    { name: 'wendy', re: /\bwendy/gi }, // wendys, Wendy's, and the bundle's escaped `Wendy\u2019s`
    { name: 'new balance', re: /\bNew[\s-]?Balance\b|\bNEW[\s-]?BALANCE\b|\bnew-?balance\b/g },
    { name: 'nb-redesign', re: /\bnb-redesign\b/gi },
  ],
  // The fixture ids #4645 names, matched only where they read as ids. The two-letter id is matched in id positions
  // alone (quoted, a path segment, an emitted file name, a fixture word, the theme's identifiers), because it is also
  // a common local variable (`const nb = box(x)`) and a prefix of ordinary words (`nbsp`). The proposal's §1.1 lists
  // the positions.
  ids: [
    { name: 'wendys', re: /\bwendys/gi },
    { name: 'nbds', re: /\bnbds/gi },
    { name: 'nb', re: /(['"`])nb\1|\/nb\/|\bnb\.(?:[a-z][a-z-]*\.)*(?:json|css|md)\b|\bnb-(?:regression|fixture|measured|redesign)|\bnbTheme\b|\btheme-nb\b/g },
  ],
  // SHA-256 of each further client name, normalized as the header says. None yet.
  hashes: [],
};
