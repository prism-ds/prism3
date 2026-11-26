/**
 * Prism3 engine — is this module the process's entry point, and where is the real temp root? (#4583, #4586)
 *
 * NOT CORE: it reads the filesystem (`realpathSync`), so it is a shell helper, like the scripts that call it.
 *
 * THE ENTRY GUARD (#4583). A script that both exports functions and runs a check when executed directly asks "am I the
 * file node was started with?". The old guard asked it as `resolve(process.argv[1]) === fileURLToPath(import.meta.url)`.
 * The two sides are not the same kind of path:
 *   - `process.argv[1]` is the path as it was TYPED (or spawned): `/var/folders/…/x.ts` on macOS, through the `/var`
 *     symlink, or `/tmp/p3-lane/…` through `/tmp`;
 *   - `import.meta.url` is the path V8 LOADED, which is the real one: `/private/var/folders/…/x.ts`.
 * So any run through a symlinked path read "not the entry point", skipped the whole check and exited 0: a silent pass
 * (`docs/34`). Linux has no such symlink under its temp root, so CI never saw it. `isEntry` compares the real paths of
 * both sides, so a symlink anywhere in either path no longer decides the answer.
 *
 * It never answers "no" for a run that is the entry point: when `argv[1]` names this module's own file by its real
 * path, or names it with the extension left off, it is. When `argv[1]` is missing, or names a file that does not exist
 * even with this module's extension (an import from a REPL, `node -e`), it is not. And when `argv[1]` has this module's file name but is a DIFFERENT real file, it throws by name rather than
 * skip the check: that is the shape of the bug this replaces, and a guess either way would hide it.
 *
 * THE TEMP ROOT (#4586). `tmpdir()` returns the root as the environment spells it, unresolved. A path made under it and
 * later compared with a path the runtime reports (a module URL, a resolved package path, a `realpath`) never matches on
 * macOS. `realTmpdir()` is that root's real path, so every path made under it is already the path the runtime reports.
 */
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The real path of a file, or null when it does not exist. */
const real = (p: string): string | null => {
  try { return realpathSync(p); } catch { return null; }
};

/** True when the module at `metaUrl` (pass `import.meta.url`) is the file node was started with.
 *
 *  A run with the extension left off (`npx tsx packages/engine/regen --check`) is loaded as `regen.ts`, but `argv[1]`
 *  stays the extensionless path, which names no file. Read as "a file that does not exist", it skipped the check and
 *  exited 0 having printed nothing (#4602 review). So a missing `argv[1]` is tried again with this module's own
 *  extension, and is then held like any other run: the entry point, or a different file of this name, which throws. */
export const isEntry = (metaUrl: string, argv1: string | undefined = process.argv[1]): boolean => {
  if (!argv1) return false;
  const self = real(fileURLToPath(metaUrl));
  if (self === null) return false;
  const typed = resolve(argv1);
  const started = real(typed) ?? (extname(typed) === extname(self) ? null : real(typed + extname(self)));
  if (started === null) return false;
  if (self === started) return true;
  if (basename(self) === basename(started)) {
    throw new Error(`entry guard (#4583): node was started with ${started}, which has this module's name but is not this module (${self}); refusing to guess whether to run the check`);
  }
  return false;
};

/** The temp root's real path (#4586): what `tmpdir()` names, with every symlink in it resolved. */
export const realTmpdir = (): string => realpathSync(tmpdir());
