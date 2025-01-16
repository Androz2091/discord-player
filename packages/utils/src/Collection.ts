import { Collection as CollectionNative } from '@discordjs/collection';

export class Collection<K = unknown, V = unknown> extends CollectionNative<
  K,
  V
> {
  #array!: V[] | null;

  /**
   * @returns {Array<V>} Array of this collection
   */
  public array(): V[] {
    if (this.#array) return this.#array;
    this.#array = [...this.values()];
    return this.#array;
  }

  public set(key: K, value: V): this {
    this.#array = null;
    super.set(key, value);
    return this;
  }

  public delete(key: K): boolean {
    this.#array = null;
    return super.delete(key);
  }
}
