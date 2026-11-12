import { Store } from './store.js';

export { Store } from './store.js';
export type { StoreOptions } from './store.js';
export { Store as AliasedStore } from './store.js';
export * from './options.js';

/** A value that may be produced later. */
export type Later<T> = Promise<Map<string, T>>;

/** Helper that is deliberately hidden from the public API. */
export const visible = 1;

/** @internal */
export function internalHelper(): void {}

/** Not exported from the entry point, but referenced by a public signature. */
interface Hidden {
  secret: string;
}

/** Uses a type that is not exported. */
export function leak(value: Hidden): void {
  void value;
}

/** A store that bounds how much it keeps. Inherits `get` and overrides `set`. */
export class LimitedStore<T> extends Store<T> {
  /** Entries kept before the oldest is dropped. */
  limit = 8;

  /**
   * Store a value, dropping the oldest entry when full.
   * @param key - Key.
   * @param value - Value.
   */
  override set(key: string, value: T): void {
    super.set(key, value);
  }
}
