import { addAbortListener } from 'node:events';
import { readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

/** A regular file found beneath the configured music directory. */
export interface MusicFile {
  /** Canonical absolute path opened by the embedded media engine. */
  path: string;

  /** Portable location relative to MUSIC_DIRECTORY. */
  relativePath: string;
}

// These filesystem APIs do not accept AbortSignal. Stop waiting promptly while
// still observing the underlying promise if it finishes after cancellation.
async function abortable<T>(signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
  signal.throwIfAborted();

  let rejectAbort!: (reason: unknown) => void;
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  using _listener = addAbortListener(signal, () => rejectAbort(signal.reason));
  const result = await Promise.race([operation(), aborted]);

  signal.throwIfAborted();

  return result;
}

async function musicDirectory(signal: AbortSignal): Promise<string | null> {
  const configured = process.env.MUSIC_DIRECTORY?.trim();

  if (!configured) {
    return null;
  }

  const directory = await abortable(signal, () => realpath(resolve(configured)));
  const info = await abortable(signal, () => stat(directory));

  return info.isDirectory() ? directory : null;
}

function isWithin(directory: string, file: string): boolean {
  const location = relative(directory, file);

  return location !== '..' && !location.startsWith(`..${sep}`) && !isAbsolute(location);
}

function normalizeFilename(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/** Search regular files recursively by normalized relative filename.
 * Matching ignores symbols, punctuation, whitespace, case and accents. Exact relative paths take precedence.
 * Symlinks are skipped. Unconfigured, missing or unreadable directories return no matches.
 * @param query Filename or relative-path substring; empty text matches every regular file.
 * @param signal Cancellation propagated by the source host.
 * @returns Matching files in stable relative-path order.
 */
export async function searchMusicFiles(query: string, signal: AbortSignal): Promise<MusicFile[]> {
  signal.throwIfAborted();

  try {
    const directory = await musicDirectory(signal);

    if (!directory) {
      return [];
    }

    const pending = [directory];
    const files: MusicFile[] = [];
    const needle = normalizeFilename(query);

    while (pending.length) {
      signal.throwIfAborted();

      const current = pending.pop()!;
      const entries = await abortable(signal, () => readdir(current, { withFileTypes: true }));

      for (const entry of entries) {
        signal.throwIfAborted();

        if (entry.name.startsWith('.')) {
          continue;
        }

        const file = resolve(current, entry.name);

        if (entry.isDirectory()) {
          pending.push(file);
        } else if (entry.isFile()) {
          const relativePath = relative(directory, file).split(sep).join('/');

          if (normalizeFilename(relativePath).includes(needle)) {
            files.push({ path: file, relativePath });
          }
        }
      }
    }

    const exact = files.find((file) => file.relativePath === query.trim());

    if (exact) {
      return [exact];
    }

    return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  } catch {
    signal.throwIfAborted();

    return [];
  }
}

/** Revalidate a portable local source before handing its path to Remedia.
 * @param location File location relative to MUSIC_DIRECTORY.
 * @param signal Cancellation propagated by the source host.
 * @returns A canonical regular-file path inside the configured directory, or null when unavailable.
 */
export async function resolveMusicFile(location: string, signal: AbortSignal): Promise<string | null> {
  signal.throwIfAborted();

  try {
    const directory = await musicDirectory(signal);

    if (!directory || isAbsolute(location)) {
      return null;
    }

    const file = await abortable(signal, () => realpath(resolve(directory, location)));

    if (!isWithin(directory, file)) {
      return null;
    }

    const info = await abortable(signal, () => stat(file));

    return info.isFile() ? file : null;
  } catch (e) {
    console.error(e);
    signal.throwIfAborted();

    return null;
  }
}
