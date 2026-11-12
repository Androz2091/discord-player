import { z } from 'zod';
import type { Track } from './structures/track.js';
import type { ProviderReference } from './plugins/types.js';
import type { PluginRegistry } from './plugins/registry.js';
import type { JSONValue } from './utils/serialization.js';

/** One normalized synchronized lyric line. */
export interface LyricsLine {
  /** Position in the source timeline, in milliseconds. */
  timestampMs: number;
  /** Text displayed from this timestamp until the next line. */
  line: string;
}

/** Provider-neutral lyrics record; either representation may be absent. */
export interface LyricsResult {
  /** Canonical Track ID when lookup used Track input, preventing stale queue loads. */
  trackId?: string;
  /** Stable provider identity, stamped by dispatch when absent. */
  provider?: ProviderReference;
  /** Plain text availability and contents. */
  plain: { available: false } | { available: true; text: string };
  /** Synchronized representation, sorted by timestamp. */
  synced: { available: false } | { available: true; lines: readonly LyricsLine[] };
  /** Optional provider-owned, serializable metadata. */
  metadata?: JSONValue;
}

/** Validate provider-neutral records crossing a process boundary. @internal */
export const lyricsResultSchema = z.strictObject({
  trackId: z.string().optional(),
  provider: z.strictObject({ pluginId: z.string().min(1), hostId: z.string().optional(), data: z.json() }).optional(),
  plain: z.discriminatedUnion('available', [
    z.strictObject({ available: z.literal(false) }),
    z.strictObject({ available: z.literal(true), text: z.string() }),
  ]),
  synced: z.discriminatedUnion('available', [
    z.strictObject({ available: z.literal(false) }),
    z.strictObject({
      available: z.literal(true),
      lines: z.array(z.strictObject({ timestampMs: z.number().nonnegative(), line: z.string() })),
    }),
  ]),
  metadata: z.json().optional(),
});

/** Normalize and validate a lyrics record once, including sorted synchronized timestamps.
 * @param result Provider record.
 * @returns Validated record with duplicate timestamps resolved deterministically.
 */
export function normalizeLyrics(result: LyricsResult): LyricsResult {
  const value = lyricsResultSchema.parse(result);
  const normalized: LyricsResult = {
    plain: value.plain,
    synced: value.synced,
    ...(value.trackId === undefined ? {} : { trackId: value.trackId }),
    ...(value.metadata === undefined ? {} : { metadata: value.metadata }),
    ...(value.provider
      ? {
          provider: {
            pluginId: value.provider.pluginId,
            data: value.provider.data,
            ...(value.provider.hostId === undefined ? {} : { hostId: value.provider.hostId }),
          },
        }
      : {}),
  };
  if (!value.synced.available) return normalized;
  const lines = new Map(value.synced.lines.map((line) => [line.timestampMs, line.line]));
  return {
    ...normalized,
    synced: {
      available: true,
      lines: [...lines].sort(([a], [b]) => a - b).map(([timestampMs, line]) => ({ timestampMs, line })),
    },
  };
}

/** Lookup input shared by local plugins and HTTP metadata transport. */
export interface LyricsRequest {
  /** Caller input. Remote transport serializes Tracks before delivery. */
  input: Track | string;
}

/** Parse LRC once, including multiple timestamps and decimal-second fractions.
 * @param text LRC text.
 * @returns Sorted normalized lines, with the last line winning duplicate timestamps.
 */
export function parseLyrics(text: string): LyricsLine[] {
  const lines = new Map<number, string>();
  const offset = Number(/\[offset:([+-]?\d+)\]/i.exec(text)?.[1] ?? 0);

  for (const row of text.split(/\r?\n/)) {
    const matches = [...row.matchAll(/\[(\d+):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    const line = row.replace(/\[\d+:\d{2}(?:\.\d{1,3})?\]/g, '').trim();

    for (const match of matches) {
      const seconds = Number(match[2]);

      if (seconds >= 60) continue;

      const timestampMs = Number(match[1]) * 60000 + seconds * 1000 + Number((match[3] ?? '').padEnd(3, '0')) + offset;

      if (Number.isFinite(timestampMs) && timestampMs >= 0) lines.set(timestampMs, line);
    }
  }

  return [...lines].sort(([a], [b]) => a - b).map(([timestampMs, line]) => ({ timestampMs, line }));
}

/** Resolve lyrics through the same operation registry as source metadata.
 * @param plugins Shared registry.
 * @param input Track or raw query.
 * @param signal Caller lifetime.
 * @returns Results in provider priority order, preferring explicit and source affinity.
 */
export async function searchLyrics(
  plugins: PluginRegistry,
  input: Track | string,
  signal?: AbortSignal,
): Promise<LyricsResult[]> {
  signal?.throwIfAborted();
  await plugins.ready();

  const providers = plugins.providers('lyrics.search');
  const preferred = typeof input === 'string' ? [] : [input.lyricsReference, input.sourceReference];
  const ordered = [...providers];
  for (const reference of preferred.reverse()) {
    if (!reference) continue;
    const index = ordered.findIndex(
      (provider) =>
        provider.pluginId === reference.pluginId && (!reference.hostId || provider.hostId === reference.hostId),
    );
    if (index >= 0) ordered.unshift(...ordered.splice(index, 1));
  }
  const results: LyricsResult[] = [];
  const seen = new Set<string>();

  for (const provider of ordered) {
    const groups = await plugins.execute(
      'lyrics.search',
      { input },
      { pluginId: provider.pluginId, hostId: provider.hostId ?? null, signal },
    );

    for (const result of groups.flatMap((group) => group ?? [])) {
      const normalized = normalizeLyrics({
        ...result,
        ...(typeof input === 'string' ? {} : { trackId: input.id }),
        provider: { ...provider, data: result.provider?.data ?? null },
      });
      const key = JSON.stringify([normalized.plain, normalized.synced]);

      if ((!normalized.plain.available && !normalized.synced.available) || seen.has(key)) continue;

      seen.add(key);
      results.push(normalized);
    }
  }

  return results;
}
