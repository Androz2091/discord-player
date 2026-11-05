import { randomInt } from 'node:crypto';

/** A bounded LIFO collection. Zero and Infinity mean unbounded. */
export class Stack<T> implements Iterable<T> {
  /** Values held by the stack from oldest to newest. */
  private items: T[] = [];
  /** Maximum retained item count, or `Infinity` for an unbounded stack. */
  private limit: number;

  /**
   * Create a LIFO collection.
   * @param maxSize Maximum retained item count; zero, negative, and non-finite values mean unlimited.
   */
  public constructor(maxSize = Infinity) {
    this.limit = Number.isFinite(maxSize) && maxSize > 0 ? Math.floor(maxSize) : Infinity;
  }

  /** Compatibility view used by the v7 queue history manager. */
  public get store(): T[] {
    return this.items;
  }

  /**
   * Push a value onto the top of the stack, discarding the oldest value if a finite limit is full.
   * @param item Value to push.
   */
  public push(item: T): void {
    if (Number.isFinite(this.limit) && this.items.length >= this.limit) this.items.shift();
    this.items.push(item);
  }

  /**
   * Push one value or each value in a batch in order.
   * @param item Value or readonly batch to push.
   */
  public add(item: T | readonly T[]): void {
    if (Array.isArray(item)) {
      for (const value of item) this.push(value);
    } else {
      this.push(item as T);
    }
  }

  /** Remove and return the newest value. */
  public pop(): T | undefined {
    return this.items.pop();
  }
  /** Alias for {@link Stack.pop}. */
  public dispatch(): T | undefined {
    return this.pop();
  }
  /** Return the newest value without removing it. */
  public peek(): T | undefined {
    return this.items.at(-1);
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

  /**
   * Change the retention limit and discard oldest values if needed.
   * @param maxSize Maximum retained item count; zero, negative, and non-finite values mean unlimited.
   */
  public setMaxSize(maxSize: number): void {
    this.limit = Number.isFinite(maxSize) && maxSize > 0 ? Math.floor(maxSize) : Infinity;
    if (Number.isFinite(this.limit) && this.items.length > this.limit) {
      this.items.splice(0, this.items.length - this.limit);
    }
  }

  /** Remove every value. */
  public clear(): void {
    this.items = [];
  }
  /** Whether this stack contains no values. */
  public isEmpty(): boolean {
    return this.items.length === 0;
  }
  /** Whether this stack has reached a finite capacity limit. */
  public isFull(): boolean {
    return Number.isFinite(this.limit) && this.items.length >= this.limit;
  }
  /**
   * Find the first value matching a predicate.
   * @param predicate Test applied to values from oldest to newest.
   */
  public find(predicate: (item: T) => boolean): T | undefined {
    return this.items.find(predicate);
  }
  /**
   * Return all values matching a predicate.
   * @param predicate Test applied to values from oldest to newest.
   */
  public filter(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate);
  }
  /**
   * Map values from oldest to newest.
   * @param callback Mapping function applied to each value.
   */
  public map<U>(callback: (item: T) => U): U[] {
    return this.items.map(callback);
  }
  /**
   * Visit values from oldest to newest.
   * @param callback Function called for each value.
   */
  public forEach(callback: (item: T) => void): void {
    this.items.forEach(callback);
  }
  /**
   * Test whether any value matches a predicate.
   * @param predicate Test applied to values from oldest to newest.
   */
  public some(predicate: (item: T) => boolean): boolean {
    return this.items.some(predicate);
  }
  /**
   * Test whether every value matches a predicate.
   * @param predicate Test applied to values from oldest to newest.
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

  /** Return one random value. */
  public random(): T | undefined;
  /**
   * Return a sample of random values with replacement.
   * @param count Number of values to sample; must be a non-negative integer.
   */
  public random(count: number): T[];
  /**
   * Return a random value or a sample with replacement.
   * @param count Optional sample size; omitted to return one value.
   */
  public random(count?: number): T | T[] | undefined {
    if (this.isEmpty()) return count === undefined ? undefined : [];
    if (count === undefined) return this.items[randomInt(this.items.length)];
    if (!Number.isInteger(count) || count < 0) throw new RangeError('count must be a non-negative integer.');
    return Array.from({ length: count }, () => this.items[randomInt(this.items.length)]!);
  }

  /** Copy values into a new array from oldest to newest. */
  public toArray(): T[] {
    return Array.from(this.items);
  }
  /** Iterate over values from oldest to newest. */
  public [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]();
  }
}
