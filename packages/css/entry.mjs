/**
 * #4583: is the calling module the file node was started with? Real paths on both sides, so a symlinked path (macOS's
 * /var and /tmp) cannot make a direct run skip its check. The engine's `isEntry` (entry-point.ts), inline here because
 * this package reads emitted files and never imports the engine's code (Q142 A). Plain node, so `.mjs`.
 */
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function isEntry(metaUrl) {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(metaUrl)); } catch { return false; }
}
