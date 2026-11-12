/** Options for {@link Store}. */
export interface StoreOptions {
  /** Maximum number of entries. */
  capacity?: number;
}

/**
 * Keeps values by key.
 *
 * @remarks Stores are not thread safe; every instance owns its entries.
 * @typeParam T - Stored value type.
 */
export class Store<T> {
  /** Number of stored entries. */
  readonly size: number = 0;

  /** Private details never appear in documentation. */
  private secret = 1;

  /**
   * Create a store.
   * @param options - Store configuration.
   */
  constructor(options?: StoreOptions) {
    void options;
  }

  /**
   * Read a value by key.
   *
   * @param key - Lookup key.
   * @returns The value, or undefined when missing.
   * @throws RangeError when the key is empty.
   * @example
   * ```ts
   * const store = new Store<number>();
   * store.get('a');
   * ```
   * @see {@link Store.set}
   */
  get(key: string): T | undefined;
  /**
   * Read several values at once.
   *
   * @param keys - Lookup keys.
   * @returns Values in key order.
   */
  get(keys: string[]): (T | undefined)[];
  get(key: string | string[]): T | undefined | (T | undefined)[] {
    void key;

    return undefined;
  }

  /**
   * Store a value.
   * @param key - Key.
   * @param value - Value.
   * @deprecated Use {@link Store.get} patterns instead.
   */
  set(key: string, value: T): void {
    void key;
    void value;
  }

  /** @internal */
  debug(): void {}
}
