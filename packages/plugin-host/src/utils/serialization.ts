import { SerializationError } from '../errors.js';

/** JSON scalar value accepted by Discord Player persistence payloads. */
export type JSONPrimitive = string | number | boolean | null;

/** Deep JSON-compatible value accepted by the serialization contract. */
export type JSONValue = JSONPrimitive | JSONValue[] | { [key: string]: JSONValue };

/** Current Discord Player serialization schema version, independent of package versions. */
export const SERIALIZATION_SCHEMA_VERSION = 1 as const;

/** A versioned, discriminated serialized entity. */
export type SerializedEntity<
  /** Stable entity discriminator. */
  Type extends string,
  /** JSON-compatible entity payload. */
  Data extends JSONValue,
  /** Persistence schema version for the entity payload. */
  Version extends number = number,
> = {
  /** Entity discriminator used by the decoder. */
  type: Type;

  /** Persistence schema version, independent of the package release. */
  version: Version;

  /** Public model data needed to reconstruct the entity. */
  data: Data;
};

/** Structural contract implemented by models that can produce a persistence payload. */
export interface Serializable<T extends SerializedEntity<string, JSONValue>> {
  /** Convert this model to a versioned JSON-compatible persistence payload. */
  serialize(): T;
}

/**
 * Validate and clone an unknown value into JSON-safe data.
 * Only primitives, dense arrays, and plain objects with data properties are accepted.
 * @param value Value to validate and clone.
 * @param path Location used in validation errors.
 * @returns A detached JSON-compatible copy of the value.
 */
export function cloneJSONValue(value: unknown, path = '$'): JSONValue {
  const ancestors = new WeakSet<object>();

  const visit = (current: unknown, currentPath: string): JSONValue => {
    if (current === null || typeof current === 'string' || typeof current === 'boolean') return current;

    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw new SerializationError(`${currentPath} must be a finite number.`);

      return current;
    }

    if (typeof current !== 'object') {
      throw new SerializationError(`${currentPath} contains an unsupported ${typeof current} value.`);
    }

    if (ancestors.has(current)) throw new SerializationError(`${currentPath} contains a circular reference.`);

    ancestors.add(current);

    try {
      if (Array.isArray(current)) {
        const keys = Reflect.ownKeys(current);

        if (
          keys.length !== current.length + 1 ||
          keys.some((key) => key !== 'length' && !isArrayIndex(key, current.length))
        ) {
          throw new SerializationError(`${currentPath} must be a dense array without custom properties.`);
        }

        const copy: JSONValue[] = [];

        for (let index = 0; index < current.length; index++) {
          const descriptor = Object.getOwnPropertyDescriptor(current, String(index));

          if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
            throw new SerializationError(`${currentPath}[${index}] must be an enumerable array value.`);
          }

          copy.push(visit(descriptor.value, `${currentPath}[${index}]`));
        }

        return copy;
      }

      const prototype = Object.getPrototypeOf(current);

      if (prototype !== Object.prototype && prototype !== null) {
        throw new SerializationError(`${currentPath} must be a plain object.`);
      }

      const copy: Record<string, JSONValue> = {};

      for (const key of Reflect.ownKeys(current)) {
        if (typeof key !== 'string') throw new SerializationError(`${currentPath} cannot contain symbol keys.`);

        const descriptor = Object.getOwnPropertyDescriptor(current, key);

        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
          throw new SerializationError(`${currentPath}.${key} must be an enumerable data property.`);
        }

        Object.defineProperty(copy, key, {
          value: visit(descriptor.value, `${currentPath}.${key}`),
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }

      return copy;
    } finally {
      ancestors.delete(current);
    }
  };

  try {
    return visit(value, path);
  } catch (error) {
    if (error instanceof SerializationError) throw error;

    throw new SerializationError(`${path} could not be validated as JSON-safe data.`, { cause: error });
  }
}

function isArrayIndex(key: string | symbol, length: number): key is string {
  if (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key)) return false;

  const index = Number(key);

  return Number.isSafeInteger(index) && index >= 0 && index < length;
}
