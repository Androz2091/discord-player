import { z } from 'zod';
import { SERIALIZATION_SCHEMA_VERSION } from './serialization.js';

/** Shared finite non-negative numeric constraint. */
export const nonNegative = z.number().nonnegative();

const sourceReferenceSchema = z.strictObject({
  pluginId: z.string(),
  hostId: z.string().min(1).max(128).optional(),
  nodeId: z.string().min(1).optional(),
  data: z.json(),
});

const authorSchema = z.strictObject({ name: z.string(), url: z.string() });

const trackDataSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  description: z.string(),
  url: z.string(),
  thumbnail: z.string(),
  durationMS: nonNegative,
  views: nonNegative,
  requestedBy: z.string().nullable(),
  source: z.string(),
  live: z.boolean(),
  metadata: z.json(),
  sourceReference: sourceReferenceSchema.optional(),
  lyricsReference: sourceReferenceSchema.optional(),
});

/** Strict versioned Track persistence schema. */
export const trackSchema = z.strictObject({
  type: z.literal('track'),
  version: z.literal(SERIALIZATION_SCHEMA_VERSION, { error: 'Unsupported track serialization schema version.' }),
  data: trackDataSchema,
});

const playlistSchema = z.strictObject({
  type: z.literal('playlist'),
  version: z.literal(SERIALIZATION_SCHEMA_VERSION, { error: 'Unsupported playlist serialization schema version.' }),
  data: z.strictObject({
    id: z.string(),
    url: z.string(),
    title: z.string(),
    description: z.string(),
    thumbnail: z.string(),
    type: z.enum(['album', 'playlist']),
    source: z.string(),
    author: authorSchema,
    tracks: z.array(trackSchema),
  }),
});

/** Supported versioned persistence entities. */
export const versionedSchema = z.discriminatedUnion('type', [trackSchema, playlistSchema]);
