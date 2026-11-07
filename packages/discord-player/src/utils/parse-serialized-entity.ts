import { z } from 'zod';
import { SerializationError } from '../errors.js';
import type { SerializedEntityUnion } from './serde.js';
import { cloneJSONValue } from './serialization.js';
import { versionedSchema } from './serialization-schemas.js';
import { legacyTrackSchema, legacyPlaylistSchema } from './legacy-serialization-schemas.js';

/** Validate a persistence payload and normalize legacy entities.
 * @internal
 * @param value Untrusted persistence data.
 * @returns A validated versioned entity.
 */
export function parseEntity(value: unknown): SerializedEntityUnion {
  // This preflight rejects cycles, getters and other non-JSON objects before Zod traverses them.
  const record = z.looseObject({}).parse(cloneJSONValue(value));
  const legacy = !Object.hasOwn(record, 'version') && !Object.hasOwn(record, 'data') && Object.hasOwn(record, '$type');

  try {
    const options: NonNullable<Parameters<typeof versionedSchema.parse>[1]> = {
      error: (issue) => (issue.input === undefined ? 'is required' : undefined),
    };

    if (legacy) {
      const tag = z
        .object({ $type: z.enum(['track', 'playlist'], { error: 'Unknown legacy serialized entity type.' }) })
        .parse(record, options);

      return tag.$type === 'track'
        ? legacyTrackSchema.parse(record, options)
        : legacyPlaylistSchema.parse(record, options);
    }

    z.object({
      type: z.enum(['track', 'playlist'], {
        error: (issue) => (issue.input === undefined ? 'is required' : 'Unknown serialized entity type.'),
      }),
    }).parse(record, options);

    return versionedSchema.parse(record, options);
  } catch (error) {
    if (!(error instanceof z.ZodError)) {
      throw error;
    }

    const flatten = (issue: z.core.$ZodIssue): z.core.$ZodIssue[] =>
      issue.code === 'invalid_union' ? issue.errors.flatMap((errors) => errors.flatMap(flatten)) : [issue];
    const issues = error.issues.flatMap(flatten);

    throw new SerializationError(
      issues.map((issue) => `$.${issue.path.map(String).join('.')} ${issue.message}`).join('; '),
      { cause: error },
    );
  }
}
