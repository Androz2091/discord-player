import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SerializedTrack } from '../structures/track.js';
import type { SerializedPlaylist } from '../structures/playlist.js';
import { SERIALIZATION_SCHEMA_VERSION } from './serialization.js';
import { nonNegative, trackSchema } from './serialization-schemas.js';

const requesterSchema = z
  .union([
    z.string(),
    z.object({ id: z.string({ error: 'Requester objects must have a string id.' }) }).transform((value) => value.id),
  ])
  .nullish()
  .transform((value) => value ?? null);

const legacyDurationSchema = z
  .string()
  .regex(/^(?:\d+(?:\.\d+)?(?::\d+(?:\.\d+)?){0,2})?$/, 'Unsupported legacy duration.')
  .transform((value) =>
    Math.round(value ? value.split(':').reduce((total, part) => total * 60 + Number(part), 0) * 1000 : 0),
  )
  .pipe(nonNegative);

/** Legacy Track validation and migration. */
export const legacyTrackSchema = z
  .object({
    $type: z.literal('track'),
    id: z.string().optional(),
    title: z.string(),
    author: z.string(),
    description: z.string(),
    url: z.string(),
    thumbnail: z
      .string()
      .nullish()
      .transform((value) => value ?? ''),
    duration: z.string().optional(),
    durationMS: nonNegative.optional(),
    views: nonNegative,
    requested_by: requesterSchema,
    requestedBy: requesterSchema,
    source: z.string().optional(),
    extractor: z.string().optional(),
    live: z.boolean().optional(),
    metadata: z.json().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.source === undefined && data.extractor === undefined) {
      ctx.addIssue({ code: 'custom', path: ['source'], message: 'source is required.' });
    }

    if (data.durationMS === undefined && data.duration === undefined) {
      ctx.addIssue({ code: 'custom', path: ['duration'], message: 'duration is required when durationMS is absent.' });
    }
  })
  .transform((data, ctx): SerializedTrack => {
    const live = data.live === true || data.duration?.toUpperCase() === 'LIVE';
    const duration = data.durationMS ?? (live ? 0 : legacyDurationSchema.safeParse(data.duration ?? ''));

    if (typeof duration !== 'number' && !duration.success) {
      for (const issue of duration.error.issues) {
        ctx.addIssue({ code: 'custom', path: ['duration'], message: issue.message });
      }

      return z.NEVER;
    }

    return {
      type: 'track',
      version: SERIALIZATION_SCHEMA_VERSION,
      data: {
        id: data.id ?? randomUUID(),
        title: data.title,
        author: data.author,
        description: data.description,
        url: data.url,
        thumbnail: data.thumbnail,
        durationMS: typeof duration === 'number' ? duration : duration.data,
        views: data.views,
        requestedBy: data.requested_by ?? data.requestedBy,
        source: data.source ?? data.extractor!,
        live,
        metadata: data.metadata ?? null,
      },
    };
  });

/** Legacy Playlist validation and migration. */
export const legacyPlaylistSchema = z
  .object({
    $type: z.literal('playlist'),
    id: z.string(),
    url: z.string(),
    title: z.string(),
    description: z.string(),
    thumbnail: z
      .string()
      .nullish()
      .transform((value) => value ?? ''),
    type: z.enum(['album', 'playlist']),
    source: z.string(),
    author: z.object({ name: z.string(), url: z.string() }),
    tracks: z.array(z.union([trackSchema, legacyTrackSchema])),
  })
  .transform((data): SerializedPlaylist => ({
    type: 'playlist',
    version: SERIALIZATION_SCHEMA_VERSION,
    data: {
      id: data.id,
      url: data.url,
      title: data.title,
      description: data.description,
      thumbnail: data.thumbnail,
      type: data.type,
      source: data.source,
      author: data.author,
      tracks: data.tracks,
    },
  }));
