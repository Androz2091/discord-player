import { randomInt } from 'node:crypto';

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return Infinity;
  return Math.floor(limit);
}

/** A bounded FIFO collection. A limit of zero or Infinity means unbounded. */
export class Queue<T> implements Iterable<T> {
  /** Values held by the queue in FIFO order. Mutating this array bypasses capacity checks. */
  private items: T[] = [];
  /** Maximum retained item count, or `Infinity` for an unbounded queue. */
  private readonly limit: number;

  /**
   * Create a FIFO collection.
   * @param maxSize Maximum item count; zero, negative, and non-finite values mean unlimited.
   */
  public constructor(maxSize = Infinity) {
    this.limit = normalizeLimit(maxSize);
  }

  /** Compatibility view used by older collection consumers. */
  public get store(): T[] {
    return this.items;
  }

  /**
   * Add one value to the back of the queue.
   * @param item Value to append.
   * @returns `true` when accepted, or `false` when the queue is full.
   */
  public enqueue(item: T): boolean {
    if (this.isFull()) return false;
    this.items.push(item);
    return true;
  }

  /** Remove and return the oldest value. */
  public dequeue(): T | undefined {
    return this.items.shift();
  }

  /** Alias for {@link Queue.dequeue}. */
  public dispatch(): T | undefined {
    return this.dequeue();
  }

  /**
   * Add as many values as fit and return the number accepted.
   * @param other Queue or array of values to append.
   * @returns Number of values accepted under the capacity limit.
   */
  public merge(other: Queue<T> | readonly T[]): number {
    const values = other instanceof Queue ? other.toArray() : Array.from(other);
    const accepted = Number.isFinite(this.limit) ? values.slice(0, Math.max(0, this.limit - this.size)) : values;
    this.items.push(...accepted);
    return accepted.length;
  }

  /**
   * Add one value or a batch of values.
   * @param item Value or readonly batch to append.
   * @returns Number of accepted values.
   */
  public add(item: T | readonly T[]): number {
    return Array.isArray(item) ? this.merge(item) : Number(this.enqueue(item as T));
  }

  /** Return the oldest value without removing it. */
  public peek(): T | undefined {
    return this.items[0];
  }

  /**
   * Return the value at an array-style index without removing it.
   * @param index Zero-based index; negative values count from the end.
   */
  public at(index: number): T | undefined {
    return this.items.at(index);
  }

  /** Number of values currently stored. */
  public get size(): number {
    return this.items.length;
  }

  /** Configured item limit, or `Infinity` when unbounded. */
  public get maxSize(): number {
    return this.limit;
  }

  /** Remove every value. */
  public clear(): void {
    this.items = [];
  }

  /** Whether this queue contains no values. */
  public isEmpty(): boolean {
    return this.items.length === 0;
  }

  /** Whether this queue has reached a finite capacity limit. */
  public isFull(): boolean {
    return Number.isFinite(this.limit) && this.items.length >= this.limit;
  }

  /** Remaining capacity, or `Infinity` when unbounded. */
  public getCapacity(): number {
    return Number.isFinite(this.limit) ? Math.max(0, this.limit - this.size) : Infinity;
  }

  /**
   * Insert a value or batch at a FIFO index, accepting only values that fit.
   * @param values Value or readonly batch to insert.
   * @param index Zero-based insertion index, from zero through the current size.
   * @returns Number of values inserted.
   */
  public insert(values: T | readonly T[], index = 0): number {
    if (!Number.isInteger(index) || index < 0 || index > this.size) {
      throw new RangeError(`Queue index must be an integer between 0 and ${this.size}.`);
    }
    const incoming = Array.isArray(values) ? Array.from(values) : [values as T];
    const accepted = incoming.slice(0, this.getCapacity());
    this.items.splice(index, 0, ...accepted);
    return accepted.length;
  }

  /**
   * Remove the first value equal to `item`.
   * @param item Value to remove.
   * @returns `true` when a value was removed.
   */
  public remove(item: T): boolean {
    const index = this.items.indexOf(item);
    if (index < 0) return false;
    this.items.splice(index, 1);
    return true;
  }

  /**
   * Remove the value at an index.
   * @param index Zero-based index to remove.
   * @returns Removed value, or `undefined` when the index is invalid.
   */
  public removeAt(index: number): T | undefined {
    if (!Number.isInteger(index) || index < 0 || index >= this.size) return undefined;
    return this.items.splice(index, 1)[0];
  }

  /**
   * Move an existing value to another queue index.
   * @param from Index of the value to move.
   * @param to Destination index after removal.
   * @returns `true` when both indexes were valid.
   */
  public move(from: number, to: number): boolean {
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 0 ||
      from >= this.size ||
      to < 0 ||
      to >= this.size
    ) {
      return false;
    }
    const [value] = this.items.splice(from, 1);
    this.items.splice(to, 0, value!);
    return true;
  }

  /**
   * Exchange values at two indexes.
   * @param left First index.
   * @param right Second index.
   * @returns `true` when both indexes were valid.
   */
  public swap(left: number, right: number): boolean {
    if (left < 0 || left >= this.size || right < 0 || right >= this.size) return false;
    [this.items[left], this.items[right]] = [this.items[right]!, this.items[left]!];
    return true;
  }

  /** Randomize item order in place using Fisher-Yates shuffling. */
  public shuffle(): void {
    for (let index = this.items.length - 1; index > 0; index--) {
      const target = randomInt(index + 1);
      [this.items[index], this.items[target]] = [this.items[target]!, this.items[index]!];
    }
  }

  /**
   * Find the first value matching a predicate.
   * @param predicate Test applied to each value in FIFO order.
   */
  public find(predicate: (item: T) => boolean): T | undefined {
    return this.items.find(predicate);
  }
  /**
   * Return all values matching a predicate.
   * @param predicate Test applied to each value in FIFO order.
   */
  public filter(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate);
  }
  /**
   * Map values in FIFO order.
   * @param callback Mapping function applied to each value.
   */
  public map<U>(callback: (item: T) => U): U[] {
    return this.items.map(callback);
  }
  /**
   * Visit values in FIFO order.
   * @param callback Function called for each value.
   */
  public forEach(callback: (item: T) => void): void {
    this.items.forEach(callback);
  }
  /**
   * Test whether any value matches a predicate.
   * @param predicate Test applied to each value in FIFO order.
   */
  public some(predicate: (item: T) => boolean): boolean {
    return this.items.some(predicate);
  }
  /**
   * Test whether every value matches a predicate.
   * @param predicate Test applied to each value in FIFO order.
   */
  public every(predicate: (item: T) => boolean): boolean {
    return this.items.every(predicate);
  }
  /**
   * Find the first index of a value.
   * @param item Value to find.
   */
  public indexOf(item: T): number {
    return this.items.indexOf(item);
  }
  /** Copy values into a new array in FIFO order. */
  public toArray(): T[] {
    return Array.from(this.items);
  }
  /** Iterate over values in FIFO order. */
  public [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]();
  }
}
